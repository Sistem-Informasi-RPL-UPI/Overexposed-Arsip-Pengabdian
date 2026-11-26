import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Download, Eye, HandHeart, Pencil, Plus, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { getSession } from "@/lib/session";
import { getTridharmaPermissions, isStaffKaprodiRole, normalizeRole } from "@/lib/rbac";
import { formatRupiah, formatSinkron, getKegiatanPage, parseKegiatanFilters, type KegiatanFilters } from "@/lib/kegiatan";
import AktivitasChart from "@/components/Tridharma/Pengabdian/AktivitasChart";
import { FilterBar, PageSizeSelect } from "@/components/Tridharma/Pengabdian/PengabdianControls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Data Pengabdian | Sistem Informasi RPL",
};

const card = "rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Link halaman dengan filter yang sedang aktif tetap terbawa.
function hrefHalaman(f: KegiatanFilters, page: number) {
  const p = new URLSearchParams();
  if (f.search) p.set("q", f.search);
  if (f.tahun !== null) p.set("tahun", String(f.tahun));
  if (f.pageSize !== 5) p.set("pageSize", String(f.pageSize));
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `/tridharma/pengabdian?${qs}` : "/tridharma/pengabdian";
}

function nomorHalaman(page: number, total: number) {
  const awal = Math.max(1, Math.min(page - 2, total - 4));
  return Array.from({ length: Math.min(5, total) }, (_, i) => awal + i);
}

