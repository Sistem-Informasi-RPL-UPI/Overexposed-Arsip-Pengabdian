import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Calendar,
  ChevronDown,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Table2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { db } from "@/lib/db";
import {
  listArsipFromView,
  parseArsipListFilters,
  requireArsipViewer,
} from "@/lib/arsip";
import { getArsipPermissions } from "@/lib/rbac";
import { buttonVariants } from "@/components/ui/button";
import DataTable, { type DataTableColumn } from "../DataTable";
import ExportExcelButton from "./exportexcelbutton";
import PrintButton from "./Printbutton";
import DeleteArsipButton from "../DeleteArsipButton";

/* ---------- Konfigurasi ---------- */

const BASE_PATH = "/arsip/daftar";
const PAGE_SIZE = 10;

// Nama query param, sesuai yang dibaca parseArsipListFilters di lib/arsip.ts
const PARAM = {
  q: "search",
  kategori: "kategoriId",
  tahun: "tahun",
  page: "page",
  limit: "pageSize",
} as const;

type SearchParams = Record<string, string | string[] | undefined>;
type ArsipItem = Awaited<ReturnType<typeof listArsipFromView>>["items"][number];

type Row = {
  id: string;
  judul: string;
  kategori: string;
  noBerkas: string;
  tanggal: string;
};

type KategoriOption = { id: string; nama: string };

/* ---------- Style kategori ---------- */

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

/* ---------- Data ---------- */

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

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

async function getKategoriOptions(): Promise<KategoriOption[]> {
  const list = await db.kategori.findMany({
    orderBy: { nama: "asc" },
    select: { id: true, nama: true },
  });
  return list.map((k) => ({ id: String(k.id), nama: k.nama }));
}

async function getDaftarData(sp: SearchParams) {
  const auth = await requireArsipViewer();
  if (!auth.ok) redirect(auth.response.status === 401 ? "/login" : "/");
  const { canManageArsip } = getArsipPermissions(auth.session);

  const query = new URLSearchParams();
  for (const key of [PARAM.q, PARAM.kategori, PARAM.tahun, PARAM.page]) {
    const v = first(sp[key])?.trim();
    if (v) query.set(key, v);
  }
  query.set(PARAM.limit, String(PAGE_SIZE));

  const parsed = parseArsipListFilters(query);
  if (!parsed.ok) {
    return {
      rows: [] as Row[],
      total: 0,
      page: 1,
      totalPages: 1,
      canManageArsip,
    };
  }

  const { items, pagination } = await listArsipFromView(parsed.filters);
  return {
    rows: items.map(toRow),
    total: pagination.total,
    page: pagination.page,
    totalPages: pagination.totalPages,
    canManageArsip,
  };
}

/* ---------- Helper pagination ---------- */

function buildHref(sp: SearchParams, page: number) {
  const query = new URLSearchParams();
  for (const key of [PARAM.q, PARAM.kategori, PARAM.tahun]) {
    const v = first(sp[key])?.trim();
    if (v) query.set(key, v);
  }
  if (page > 1) query.set(PARAM.page, String(page));
  const qs = query.toString();
  return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
}

/* ---------- Sub-komponen ---------- */

async function TambahArsipButton() {
  const auth = await requireArsipViewer();
  if (!auth.ok || !getArsipPermissions(auth.session).canManageArsip) {
    return null;
  }

  return (
    <Link
      href="/arsip/daftar/formulir"
      className={cn(
        buttonVariants(),
        "h-auto gap-2 rounded-lg bg-[#00288e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#001f6f]",
      )}
    >
      <Plus className="size-3" aria-hidden />
      Tambah Arsip
    </Link>
  );
}

function PageHeader() {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <h1 className="text-[28px] font-bold leading-9 tracking-[-0.7px] text-black">
        Daftar Arsip
      </h1>
      <Suspense fallback={null}>
        <TambahArsipButton />
      </Suspense>
    </div>
  );
}

const selectClass =
  "h-10 w-full appearance-none rounded-lg border-0 bg-[#f2f3ff] pl-3 pr-8 text-sm text-[#131b2e] outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40";

