import { Suspense } from "react";
import Link from "next/link";
import {
  Activity,
  BadgeCheck,
  BookCopy,
  BookOpen,
  ChevronRight,
  Microscope,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getSession } from "@/lib/session";
import { normalizeRole } from "@/lib/rbac";
import {
  getDaftarDosen,
  getDosenProfil,
  getTridharmaDashboard,
  semesterSekarang,
} from "@/lib/tridharma-dashboard";
import StatCard from "@/components/Tridharma/Dashboard/StatCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ---------- Konfigurasi ---------- */

// Tujuan saat nama dosen diklik. Ganti sesuai halaman detail yang kamu buat.
const hrefDetailDosen = (id: number) => `/tridharma/publikasi?dosen=${id}`;

const kategoriStyle: Record<string, { badge: string; dot: string }> = {
  Penelitian: { badge: "bg-[#e2e7ff] text-[#173bab]", dot: "bg-[#1e40af]" },
  Pengabdian: { badge: "bg-[#c9e6ff] text-[#001e2f]", dot: "bg-[#006591]" },
  Buku: { badge: "bg-[#dde1ff] text-[#173bab]", dot: "bg-[#00288e]" },
};

const cardClass = "overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]";

function inisial(nama: string) {
  return nama
    .replace(/^(dr|prof|ir)\.?\s*/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

/* ---------- Sub-komponen ---------- */

// Subheader kartu, sama seperti "Data Rekapitulasi Berkas Arsip"
function CardHeader({ icon: Icon, title, desc }: { icon: typeof Users; title: string; desc?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f2f3ff] px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className="size-[14px] text-[#00288e]" aria-hidden />
        <h2 className="text-base font-bold leading-6 text-[#131b2e]">{title}</h2>
      </div>
      {desc && <p className="text-[13px] leading-[18px] text-[#444653]">{desc}</p>}
    </div>
  );
}

/* ---------- Bagian yang butuh data (async) ---------- */

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
    <>
      {/* Banner */}
      <section className="rounded-xl bg-[linear-gradient(110deg,#00288e_45%,#006591)] p-6 text-white">
        <h1 className="font-[family-name:var(--font-lexend)] text-[28px] font-bold leading-9 tracking-[-0.7px]">
          {personal ? "Selamat Datang kembali" : "Selamat Datang"}, {nama} <span aria-hidden>👋</span>
        </h1>
        <p className="mt-1 text-sm leading-5 opacity-90">
          {personal
            ? "Portal Pelaporan Tridharma Dosen Prodi Rekayasa Perangkat Lunak UPI"
            : "Ringkasan Tridharma seluruh dosen Prodi Rekayasa Perangkat Lunak UPI"}{" "}
          — {semester}.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[#00288e]">
            {profil?.departemen ?? "Rekayasa Perangkat Lunak"}
          </span>
          {personal && session?.nip && (
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[#00288e]">
              NIP: {session.nip}
            </span>
          )}
        </div>
      </section>

      {/* Kartu statistik */}
      {belumTerhubung || !data || !stats ? (
        <section className={cn(cardClass, "p-6 text-sm text-[#444653]")}>
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
        <section className={cardClass}>
          <CardHeader
            icon={Users}
            title="Daftar Dosen"
            desc={`Pilih dosen untuk melihat publikasi dan kegiatannya (${daftarDosen.length} dosen)`}
          />
          {daftarDosen.length === 0 ? (
            <p className="py-12 text-center text-sm text-[#444653]">Belum ada data dosen.</p>
          ) : (
            <ul className="grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2 xl:grid-cols-3">
              {daftarDosen.map((d) => (
                <li key={d.id}>
                  <Link
                    href={hrefDetailDosen(d.id)}
                    className="flex items-center gap-3 rounded-lg bg-[#f2f3ff] p-3 hover:bg-[#e2e7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40"
                  >
                    <span
                      aria-hidden
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e2e7ff] text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[#00288e]"
                    >
                      {inisial(d.nama ?? "?")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold leading-5 text-[#131b2e]">{d.nama}</span>
                      <span className="block truncate text-xs leading-4 tracking-[0.24px] text-[#444653]">
                        {d.departemen ?? "Rekayasa Perangkat Lunak"}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-[#757684]" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Aktivitas terbaru */}
      {data && (
        <section className={cardClass}>
          <CardHeader
            icon={Activity}
            title="Aktivitas Terbaru"
            desc={personal ? "Kegiatan dan buku milik kamu" : "Kegiatan dan buku terbaru dari seluruh dosen"}
          />
          <Table className="min-w-[640px]">
            <TableHeader className="bg-[#f2f3ff] [&_tr]:border-0">
              <TableRow className="border-0 hover:bg-transparent">
                {["Judul Kegiatan / Berkas", "Kategori", "Tahun"].map((h, i) => (
                  <TableHead
                    key={h}
                    className={cn(
                      "h-auto px-4 py-[22px] text-xs font-semibold uppercase leading-4 tracking-[0.6px] text-[#444653]",
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
                  <TableCell colSpan={3} className="py-12 text-center text-sm text-[#444653]">
                    Belum ada aktivitas tercatat.
                  </TableCell>
                </TableRow>
              )}
              {data.aktivitas.map((a) => {
                const style = kategoriStyle[a.kategori];
                return (
                  <TableRow key={`${a.kategori}-${a.judul}`} className="h-[60px] border-0">
                    <TableCell className="whitespace-normal py-5 pr-6 text-sm font-semibold leading-5 text-black">
                      {a.judul}
                      {a.detail && (
                        <span className="block text-xs font-normal leading-4 tracking-[0.24px] text-[#444653]">
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
                    <TableCell className="px-4 text-xs font-semibold leading-4 tracking-[0.24px] text-black">
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
      <div className="h-[140px] animate-pulse rounded-xl bg-white" />
      <div className="h-[200px] animate-pulse rounded-xl bg-white" />
      <div className="h-[320px] animate-pulse rounded-xl bg-white" />
    </>
  );
}

/* ---------- Halaman ---------- */

export default function TridharmaDashboardPage() {
  return (
    <div className="flex flex-col gap-4 pb-6 font-[family-name:var(--font-plus-jakarta)]">
      <div className="flex flex-col gap-6 px-6 pt-4">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent />
        </Suspense>
      </div>
    </div>
  );
}
