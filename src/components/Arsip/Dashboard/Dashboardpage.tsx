import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Eye,
  Folder,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import {
  listArsipFromView,
  parseArsipListFilters,
  requireArsipViewer,
} from "@/lib/arsip";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ---------- Data ---------- */

const TZ = "Asia/Jakarta";
const JUMLAH_AKTIVITAS = 5;

type Row = {
  id: string;
  judul: string;
  kategori: string;
  noBerkas: string;
  tanggal: string;
  waktu: string;
};

const defaultStyle = {
  badge: "bg-[#eaedff] text-[#444653]",
  dot: "bg-[#757684]",
};

const kategoriStyle: Record<string, { badge: string; dot: string }> = {
  Kemahasiswaan: { badge: "bg-[#c9e6ff] text-[#001e2f]", dot: "bg-[#006591]" },
  Keuangan: { badge: "bg-[#e2e7ff] text-[#173bab]", dot: "bg-[#1e40af]" },
  Kurikulum: { badge: "bg-[#dde1ff] text-[#173bab]", dot: "bg-[#00288e]" },
  Kerjasama: { badge: "bg-[#c9e6ff] text-[#001e2f]", dot: "bg-[#006591]" },
  "Sarana & Prasarana": defaultStyle,
};

/**
 * Ubah satu item hasil listArsipFromView menjadi baris tabel.
 * Kalau nama field di database-mu berbeda, cukup sesuaikan fungsi ini.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toRow(a: any): Row {
  const d = new Date(a.tanggal_arsip);
  const kategori =
    typeof a.kategori === "string"
      ? a.kategori
      : (a.kategori?.nama ?? a.kategori_nama ?? "-");

  return {
    id: String(a.id),
    judul: a.judul,
    kategori,
    noBerkas: a.nomor_surat || a.nomor_arsip || "-",
    tanggal: d.toLocaleDateString("id-ID", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    waktu:
      d
        .toLocaleTimeString("id-ID", {
          timeZone: TZ,
          hour: "2-digit",
          minute: "2-digit",
          hourCycle: "h23",
        })
        .replace(".", ":") + " WIB",
  };
}

async function getDashboardData(): Promise<{ rows: Row[]; total: number }> {
  const auth = await requireArsipViewer();
  if (!auth.ok) redirect("/login"); // sesuaikan dengan rute login-mu

  const parsed = parseArsipListFilters(
    new URLSearchParams({ page: "1", limit: String(JUMLAH_AKTIVITAS) }),
  );
  if (!parsed.ok) return { rows: [], total: 0 };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await listArsipFromView(parsed.filters);
  const items: unknown[] = result.data ?? result.items ?? [];
  const total: number =
    result.total ?? result.meta?.total ?? (await db.arsip.count());

  return { rows: items.map(toRow), total };
}

/* ---------- Sub-komponen ---------- */

function Banner() {
  return (
    <section className="relative flex w-full flex-col overflow-hidden rounded-xl bg-gradient-to-r from-[#00288e] via-[#1e40af] to-[#006591] p-6 shadow-md">
      <div
        aria-hidden
        className="absolute -bottom-10 -right-10 size-64 rounded-full bg-[#39b8fd]/20 blur-[64px]"
      />
      <div className="relative max-w-3xl">
        <div className="flex items-center gap-2">
          <h1 className="text-[28px] font-bold leading-9 tracking-[-0.7px] text-white">
            Dashboard Arsip
          </h1>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold leading-[14px] tracking-[0.275px] text-white backdrop-blur-sm">
            SI RPL UPI
          </span>
        </div>
        <p className="mt-1 text-sm leading-[22.75px] text-[#a8b8ff]">
          Ringkasan pengelolaan dan pemantauan arsip digital Program Studi
          Rekayasa Perangkat Lunak. Kelola seluruh berkas dalam satu repositori
          terpadu.
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <span className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1 text-xs font-semibold leading-4 tracking-[0.24px] text-white">
            <Building2 className="size-3.5" aria-hidden />
            Prodi Rekayasa Perangkat Lunak
          </span>
          <span className="flex items-center gap-1.5 rounded-md bg-white/10 px-3 py-1 text-xs font-semibold leading-4 tracking-[0.24px] text-white">
            <ShieldCheck className="size-3.5" aria-hidden />
            Akreditasi Unggul
          </span>
        </div>
      </div>
    </section>
  );
}

function StatCard({ total }: { total: number }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-12 flex flex-col justify-between rounded-xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)] lg:col-span-5">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-xl bg-[#f2f3ff] text-[#00288e] shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]">
            <Folder className="size-7" aria-hidden />
          </div>
          <h2 className="text-base font-semibold leading-6 text-[#131b2e]">
            Total Arsip Digital
          </h2>
        </div>
        <p className="flex items-baseline gap-2 py-4">
          <span className="text-4xl font-bold leading-[44px] tracking-[-0.9px] text-[#00288e]">
            {total}
          </span>
          <span className="text-xl font-medium leading-7 tracking-[-0.2px] text-[#444653]">
            Berkas
          </span>
        </p>
      </div>
    </div>
  );
}