async function PengabdianContent({ searchParams }: { searchParams: SearchParams }) {
  const filters = parseKegiatanFilters(await searchParams);
  const session = await getSession();
  const role = normalizeRole(session?.role);

  // Dosen & Kaprodi melihat miliknya sendiri, role lain melihat semua (sama seperti dashboard).
  const personal = role === "Dosen" || role === "Kaprodi";
  const dosenId = session?.dosen_id ?? null;

  if (personal && dosenId === null) {
    return (
      <section className={cn(card, "p-6 text-sm text-[#444653]")}>
        Akun ini belum terhubung ke data dosen. Isi SINTA ID terlebih dahulu agar data pengabdian bisa ditampilkan.
      </section>
    );
  }

  const data = await getKegiatanPage("pengabdian", filters, personal ? (dosenId as number) : undefined);
  const canCreate = getTridharmaPermissions(session).canCreate;

  // Siapa yang boleh menarik data SINTA (PRD 8.1).
  const syncEndpoint = !session
    ? null
    : isStaffKaprodiRole(role)
      ? "/api/staff-kaprodi/sinkron"
      : personal
        ? "/api/dosen/sinkron"
        : null;

  const dari = data.total === 0 ? 0 : (data.page - 1) * filters.pageSize + 1;
  const sampai = (data.page - 1) * filters.pageSize + data.items.length;

  return (
    <>
      {/* Header */}
      <section className={cn(card, "flex flex-wrap items-center justify-between gap-4 px-8 py-7")}>
        <h1 className="font-[family-name:var(--font-lexend)] text-[32px] font-bold leading-10 text-[#131b2e]">Data Pengabdian</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[#e2e7ff] text-[#00288e]">
              <HandHeart className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase leading-[14px] tracking-[0.44px] text-[#444653]">Total Pengabdian</p>
              <p className="font-[family-name:var(--font-lexend)] text-xl font-bold leading-6 text-[#131b2e]">{data.totalAll}</p>
            </div>
          </div>
          {canCreate && (
            <Link href="/tridharma/pengabdian/tambah" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0000B8] px-4 text-sm font-semibold text-white hover:bg-[#00288e]">
              <Plus className="size-4" aria-hidden /> Tambah Pengabdian
            </Link>
          )}
        </div>
      </section>

      {/* Grafik + filter */}
      <section className={cn(card, "flex flex-col gap-4 p-4")}>
        <AktivitasChart data={data.perTahun} />
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[#f6f6fb] px-4 py-2.5 text-xs font-semibold text-[#131b2e]">
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#00288e]" aria-hidden />
            Menampilkan {data.items.length} dari {data.total} data pengabdian
          </span>
          <span className="flex items-center gap-4">
            <span className="text-[#444653]">Terakhir sinkronisasi: {formatSinkron(data.lastSync)}</span>
            {/* TODO: ekspor belum ada endpoint-nya. */}
            <button type="button" className="inline-flex items-center gap-1 text-[#00288e] hover:underline">
              <Download className="size-3.5" aria-hidden /> Ekspor PDF/Excel
            </button>
          </span>
        </div>
      </section>

      {/* Tabel */}
      <section className={cn(card, "overflow-hidden")}>
        <Table className="min-w-[760px]">
          <TableHeader className="bg-[#ececec] [&_tr]:border-0">
            <TableRow className="border-0 hover:bg-transparent">
              {[
                ["No.", "w-[70px]"],
                ["Judul Pengabdian", ""],
                ["Tahun", "w-[90px] text-center"],
                ["Dana", "w-[170px]"],
                ["Aksi", "w-[140px] text-center"],
              ].map(([h, c]) => (
                <TableHead key={h} className={cn("h-auto px-4 py-[18px] text-xs font-semibold uppercase leading-4 tracking-[0.6px] text-[#444653]", c)}>
                  {h}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.length === 0 && (
              <TableRow className="border-0 hover:bg-transparent">
                <TableCell colSpan={5} className="py-16 text-center text-sm text-[#444653]">
                  {data.totalAll === 0 ? "Belum ada data pengabdian. Tarik data dari SINTA untuk mengisinya." : "Tidak ada pengabdian yang cocok dengan filter."}
                </TableCell>
              </TableRow>
            )}
            {data.items.map((k, i) => {
              const izin = getTridharmaPermissions(session, k.ownerDosenIds);
              return (
                <TableRow key={k.id} className="border-0 hover:bg-[#f9f9ff]">
                  <TableCell className="px-4 py-8 text-xs text-[#131b2e]">{dari + i}</TableCell>
                  <TableCell className="whitespace-normal px-4 py-8">
                    <p className="line-clamp-2 max-w-[420px] text-base font-bold leading-[22px] text-[#0b1f6b]">{k.judul}</p>
                    <p className="mt-0.5 text-xs text-[#444653]">
                      Ketua: <span className="font-semibold text-[#131b2e]">{k.ketua ?? "-"}</span>
                    </p>
                  </TableCell>
                  <TableCell className="px-4 text-center text-sm font-semibold text-[#131b2e]">{k.tahun ?? "-"}</TableCell>
                  <TableCell className="px-4 text-xs font-semibold text-[#444653]">{formatRupiah(k.dana)}</TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center justify-center gap-3">
                      {/* TODO: sambungkan ke halaman detail / form ubah / API hapus. */}
                      {k.link ? (
                        <a
                          href={k.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Lihat ${k.judul} di Google Scholar`}
                          title="Lihat di Google Scholar"
                          className="text-[#0000B8] hover:opacity-70"
                        >
                          <Eye className="size-5" />
                        </a>
                      ) : (
                        <span
                          title="Tautan Google Scholar tidak tersedia"
                          className="text-gray-400"
                        >
                          <Eye className="size-5" />
                        </span>
                      )}
                      {izin.canUpdate && (
                        <button type="button" aria-label={`Ubah ${k.judul}`} className="text-[#757684] hover:opacity-70">
                          <Pencil className="size-[18px]" />
                        </button>
                      )}
                      {izin.canDelete && (
                        <button type="button" aria-label={`Hapus ${k.judul}`} className="text-[#ba1a1a] hover:opacity-70">
                          <Trash2 className="size-[18px]" />
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {/* Paginasi */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f6f6fb] px-4 py-3 text-xs font-semibold text-[#131b2e]">
          <div className="flex items-center gap-3">
            <span>Menampilkan {dari} - {sampai} dari {data.total} data</span>
            <span className="flex items-center gap-2 text-[#444653]">
              Baris per halaman: <PageSizeSelect value={filters.pageSize} />
            </span>
          </div>
          <nav aria-label="Halaman" className="flex items-center gap-1.5">
            {data.page > 1 ? (
              <Link href={hrefHalaman(filters, data.page - 1)} aria-label="Sebelumnya" className="flex size-8 items-center justify-center rounded-md hover:bg-[#e2e7ff]">
                <ChevronLeft className="size-4" />
              </Link>
            ) : (
              <span className="flex size-8 items-center justify-center text-[#c4c5d5]"><ChevronLeft className="size-4" /></span>
            )}
            {nomorHalaman(data.page, data.totalPages).map((n) => (
              <Link
                key={n}
                href={hrefHalaman(filters, n)}
                aria-current={n === data.page ? "page" : undefined}
                className={cn("flex size-8 items-center justify-center rounded-md", n === data.page ? "bg-[#0000B8] text-white" : "hover:bg-[#e2e7ff]")}
              >
                {n}
              </Link>
            ))}
            {data.page < data.totalPages ? (
              <Link href={hrefHalaman(filters, data.page + 1)} aria-label="Berikutnya" className="flex size-8 items-center justify-center rounded-md hover:bg-[#e2e7ff]">
                <ChevronRight className="size-4" />
              </Link>
            ) : (
              <span className="flex size-8 items-center justify-center text-[#c4c5d5]"><ChevronRight className="size-4" /></span>
            )}
          </nav>
        </div>
      </section>
    </>
  );
}

function Skeleton() {
  return (
    <>
      <div className="h-[100px] animate-pulse rounded-xl bg-white" />
      <div className="h-[330px] animate-pulse rounded-xl bg-white" />
      <div className="h-[480px] animate-pulse rounded-xl bg-white" />
    </>
  );
}

export default function PengabdianPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <div className="flex flex-col gap-4 px-6 pb-6 pt-4 font-[family-name:var(--font-plus-jakarta)]">
      <Suspense fallback={<Skeleton />}>
        <PengabdianContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
