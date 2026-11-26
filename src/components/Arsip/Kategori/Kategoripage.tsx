"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, FolderOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import ConfirmDeleteDialog from "../ConfirmDeletedialog";

export type KategoriArsip = {
  id: string | number;
  kode: string;
  nama: string;
  retensiAktif: number;
  retensiInaktif: number;
};

export interface KategoriArsipPageProps {
  data?: KategoriArsip[];
  totalItems?: number;
  /** Opsional. Kalau diisi, halaman dikontrol dari luar. Kalau tidak, komponen mengelola sendiri. */
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onAdd?: () => void;
  onView?: (item: KategoriArsip) => void;
  onEdit?: (item: KategoriArsip) => void;
  /** Dipanggil setelah kategori berhasil dihapus. */
  onDelete?: (item: KategoriArsip) => void;
  className?: string;
}

function getPageItems(
  page: number,
  totalPages: number,
): (number | "ellipsis")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (page <= 3) return [1, 2, 3, "ellipsis", totalPages];

  if (page >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages];
}

type KategoriApiResponse = {
  items?: Array<{
    id: string | number;
    kode: string;
    nama: string;
    retensi_aktif_tahun?: number;
    retensi_inaktif_tahun?: number;
    retensiAktif?: number;
    retensiInaktif?: number;
  }>;
  pagination?: {
    totalItems?: number;
    total?: number;
    totalPages?: number;
    page?: number;
    pageSize?: number;
  };
  totalItems?: number;
  message?: string;
};

