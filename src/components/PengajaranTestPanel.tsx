"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

export interface MatkulTestItem {
  id: number;
  kode: string;
  nama: string;
  sks: number;
  jumlah_kelas: number;
}

export interface KelasTestItem {
  id: number;
  matkul_id: number;
  matkul_kode: string;
  matkul_nama: string;
  dosen_id: number;
  dosen_nama: string | null;
  tahun_ajaran: string;
  semester: "Ganjil" | "Genap";
  jumlah_berkas: number;
}

export interface BerkasPengajaranTestItem {
  id: number;
  kelas_id: number;
  kelas_label: string;
  dosen_id: number;
  jenis:
    | "RPS"
    | "Slide"
    | "UTS"
    | "UAS"
    | "Kuis"
    | "Presensi"
    | "Nilai"
    | "Modul";
  judul: string | null;
  link: string;
  keterangan: string | null;
}

type SubTabKey = "matkul" | "kelas" | "berkas";

interface ApiFeedback {
  type: "success" | "error";
  status: number | null;
  message: string;
  extra?: string;
}

const JENIS_BERKAS_OPTIONS = [
  "RPS",
  "Slide",
  "UTS",
  "UAS",
  "Kuis",
  "Presensi",
  "Nilai",
  "Modul",
] as const;

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