function FilterBar({
  sp,
  kategori,
}: {
  sp: SearchParams;
  kategori: KategoriOption[];
}) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => thisYear - i);

  return (
    <form
      method="get"
      action={BASE_PATH}
      className="rounded-xl bg-white p-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
    >
      <div className="grid grid-cols-12 items-center gap-x-3.75 gap-y-3">
        {/* Search */}
        <div className="relative col-span-12 md:col-span-5">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 size-3.75 -translate-y-1/2 text-[#757684]"
            aria-hidden
          />
          <input
            type="search"
            name={PARAM.q}
            defaultValue={first(sp[PARAM.q]) ?? ""}
            placeholder="Cari judul arsip atau nomor berkas/surat..."
            aria-label="Cari arsip"
            className="h-10 w-full rounded-lg border-0 bg-[#f2f3ff] pl-10 pr-4 text-sm text-[#131b2e] placeholder:text-[#757684] outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40"
          />
        </div>

        {/* Kategori */}
        <div className="relative col-span-6 md:col-span-3">
          <select
            name={PARAM.kategori}
            defaultValue={first(sp[PARAM.kategori]) ?? ""}
            aria-label="Filter kategori"
            className={selectClass}
          >
            <option value="">Semua Kategori</option>
            {kategori.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 size-2.25 -translate-y-1/2 text-[#444653]"
            aria-hidden
          />
        </div>

        {/* Tahun */}
        <div className="relative col-span-6 md:col-span-2">
          <select
            name={PARAM.tahun}
            defaultValue={first(sp[PARAM.tahun]) ?? ""}
            aria-label="Filter tahun"
            className={selectClass}
          >
            <option value="">Semua Tahun</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Calendar
            className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#444653]"
            aria-hidden
          />
        </div>

        {/* Aksi */}
        <div className="col-span-12 flex items-center gap-2 md:col-span-2">
          <Link
            href={BASE_PATH}
            className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#eaedff] px-3 text-xs font-semibold tracking-[0.24px] text-[#444653] hover:bg-[#dde1ff]"
          >
            <RotateCcw className="size-3" aria-hidden />
            Reset
          </Link>
          <button
            type="submit"
            className="flex h-10 flex-1 items-center justify-center rounded-lg bg-[#1e40af] px-3 text-xs font-semibold tracking-[0.24px] text-white hover:bg-[#1e3a9f]"
          >
            Terapkan
          </button>
        </div>
      </div>
    </form>
  );
}

function TabelArsip({
  rows,
  total,
  page,
  totalPages,
  sp,
  canManageArsip,
}: {
  rows: Row[];
  total: number;
  page: number;
  totalPages: number;
  sp: SearchParams;
  canManageArsip: boolean;
}) {
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = (page - 1) * PAGE_SIZE + rows.length;
  const hasFilter = Boolean(
    first(sp[PARAM.q])?.trim() ||
      first(sp[PARAM.kategori])?.trim() ||
      first(sp[PARAM.tahun])?.trim(),
  );

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
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold leading-3.5 tracking-[0.44px]",
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
      headerClassName: "w-27.5 whitespace-normal",
      cellClassName:
        "text-xs font-semibold leading-4 tracking-[0.24px] text-black",
      render: (row) => row.tanggal,
    },
    {
      key: "aksi",
      header: "Aksi",
      align: "right",
      headerClassName: "w-40",
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Link
            href={`/arsip/${row.id}`}
            aria-label={`Lihat ${row.judul}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "size-[27px] text-[#00288e] hover:bg-[#e2e7ff]",
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
                  "size-[27px] text-[#00288e] hover:bg-[#e2e7ff]",
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
      icon={<Table2 className="size-4 text-[#00288e]" aria-hidden />}
      title="Data Rekapitulasi Berkas Arsip"
      headerActions={
        <>
          <ExportExcelButton rows={rows} />
          <PrintButton rows={rows} page={page} total={total} />
        </>
      }
      columns={columns}
      data={rows}
      getRowKey={(row) => row.id}
      emptyState={
        hasFilter
          ? {
              icon: <Search className="size-6" aria-hidden />,
              title: "Arsip tidak ditemukan",
              description:
                "Tidak ada berkas arsip yang cocok dengan kata kunci atau filter yang dipilih.",
              action: (
                <Link
                  href={BASE_PATH}
                  className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg bg-[#eaedff] px-4 py-2 text-xs font-semibold text-[#131b2e] hover:bg-[#dde1ff]"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Reset Pencarian & Filter
                </Link>
              ),
            }
          : {
              title: "Belum ada berkas arsip di direktori",
              description: canManageArsip
                ? "Tambahkan berkas arsip pertama untuk mulai mencatat nomor surat dan jadwal retensi dokumen."
                : "Belum ada data arsip yang diinput oleh staf program studi.",
              action: canManageArsip ? (
                <Link
                  href="/arsip/daftar/formulir"
                  className={cn(
                    buttonVariants(),
                    "h-auto min-h-[40px] gap-2 rounded-lg bg-[#00288e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#001f6f]",
                  )}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Tambah Arsip Pertama
                </Link>
              ) : undefined,
            }
      }
      pagination={{
        page,
        totalPages,
        from,
        to,
        total,
        itemLabel: "arsip",
        buildHref: (p) => buildHref(sp, p),
      }}
    />
  );
}

/* ---------- Bagian yang butuh data (async) ---------- */

async function DaftarArsipContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const [data, kategori] = await Promise.all([
    getDaftarData(sp),
    getKategoriOptions(),
  ]);

  return (
    <>
      <FilterBar sp={sp} kategori={kategori} />
      <TabelArsip
        rows={data.rows}
        total={data.total}
        page={data.page}
        totalPages={data.totalPages}
        sp={sp}
        canManageArsip={data.canManageArsip}
      />
    </>
  );
}

function DaftarArsipSkeleton() {
  return (
    <>
      <div className="h-18 animate-pulse rounded-xl bg-white" />
      <div className="h-130 animate-pulse rounded-xl bg-white" />
    </>
  );
}

/* ---------- Halaman ---------- */

export default function DaftarArsipPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <div className="flex flex-col gap-4 pb-6 font-(family-name:--font-plus-jakarta)">
      <PageHeader />
      <div className="flex flex-col gap-6 px-6">
        <Suspense fallback={<DaftarArsipSkeleton />}>
          <DaftarArsipContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
