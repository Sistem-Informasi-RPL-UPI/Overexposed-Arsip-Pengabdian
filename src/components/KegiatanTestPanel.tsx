"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

export interface KegiatanTestAnggota {
  nama: string;
  peran: "ketua" | "anggota";
  dosen_id: number | null;
}

export interface KegiatanTestItem {
  id: number;
  kunci: string;
  jenis: "penelitian" | "pengabdian";
  judul: string;
  tahun: number | null;
  skema: string | null;
  dana_nominal: number;
  sumber_dana: string | null;
  sumber: "sinta" | "manual";
  anggota: KegiatanTestAnggota[];
  dosenIds: number[];
}

interface FormState {
  jenis: "penelitian" | "pengabdian";
  judul: string;
  tahun: string;
  tim: string;
  skema: string;
  dana_nominal: string;
  sumber_dana: string;
  status_uji: string;
}

interface ApiFeedback {
  type: "success" | "error";
  status: number | null;
  message: string;
  extra?: string;
}

function createInitialForm(defaultTim: string): FormState {
  return {
    jenis: "penelitian",
    judul: "",
    tahun: "2026",
    tim: defaultTim,
    skema: "",
    dana_nominal: "0",
    sumber_dana: "",
    status_uji: "",
  };
}

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

export function KegiatanTestPanel({
  items,
  canManage,
  role,
  currentDosenId,
  currentDosenNama,
}: {
  items: KegiatanTestItem[];
  canManage: boolean;
  role: string;
  currentDosenId: number | null;
  currentDosenNama: string | null;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const defaultTim = currentDosenNama?.trim() ?? "";

  const [form, setForm] = useState<FormState>(() =>
    createInitialForm(defaultTim),
  );
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<ApiFeedback | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterJenis, setFilterJenis] = useState<
    "all" | "penelitian" | "pengabdian"
  >("all");
  const [filterScope, setFilterScope] = useState<"all" | "mine">("all");

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (filterJenis !== "all" && item.jenis !== filterJenis) {
      return false;
    }
    if (filterScope === "mine") {
      if (currentDosenId === null || !item.dosenIds.includes(currentDosenId)) {
        return false;
      }
    }
    if (!normalizedQuery) return true;
    const timText = item.anggota
      .map((a) => a.nama)
      .join("; ")
      .toLowerCase();
    return (
      item.judul.toLowerCase().includes(normalizedQuery) ||
      (item.skema ?? "").toLowerCase().includes(normalizedQuery) ||
      (item.sumber_dana ?? "").toLowerCase().includes(normalizedQuery) ||
      timText.includes(normalizedQuery)
    );
  });

  function refreshData() {
    startRefresh(() => {
      router.refresh();
    });
  }

  function handleSelectEdit(item: KegiatanTestItem) {
    setEditingId(item.id);
    setForm({
      jenis: item.jenis,
      judul: item.judul,
      tahun: item.tahun !== null ? String(item.tahun) : "",
      tim: item.anggota.map((a) => a.nama).join("; "),
      skema: item.skema ?? "",
      dana_nominal: String(item.dana_nominal ?? 0),
      sumber_dana: item.sumber_dana ?? "",
      status_uji: "",
    });
    setFeedback(null);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(createInitialForm(defaultTim));
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
          ? `/api/tridarma/kegiatan/${editingId}`
          : "/api/tridarma/kegiatan";

      const requestBody: Record<string, string> = {
        jenis: form.jenis,
        judul: form.judul,
        tahun: form.tahun,
        tim: form.tim,
        skema: form.skema,
        dana_nominal: form.dana_nominal,
        sumber_dana: form.sumber_dana,
      };
      if (form.status_uji.trim()) {
        requestBody.status = form.status_uji.trim();
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
              ? "Permintaan PATCH kegiatan gagal diproses."
              : "Permintaan POST kegiatan gagal diproses.",
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
            ? "Kegiatan berhasil diperbarui."
            : "Kegiatan berhasil ditambahkan.",
        ),
        extra: extraParts.length > 0 ? extraParts.join(", ") : undefined,
      });
      setEditingId(null);
      setForm(createInitialForm(defaultTim));
      refreshData();
    } catch {
      setFeedback({
        type: "error",
        status: null,
        message: "Terjadi kesalahan jaringan saat mengirim data kegiatan.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(item: KegiatanTestItem) {
    if (!canManage || deletingId !== null || isSubmitting) return;
    const konfirmasi =
      item.dosenIds.length > 1
        ? `Lepas tautan kegiatan "${item.judul}" dari akun Anda? (Data tetap ada untuk dosen terdaftar lain yang tertaut.)`
        : `Hapus kegiatan "${item.judul}"?`;
    if (!window.confirm(konfirmasi)) return;

    setDeletingId(item.id);
    setFeedback(null);

    try {
      const res = await fetch(`/api/tridarma/kegiatan/${item.id}`, {
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
          message: parseApiMessage(payload, "Gagal menghapus kegiatan."),
        });
        return;
      }

      if (editingId === item.id) {
        setEditingId(null);
        setForm(createInitialForm(defaultTim));
      }

      setFeedback({
        type: "success",
        status: res.status,
        message: parseApiMessage(payload, "Kegiatan berhasil dihapus."),
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
        message: "Terjadi kesalahan jaringan saat menghapus kegiatan.",
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
    <section aria-labelledby="kegiatan-uji-heading" className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2
            id="kegiatan-uji-heading"
            className="font-[family-name:var(--font-lexend)] text-[18px] font-bold text-[var(--color-text-primary)]"
          >
            Uji API CRUD Kegiatan: Penelitian &amp; Pengabdian (Modul 7)
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Form POST / PATCH dan daftar kegiatan untuk menguji /api/tridarma/kegiatan dan /api/tridarma/kegiatan/[id].
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
              ? `Mode Edit Kegiatan (ID: ${editingId})`
              : "Tambah Kegiatan Manual (POST)"}
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
            Mode baca saja ({role}): hanya Dosen, Kaprodi, dan Staff Kaprodi yang dapat mengirim POST, PATCH, atau DELETE kegiatan.
          </p>
        ) : currentDosenId === null ? (
          <p
            role="status"
            className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-warning-bg)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--color-warning-text)]"
          >
            Akun Anda belum punya baris dosen (sinta_id belum diisi). Form tetap dibuka supaya Anda bisa menguji penolakan 400 dari server.
          </p>
        ) : !currentDosenNama ? (
          <p
            role="status"
            className="rounded-[10px] border border-[var(--color-border-default)] bg-[var(--color-warning-bg)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--color-warning-text)]"
          >
            Baris dosen ID {currentDosenId} belum punya nama SINTA (belum pernah sinkron). Form tetap dibuka untuk menguji penolakan 400 minta sinkron dulu.
          </p>
        ) : (
          <p className="text-[13px] text-[var(--color-text-secondary)]">
            Terhubung dengan dosen ID:{" "}
            <strong className="text-[var(--color-text-primary)]">
              {currentDosenId}
            </strong>{" "}
            (Nama SINTA:{" "}
            <strong className="text-[var(--color-text-primary)]">
              {currentDosenNama}
            </strong>
            , wajib ada di daftar tim).
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="kegiatan-jenis"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Jenis Kegiatan (wajib)
            </label>
            <select
              id="kegiatan-jenis"
              value={form.jenis}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  jenis:
                    e.target.value === "pengabdian"
                      ? "pengabdian"
                      : "penelitian",
                }))
              }
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            >
              <option value="penelitian">Penelitian</option>
              <option value="pengabdian">Pengabdian</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="kegiatan-judul"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Judul Kegiatan (wajib)
            </label>
            <input
              id="kegiatan-judul"
              type="text"
              value={form.judul}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, judul: e.target.value }))
              }
              placeholder="Contoh: Pengembangan Model Pembelajaran Adaptif"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="kegiatan-tahun"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Tahun (wajib)
            </label>
            <input
              id="kegiatan-tahun"
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
              htmlFor="kegiatan-tim"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Tim (wajib, pisahkan ; , nama pertama ketua, wajib memuat nama Anda)
            </label>
            <input
              id="kegiatan-tim"
              type="text"
              value={form.tim}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, tim: e.target.value }))
              }
              placeholder={
                defaultTim
                  ? `${defaultTim}; Anggota Dua`
                  : "Contoh: Ketua Tim; Anggota Satu; Anggota Dua"
              }
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="kegiatan-skema"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Skema (opsional)
            </label>
            <input
              id="kegiatan-skema"
              type="text"
              value={form.skema}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, skema: e.target.value }))
              }
              placeholder="Contoh: Penelitian Internal UPI"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="kegiatan-dana"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Dana Nominal Rp (opsional, bawaan 0)
            </label>
            <input
              id="kegiatan-dana"
              type="text"
              value={form.dana_nominal}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, dana_nominal: e.target.value }))
              }
              placeholder="Contoh: 25000000"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="kegiatan-sumber-dana"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Sumber Dana (opsional)
            </label>
            <input
              id="kegiatan-sumber-dana"
              type="text"
              value={form.sumber_dana}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, sumber_dana: e.target.value }))
              }
              placeholder="Contoh: RKAT UPI / Kemdiktisaintek"
              disabled={!canManage || isSubmitting}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
            <label
              htmlFor="kegiatan-status-uji"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Uji Field Status (opsional, harus ditolak 400 bila diisi)
            </label>
            <input
              id="kegiatan-status-uji"
              type="text"
              value={form.status_uji}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, status_uji: e.target.value }))
              }
              placeholder="Kosongkan untuk request normal, atau isi mis. Diterima untuk menguji penolakan 400"
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
              {isSubmitting ? "Mengirim..." : "Kirim POST Kegiatan"}
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
          <div className="flex flex-col gap-1.5 sm:col-span-5">
            <label
              htmlFor="kegiatan-filter-search"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Saring Daftar (Judul, Skema, Sumber Dana, Nama Tim)
            </label>
            <input
              id="kegiatan-filter-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ketik kata kunci kegiatan"
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label
              htmlFor="kegiatan-filter-jenis"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Jenis
            </label>
            <select
              id="kegiatan-filter-jenis"
              value={filterJenis}
              onChange={(e) =>
                setFilterJenis(
                  e.target.value === "penelitian" ||
                    e.target.value === "pengabdian"
                    ? e.target.value
                    : "all",
                )
              }
              className={inputClassName}
            >
              <option value="all">Semua</option>
              <option value="penelitian">Penelitian</option>
              <option value="pengabdian">Pengabdian</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-3">
            <label
              htmlFor="kegiatan-filter-scope"
              className="text-[13px] font-semibold text-[var(--color-text-primary)]"
            >
              Kepemilikan
            </label>
            <select
              id="kegiatan-filter-scope"
              value={filterScope}
              onChange={(e) =>
                setFilterScope(e.target.value === "mine" ? "mine" : "all")
              }
              className={inputClassName}
            >
              <option value="all">Semua kegiatan ({items.length})</option>
              <option value="mine">Hanya tertaut ke akun saya</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setFilterJenis("all");
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
            Memperbarui daftar kegiatan dari database...
          </p>
        ) : filteredItems.length === 0 ? (
          <p
            role="status"
            className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-4 py-6 text-center text-[13px] text-[var(--color-text-secondary)]"
          >
            Belum ada data kegiatan yang sesuai filter.
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
                        <span className="rounded-[6px] bg-[var(--color-tint-primary)] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--color-primary-strong)]">
                          {item.jenis}
                        </span>
                        <span
                          className={`rounded-[6px] px-2 py-0.5 text-[11px] font-bold uppercase ${
                            item.sumber === "manual"
                              ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                              : "bg-[var(--color-tint-neutral)] text-[var(--color-text-primary)]"
                          }`}
                        >
                          {item.sumber}
                        </span>
                      </div>
                    </div>
                    <p className="text-[var(--color-text-secondary)]">
                      Tahun: {item.tahun ?? "-"} | Skema: {item.skema ?? "-"}
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      Dana: Rp {item.dana_nominal.toLocaleString("id-ID")} (
                      {item.sumber_dana ?? "-"})
                    </p>
                    <p className="text-[var(--color-text-secondary)]">
                      Tim:{" "}
                      {item.anggota
                        .map(
                          (a) =>
                            `${a.nama} [${a.peran}${a.dosen_id !== null ? `, ID:${a.dosen_id}` : ""}]`,
                        )
                        .join("; ") || "-"}
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
                    <th className="px-3.5 py-2.5 font-semibold">Judul &amp; Tim</th>
                    <th className="px-3.5 py-2.5 font-semibold">Tahun / Dana</th>
                    <th className="px-3.5 py-2.5 font-semibold">Jenis &amp; Sumber</th>
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
                            Skema: {item.skema ?? "-"} | Sumber Dana:{" "}
                            {item.sumber_dana ?? "-"}
                          </div>
                          <div className="mt-0.5 text-[12px] text-[var(--color-text-secondary)]">
                            Tim:{" "}
                            {item.anggota
                              .map(
                                (a) =>
                                  `${a.nama} (${a.peran}${a.dosen_id !== null ? `, ID:${a.dosen_id}` : ""})`,
                              )
                              .join("; ") || "-"}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap text-[var(--color-text-secondary)]">
                          <div className="font-semibold text-[var(--color-text-primary)]">
                            {item.tahun ?? "-"}
                          </div>
                          <div className="mt-0.5 text-[12px]">
                            Rp {item.dana_nominal.toLocaleString("id-ID")}
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-1">
                            <span className="inline-block rounded-[6px] bg-[var(--color-tint-primary)] px-2 py-0.5 text-[11px] font-bold uppercase text-[var(--color-primary-strong)]">
                              {item.jenis}
                            </span>
                            <span
                              className={`inline-block rounded-[6px] px-2 py-0.5 text-[11px] font-bold uppercase ${
                                item.sumber === "manual"
                                  ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
                                  : "bg-[var(--color-tint-neutral)] text-[var(--color-text-primary)]"
                              }`}
                            >
                              {item.sumber}
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
          Menampilkan {filteredItems.length} dari {items.length} kegiatan (maks. 50 data terbaru).
        </p>
      </div>
    </section>
  );
}