function AktivitasTerbaru({ rows, total }: { rows: Row[]; total: number }) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="text-xl font-semibold leading-7 tracking-[-0.2px] text-[#131b2e]">
            Aktivitas Terbaru
          </h2>
          <p className="text-[13px] leading-[18px] text-[#444653]">
            Riwayat arsip dan berkas yang baru saja ditambahkan atau diperbarui
            oleh staf prodi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/arsip/daftar"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-auto gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-[#00288e] hover:bg-[#f2f3ff] hover:text-[#00288e]",
            )}
          >
            Lihat Seluruh Arsip
            <ArrowRight className="size-3" aria-hidden />
          </Link>
          <Link
            href="/arsip/tambah"
            className={cn(
              buttonVariants(),
              "h-auto gap-2 rounded-lg bg-[#1e40af] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1e3a9f]",
            )}
          >
            <Plus className="size-3" aria-hidden />
            Tambah Arsip
          </Link>
        </div>
      </div>

      {/* Tabel */}
      <Table className="min-w-[960px]">
        <TableHeader className="bg-[#f2f3ff] [&_tr]:border-0">
          <TableRow className="border-0 hover:bg-transparent">
            {[
              "Judul Arsip",
              "Kategori",
              "No. Berkas / Surat",
              "Tanggal & Waktu",
              "Aksi",
            ].map((h, i) => (
              <TableHead
                key={h}
                className={cn(
                  "h-auto px-4 py-[22px] text-xs font-semibold uppercase leading-4 tracking-[0.6px] text-[#444653]",
                  i === 0 && "w-[400px] pl-8",
                  i === 3 && "w-[140px] whitespace-normal py-3.5",
                  i === 4 && "pr-6 text-right",
                )}
              >
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow className="border-0 hover:bg-transparent">
              <TableCell
                colSpan={5}
                className="py-10 text-center text-sm text-[#444653]"
              >
                Belum ada arsip. Klik &quot;Tambah Arsip&quot; untuk menambahkan
                berkas pertama.
              </TableCell>
            </TableRow>
          )}
          {rows.map((row) => {
            const style = kategoriStyle[row.kategori] ?? defaultStyle;
            return (
              <TableRow key={row.id} className="h-[77px] border-0">
                <TableCell className="whitespace-normal py-5 pl-8 pr-6 text-sm font-semibold leading-5 text-black">
                  {row.judul}
                </TableCell>
                <TableCell className="px-4">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold leading-[14px] tracking-[0.44px]",
                      style.badge,
                    )}
                  >
                    <span className={cn("size-1.5 rounded-full", style.dot)} />
                    {row.kategori}
                  </span>
                </TableCell>
                <TableCell className="px-4 text-xs font-semibold uppercase leading-4 tracking-[0.24px] text-black">
                  {row.noBerkas}
                </TableCell>
                <TableCell className="px-4 py-3.5">
                  <p className="text-xs font-semibold leading-4 tracking-[0.24px] text-black">
                    {row.tanggal}
                  </p>
                  <p className="text-[13px] leading-[18px] text-[#757684]">
                    {row.waktu}
                  </p>
                </TableCell>
                <TableCell className="px-6">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Lihat ${row.judul}`}
                      className="size-[27px] text-[#00288e] hover:bg-[#e2e7ff]"
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Ubah ${row.judul}`}
                      className="size-[27px] text-[#00288e] hover:bg-[#e2e7ff]"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Hapus ${row.judul}`}
                      className="size-[27px] text-[#ba1a1a] hover:bg-red-50"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f2f3ff]/70 p-4">
        <p className="text-[13px] leading-[18px] text-[#444653]">
          Menampilkan {rows.length} aktivitas berkas terbaru dari keseluruhan
          arsip.
        </p>
        <Link
          href="/arsip/daftar"
          className="flex items-center gap-2 text-sm font-semibold leading-5 text-[#00288e] hover:underline"
        >
          Lihat Semua Daftar Arsip ({total} Arsip)
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/* ---------- Bagian yang butuh data (async) ---------- */

async function DashboardData() {
  const { rows, total } = await getDashboardData();

  return (
    <>
      <StatCard total={total} />
      <AktivitasTerbaru rows={rows} total={total} />
    </>
  );
}

function DashboardDataSkeleton() {
  return (
    <>
      <div className="h-[200px] animate-pulse rounded-xl bg-white lg:w-5/12" />
      <div className="h-[520px] animate-pulse rounded-xl bg-white" />
    </>
  );
}

/* ---------- Halaman ---------- */

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-2 font-[family-name:var(--font-plus-jakarta)]">
      <div className="flex flex-col gap-6 px-6 pb-6">
        <Banner />
        <Suspense fallback={<DashboardDataSkeleton />}>
          <DashboardData />
        </Suspense>
      </div>
    </div>
  );
}