export function PengajaranTestPanel({
  matkulItems,
  kelasItems,
  berkasItems,
  role,
  canViewPengajaran,
  canManageMatkul,
  canManageOwnKelasBerkas,
  currentDosenId,
}: {
  matkulItems: MatkulTestItem[];
  kelasItems: KelasTestItem[];
  berkasItems: BerkasPengajaranTestItem[];
  role: string;
  canViewPengajaran: boolean;
  canManageMatkul: boolean;
  canManageOwnKelasBerkas: boolean;
  currentDosenId: number | null;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();
  const [subTab, setSubTab] = useState<SubTabKey>("matkul");

  const [matkulForm, setMatkulForm] = useState({
    kode: "",
    nama: "",
    sks: "3",
  });
  const [editingMatkulId, setEditingMatkulId] = useState<number | null>(null);

  const [kelasForm, setKelasForm] = useState({
    matkul_id: matkulItems[0] ? String(matkulItems[0].id) : "",
    tahun_ajaran: "2025/2026",
    semester: "Ganjil" as "Ganjil" | "Genap",
  });
  const [editingKelasId, setEditingKelasId] = useState<number | null>(null);

  const [berkasForm, setBerkasForm] = useState({
    kelas_id: kelasItems[0] ? String(kelasItems[0].id) : "",
    jenis: "RPS" as (typeof JENIS_BERKAS_OPTIONS)[number],
    judul: "",
    link: "",
    keterangan: "",
  });
  const [editingBerkasId, setEditingBerkasId] = useState<number | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ApiFeedback | null>(null);

  function refreshData() {
    startRefresh(() => {
      router.refresh();
    });
  }

  async function handleTestGet(
    endpoint:
      | "/api/tridarma/pengajaran/matkul"
      | "/api/tridarma/pengajaran/kelas"
      | "/api/tridarma/pengajaran/berkas_pengajaran",
  ) {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      const payload = (await res.json().catch(() => null)) as {
        message?: string;
        items?: unknown[];
      } | null;

      if (!res.ok) {
        setFeedback({
          type: "error",
          status: res.status,
          message: parseApiMessage(payload, `GET ${endpoint} ditolak.`),
        });
        return;
      }

      const count = Array.isArray(payload?.items) ? payload.items.length : 0;
      setFeedback({
        type: "success",
        status: res.status,
        message: `GET ${endpoint} berhasil.`,
        extra: `${count} item diterima`,
      });
    } catch {
      setFeedback({
        type: "error",
        status: null,
        message: `Gagal menghubungi ${endpoint}.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitMatkul(mode: "post" | "patch") {
    if (isSubmitting) return;
    if (mode === "patch" && editingMatkulId === null) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const url =
        mode === "patch"
          ? `/api/tridarma/pengajaran/matkul/${editingMatkulId}`
          : "/api/tridarma/pengajaran/matkul";
      const res = await fetch(url, {
        method: mode === "patch" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matkulForm),
      });
      const payload = (await res.json().catch(() => null)) as {
        message?: string;
        data?: { id?: number; kode?: string };
      } | null;

      if (!res.ok) {
        setFeedback({
          type: "error",
          status: res.status,
          message: parseApiMessage(
            payload,
            "Permintaan mata kuliah gagal diproses.",
          ),
        });
        return;
      }

      setFeedback({
        type: "success",
        status: res.status,
        message: parseApiMessage(payload, "Mata kuliah berhasil disimpan."),
        extra:
          payload?.data?.id !== undefined
            ? `id: ${payload.data.id}, kode: ${payload.data.kode ?? "-"}`
            : undefined,
      });
      setEditingMatkulId(null);
      setMatkulForm({ kode: "", nama: "", sks: "3" });
      refreshData();
    } catch {
      setFeedback({
        type: "error",
        status: null,
        message: "Terjadi kesalahan jaringan saat mengirim mata kuliah.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitKelas(mode: "post" | "patch") {
    if (isSubmitting) return;
    if (mode === "patch" && editingKelasId === null) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const url =
        mode === "patch"
          ? `/api/tridarma/pengajaran/kelas/${editingKelasId}`
          : "/api/tridarma/pengajaran/kelas";
      const res = await fetch(url, {
        method: mode === "patch" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kelasForm),
      });
      const payload = (await res.json().catch(() => null)) as {
        message?: string;
        data?: { id?: number };
      } | null;

      if (!res.ok) {
        setFeedback({
          type: "error",
          status: res.status,
          message: parseApiMessage(payload, "Permintaan kelas gagal diproses."),
        });
        return;
      }

      setFeedback({
        type: "success",
        status: res.status,
        message: parseApiMessage(payload, "Kelas berhasil disimpan."),
        extra:
          payload?.data?.id !== undefined
            ? `id: ${payload.data.id}`
            : undefined,
      });
      setEditingKelasId(null);
      refreshData();
    } catch {
      setFeedback({
        type: "error",
        status: null,
        message: "Terjadi kesalahan jaringan saat mengirim kelas.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitBerkas(mode: "post" | "patch") {
    if (isSubmitting) return;
    if (mode === "patch" && editingBerkasId === null) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const url =
        mode === "patch"
          ? `/api/tridarma/pengajaran/berkas_pengajaran/${editingBerkasId}`
          : "/api/tridarma/pengajaran/berkas_pengajaran";
      const res = await fetch(url, {
        method: mode === "patch" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(berkasForm),
      });
      const payload = (await res.json().catch(() => null)) as {
        message?: string;
        data?: { id?: number; jenis?: string };
      } | null;

      if (!res.ok) {
        setFeedback({
          type: "error",
          status: res.status,
          message: parseApiMessage(
            payload,
            "Permintaan berkas pengajaran gagal diproses.",
          ),
        });
        return;
      }

      setFeedback({
        type: "success",
        status: res.status,
        message: parseApiMessage(
          payload,
          "Berkas pengajaran berhasil disimpan.",
        ),
        extra:
          payload?.data?.id !== undefined
            ? `id: ${payload.data.id}, jenis: ${payload.data.jenis ?? "-"}`
            : undefined,
      });
      setEditingBerkasId(null);
      setBerkasForm((prev) => ({
        ...prev,
        judul: "",
        link: "",
        keterangan: "",
      }));
      refreshData();
    } catch {
      setFeedback({
        type: "error",
        status: null,
        message: "Terjadi kesalahan jaringan saat mengirim berkas pengajaran.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteEntity(
    kind: "matkul" | "kelas" | "berkas_pengajaran",
    id: number,
    label: string,
  ) {
    if (deletingKey !== null || isSubmitting) return;
    if (!window.confirm(`Hapus ${label}?`)) return;

    const key = `${kind}-${id}`;
    setDeletingKey(key);
    setFeedback(null);
    try {
      const res = await fetch(`/api/tridarma/pengajaran/${kind}/${id}`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!res.ok) {
        setFeedback({
          type: "error",
          status: res.status,
          message: parseApiMessage(payload, `Gagal menghapus ${label}.`),
        });
        return;
      }

      setFeedback({
        type: "success",
        status: res.status,
        message: parseApiMessage(payload, `${label} berhasil dihapus.`),
      });
      refreshData();
    } catch {
      setFeedback({
        type: "error",
        status: null,
        message: `Terjadi kesalahan jaringan saat menghapus ${label}.`,
      });
    } finally {
      setDeletingKey(null);
    }
  }

  const inputClassName =
    "min-h-[44px] w-full rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3 py-2 text-[14px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]/70 disabled:bg-[var(--color-tint-neutral)] disabled:opacity-70";

  return (
    <section
      aria-labelledby="pengajaran-uji-heading"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2
            id="pengajaran-uji-heading"
            className="font-[family-name:var(--font-lexend)] text-[18px] font-bold text-[var(--color-text-primary)]"
          >
            Uji API CRUD Pengajaran: Matkul, Kelas, &amp; Berkas (Modul 7)
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            Aturan khusus PRD 5.4: Matkul dikelola Kaprodi &amp; Staff Kaprodi (Dosen lihat saja), Kelas &amp; Berkas dikelola Dosen sendiri (Kaprodi &amp; Staff Kaprodi lihat saja). Mahasiswa &amp; Umum ditolak (403/401).
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

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            {
              key: "matkul",
              label: `1. Mata Kuliah (${matkulItems.length})`,
            },
            {
              key: "kelas",
              label: `2. Kelas (${kelasItems.length})`,
            },
            {
              key: "berkas",
              label: `3. Berkas Pengajaran (${berkasItems.length})`,
            },
          ] as const
        ).map((tab) => {
          const active = subTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setSubTab(tab.key);
                setFeedback(null);
              }}
              className={`inline-flex min-h-[44px] items-center justify-center rounded-[10px] px-3.5 py-2 text-[13px] font-semibold transition-colors ${
                active
                  ? "bg-[var(--color-text-primary)] text-white"
                  : "border border-[var(--color-border-strong)] bg-white text-[var(--color-text-primary)] hover:bg-[var(--color-tint-neutral)]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
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

      {subTab === "matkul" && (
        <div className="flex flex-col gap-5">
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              void submitMatkul(editingMatkulId !== null ? "patch" : "post");
            }}
            className="flex flex-col gap-4 rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-[family-name:var(--font-lexend)] text-[15px] font-semibold text-[var(--color-text-primary)]">
                {editingMatkulId !== null
                  ? `Mode Edit Mata Kuliah (ID: ${editingMatkulId})`
                  : "Tambah Mata Kuliah (POST /api/tridarma/pengajaran/matkul)"}
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void handleTestGet("/api/tridarma/pengajaran/matkul")
                  }
                  disabled={isSubmitting}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)]"
                >
                  Uji GET Matkul
                </button>
                {editingMatkulId !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMatkulId(null);
                      setMatkulForm({ kode: "", nama: "", sks: "3" });
                    }}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)]"
                  >
                    Batal Edit
                  </button>
                )}
              </div>
            </div>

            <p
              role="status"
              className="rounded-[10px] border border-[var(--color-border-default)] bg-white px-3.5 py-2.5 text-[13px] text-[var(--color-text-secondary)]"
            >
              Role Anda: <strong className="text-[var(--color-text-primary)]">{role}</strong>{" "}
              ({canManageMatkul ? "Diizinkan CRUD Matkul" : "Tidak punya izin tulis Matkul; form tetap aktif untuk menguji penolakan 403/401"}).
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="matkul-kode"
                  className="text-[13px] font-semibold text-[var(--color-text-primary)]"
                >
                  Kode Matkul (wajib, unik)
                </label>
                <input
                  id="matkul-kode"
                  type="text"
                  value={matkulForm.kode}
                  onChange={(e) =>
                    setMatkulForm((prev) => ({ ...prev, kode: e.target.value }))
                  }
                  placeholder="Contoh: RPL101"
                  disabled={isSubmitting}
                  className={inputClassName}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label
                  htmlFor="matkul-nama"
                  className="text-[13px] font-semibold text-[var(--color-text-primary)]"
                >
                  Nama Mata Kuliah (wajib)
                </label>
                <input
                  id="matkul-nama"
                  type="text"
                  value={matkulForm.nama}
                  onChange={(e) =>
                    setMatkulForm((prev) => ({ ...prev, nama: e.target.value }))
                  }
                  placeholder="Contoh: Rekayasa Perangkat Lunak"
                  disabled={isSubmitting}
                  className={inputClassName}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="matkul-sks"
                  className="text-[13px] font-semibold text-[var(--color-text-primary)]"
                >
                  SKS (wajib, 1 - 24)
                </label>
                <input
                  id="matkul-sks"
                  type="number"
                  min={1}
                  max={24}
                  value={matkulForm.sks}
                  onChange={(e) =>
                    setMatkulForm((prev) => ({ ...prev, sks: e.target.value }))
                  }
                  disabled={isSubmitting}
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {editingMatkulId !== null ? (
                <>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-[var(--color-primary-strong)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-55"
                  >
                    {isSubmitting ? "Mengirim..." : "Simpan Edit (PATCH)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitMatkul("post")}
                    disabled={isSubmitting}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)] disabled:opacity-55"
                  >
                    Kirim sebagai POST Baru (Uji 409)
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-[var(--color-primary-strong)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-55"
                >
                  {isSubmitting ? "Mengirim..." : "Kirim POST Matkul"}
                </button>
              )}
            </div>
          </form>

          {!canViewPengajaran ? (
            <p
              role="status"
              className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-4 py-6 text-center text-[13px] text-[var(--color-text-secondary)]"
            >
              Role {role} tidak memiliki akses baca pengajaran. Gunakan tombol Uji GET atau Kirim POST di atas untuk menguji respons 401/403 dari API.
            </p>
          ) : matkulItems.length === 0 ? (
            <p
              role="status"
              className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-4 py-6 text-center text-[13px] text-[var(--color-text-secondary)]"
            >
              Belum ada data mata kuliah.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[12px] border border-[var(--color-border-default)]">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
                  <tr className="border-b border-[var(--color-border-default)]">
                    <th className="px-3.5 py-2.5 font-semibold">ID &amp; Kode</th>
                    <th className="px-3.5 py-2.5 font-semibold">Nama Mata Kuliah</th>
                    <th className="px-3.5 py-2.5 font-semibold">SKS</th>
                    <th className="px-3.5 py-2.5 font-semibold">Dipakai Kelas</th>
                    <th className="px-3.5 py-2.5 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-default)] bg-white">
                  {matkulItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3.5 py-2.5 font-bold text-[var(--color-text-primary)]">
                        #{item.id} {item.kode}
                      </td>
                      <td className="px-3.5 py-2.5 text-[var(--color-text-primary)]">
                        {item.nama}
                      </td>
                      <td className="px-3.5 py-2.5 text-[var(--color-text-secondary)]">
                        {item.sks} SKS
                      </td>
                      <td className="px-3.5 py-2.5 text-[var(--color-text-secondary)]">
                        {item.jumlah_kelas} kelas
                      </td>
                      <td className="px-3.5 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMatkulId(item.id);
                              setMatkulForm({
                                kode: item.kode,
                                nama: item.nama,
                                sks: String(item.sks),
                              });
                              setFeedback(null);
                            }}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-tint-neutral)]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteEntity(
                                "matkul",
                                item.id,
                                `mata kuliah ${item.kode}`,
                              )
                            }
                            disabled={deletingKey !== null || isSubmitting}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-danger-solid)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--color-danger-solid)] hover:bg-[var(--color-danger-bg)] disabled:opacity-55"
                          >
                            {deletingKey === `matkul-${item.id}`
                              ? "Menghapus..."
                              : "Hapus"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === "kelas" && (
        <div className="flex flex-col gap-5">
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              void submitKelas(editingKelasId !== null ? "patch" : "post");
            }}
            className="flex flex-col gap-4 rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-[family-name:var(--font-lexend)] text-[15px] font-semibold text-[var(--color-text-primary)]">
                {editingKelasId !== null
                  ? `Mode Edit Kelas (ID: ${editingKelasId})`
                  : "Tambah Kelas (POST /api/tridarma/pengajaran/kelas)"}
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void handleTestGet("/api/tridarma/pengajaran/kelas")
                  }
                  disabled={isSubmitting}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)]"
                >
                  Uji GET Kelas
                </button>
                {editingKelasId !== null && (
                  <button
                    type="button"
                    onClick={() => setEditingKelasId(null)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)]"
                  >
                    Batal Edit
                  </button>
                )}
              </div>
            </div>

            <p
              role="status"
              className="rounded-[10px] border border-[var(--color-border-default)] bg-white px-3.5 py-2.5 text-[13px] text-[var(--color-text-secondary)]"
            >
              Role Anda: <strong className="text-[var(--color-text-primary)]">{role}</strong>{" "}
              (Dosen ID:{" "}
              <strong className="text-[var(--color-text-primary)]">
                {currentDosenId ?? "belum isi sinta_id"}
              </strong>
              ).{" "}
              {canManageOwnKelasBerkas
                ? "Diizinkan CRUD Kelas milik sendiri."
                : "Kaprodi/Staff/Mahasiswa/Umum ditolak 403/401 saat tulis kelas; form tetap aktif untuk uji penolakan."}
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="kelas-matkul-id"
                  className="text-[13px] font-semibold text-[var(--color-text-primary)]"
                >
                  Mata Kuliah (wajib)
                </label>
                {matkulItems.length > 0 ? (
                  <select
                    id="kelas-matkul-id"
                    value={kelasForm.matkul_id}
                    onChange={(e) =>
                      setKelasForm((prev) => ({
                        ...prev,
                        matkul_id: e.target.value,
                      }))
                    }
                    disabled={isSubmitting}
                    className={inputClassName}
                  >
                    <option value="">Pilih mata kuliah</option>
                    {matkulItems.map((m) => (
                      <option key={m.id} value={String(m.id)}>
                        #{m.id} {m.kode} - {m.nama} ({m.sks} SKS)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="kelas-matkul-id"
                    type="number"
                    min={1}
                    value={kelasForm.matkul_id}
                    onChange={(e) =>
                      setKelasForm((prev) => ({
                        ...prev,
                        matkul_id: e.target.value,
                      }))
                    }
                    placeholder="ID matkul (mis. 1)"
                    disabled={isSubmitting}
                    className={inputClassName}
                  />
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="kelas-tahun-ajaran"
                  className="text-[13px] font-semibold text-[var(--color-text-primary)]"
                >
                  Tahun Ajaran (wajib, YYYY/YYYY)
                </label>
                <input
                  id="kelas-tahun-ajaran"
                  type="text"
                  value={kelasForm.tahun_ajaran}
                  onChange={(e) =>
                    setKelasForm((prev) => ({
                      ...prev,
                      tahun_ajaran: e.target.value,
                    }))
                  }
                  placeholder="Contoh: 2025/2026"
                  disabled={isSubmitting}
                  className={inputClassName}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="kelas-semester"
                  className="text-[13px] font-semibold text-[var(--color-text-primary)]"
                >
                  Semester (wajib)
                </label>
                <select
                  id="kelas-semester"
                  value={kelasForm.semester}
                  onChange={(e) =>
                    setKelasForm((prev) => ({
                      ...prev,
                      semester:
                        e.target.value === "Genap" ? "Genap" : "Ganjil",
                    }))
                  }
                  disabled={isSubmitting}
                  className={inputClassName}
                >
                  <option value="Ganjil">Ganjil</option>
                  <option value="Genap">Genap</option>
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {editingKelasId !== null ? (
                <>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-[var(--color-primary-strong)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-55"
                  >
                    {isSubmitting ? "Mengirim..." : "Simpan Edit (PATCH)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitKelas("post")}
                    disabled={isSubmitting}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)] disabled:opacity-55"
                  >
                    Kirim sebagai POST Baru (Uji 409)
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-[var(--color-primary-strong)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-55"
                >
                  {isSubmitting ? "Mengirim..." : "Kirim POST Kelas"}
                </button>
              )}
            </div>
          </form>

          {!canViewPengajaran ? (
            <p
              role="status"
              className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-4 py-6 text-center text-[13px] text-[var(--color-text-secondary)]"
            >
              Role {role} tidak memiliki akses baca kelas.
            </p>
          ) : kelasItems.length === 0 ? (
            <p
              role="status"
              className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-4 py-6 text-center text-[13px] text-[var(--color-text-secondary)]"
            >
              Belum ada data kelas yang ditampilkan.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[12px] border border-[var(--color-border-default)]">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
                  <tr className="border-b border-[var(--color-border-default)]">
                    <th className="px-3.5 py-2.5 font-semibold">ID &amp; Mata Kuliah</th>
                    <th className="px-3.5 py-2.5 font-semibold">Tahun Ajaran / Semester</th>
                    <th className="px-3.5 py-2.5 font-semibold">Dosen Pengampu</th>
                    <th className="px-3.5 py-2.5 font-semibold">Berkas</th>
                    <th className="px-3.5 py-2.5 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-default)] bg-white">
                  {kelasItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3.5 py-2.5 text-[var(--color-text-primary)]">
                        <span className="font-bold">
                          #{item.id} {item.matkul_kode}
                        </span>{" "}
                        - {item.matkul_nama}
                      </td>
                      <td className="px-3.5 py-2.5 text-[var(--color-text-secondary)]">
                        {item.tahun_ajaran} ({item.semester})
                      </td>
                      <td className="px-3.5 py-2.5 text-[var(--color-text-secondary)]">
                        ID {item.dosen_id}{" "}
                        {item.dosen_nama ? `(${item.dosen_nama})` : ""}{" "}
                        {currentDosenId === item.dosen_id
                          ? "[Milik Anda]"
                          : "[Dosen lain]"}
                      </td>
                      <td className="px-3.5 py-2.5 text-[var(--color-text-secondary)]">
                        {item.jumlah_berkas} berkas
                      </td>
                      <td className="px-3.5 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingKelasId(item.id);
                              setKelasForm({
                                matkul_id: String(item.matkul_id),
                                tahun_ajaran: item.tahun_ajaran,
                                semester: item.semester,
                              });
                              setFeedback(null);
                            }}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-tint-neutral)]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteEntity(
                                "kelas",
                                item.id,
                                `kelas #${item.id} (${item.matkul_kode})`,
                              )
                            }
                            disabled={deletingKey !== null || isSubmitting}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-danger-solid)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--color-danger-solid)] hover:bg-[var(--color-danger-bg)] disabled:opacity-55"
                          >
                            {deletingKey === `kelas-${item.id}`
                              ? "Menghapus..."
                              : "Hapus"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {subTab === "berkas" && (
        <div className="flex flex-col gap-5">
          <form
            onSubmit={(e: FormEvent<HTMLFormElement>) => {
              e.preventDefault();
              void submitBerkas(editingBerkasId !== null ? "patch" : "post");
            }}
            className="flex flex-col gap-4 rounded-[14px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-[family-name:var(--font-lexend)] text-[15px] font-semibold text-[var(--color-text-primary)]">
                {editingBerkasId !== null
                  ? `Mode Edit Berkas Pengajaran (ID: ${editingBerkasId})`
                  : "Tambah Berkas Pengajaran (POST /api/tridarma/pengajaran/berkas_pengajaran)"}
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void handleTestGet(
                      "/api/tridarma/pengajaran/berkas_pengajaran",
                    )
                  }
                  disabled={isSubmitting}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)]"
                >
                  Uji GET Berkas
                </button>
                {editingBerkasId !== null && (
                  <button
                    type="button"
                    onClick={() => setEditingBerkasId(null)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3.5 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)]"
                  >
                    Batal Edit
                  </button>
                )}
              </div>
            </div>

            <p
              role="status"
              className="rounded-[10px] border border-[var(--color-border-default)] bg-white px-3.5 py-2.5 text-[13px] text-[var(--color-text-secondary)]"
            >
              Satu kelas boleh memiliki lebih dari satu berkas dengan jenis yang sama (mis. dua Kuis). Link wajib berupa URL http:// atau https://.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="berkas-kelas-id"
                  className="text-[13px] font-semibold text-[var(--color-text-primary)]"
                >
                  Kelas (wajib)
                </label>
                {kelasItems.length > 0 ? (
                  <select
                    id="berkas-kelas-id"
                    value={berkasForm.kelas_id}
                    onChange={(e) =>
                      setBerkasForm((prev) => ({
                        ...prev,
                        kelas_id: e.target.value,
                      }))
                    }
                    disabled={isSubmitting}
                    className={inputClassName}
                  >
                    <option value="">Pilih kelas</option>
                    {kelasItems.map((k) => (
                      <option key={k.id} value={String(k.id)}>
                        #{k.id} {k.matkul_kode} ({k.tahun_ajaran} {k.semester}) - Dosen ID {k.dosen_id}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="berkas-kelas-id"
                    type="number"
                    min={1}
                    value={berkasForm.kelas_id}
                    onChange={(e) =>
                      setBerkasForm((prev) => ({
                        ...prev,
                        kelas_id: e.target.value,
                      }))
                    }
                    placeholder="ID kelas (mis. 1)"
                    disabled={isSubmitting}
                    className={inputClassName}
                  />
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="berkas-jenis"
                  className="text-[13px] font-semibold text-[var(--color-text-primary)]"
                >
                  Jenis Berkas (wajib)
                </label>
                <select
                  id="berkas-jenis"
                  value={berkasForm.jenis}
                  onChange={(e) =>
                    setBerkasForm((prev) => ({
                      ...prev,
                      jenis: e.target
                        .value as (typeof JENIS_BERKAS_OPTIONS)[number],
                    }))
                  }
                  disabled={isSubmitting}
                  className={inputClassName}
                >
                  {JENIS_BERKAS_OPTIONS.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="berkas-judul"
                  className="text-[13px] font-semibold text-[var(--color-text-primary)]"
                >
                  Judul Berkas (opsional)
                </label>
                <input
                  id="berkas-judul"
                  type="text"
                  value={berkasForm.judul}
                  onChange={(e) =>
                    setBerkasForm((prev) => ({
                      ...prev,
                      judul: e.target.value,
                    }))
                  }
                  placeholder="Contoh: Kuis 1 Minggu 3"
                  disabled={isSubmitting}
                  className={inputClassName}
                />
              </div>

              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label
                  htmlFor="berkas-link"
                  className="text-[13px] font-semibold text-[var(--color-text-primary)]"
                >
                  Link Berkas (wajib, URL http:// atau https://)
                </label>
                <input
                  id="berkas-link"
                  type="text"
                  value={berkasForm.link}
                  onChange={(e) =>
                    setBerkasForm((prev) => ({ ...prev, link: e.target.value }))
                  }
                  placeholder="Contoh: https://drive.google.com/file/d/123/view"
                  disabled={isSubmitting}
                  className={inputClassName}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="berkas-keterangan"
                  className="text-[13px] font-semibold text-[var(--color-text-primary)]"
                >
                  Keterangan (opsional)
                </label>
                <input
                  id="berkas-keterangan"
                  type="text"
                  value={berkasForm.keterangan}
                  onChange={(e) =>
                    setBerkasForm((prev) => ({
                      ...prev,
                      keterangan: e.target.value,
                    }))
                  }
                  placeholder="Catatan tambahan"
                  disabled={isSubmitting}
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {editingBerkasId !== null ? (
                <>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-[var(--color-primary-strong)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-55"
                  >
                    {isSubmitting ? "Mengirim..." : "Simpan Edit (PATCH)"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitBerkas("post")}
                    disabled={isSubmitting}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)] disabled:opacity-55"
                  >
                    Kirim sebagai POST Baru
                  </button>
                </>
              ) : (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-[var(--color-primary-strong)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-primary)] disabled:opacity-55"
                >
                  {isSubmitting ? "Mengirim..." : "Kirim POST Berkas"}
                </button>
              )}
            </div>
          </form>

          {!canViewPengajaran ? (
            <p
              role="status"
              className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-4 py-6 text-center text-[13px] text-[var(--color-text-secondary)]"
            >
              Role {role} tidak memiliki akses baca berkas pengajaran.
            </p>
          ) : berkasItems.length === 0 ? (
            <p
              role="status"
              className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] px-4 py-6 text-center text-[13px] text-[var(--color-text-secondary)]"
            >
              Belum ada data berkas pengajaran yang ditampilkan.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[12px] border border-[var(--color-border-default)]">
              <table className="w-full border-collapse text-left text-[13px]">
                <thead className="bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
                  <tr className="border-b border-[var(--color-border-default)]">
                    <th className="px-3.5 py-2.5 font-semibold">ID &amp; Jenis</th>
                    <th className="px-3.5 py-2.5 font-semibold">Kelas</th>
                    <th className="px-3.5 py-2.5 font-semibold">Judul &amp; Link</th>
                    <th className="px-3.5 py-2.5 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-default)] bg-white">
                  {berkasItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="font-bold text-[var(--color-text-primary)]">
                          #{item.id}
                        </span>{" "}
                        <span className="inline-block rounded-[6px] bg-[var(--color-tint-primary)] px-2 py-0.5 text-[11px] font-bold text-[var(--color-primary-strong)]">
                          {item.jenis}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-[var(--color-text-secondary)]">
                        {item.kelas_label} (Dosen ID {item.dosen_id})
                      </td>
                      <td className="px-3.5 py-2.5 text-[var(--color-text-primary)]">
                        <div className="font-semibold">
                          {item.judul ?? "(Tanpa judul)"}
                        </div>
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12px] text-[var(--color-primary-strong)] underline"
                        >
                          {item.link}
                        </a>
                        {item.keterangan && (
                          <div className="text-[12px] text-[var(--color-text-secondary)]">
                            {item.keterangan}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBerkasId(item.id);
                              setBerkasForm({
                                kelas_id: String(item.kelas_id),
                                jenis: item.jenis,
                                judul: item.judul ?? "",
                                link: item.link,
                                keterangan: item.keterangan ?? "",
                              });
                              setFeedback(null);
                            }}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-tint-neutral)]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleDeleteEntity(
                                "berkas_pengajaran",
                                item.id,
                                `berkas #${item.id} (${item.jenis})`,
                              )
                            }
                            disabled={deletingKey !== null || isSubmitting}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-danger-solid)] bg-white px-3 py-1.5 text-[13px] font-semibold text-[var(--color-danger-solid)] hover:bg-[var(--color-danger-bg)] disabled:opacity-55"
                          >
                            {deletingKey === `berkas_pengajaran-${item.id}`
                              ? "Menghapus..."
                              : "Hapus"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
