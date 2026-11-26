import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import {
  Activity,
  BadgeCheck,
  BookCopy,
  BookOpen,
  Microscope,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getSession } from "@/lib/session";
import { resolveTridharmaScope } from "@/lib/tridharma-scope";
import {
  getDaftarDosen,
  getDosenProfil,
  getTridharmaDashboard,
  semesterSekarang,
} from "@/lib/tridharma-dashboard";
import StatCard from "@/components/Tridharma/Dashboard/StatCard";
import DaftarDosen from "@/components/Tridharma/DaftarDosen";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ---------- Konfigurasi ---------- */

// Tujuan saat nama dosen diklik: dashboard ini lagi, tapi khusus dosen yang dipilih
const BASE_PATH = "/tridharma/dashboard";
const HREF_DOSEN = `${BASE_PATH}?dosen=`;

type SearchParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const kategoriStyle: Record<string, { badge: string; dot: string }> = {
  Penelitian: { badge: "bg-[var(--color-tint-secondary)] text-[var(--color-primary-strong)]", dot: "bg-[var(--color-primary-strong)]" },
  Pengabdian: { badge: "bg-[var(--color-tint-sky)] text-[var(--color-text-ink)]", dot: "bg-[var(--color-secondary)]" },
  Buku: { badge: "bg-[var(--color-tint-accent)] text-[var(--color-warning-text)]", dot: "bg-[var(--color-accent)]" },
};

const cardClass = "overflow-hidden rounded-xl bg-[var(--color-bg-surface)] shadow-sm";

/* ---------- Sub-komponen ---------- */

// Subheader kartu, sama seperti "Data Rekapitulasi Berkas Arsip"
function CardHeader({ icon: Icon, title, desc }: { icon: typeof Users; title: string; desc?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--color-tint-primary)] px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className="size-[14px] text-[var(--color-primary-strong)]" aria-hidden />
        <h2 className="text-base font-bold leading-6 text-[var(--color-text-ink)]">{title}</h2>
      </div>
      {desc && <p className="text-[13px] leading-[18px] text-[var(--color-text-secondary)]">{desc}</p>}
    </div>
  );
}

/* ---------- Bagian yang butuh data (async) ---------- */

