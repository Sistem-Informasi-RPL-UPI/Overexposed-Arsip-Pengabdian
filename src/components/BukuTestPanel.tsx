"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

export interface BukuTestItem {
  id: number;
  kunci: string;
  judul: string;
  kategori: string | null;
  penulis: string | null;
  penerbit: string | null;
  tahun: number | null;
  tempat_terbit: string | null;
  isbn: string | null;
  sumber: "sinta" | "manual";
  dosenIds: number[];
}

interface FormState {
  judul: string;
  tahun: string;
  kategori: string;
  penulis: string;
  penerbit: string;
  tempat_terbit: string;
  isbn: string;
}

interface ApiFeedback {
  type: "success" | "error";
  status: number | null;
  message: string;
  extra?: string;
}

const INITIAL_FORM: FormState = {
  judul: "",
  tahun: "2026",
  kategori: "",
  penulis: "",
  penerbit: "",
  tempat_terbit: "",
  isbn: "",
};

function parseApiMessage(payload: unknown, fallback: string): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "message" in payload &&
    typeof payload.message === "string"
  ) {
    return payload.message;
  }
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }
  return fallback;
}

export function BukuTestPanel({
  items,
  canManage,
  role,
  currentDosenId,
}: {
  items: BukuTestItem[];
  canManage: boolean;
  role: string;
  currentDosenId: number | null;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<ApiFeedback | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterScope, setFilterScope] = useState<"all" | "mine">("all");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (filterScope === "mine") {
      if (currentDosenId === null || !item.dosenIds.includes(currentDosenId)) {
        return false;
      }
    }
    if (!normalizedQuery) return true;
    return (
      item.judul.toLowerCase().includes(normalizedQuery) ||
      (item.isbn ?? "").toLowerCase().includes(normalizedQuery) ||
      (item.penulis ?? "").toLowerCase().includes(normalizedQuery)
    );
  });

  function refreshData() {
    startRefresh(() => {
      router.refresh();
    });
  }

  function handleSelectEdit(item: BukuTestItem) {
    setEditingId(item.id);
    setForm({
      judul: item.judul,
      tahun: item.tahun !== null ? String(item.tahun) : "",
      kategori: item.kategori ?? "",
      penulis: item.penulis ?? "",
      penerbit: item.penerbit ?? "",
      tempat_terbit: item.tempat_terbit ?? "",
      isbn: item.isbn ?? "",
    });
    setFeedback(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(INITIAL_FORM);
    setFeedback(null);
  }

  async function submitMutation(mode: "post" | "patch") {
    if (!canManage || isSubmitting) return;
    if (mode === "patch" && editingId === null) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const targetUrl =
        mode === "patch"
          ? `/api/tridarma/buku/${editingId}`
          : "/api/tridarma/buku";

      const res = await fetch(targetUrl, {
        method: mode === "patch" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          judul: form.judul,
          tahun: form.tahun,
          kategori: form.kategori,
          penulis: form.penulis,
          penerbit: form.penerbit,
          tempat_terbit: form.tempat_terbit,
          isbn: form.isbn,
        }),
      });

      const payload = (await res.json().catch(() => null)) as {
        message?: string;
        error?: string;
        data?: { ditautkan?: boolean; id?: number; judul?: string; sumber?: string };
      } | null;

      if (!res.ok) {
        setFeedback({
          type: "error",
          status: res.status,
          message: parseApiMessage(
            payload,
            mode === "patch"
              ? "Permintaan PATCH buku gagal diproses."
              : "Permintaan POST buku gagal diproses.",
          ),
        });
        return;
      }

      const extraParts: string[] = [];
      if (payload?.data?.ditautkan) {
        extraParts.push(`ditautkan=true (id: ${payload.data.id}, judul: ${payload.data.judul})`);
      } else if (payload?.data?.id !== undefined) {
        extraParts.push(`id: ${payload.data.id}`);
        if (payload.data.sumber) {
          extraParts.push(`sumber: ${payload.data.sumber}`);
        }
      }

      setFeedback({
        type: "success",
        status: res.status,
        message: parseApiMessage(
          payload,
          mode === "patch"
            ? "Buku berhasil diperbarui."
            : "Buku berhasil ditambahkan.",
        ),
        extra: extraParts.length > 0 ? extraParts.join(", ") : undefined,
      });
      setEditingId(null);
      setForm(INITIAL_FORM);
      refreshData();
    } catch {
      setFeedback({
        type: "error",
        status: null,
        message: "Terjadi kesalahan jaringan saat mengirim data buku.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(item: BukuTestItem) {
    if (!canManage || deletingId !== null || isSubmitting) return;
    const konfirmasi = item.dosenIds.length > 1
      ? `Lepas tautan buku "${item.judul}" dari akun Anda? (Data tetap ada untuk dosen lain yang tertaut.)`
      : `Hapus buku "${item.judul}"?`;
    if (!window.confirm(konfirmasi)) return;

    setDeletingId(item.id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/tridarma/buku/${item.id}`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => null)) as {
        message?: string;
        error?: string;
        data?: { data_dihapus?: boolean };
      } | null;

      if (!res.ok) {
        setFeedback({
          type: "error",
          status: res.status,
          message: parseApiMessage(payload, "Gagal menghapus buku."),
        });
        return;
      }

      if (editingId === item.id) {
        setEditingId(null);
        setForm(INITIAL_FORM);
      }

      setFeedback({
        type: "success",
        status: res.status,
        message: parseApiMessage(payload, "Buku berhasil dihapus."),
        extra:
          payload?.data?.data_dihapus !== undefined
            ? `data_dihapus=${String(payload.data.data_dihapus)}`
            : undefined,
      });
      refreshData();
    } catch {
      setFeedback({
        type: "error",
        status: null,
        message: "Terjadi kesalahan jaringan saat menghapus buku.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitMutation(editingId !== null ? "patch" : "post");
  }

  const inputClassName =
    "min-h-[44px] w-full rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3 py-2 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/70 disabled:bg-[var(--color-tint-neutral)] disabled:opacity-70";

  return (
    <section
      aria-labelledby="buku-uji-heading"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2
            id="buku-uji-heading"
            className="font-[family-name:var(--font-lexend)] text-[18px] font-bold text-[var(--color-text-primary)]"
          >
            Uji API CRUD Buku (Modul 7)
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Form POST / PATCH dan daftar buku untuk menguji /api/tridarma/buku dan /api/tridarma/buku/[id].
          </p>
        </div>
        <button
          type="button"
          onClick={refreshData}
          disabled={isRefreshing}
          className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)] active:bg-[var(--color-border-default)] disabled:opacity-55"
        >
          {isRefreshing ? "Memuat..." : "Muat Ulang Data"}
        </button>
      </div>

      {/* Form Input POST / PATCH Buku */}
      <form
        onSubmit={handleFormSubmit}
        className="flex flex-col gap-4 rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-[family-name:var(--font-lexend)] text-[15px] font-semibold text-[var(--color-text-primary)]">
            {editingId !== null
              ? `Mode Edit Buku (ID: ${editingId})`
              : "Tambah Buku Manual (POST)"}
          </h3>
          {editingId !== null && (
            <button
              type="button"
              onClick={handleCancelEdit}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)] active:bg-[var(--color-border-default)]"
            >
              Batal Edit
            </button>
          )}
        </div>

        {!canManage ? (
          <p
            role="status"
            className="rounded-[10px] border border-[var(--color-border-default)] bg-white px-3.5 py-2.5 text-[13px] text-[var(--color-text-secondary)]"
          >
            Mode baca saja ({role}): hanya Dosen, Kaprodi, dan Staff Kaprodi yang dapat mengirim POST, PATCH, atau DELETE buku.
          </p>
        ) : currentDosenId === null ? (
          <p
            role="status"
            className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-warning-bg)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--color-warning-text)]"
          >
            Akun Anda belum punya baris dosen (sinta_id belum diisi). Form tetap dibuka supaya Anda bisa menguji penolakan 400 dari server.
          </p>
        ) : (
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            Terhubung dengan baris dosen ID: <strong className="text-[var(--color-text-primary)]">{currentDosenId}</strong>.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="buku-judul"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Judul Buku (wajib)
            </label>
            <input
              id="buku-judul"
              type="text"
              value={form.judul}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, judul: e.target.value }))
              }
              placeholder="Contoh: Rekayasa Perangkat Lunak Modern"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="buku-tahun"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Tahun Terbit (wajib)
            </label>
            <input
              id="buku-tahun"
              type="number"
              min={1000}
              max={9999}
              value={form.tahun}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, tahun: e.target.value }))
              }
              placeholder="2026"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="buku-isbn"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              ISBN (opsional, kunci utama bila diisi)
            </label>
            <input
              id="buku-isbn"
              type="text"
              value={form.isbn}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, isbn: e.target.value }))
              }
              placeholder="Contoh: 978-602-1234-56-7"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="buku-kategori"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Kategori (opsional)
            </label>
            <input
              id="buku-kategori"
              type="text"
              value={form.kategori}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, kategori: e.target.value }))
              }
              placeholder="Contoh: Buku Ajar / Referensi"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="buku-penerbit"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Penerbit (opsional)
            </label>
            <input
              id="buku-penerbit"
              type="text"
              value={form.penerbit}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, penerbit: e.target.value }))
              }
              placeholder="Contoh: UPI Press"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="buku-tempat-terbit"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Tempat Terbit (opsional)
            </label>
            <input
              id="buku-tempat-terbit"
              type="text"
              value={form.tempat_terbit}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, tempat_terbit: e.target.value }))
              }
              placeholder="Contoh: Bandung"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="buku-penulis"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Penulis (opsional, pisahkan dengan tanda ;)
            </label>
            <input
              id="buku-penulis"
              type="text"
              value={form.penulis}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, penulis: e.target.value }))
              }
              placeholder="Contoh: Budi Santoso; Ani Wijaya"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {editingId !== null ? (
            <>
              <button
                type="submit"
                disabled={!canManage || isSubmitting}
                className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-[var(--color-primary-strong)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-primary)] active:bg-[var(--color-text-primary)] disabled:opacity-55"
              >
                {isSubmitting ? "Mengirim..." : "Simpan Edit (PATCH)"}
              </button>
              <button
                type="button"
                onClick={() => void submitMutation("post")}
                disabled={!canManage || isSubmitting}
                className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)] active:bg-[var(--color-border-default)] disabled:opacity-55"
              >
                Kirim sebagai POST Baru
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={!canManage || isSubmitting}
              className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-[var(--color-primary-strong)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-primary)] active:bg-[var(--color-text-primary)] disabled:opacity-55"
            >
              {isSubmitting ? "Mengirim..." : "Kirim POST Buku"}
            </button>
          )}
        </div>

        {feedback && (
          <div
            role={feedback.type === "error" ? "alert" : "status"}
            className={`rounded-[10px] px-3.5 py-2.5 text-[13px] font-medium ${
              feedback.type === "success"
                ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                : "bg-[var(--color-danger-bg)] text-[var(--color-danger-solid)]"
            }`}
          >
            {feedback.status !== null ? `HTTP ${feedback.status}: ` : ""}
            {feedback.message}
            {feedback.extra ? ` (${feedback.extra})` : ""}
          </div>
        )}
      </form>

      {/* Filter & Daftar Buku dari DB */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 sm:items-end">
          <div className="flex flex-col gap-1.5 sm:col-span-6">
            <label
              htmlFor="buku-filter-search"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Saring Daftar (Judul, ISBN, atau Penulis)
            </label>
            <input
              id="buku-filter-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ketik judul, ISBN, atau penulis"
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-4">
            <label
              htmlFor="buku-filter-scope"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Kepemilikan
            </label>
            <select
              id="buku-filter-scope"
              value={filterScope}
              onChange={(e) =>
                setFilterScope(e.target.value === "mine" ? "mine" : "all")
              }
              className={inputClassName}
            >
              <option value="all">Semua buku ({items.length})</option>
              <option value="mine">Hanya tertaut ke akun saya</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setFilterScope("all");
              }}
              className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-tint-neutral)] active:bg-[var(--color-border-default)]"
            >
              Reset
            </button>
          </div>
        </div>

        {isRefreshing ? (
          <p
            role="status"
            className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-4 py-6 text-center text-[13px] text-[var(--color-text-secondary)]"
          >
            Memperbarui daftar buku dari database...
          </p>
        ) : filteredItems.length === 0 ? (
          <p
            role="status"
            className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-4 py-6 text-center text-[13px] text-[var(--color-text-secondary)]"
          >
            Belum ada data buku yang sesuai filter.
          </p>
        ) : (
          <>
            {/* Mobile stacked view */}
            <ul className="flex flex-col gap-2.5 sm:hidden">
              {filteredItems.map((item) => {
                const isMine =
                  currentDosenId !== null &&
                  item.dosenIds.includes(currentDosenId);
                return (
                  <li
                    key={item.id}
                    className="flex flex-col gap-1.5 rounded-[12px] border border-[var(--color-border-default)] bg-white p-3.5 text-[13px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-[var(--color-text-primary)]">
                        #{item.id} {item.judul}
                      </span>
                      <span
                        className={`shrink-0 rounded-[6px] px-2 py-0.5 text-[11px] font-bold uppercase ${
                          item.sumber === "manual"
                            ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                            : "bg-[var(--color-tint-neutral)] text-[var(--color-text-primary)]"
                        }`}
                      >
                        {item.sumber}
                      </span>
                    </div>
                    <p className="text-[var(--color-text-secondary)]">
                      Tahun: {item.tahun ?? "-"} | ISBN: {item.isbn ?? "-"}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      Penulis: {item.penulis ?? "-"}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      Penerbit: {item.penerbit ?? "-"} ({item.tempat_terbit ?? "-"}) | Kategori: {item.kategori ?? "-"}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      Tautan dosen ID: {item.dosenIds.length > 0 ? item.dosenIds.join(", ") : "-"}{" "}
                      {isMine ? "(Milik Anda)" : "(Bukan milik Anda)"}
                    </p>
                    {canManage && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSelectEdit(item)}
                          disabled={deletingId === item.id}
                          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)] active:bg-[var(--color-border-default)] disabled:opacity-55"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(item)}
                          disabled={deletingId !== null || isSubmitting}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-danger-solid)] bg-white px-3 py-2 text-[13px] font-semibold text-[var(--color-danger-solid)] transition-colors hover:bg-[var(--color-danger-bg)] active:bg-[var(--color-danger-bg)] disabled:opacity-55"
                        >
                          {deletingId === item.id ? "Menghapus..." : "Hapus"}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Desktop/tablet table view */}
            <div className="hidden overflow-x-auto rounded-[12px] border border-[var(--color-border-default)] sm:block">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
                  <tr className="border-b border-[var(--color-border-default)]">
                    <th className="px-3.5 py-2.5 font-semibold">Judul &amp; Penulis</th>
                    <th className="px-3.5 py-2.5 font-semibold">Tahun / ISBN</th>
                    <th className="px-3.5 py-2.5 font-semibold">Sumber</th>
                    <th className="px-3.5 py-2.5 font-semibold">Dosen Tertaut</th>
                    <th className="px-3.5 py-2.5 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-default)] bg-white">
                  {filteredItems.map((item) => {
                    const isMine =
                      currentDosenId !== null &&
                      item.dosenIds.includes(currentDosenId);
                    return (
                      <tr
                        key={item.id}
                        className={
                          editingId === item.id
                            ? "bg-[var(--color-tint-primary)]"
                            : ""
                        }
                      >
                        <td className="px-3.5 py-2.5 text-[var(--color-text-primary)]">
                          <div className="font-bold">
                            #{item.id} {item.judul}
                          </div>
                          <div className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">
                            Penulis: {item.penulis ?? "-"} | Kategori: {item.kategori ?? "-"}
                          </div>
                          <div className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">
                            Penerbit: {item.penerbit ?? "-"} ({item.tempat_terbit ?? "-"})
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          <div className="font-semibold text-[var(--color-text-primary)]">
                            {item.tahun ?? "-"}
                          </div>
                          <div className="mt-0.5 text-[12px]">
                            {item.isbn ?? "Tanpa ISBN"}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <span
                            className={`inline-block rounded-[6px] px-2 py-0.5 text-[11px] font-bold uppercase ${
                              item.sumber === "manual"
                                ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                                : "bg-[var(--color-tint-neutral)] text-[var(--color-text-primary)]"
                            }`}
                          >
                            {item.sumber}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-[var(--color-text-secondary)]">
                          <div>
                            {item.dosenIds.length > 0
                              ? item.dosenIds.join(", ")
                              : "-"}
                          </div>
                          <div className="mt-0.5 text-[12px] font-medium text-[var(--color-text-primary)]">
                            {isMine ? "Milik Anda" : "Dosen lain"}
                          </div>
                        </td>
                        <td className="px-3.5 py-2">
                          {canManage ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleSelectEdit(item)}
                                disabled={deletingId === item.id}
                                className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)] active:bg-[var(--color-border-default)] disabled:opacity-55"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(item)}
                                disabled={deletingId !== null || isSubmitting}
                                className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-danger-solid)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--color-danger-solid)] transition-colors hover:bg-[var(--color-danger-bg)] active:bg-[var(--color-danger-bg)] disabled:opacity-55"
                              >
                                {deletingId === item.id ? "Menghapus..." : "Hapus"}
                              </button>
                            </div>
                          ) : (
                            <span className="text-[var(--color-text-secondary)]">
                              -
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <p className="text-[13px] text-[var(--color-text-secondary)]">
          Menampilkan {filteredItems.length} dari {items.length} buku (maks. 50 data terbaru).
        </p>
      </div>
    </section>
  );
}
