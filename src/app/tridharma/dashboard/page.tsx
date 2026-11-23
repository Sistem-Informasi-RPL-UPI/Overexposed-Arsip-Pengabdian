import { Suspense } from "react";
import Link from "next/link";
import { BadgeCheck, BookCopy, BookOpen, ChevronRight, Microscope, Users } from "lucide-react";
import { getSession } from "@/lib/session";
import { normalizeRole } from "@/lib/rbac";
import {
  getDaftarDosen,
  getDosenProfil,
  getTridharmaDashboard,
  semesterSekarang,
} from "@/lib/tridharma-dashboard";
import StatCard from "@/components/Tridharma/Dashboard/StatCard";

// Tujuan saat nama dosen diklik. Ganti sesuai halaman detail yang kamu buat.
const hrefDetailDosen = (id: number) => `/tridharma/publikasi?dosen=${id}`;

function inisial(nama: string) {
  return nama
    .replace(/^(dr|prof|ir)\.?\s*/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

async function DashboardContent() {
  const session = await getSession();
  const role = normalizeRole(session?.role);
  const nama = session?.name ?? "Pengguna";
  const semester = semesterSekarang();

  // Dosen & Kaprodi: data milik sendiri. Role lain: gabungan semua dosen.
  const personal = role === "Dosen" || role === "Kaprodi";
  const dosenId = session?.dosen_id ?? null;
  const belumTerhubung = personal && dosenId === null;

  const [data, daftarDosen, profil] = await Promise.all([
    belumTerhubung ? null : getTridharmaDashboard(personal ? (dosenId as number) : undefined),
    personal ? Promise.resolve([]) : getDaftarDosen(),
    personal && dosenId !== null ? getDosenProfil(dosenId) : null,
  ]);

  const stats = data && [
    { icon: Microscope, label: "Penelitian", total: `${data.penelitian} Total`, value: String(data.penelitian), unit: "Kegiatan" },
    { icon: BadgeCheck, label: "IPRS Pengabdian", total: `${data.iprs} Total`, value: String(data.iprs), unit: "Berkas" },
    { icon: Users, label: "Pengabdian (PkM)", total: `${data.pengabdian} Total`, value: String(data.pengabdian), unit: "Program" },
    {
      icon: BookOpen,
      label: "Publikasi Ilmiah",
      total: `${data.publikasi} Total`,
      value: String(data.publikasi),
      unit: "Artikel",
      notes: [`Kuartil Q1/Q2 (${data.publikasiQ12})`],
    },
    { icon: BookCopy, label: "Buku & Monograf", total: `${data.buku} Total`, value: String(data.buku), unit: "Judul" },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Banner */}
      <section
        className="rounded-[18px] p-6 text-[var(--color-text-inverse)] lg:p-8"
        style={{
          backgroundImage:
            "linear-gradient(110deg, var(--color-primary-strong) 45%, color-mix(in oklab, var(--color-primary-strong) 55%, var(--color-secondary)))",
        }}
      >
        <h1 className="font-[family-name:var(--font-lexend)] text-[24px] font-bold leading-[1.1] lg:text-[32px]">
          {personal ? "Selamat Datang kembali" : "Selamat Datang"}, {nama} <span aria-hidden="true">👋</span>
        </h1>
        <p className="mt-2 text-[13px] opacity-90 lg:text-[16px]">
          {personal
            ? "Portal Pelaporan Tridharma Dosen Prodi Rekayasa Perangkat Lunak UPI"
            : "Ringkasan Tridharma seluruh dosen Prodi Rekayasa Perangkat Lunak UPI"}{" "}
          — {semester}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-[13px] font-bold text-[var(--color-primary-strong)]">
          <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1">
            {profil?.departemen ?? "Rekayasa Perangkat Lunak"}
          </span>
          {personal && session?.nip && (
            <span className="rounded-full bg-[var(--color-bg-surface)] px-3 py-1">NIP: {session.nip}</span>
          )}
        </div>
      </section>

      {belumTerhubung || !data || !stats ? (
        <section className="rounded-[18px] bg-[var(--color-bg-surface)] p-6 text-[13px] text-[var(--color-text-secondary)] shadow-sm lg:text-[16px]">
          Akun ini belum terhubung ke data dosen, jadi statistik pribadi belum bisa ditampilkan.
        </section>
      ) : (
        <section
          aria-label="Ringkasan Tridharma"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
        >
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </section>
      )}

      {/* Daftar dosen (bisa diklik): hanya Mahasiswa, Umum, Staff, Admin */}
      {!personal && (
      <section className="rounded-[18px] bg-[var(--color-bg-surface)] p-4 shadow-sm lg:p-6">
        <h2 className="font-[family-name:var(--font-lexend)] text-[20px] font-semibold text-[var(--color-text-primary)]">
          Daftar Dosen
        </h2>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          Pilih nama dosen untuk melihat publikasi dan kegiatannya ({daftarDosen.length} dosen).
        </p>

        {daftarDosen.length === 0 ? (
          <p className="mt-4 text-[13px] text-[var(--color-text-muted)]">Belum ada data dosen.</p>
        ) : (
          <ul className="mt-4 grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
            {daftarDosen.map((d) => (
              <li key={d.id}>
                <Link
                  href={hrefDetailDosen(d.id)}
                  className="flex min-h-[44px] items-center gap-3 rounded-[12px] border border-[var(--color-border-default)] p-3 transition-colors hover:bg-[var(--color-tint-primary)]"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-tint-primary)] text-[13px] font-bold text-[var(--color-primary-strong)]"
                  >
                    {inisial(d.nama ?? "?")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-bold text-[var(--color-text-primary)]">
                      {d.nama}
                    </span>
                    <span className="block truncate text-[13px] text-[var(--color-text-muted)]">
                      {d.departemen ?? "Rekayasa Perangkat Lunak"}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {/* Aktivitas terbaru */}
      {data && (
        <section className="rounded-[18px] bg-[var(--color-bg-surface)] p-4 shadow-sm lg:p-6">
          <h2 className="font-[family-name:var(--font-lexend)] text-[20px] font-semibold text-[var(--color-text-primary)]">
            Aktivitas Terbaru
          </h2>
          <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
            {personal ? "Kegiatan dan buku milik kamu." : "Kegiatan dan buku terbaru dari seluruh dosen."}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <thead>
                <tr className="bg-[var(--color-tint-primary)] text-[var(--color-text-primary)]">
                  <th className="rounded-l-[12px] px-4 py-3 font-bold">Judul Kegiatan / Berkas</th>
                  <th className="px-4 py-3 font-bold">Kategori</th>
                  <th className="rounded-r-[12px] px-4 py-3 font-bold">Tahun</th>
                </tr>
              </thead>
              <tbody>
                {data.aktivitas.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-[var(--color-text-muted)]">
                      Belum ada aktivitas tercatat.
                    </td>
                  </tr>
                ) : (
                  data.aktivitas.map((a) => (
                    <tr
                      key={`${a.kategori}-${a.judul}`}
                      className="border-b border-[var(--color-border-default)] last:border-0"
                    >
                      <td className="px-4 py-4">
                        <p className="max-w-[360px] truncate font-bold text-[var(--color-text-primary)]">{a.judul}</p>
                        {a.detail && <p className="max-w-[360px] truncate text-[var(--color-text-muted)]">{a.detail}</p>}
                      </td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-[var(--color-tint-secondary)] px-2 py-0.5 font-bold text-[var(--color-primary-strong)]">
                          {a.kategori}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-semibold text-[var(--color-text-primary)]">{a.tahun ?? "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default function TridharmaDashboardPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-[18px] bg-[var(--color-tint-neutral)]" />}>
      <DashboardContent />
    </Suspense>
  );
}