async function DashboardContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  // Tandai halaman ini dinamis (dipakai karena membaca tanggal hari ini)
  await connection();
  const sp = await searchParams;
  const session = await getSession();
  const nama = session?.name ?? "Pengguna";
  const semester = semesterSekarang();

  // Dosen & Kaprodi: data milik sendiri. Role lain: gabungan semua dosen,
  // sampai salah satu dosen dipilih (?dosen=ID) → tampil khusus dosen itu saja.
  const { personal, dosenId, belumTerhubung, milikSendiri } = resolveTridharmaScope(session, first(sp.dosen));
  const lihatDosenLain = dosenId !== undefined && !milikSendiri;

  const [dataRaw, daftarSemua, profil] = await Promise.all([
    belumTerhubung ? null : getTridharmaDashboard(dosenId),
    getDaftarDosen(),
    dosenId !== undefined ? getDosenProfil(dosenId) : null,
  ]);

  // Dosen yang login tidak perlu muncul di daftar (datanya sudah tampil sebagai miliknya)
  const daftarDosen = daftarSemua.filter((d) => d.id !== session?.dosen_id);

  const dosenTidakAda = dosenId !== undefined && !profil;
  const data = dosenTidakAda ? null : dataRaw;

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
    <>
      {/* Banner */}
      <section
        className="rounded-xl p-6 text-[var(--color-text-inverse)]"
        style={{
          backgroundImage:
            "linear-gradient(110deg, var(--color-primary-strong) 45%, color-mix(in oklab, var(--color-primary-strong) 55%, var(--color-secondary)))",
        }}
      >
        <h1 className="font-heading text-[28px] font-bold leading-9 tracking-[-0.7px]">
          {lihatDosenLain ? (
            <>Tridharma {profil?.nama ?? "Dosen"}</>
          ) : (
            <>
              {personal ? "Selamat Datang kembali" : "Selamat Datang"}, {nama} <span aria-hidden>👋</span>
            </>
          )}
        </h1>
        <p className="mt-1 text-sm leading-5 opacity-90">
          {lihatDosenLain
            ? "Ringkasan Tridharma dosen Prodi Rekayasa Perangkat Lunak UPI"
            : personal
              ? "Portal Pelaporan Tridharma Dosen Prodi Rekayasa Perangkat Lunak UPI"
              : "Ringkasan Tridharma seluruh dosen Prodi Rekayasa Perangkat Lunak UPI"}{" "}
          — {semester}.
          {personal && lihatDosenLain && (
            <>
              {" · "}
              <Link href={BASE_PATH} className="font-semibold underline">
                Kembali ke dashboard saya
              </Link>
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-[var(--color-bg-surface)] px-2.5 py-1 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-primary-strong)]">
            {profil?.departemen ?? "Rekayasa Perangkat Lunak"}
          </span>
          {milikSendiri && session?.nip && (
            <span className="rounded-full bg-[var(--color-bg-surface)] px-2.5 py-1 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-primary-strong)]">
              NIP: {session.nip}
            </span>
          )}
          {lihatDosenLain && !dosenTidakAda && (
            <Link
              href={`/tridharma/publikasi?dosen=${dosenId}`}
              className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-text-inverse)] hover:bg-white/25"
            >
              Lihat publikasi
            </Link>
          )}

        </div>
      </section>

      {/* Kartu statistik */}
      {belumTerhubung || !data || !stats ? (
        <section className={cn(cardClass, "p-6 text-sm text-[var(--color-text-secondary)]")}>
          {dosenTidakAda
            ? "Dosen yang dipilih tidak ditemukan. Pilih dosen lain dari daftar dosen."
            : "Akun ini belum terhubung ke data dosen, jadi statistik pribadi belum bisa ditampilkan."}
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

      {/* Pilih dosen: tampil untuk SEMUA role (Dosen/Kaprodi tetap bisa melihat dosen lain) */}
      <DaftarDosen
        dosen={daftarDosen}
        hrefBase={HREF_DOSEN}
        desc={`Pilih dosen untuk melihat publikasi dan kegiatannya (${daftarDosen.length} dosen)`}
      />

      {/* Aktivitas terbaru */}
      {data && (
        <section className={cardClass}>
          <CardHeader
            icon={Activity}
            title="Aktivitas Terbaru"
            desc={
              dosenId === undefined
                ? "Kegiatan dan buku terbaru dari seluruh dosen"
                : milikSendiri
                  ? "Kegiatan dan buku milik kamu"
                  : `Kegiatan dan buku ${profil?.nama ?? "dosen ini"}`
            }
          />
          <Table className="min-w-[640px]">
            <TableHeader className="bg-[var(--color-tint-primary)] [&_tr]:border-0">
              <TableRow className="border-0 hover:bg-transparent">
                {["Judul Kegiatan / Berkas", "Kategori", "Tahun"].map((h, i) => (
                  <TableHead
                    key={h}
                    className={cn(
                      "h-auto px-4 py-[22px] text-xs font-semibold uppercase leading-4 tracking-[0.6px] text-[var(--color-text-secondary)]",
                      i === 0 && "pr-6",
                      i === 2 && "w-[110px]"
                    )}
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.aktivitas.length === 0 && (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell colSpan={3} className="py-12 text-center text-sm text-[var(--color-text-secondary)]">
                    Belum ada aktivitas tercatat.
                  </TableCell>
                </TableRow>
              )}
              {data.aktivitas.map((a) => {
                const style = kategoriStyle[a.kategori];
                return (
                  <TableRow key={`${a.kategori}-${a.judul}`} className="h-[60px] border-0">
                    <TableCell className="whitespace-normal py-5 pr-6 text-sm font-semibold leading-5 text-[var(--color-text-ink)]">
                      {a.judul}
                      {a.detail && (
                        <span className="block text-xs font-normal leading-4 tracking-[0.24px] text-[var(--color-text-secondary)]">
                          {a.detail}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold leading-[14px] tracking-[0.44px]",
                          style.badge
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", style.dot)} />
                        {a.kategori}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 text-xs font-semibold leading-4 tracking-[0.24px] text-[var(--color-text-ink)]">
                      {a.tahun ?? "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      )}
    </>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="h-[140px] animate-pulse rounded-xl bg-[var(--color-bg-surface)]" />
      <div className="h-[200px] animate-pulse rounded-xl bg-[var(--color-bg-surface)]" />
      <div className="h-[320px] animate-pulse rounded-xl bg-[var(--color-bg-surface)]" />
    </>
  );
}

/* ---------- Halaman ---------- */

export default function TridharmaDashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex flex-col gap-6 px-6 pt-4">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
