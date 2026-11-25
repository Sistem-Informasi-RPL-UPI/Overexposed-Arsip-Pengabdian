"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

export interface PublikasiTestItem {
  id: number;
  judul_hash: string;
  judul: string;
  tahun: number | null;
  penulis: string | null;
  jurnal: string | null;
  sitasi: number;
  link: string | null;
  kuartil: string | null;
  jenis: string | null;
  penerbit: string | null;
  doi: string | null;
  akreditasi: string | null;
  sumber: "sinta" | "manual";
  sources: string[];
  dosenIds: number[];
}

interface FormState {
  judul: string;
  tahun: string;
  penulis: string;
  jurnal: string;
  jenis: string;
  penerbit: string;
  kuartil: string;
  akreditasi: string;
  sitasi: string;
  doi: string;
  link: string;
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
  penulis: "",
  jurnal: "",
  jenis: "",
  penerbit: "",
  kuartil: "",
  akreditasi: "",
  sitasi: "0",
  doi: "",
  link: "",
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

export function PublikasiTestPanel({
  items,
  canManage,
  role,
  currentDosenId,
}: {
  items: PublikasiTestItem[];
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
      (item.jurnal ?? "").toLowerCase().includes(normalizedQuery) ||
      (item.doi ?? "").toLowerCase().includes(normalizedQuery) ||
      (item.penulis ?? "").toLowerCase().includes(normalizedQuery) ||
      (item.kuartil ?? "").toLowerCase().includes(normalizedQuery) ||
      (item.akreditasi ?? "").toLowerCase().includes(normalizedQuery)
    );
  });

  function refreshData() {
    startRefresh(() => {
      router.refresh();
    });
  }

  function handleSelectEdit(item: PublikasiTestItem) {
    setEditingId(item.id);
    setForm({
      judul: item.judul,
      tahun: item.tahun !== null ? String(item.tahun) : "",
      penulis: item.penulis ?? "",
      jurnal: item.jurnal ?? "",
      jenis: item.jenis ?? "",
      penerbit: item.penerbit ?? "",
      kuartil: item.kuartil ?? "",
      akreditasi: item.akreditasi ?? "",
      sitasi: String(item.sitasi ?? 0),
      doi: item.doi ?? "",
      link: item.link ?? "",
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
          ? `/api/tridarma/publikasi/${editingId}`
          : "/api/tridarma/publikasi";

      const res = await fetch(targetUrl, {
        method: mode === "patch" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          judul: form.judul,
          tahun: form.tahun,
          penulis: form.penulis,
          jurnal: form.jurnal,
          jenis: form.jenis,
          penerbit: form.penerbit,
          kuartil: form.kuartil,
          akreditasi: form.akreditasi,
          sitasi: form.sitasi,
          doi: form.doi,
          link: form.link,
        }),
      });

      const payload = (await res.json().catch(() => null)) as {
        message?: string;
        error?: string;
        data?: {
          ditautkan?: boolean;
          id?: number;
          judul?: string;
          sumber?: string;
        };
      } | null;

      if (!res.ok) {
        setFeedback({
          type: "error",
          status: res.status,
          message: parseApiMessage(
            payload,
            mode === "patch"
              ? "Permintaan PATCH publikasi gagal diproses."
              : "Permintaan POST publikasi gagal diproses.",
          ),
        });
        return;
      }

      const extraParts: string[] = [];
      if (payload?.data?.ditautkan) {
        extraParts.push(
          `ditautkan=true (id: ${payload.data.id}, judul: ${payload.data.judul})`,
        );
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
            ? "Publikasi berhasil diperbarui."
            : "Publikasi berhasil ditambahkan.",
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
        message: "Terjadi kesalahan jaringan saat mengirim data publikasi.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(item: PublikasiTestItem) {
    if (!canManage || deletingId !== null || isSubmitting) return;
    const konfirmasi =
      item.dosenIds.length > 1
        ? `Lepas semua tautan publikasi "${item.judul}" dari akun Anda? (Data tetap ada untuk dosen lain yang tertaut.)`
        : `Hapus publikasi "${item.judul}"?`;
    if (!window.confirm(konfirmasi)) return;

    setDeletingId(item.id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/tridarma/publikasi/${item.id}`, {
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
          message: parseApiMessage(payload, "Gagal menghapus publikasi."),
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
        message: parseApiMessage(payload, "Publikasi berhasil dihapus."),
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
        message: "Terjadi kesalahan jaringan saat menghapus publikasi.",
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
    <section aria-labelledby="publikasi-uji-heading" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2
            id="publikasi-uji-heading"
            className="font-[family-name:var(--font-lexend)] text-[18px] font-bold text-[var(--color-text-primary)]"
          >
            Uji API CRUD Publikasi (Modul 7)
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Form POST / PATCH dan daftar paper untuk menguji /api/tridarma/publikasi dan /api/tridarma/publikasi/[id].
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

      <form
        onSubmit={handleFormSubmit}
        className="flex flex-col gap-4 rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-[family-name:var(--font-lexend)] text-[15px] font-semibold text-[var(--color-text-primary)]">
            {editingId !== null
              ? `Mode Edit Publikasi (ID: ${editingId})`
              : "Tambah Publikasi Manual (POST)"}
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
            Mode baca saja ({role}): hanya Dosen, Kaprodi, dan Staff Kaprodi yang dapat mengirim POST, PATCH, atau DELETE publikasi.
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
            Terhubung dengan baris dosen ID:{" "}
            <strong className="text-[var(--color-text-primary)]">
              {currentDosenId}
            </strong>
            . Tautan manual disimpan dengan source{" "}
            <strong className="text-[var(--color-text-primary)]">manual</strong>.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="publikasi-judul"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Judul Publikasi (wajib, kunci anti-dobel)
            </label>
            <input
              id="publikasi-judul"
              type="text"
              value={form.judul}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, judul: e.target.value }))
              }
              placeholder="Contoh: Analisis Arsitektur Microservices pada Sistem Akademik"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="publikasi-tahun"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Tahun (wajib)
            </label>
            <input
              id="publikasi-tahun"
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

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="publikasi-penulis"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Penulis (opsional, pisahkan dengan tanda ;)
            </label>
            <input
              id="publikasi-penulis"
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

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="publikasi-jenis"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Jenis Publikasi (opsional)
            </label>
            <input
              id="publikasi-jenis"
              type="text"
              value={form.jenis}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, jenis: e.target.value }))
              }
              placeholder="Contoh: Jurnal Nasional / Prosiding"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="publikasi-jurnal"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Jurnal / Konferensi (opsional)
            </label>
            <input
              id="publikasi-jurnal"
              type="text"
              value={form.jurnal}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, jurnal: e.target.value }))
              }
              placeholder="Contoh: Jurnal Rekayasa Perangkat Lunak"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="publikasi-penerbit"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Penerbit (opsional)
            </label>
            <input
              id="publikasi-penerbit"
              type="text"
              value={form.penerbit}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, penerbit: e.target.value }))
              }
              placeholder="Contoh: UPI Press / IEEE"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="publikasi-sitasi"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Sitasi (opsional, bawaan 0)
            </label>
            <input
              id="publikasi-sitasi"
              type="number"
              min={0}
              value={form.sitasi}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sitasi: e.target.value }))
              }
              placeholder="0"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="publikasi-kuartil"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Kuartil (opsional, boleh bersama akreditasi)
            </label>
            <input
              id="publikasi-kuartil"
              type="text"
              value={form.kuartil}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, kuartil: e.target.value }))
              }
              placeholder="Contoh: Q1 / Q2"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="publikasi-akreditasi"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Akreditasi (opsional, boleh bersama kuartil)
            </label>
            <input
              id="publikasi-akreditasi"
              type="text"
              value={form.akreditasi}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, akreditasi: e.target.value }))
              }
              placeholder="Contoh: SINTA 2"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="publikasi-doi"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              DOI (opsional)
            </label>
            <input
              id="publikasi-doi"
              type="text"
              value={form.doi}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, doi: e.target.value }))
              }
              placeholder="Contoh: 10.17509/jrpl.v4i2.123"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
            <label
              htmlFor="publikasi-link"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Link Publikasi (opsional, harus URL http:// atau https://)
            </label>
            <input
              id="publikasi-link"
              type="text"
              value={form.link}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, link: e.target.value }))
              }
              placeholder="Contoh: https://journal.upi.edu/article/view/123"
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
              {isSubmitting ? "Mengirim..." : "Kirim POST Publikasi"}
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

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 sm:items-end">
          <div className="flex flex-col gap-1.5 sm:col-span-6">
            <label
              htmlFor="publikasi-filter-search"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Saring Daftar (Judul, Jurnal, DOI, Penulis, Kuartil, Akreditasi)
            </label>
            <input
              id="publikasi-filter-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ketik kata kunci publikasi"
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-4">
            <label
              htmlFor="publikasi-filter-scope"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Kepemilikan
            </label>
            <select
              id="publikasi-filter-scope"
              value={filterScope}
              onChange={(e) =>
                setFilterScope(e.target.value === "mine" ? "mine" : "all")
              }
              className={inputClassName}
            >
              <option value="all">Semua publikasi ({items.length})</option>
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
            Memperbarui daftar publikasi dari database...
          </p>
        ) : filteredItems.length === 0 ? (
          <p
            role="status"
            className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-4 py-6 text-center text-[13px] text-[var(--color-text-secondary)]"
          >
            Belum ada data publikasi yang sesuai filter.
          </p>
        ) : (
          <>
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
                      Tahun: {item.tahun ?? "-"} | Sitasi: {item.sitasi} | Jenis:{" "}
                      {item.jenis ?? "-"}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      Penulis: {item.penulis ?? "-"}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      Jurnal: {item.jurnal ?? "-"} ({item.penerbit ?? "-"})
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      Kuartil: {item.kuartil ?? "-"} | Akreditasi:{" "}
                      {item.akreditasi ?? "-"} | DOI: {item.doi ?? "-"}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      Tautan dosen ID:{" "}
                      {item.dosenIds.length > 0 ? item.dosenIds.join(", ") : "-"}{" "}
                      {isMine ? "(Milik Anda)" : "(Bukan milik Anda)"} | Source:{" "}
                      {item.sources.length > 0 ? item.sources.join(", ") : "-"}
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

            <div className="hidden overflow-x-auto rounded-[12px] border border-[var(--color-border-default)] sm:block">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
                  <tr className="border-b border-[var(--color-border-default)]">
                    <th className="px-3.5 py-2.5 font-semibold">Judul &amp; Jurnal</th>
                    <th className="px-3.5 py-2.5 font-semibold">Tahun / Sitasi</th>
                    <th className="px-3.5 py-2.5 font-semibold">Kuartil &amp; Akreditasi</th>
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
                            Penulis: {item.penulis ?? "-"} | Jenis:{" "}
                            {item.jenis ?? "-"}
                          </div>
                          <div className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">
                            Jurnal: {item.jurnal ?? "-"} ({item.penerbit ?? "-"})
                            {item.doi ? ` | DOI: ${item.doi}` : ""}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          <div className="font-semibold text-[var(--color-text-primary)]">
                            {item.tahun ?? "-"}
                          </div>
                          <div className="mt-0.5 text-[12px]">
                            Sitasi: {item.sitasi}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          <div>Kuartil: {item.kuartil ?? "-"}</div>
                          <div className="mt-0.5 text-[12px]">
                            Akreditasi: {item.akreditasi ?? "-"}
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
                          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                            {item.sources.join(", ") || "-"}
                          </div>
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
                                {deletingId === item.id
                                  ? "Menghapus..."
                                  : "Hapus"}
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
          Menampilkan {filteredItems.length} dari {items.length} publikasi (maks. 50 data terbaru).
        </p>
      </div>
    </section>
  );
}