export function KategoriArsipPage({
  data,
  totalItems,
  page: pageProp,
  pageSize = 6,
  onPageChange,
  onView,
  onEdit,
  onDelete,
  className,
}: KategoriArsipPageProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [kategoriData, setKategoriData] = React.useState<KategoriArsip[]>(
    data ?? [],
  );
  const [totalData, setTotalData] = React.useState(totalItems ?? 0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  // Hapus kategori
  const [deleteTarget, setDeleteTarget] = React.useState<KategoriArsip | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);
  // Dinaikkan setelah hapus supaya data dimuat ulang
  const [reloadKey, setReloadKey] = React.useState(0);

  // Halaman aktif: pakai props kalau dikontrol dari luar, kalau tidak pakai state sendiri
  const [internalPage, setInternalPage] = React.useState(1);
  const page = pageProp ?? internalPage;

  const handlePageChange = (next: number) => {
    setInternalPage(next);
    onPageChange?.(next);
  };

  React.useEffect(() => {
    if (data !== undefined) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setKategoriData(data);
      setTotalData(totalItems ?? data.length);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function fetchKategori() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/arsip/kategori?page=${page}&pageSize=${pageSize}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );

        const result: KategoriApiResponse = await response.json();

        if (!response.ok) {
          throw new Error(result.message ?? "Gagal mengambil data kategori.");
        }

        const items = (result.items ?? []).map((item) => ({
          id: item.id,
          kode: item.kode,
          nama: item.nama,
          retensiAktif: item.retensi_aktif_tahun ?? item.retensiAktif ?? 0,
          retensiInaktif:
            item.retensi_inaktif_tahun ?? item.retensiInaktif ?? 0,
        }));

        setKategoriData(items);

        setTotalData(
          result.pagination?.totalItems ??
            result.pagination?.total ??
            result.totalItems ??
            items.length,
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        setError(
          err instanceof Error
            ? err.message
            : "Terjadi kesalahan saat mengambil kategori.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchKategori();

    return () => controller.abort();
  }, [data, totalItems, page, pageSize, reloadKey]);

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    const target = deleteTarget;
    setDeleting(true);

    try {
      const res = await fetch(
        `/api/arsip/kategori/${encodeURIComponent(String(target.id))}`,
        { method: "DELETE" },
      );
      const result = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!res.ok) {
        toast.error("Kategori gagal dihapus", {
          description:
            result?.message ?? "Terjadi kesalahan saat menghapus kategori.",
        });
        return;
      }

      toast.success("Kategori berhasil dihapus", {
        description: result?.message ?? `"${target.nama}" telah dihapus.`,
      });
      onDelete?.(target);

      if (data !== undefined) {
        // Data dikirim dari luar (server component): minta server ambil ulang
        router.refresh();
      } else if (kategoriData.length === 1 && page > 1) {
        // Item terakhir di halaman ini terhapus: mundur satu halaman
        handlePageChange(page - 1);
      } else {
        setReloadKey((k) => k + 1);
      }
    } catch {
      toast.error("Kategori gagal dihapus", {
        description: "Tidak dapat terhubung ke server. Coba lagi.",
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return kategoriData;

    return kategoriData.filter(
      (item) =>
        item.kode.toLowerCase().includes(q) ||
        item.nama.toLowerCase().includes(q),
    );
  }, [kategoriData, query]);

  const total = totalItems ?? totalData;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const from = filtered.length ? (page - 1) * pageSize + 1 : 0;
  const to = filtered.length ? Math.min(from + filtered.length - 1, total) : 0;

  return (
    <div
      className={cn("flex w-full flex-col gap-6 bg-[#faf8ff] p-6", className)}
    >
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold leading-9 tracking-[-0.7px] text-[#131b2e]">
          Kategori Arsip
        </h1>

        <Link
          href="/arsip/kategori/formulir"
          className="inline-flex h-auto items-center gap-2 rounded-xl bg-[#1e40af] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e40af]/90"
        >
          <Plus className="size-3 stroke-[2.5]" />
          Tambah Kategori
        </Link>
      </div>

      {/* Search bar */}
      <div className="rounded-xl bg-white p-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.75 -translate-y-1/2 text-[#757684]" />

          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kode atau nama kategori arsip..."
            className="h-auto rounded-lg border-0 bg-[#f2f3ff] py-2.5 pl-10 pr-4 text-sm text-[#131b2e] shadow-none placeholder:text-[#757684] focus-visible:ring-1 focus-visible:ring-[#1e40af]"
          />
        </div>
      </div>

      {/* Data table card */}
      <div className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between border-b border-[#eaedff] px-6 py-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="size-5 text-[#00288e]" />

            <h2 className="text-base font-semibold leading-6 text-[#131b2e]">
              Data Klasifikasi Kategori Arsip
            </h2>
          </div>

          <p className="text-[11px] font-bold tracking-[0.44px] text-[#444653]">
            Total:{" "}
            <span className="font-semibold text-[#00288e]">
              {total} Kategori
            </span>
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-0 bg-[#f2f3ff] hover:bg-[#f2f3ff]">
              <TableHead className="h-auto w-32 px-6 py-3.5 text-xs font-bold uppercase tracking-[0.6px] text-[#444653]">
                Kode
              </TableHead>

              <TableHead className="h-auto px-6 py-3.5 text-xs font-bold uppercase tracking-[0.6px] text-[#444653]">
                Nama Kategori
              </TableHead>

              <TableHead className="h-auto w-64 px-6 py-3.5 text-xs font-bold uppercase tracking-[0.6px] text-[#444653]">
                Retensi
              </TableHead>

              <TableHead className="h-auto w-48 px-6 py-3.5 text-right text-xs font-bold uppercase tracking-[0.6px] text-[#444653]">
                Aksi
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="px-6 py-10 text-center text-sm text-[#757684]"
                >
                  Memuat data kategori...
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="px-6 py-10 text-center text-sm text-red-600"
                >
                  {error}
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="px-6 py-10 text-center text-sm text-[#757684]"
                >
                  Tidak ada kategori yang cocok.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((item) => (
                <TableRow
                  key={item.id}
                  className="border-t border-[#eaedff] hover:bg-[#f2f3ff]/40"
                >
                  <TableCell className="px-6 py-6">
                    <span className="inline-flex rounded bg-[#e2e7ff] px-2.5 py-px font-mono text-[13px] font-bold leading-5.5 text-[#00288e]">
                      {item.kode}
                    </span>
                  </TableCell>

                  <TableCell className="px-6 py-6 text-base font-semibold leading-6 text-[#131b2e]">
                    {item.nama}
                  </TableCell>

                  <TableCell className="px-6 py-4 text-sm leading-[22.75px] text-[#444653]">
                    <p>• Aktif: {item.retensiAktif} Tahun</p>
                    <p>• Inaktif: {item.retensiInaktif} Tahun</p>
                  </TableCell>

                  <TableCell className="px-6 py-6">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Lihat ${item.nama}`}
                        onClick={() => onView?.(item)}
                        className="size-6.75 rounded-lg text-[#0101b7] hover:bg-[#e2e7ff] hover:text-[#0101b7]"
                      >
                        <Eye className="size-5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${item.nama}`}
                        onClick={() => onEdit?.(item)}
                        className="size-6.75 rounded-lg text-[#757684] hover:bg-[#e2e7ff] hover:text-[#444653]"
                      >
                        <Pencil className="size-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Hapus ${item.nama}`}
                        onClick={() => setDeleteTarget(item)}
                        className="size-6.75 rounded-lg text-[#ba1a1a] hover:bg-[#ba1a1a]/10 hover:text-[#ba1a1a]"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-[#eaedff] bg-[#f2f3ff]/40 px-6 py-4">
          <p className="text-[13px] leading-4.5 text-[#444653]">
            Menampilkan{" "}
            <span className="text-xs font-semibold tracking-[0.24px] text-[#131b2e]">
              {from} - {to}
            </span>{" "}
            dari{" "}
            <span className="text-xs font-semibold tracking-[0.24px] text-[#131b2e]">
              {total}
            </span>{" "}
            kategori
          </p>

          <nav aria-label="Pagination" className="flex items-center gap-1">
            <Button
              variant="ghost"
              disabled={page <= 1 || loading}
              onClick={() => handlePageChange(page - 1)}
              className="h-auto rounded-lg bg-[#eaedff] px-3 py-1 text-[11px] font-bold tracking-[0.44px] text-[#757684] hover:bg-[#eaedff] disabled:opacity-50"
            >
              {"< Sebelumnya"}
            </Button>

            {getPageItems(page, totalPages).map((p, i) =>
              p === "ellipsis" ? (
                <span
                  key={`e-${i}`}
                  className="px-2 text-[11px] font-bold tracking-[0.44px] text-[#757684]"
                >
                  ...
                </span>
              ) : (
                <Button
                  key={p}
                  variant="ghost"
                  disabled={loading}
                  onClick={() => handlePageChange(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={cn(
                    "h-auto rounded-lg px-3 py-1 text-[11px] tracking-[0.44px]",
                    p === page
                      ? "bg-[#00288e] font-semibold text-white hover:bg-[#00288e] hover:text-white"
                      : "font-bold text-[#444653] hover:bg-[#eaedff]",
                  )}
                >
                  {p}
                </Button>
              ),
            )}

            <Button
              variant="ghost"
              disabled={page >= totalPages || loading}
              onClick={() => handlePageChange(page + 1)}
              className="h-auto rounded-lg px-3 py-1 text-[11px] font-bold tracking-[0.44px] text-[#444653] hover:bg-[#eaedff]"
            >
              {"Selanjutnya >"}
            </Button>
          </nav>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        loading={deleting}
        message={
          deleteTarget
            ? `Apakah Anda yakin untuk menghapus kategori "${deleteTarget.nama}"?`
            : undefined
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default KategoriArsipPage;