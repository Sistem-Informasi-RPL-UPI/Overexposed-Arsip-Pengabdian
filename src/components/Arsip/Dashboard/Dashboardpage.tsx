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
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  listArsipFromView,
  parseArsipListFilters,
  requireArsipViewer,
} from "@/lib/arsip";
import { getArsipPermissions } from "@/lib/rbac";
import { buttonVariants } from "@/components/ui/button";
import DataTable, { type DataTableColumn } from "../DataTable";
import DeleteArsipButton from "../DeleteArsipButton";

/* ---------- Data ---------- */

const JUMLAH_AKTIVITAS = 5;

type ArsipItem = Awaited<ReturnType<typeof listArsipFromView>>["items"][number];

type Row = {
  id: string;
  judul: string;
  kategori: string;
  noBerkas: string;
  tanggal: string;
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

function toRow(a: ArsipItem): Row {
  return {
    id: String(a.id),
    judul: a.judul,
    kategori: a.kategori.nama,
    noBerkas: a.nomor_surat || a.nomor_arsip,
    // tanggal_arsip bertipe date (tanpa jam), jadi dibaca sebagai UTC
    tanggal: new Date(a.tanggal_arsip).toLocaleDateString("id-ID", {
      timeZone: "UTC",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  };
}

async function getDashboardData(): Promise<{
  rows: Row[];
  total: number;
  canManageArsip: boolean;
}> {
  const auth = await requireArsipViewer();
  if (!auth.ok) redirect(auth.response.status === 401 ? "/login" : "/");
  const { canManageArsip } = getArsipPermissions(auth.session);

  const parsed = parseArsipListFilters(
    new URLSearchParams({ page: "1", pageSize: String(JUMLAH_AKTIVITAS) }),
  );
  if (!parsed.ok) return { rows: [], total: 0, canManageArsip };

  const { items, pagination } = await listArsipFromView(parsed.filters);
  return {
    rows: items.map(toRow),
    total: pagination.total,
    canManageArsip,
  };
}

/* ---------- Sub-komponen ---------- */

function Banner() {
  return (
    <section className="relative flex w-full flex-col overflow-hidden rounded-xl bg-linear-to-r from-[#00288e] via-[#1e40af] to-[#006591] p-6 shadow-md">
      <div
        aria-hidden
        className="absolute -bottom-10 -right-10 size-64 rounded-full bg-[#39b8fd]/20 blur-3xl"
      />
      <div className="relative max-w-3xl">
        <div className="flex items-center gap-2">
          <h1 className="text-[28px] font-bold leading-9 tracking-[-0.7px] text-white">
            Dashboard Arsip
          </h1>
          <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-bold leading-3.5 tracking-[0.275px] text-white backdrop-blur-sm">
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
          <span className="text-4xl font-bold leading-11 tracking-[-0.9px] text-[#00288e]">
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

function AktivitasTerbaru({
  rows,
  total,
  canManageArsip,
}: {
  rows: Row[];
  total: number;
  canManageArsip: boolean;
}) {
  const columns: DataTableColumn<Row>[] = [
    {
      key: "judul",
      header: "Judul Arsip",
      headerClassName: "w-100",
      cellClassName:
        "whitespace-normal py-5 pr-6 text-sm font-semibold leading-5 text-black",
      render: (row) => row.judul,
    },
    {
      key: "kategori",
      header: "Kategori",
      render: (row) => {
        const style = kategoriStyle[row.kategori] ?? defaultStyle;
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold leading-3.5 tracking-[0.44px]",
              style.badge,
            )}
          >
            <span className={cn("size-1.5 rounded-full", style.dot)} />
            {row.kategori}
          </span>
        );
      },
    },
    {
      key: "noBerkas",
      header: "No. Berkas / Surat",
      cellClassName:
        "text-xs font-semibold uppercase leading-4 tracking-[0.24px] text-black",
      render: (row) => row.noBerkas,
    },
    {
      key: "tanggal",
      header: "Tanggal Arsip",
      headerClassName: "w-35 whitespace-normal",
      cellClassName:
        "text-xs font-semibold leading-4 tracking-[0.24px] text-black",
      render: (row) => row.tanggal,
    },
    {
      key: "aksi",
      header: "Aksi",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/arsip/${row.id}`}
            aria-label={`Lihat ${row.judul}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "size-6.75 text-[#00288e] hover:bg-[#e2e7ff]",
            )}
          >
            <Eye className="size-4" />
          </Link>
          {canManageArsip && (
            <>
              <Link
                href={`/arsip/daftar/${row.id}/edit`}
                aria-label={`Ubah ${row.judul}`}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "size-6.75 text-[#00288e] hover:bg-[#e2e7ff]",
                )}
              >
                <Pencil className="size-4" />
              </Link>
              <DeleteArsipButton id={row.id} judul={row.judul} />
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      getRowKey={(row) => row.id}
      emptyState={{
        icon: <Folder className="size-6" aria-hidden />,
        title: "Belum ada berkas arsip yang tercatat",
        description: canManageArsip
          ? "Mulai simpan dan kelola naskah dinas atau berkas digital Program Studi RPL di repositori ini."
          : "Arsip yang ditambahkan oleh staf program studi akan otomatis tampil pada ringkasan aktivitas terbaru ini.",
        action: canManageArsip ? (
          <Link
            href="/arsip/daftar/formulir"
            className={cn(
              buttonVariants(),
              "h-auto min-h-[40px] gap-2 rounded-lg bg-[#1e40af] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1e3a9f]",
            )}
          >
            <Plus className="size-3.5" aria-hidden />
            Tambah Arsip Pertama
          </Link>
        ) : undefined,
      }}
      topContent={
        <div className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="text-xl font-semibold leading-7 tracking-[-0.2px] text-[#131b2e]">
              Aktivitas Terbaru
            </h2>
            <p className="text-[13px] leading-4.5 text-[#444653]">
              Riwayat arsip dan berkas yang baru saja ditambahkan atau
              diperbarui oleh staf prodi
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
            {canManageArsip && (
              <Link
                href="/arsip/daftar/formulir"
                className={cn(
                  buttonVariants(),
                  "h-auto gap-2 rounded-lg bg-[#1e40af] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1e3a9f]",
                )}
              >
                <Plus className="size-3" aria-hidden />
                Tambah Arsip
              </Link>
            )}
          </div>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#eaedff] bg-[#f2f3ff]/60 px-6 py-4">
          <p className="text-[13px] leading-4.5 text-[#444653]">
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
      }
    />
  );
}

/* ---------- Bagian yang butuh data (async) ---------- */

async function DashboardData() {
  const { rows, total, canManageArsip } = await getDashboardData();

  return (
    <>
      <StatCard total={total} />
      <AktivitasTerbaru
        rows={rows}
        total={total}
        canManageArsip={canManageArsip}
      />
    </>
  );
}

function DashboardDataSkeleton() {
  return (
    <>
      <div className="h-50 animate-pulse rounded-xl bg-white lg:w-5/12" />
      <div className="h-130 animate-pulse rounded-xl bg-white" />
    </>
  );
}

/* ---------- Halaman ---------- */

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6 font-(family-name:--font-plus-jakarta)">
      <Banner />
      <Suspense fallback={<DashboardDataSkeleton />}>
        <DashboardData />
      </Suspense>
    </div>
  );
}
