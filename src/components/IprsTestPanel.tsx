"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

export interface IprsTestItem {
  id: number;
  kunci: string;
  judul: string;
  jenis: string | null;
  tahun: number | null;
  nomor_permohonan: string | null;
  status: string | null;
  pemegang: string | null;
  inventor: string | null;
  sumber: "sinta" | "manual";
  dosenIds: number[];
}

interface FormState {
  judul: string;
  jenis: string;
  tahun: string;
  nomor_permohonan: string;
  pemegang: string;
  inventor: string;
  status: string;
}

interface ApiFeedback {
  type: "success" | "error";
  status: number | null;
  message: string;
  extra?: string;
}

const INITIAL_FORM: FormState = {
  judul: "",
  jenis: "",
  tahun: "2026",
  nomor_permohonan: "",
  pemegang: "",
  inventor: "",
  status: "",
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

export function IprsTestPanel({
  items,
  canManage,
  role,
  currentDosenId,
}: {
  items: IprsTestItem[];
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
      (item.jenis ?? "").toLowerCase().includes(normalizedQuery) ||
      (item.nomor_permohonan ?? "").toLowerCase().includes(normalizedQuery) ||
      (item.pemegang ?? "").toLowerCase().includes(normalizedQuery) ||
      (item.inventor ?? "").toLowerCase().includes(normalizedQuery)
    );
  });

  function refreshData() {
    startRefresh(() => {
      router.refresh();
    });
  }

  function handleSelectEdit(item: IprsTestItem) {
    setEditingId(item.id);
    setForm({
      judul: item.judul,
      jenis: item.jenis ?? "",
      tahun: item.tahun !== null ? String(item.tahun) : "",
      nomor_permohonan: item.nomor_permohonan ?? "",
      pemegang: item.pemegang ?? "",
      inventor: item.inventor ?? "",
      status: "",
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
          ? `/api/tridarma/iprs/${editingId}`
          : "/api/tridarma/iprs";

      const requestBody: Record<string, string> = {
        judul: form.judul,
        jenis: form.jenis,
        tahun: form.tahun,
        nomor_permohonan: form.nomor_permohonan,
        pemegang: form.pemegang,
        inventor: form.inventor,
      };
      if (form.status.trim()) {
        requestBody.status = form.status.trim();
      }

      const res = await fetch(targetUrl, {
        method: mode === "patch" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const payload = (await res.json().catch(() => null)) as {
        message?: string;
        error?: string;
        data?: {
          ditautkan?: boolean;
          id?: number;
          judul?: string;
          status?: string | null;
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
              ? "Permintaan PATCH IPRS gagal diproses."
              : "Permintaan POST IPRS gagal diproses.",
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
        if (payload.data.status) {
          extraParts.push(`status: ${payload.data.status}`);
        }
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
            ? "IPRS berhasil diperbarui."
            : "IPRS berhasil ditambahkan.",
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
        message: "Terjadi kesalahan jaringan saat mengirim data IPRS.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(item: IprsTestItem) {
    if (!canManage || deletingId !== null || isSubmitting) return;
    const konfirmasi =
      item.dosenIds.length > 1
        ? `Lepas tautan IPRS "${item.judul}" dari akun Anda? (Data tetap ada untuk dosen lain yang tertaut.)`
        : `Hapus IPRS "${item.judul}"?`;
    if (!window.confirm(konfirmasi)) return;

    setDeletingId(item.id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/tridarma/iprs/${item.id}`, {
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
          message: parseApiMessage(payload, "Gagal menghapus IPRS."),
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
        message: parseApiMessage(payload, "IPRS berhasil dihapus."),
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
        message: "Terjadi kesalahan jaringan saat menghapus IPRS.",
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
      aria-labelledby="iprs-uji-heading"
      className="flex flex-col gap-6 border-t border-[var(--color-border-default)] pt-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2
            id="iprs-uji-heading"
            className="font-[family-name:var(--font-lexend)] text-[18px] font-bold text-[var(--color-text-primary)]"
          >
            Uji API CRUD IPRS (Modul 7)
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Form POST / PATCH dan daftar IPRS untuk menguji /api/tridarma/iprs dan /api/tridarma/iprs/[id].
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
              ? `Mode Edit IPRS (ID: ${editingId})`
              : "Tambah IPRS Manual (POST)"}
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
            Mode baca saja ({role}): hanya Dosen, Kaprodi, dan Staff Kaprodi yang dapat mengirim POST, PATCH, atau DELETE IPRS.
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
            . Status IPRS manual otomatis diisi{" "}
            <strong className="text-[var(--color-text-primary)]">Diterima</strong>{" "}
            oleh server.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="iprs-judul"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Judul IPRS (wajib)
            </label>
            <input
              id="iprs-judul"
              type="text"
              value={form.judul}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, judul: e.target.value }))
              }
              placeholder="Contoh: Aplikasi Arsip Pengabdian RPL"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="iprs-tahun"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Tahun (wajib)
            </label>
            <input
              id="iprs-tahun"
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
              htmlFor="iprs-jenis"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Jenis HKI (wajib)
            </label>
            <input
              id="iprs-jenis"
              type="text"
              value={form.jenis}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, jenis: e.target.value }))
              }
              placeholder="Contoh: Hak Cipta / Paten"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="iprs-nomor-permohonan"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Nomor Permohonan (opsional, kunci utama)
            </label>
            <input
              id="iprs-nomor-permohonan"
              type="text"
              value={form.nomor_permohonan}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  nomor_permohonan: e.target.value,
                }))
              }
              placeholder="Contoh: EC00202612345"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="iprs-status-uji"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Uji Field Status (opsional, diabaikan server)
            </label>
            <input
              id="iprs-status-uji"
              type="text"
              value={form.status}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, status: e.target.value }))
              }
              placeholder="Contoh: Ditolak (uji abaikan)"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
            <label
              htmlFor="iprs-pemegang"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Pemegang (opsional, pisahkan ;)
            </label>
            <input
              id="iprs-pemegang"
              type="text"
              value={form.pemegang}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, pemegang: e.target.value }))
              }
              placeholder="Contoh: UPI; LPPM UPI"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="iprs-inventor"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Inventor (opsional, pisahkan dengan tanda ;)
            </label>
            <input
              id="iprs-inventor"
              type="text"
              value={form.inventor}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, inventor: e.target.value }))
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
              {isSubmitting ? "Mengirim..." : "Kirim POST IPRS"}
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
              htmlFor="iprs-filter-search"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Saring Daftar (Judul, Jenis, No. Permohonan, Pemegang, Inventor)
            </label>
            <input
              id="iprs-filter-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ketik kata kunci IPRS"
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-4">
            <label
              htmlFor="iprs-filter-scope"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Kepemilikan
            </label>
            <select
              id="iprs-filter-scope"
              value={filterScope}
              onChange={(e) =>
                setFilterScope(e.target.value === "mine" ? "mine" : "all")
              }
              className={inputClassName}
            >
              <option value="all">Semua IPRS ({items.length})</option>
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
            Memperbarui daftar IPRS dari database...
          </p>
        ) : filteredItems.length === 0 ? (
          <p
            role="status"
            className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-4 py-6 text-center text-[13px] text-[var(--color-text-secondary)]"
          >
            Belum ada data IPRS yang sesuai filter.
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
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        <span
                          className={`rounded-[6px] px-2 py-0.5 text-[11px] font-bold uppercase ${
                            item.sumber === "manual"
                              ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                              : "bg-[var(--color-tint-neutral)] text-[var(--color-text-primary)]"
                          }`}
                        >
                          {item.sumber}
                        </span>
                        <span className="rounded-[6px] bg-[var(--color-tint-primary)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-primary-strong)]">
                          {item.status ?? "-"}
                        </span>
                      </div>
                    </div>
                    <p className="text-[var(--color-text-secondary)]">
                      Jenis: {item.jenis ?? "-"} | Tahun: {item.tahun ?? "-"}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      No. Permohonan: {item.nomor_permohonan ?? "-"}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      Pemegang: {item.pemegang ?? "-"}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      Inventor: {item.inventor ?? "-"}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      Tautan dosen ID:{" "}
                      {item.dosenIds.length > 0 ? item.dosenIds.join(", ") : "-"}{" "}
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

            <div className="hidden overflow-x-auto rounded-[12px] border border-[var(--color-border-default)] sm:block">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
                  <tr className="border-b border-[var(--color-border-default)]">
                    <th className="px-3.5 py-2.5 font-semibold">Judul &amp; Detail</th>
                    <th className="px-3.5 py-2.5 font-semibold">Tahun / No. Permohonan</th>
                    <th className="px-3.5 py-2.5 font-semibold">Sumber &amp; Status</th>
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
                            Jenis: {item.jenis ?? "-"} | Pemegang: {item.pemegang ?? "-"}
                          </div>
                          <div className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">
                            Inventor: {item.inventor ?? "-"}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          <div className="font-semibold text-[var(--color-text-primary)]">
                            {item.tahun ?? "-"}
                          </div>
                          <div className="mt-0.5 text-[12px]">
                            {item.nomor_permohonan ?? "Tanpa nomor"}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <span
                              className={`inline-block rounded-[6px] px-2 py-0.5 text-[11px] font-bold uppercase ${
                                item.sumber === "manual"
                                  ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                                  : "bg-[var(--color-tint-neutral)] text-[var(--color-text-primary)]"
                              }`}
                            >
                              {item.sumber}
                            </span>
                            <span className="inline-block rounded-[6px] bg-[var(--color-tint-primary)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-primary-strong)]">
                              {item.status ?? "-"}
                            </span>
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
          Menampilkan {filteredItems.length} dari {items.length} IPRS (maks. 50 data terbaru).
        </p>
      </div>
    </section>
  );
}
