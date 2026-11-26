"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  FileStack,
  FolderOpen,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import ConfirmDeleteDialog from "../ConfirmDeletedialog";
import DataTable, { type DataTableColumn } from "../DataTable";

export type KategoriArsip = {
  id: string | number;
  kode: string;
  nama: string;
  retensiAktif: number;
  retensiInaktif: number;
  jumlahArsip: number;
  keterangan?: string | null;
};

export interface KategoriArsipPageProps {
  data?: KategoriArsip[];
  totalItems?: number;
  /** Opsional. Kalau diisi, halaman dikontrol dari luar. Kalau tidak, komponen mengelola sendiri. */
  page?: number;
  pageSize?: number;
  canManage?: boolean;
  onPageChange?: (page: number) => void;
  onAdd?: () => void;
  onView?: (item: KategoriArsip) => void;
  onEdit?: (item: KategoriArsip) => void;
  /** Dipanggil setelah kategori berhasil dihapus. */
  onDelete?: (item: KategoriArsip) => void;
  className?: string;
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
    jumlah_arsip?: number;
    jumlahArsip?: number;
    keterangan?: string | null;
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
  canManage = true,
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

  // Detail kategori modal
  const [viewTarget, setViewTarget] = React.useState<KategoriArsip | null>(
    null,
  );

  // Edit kategori modal
  const [editTarget, setEditTarget] = React.useState<KategoriArsip | null>(
    null,
  );
  const [editForm, setEditForm] = React.useState({
    kode: "",
    nama: "",
    retensiAktif: 1,
    retensiInaktif: 1,
  });
  const [savingEdit, setSavingEdit] = React.useState(false);

  // Hapus kategori
  const [deleteTarget, setDeleteTarget] = React.useState<KategoriArsip | null>(
    null,
  );
  const [deleting, setDeleting] = React.useState(false);
  // Dinaikkan setelah ubah/hapus supaya data dimuat ulang
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

        const items: KategoriArsip[] = (result.items ?? []).map((item) => ({
          id: item.id,
          kode: item.kode,
          nama: item.nama,
          retensiAktif: item.retensi_aktif_tahun ?? item.retensiAktif ?? 0,
          retensiInaktif:
            item.retensi_inaktif_tahun ?? item.retensiInaktif ?? 0,
          jumlahArsip: item.jumlah_arsip ?? item.jumlahArsip ?? 0,
          keterangan: item.keterangan ?? null,
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

  function handleViewClick(item: KategoriArsip) {
    onView?.(item);
    setViewTarget(item);
  }

  function handleEditClick(item: KategoriArsip) {
    if (onEdit) {
      onEdit(item);
      return;
    }
    setEditTarget(item);
    setEditForm({
      kode: item.kode,
      nama: item.nama,
      retensiAktif: item.retensiAktif,
      retensiInaktif: item.retensiInaktif,
    });
  }

  async function submitEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editTarget || savingEdit) return;
    setSavingEdit(true);

    try {
      const res = await fetch(
        `/api/arsip/kategori/${encodeURIComponent(String(editTarget.id))}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kode: editForm.kode.trim(),
            nama: editForm.nama.trim(),
            retensi_aktif_tahun: Number(editForm.retensiAktif),
            retensi_inaktif_tahun: Number(editForm.retensiInaktif),
          }),
        },
      );
      const result = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!res.ok) {
        toast.error("Kategori gagal diperbarui", {
          description:
            result?.message ?? "Terjadi kesalahan saat memperbarui kategori.",
        });
        return;
      }

      toast.success("Kategori berhasil diperbarui", {
        description:
          result?.message ?? `"${editForm.nama}" telah diperbarui.`,
      });
      setEditTarget(null);

      if (data !== undefined) {
        router.refresh();
      } else {
        setReloadKey((k) => k + 1);
      }
    } catch {
      toast.error("Kategori gagal diperbarui", {
        description: "Tidak dapat terhubung ke server. Coba lagi.",
      });
    } finally {
      setSavingEdit(false);
    }
  }

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
        router.refresh();
      } else if (kategoriData.length === 1 && page > 1) {
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

  const columns: DataTableColumn<KategoriArsip>[] = [
    {
      key: "kode",
      header: "Kode",
      headerClassName: "w-32",
      cellClassName: "py-5",
      render: (item) => (
        <span className="inline-flex rounded bg-[#e2e7ff] px-2.5 py-0.5 font-mono text-[13px] font-bold leading-5 text-[#00288e]">
          {item.kode}
        </span>
      ),
    },
    {
      key: "nama",
      header: "Nama Kategori",
      cellClassName: "py-5 text-base font-semibold leading-6 text-[#131b2e]",
      render: (item) => item.nama,
    },
    {
      key: "jumlahArsip",
      header: "Jumlah Arsip",
      headerClassName: "w-44",
      cellClassName: "py-5",
      render: (item) => (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f2f3ff] px-3 py-1 text-xs font-bold text-[#00288e]">
          <FileStack className="size-3.5" aria-hidden />
          {item.jumlahArsip} Arsip
        </span>
      ),
    },
    {
      key: "retensi",
      header: "Retensi",
      headerClassName: "w-56",
      cellClassName: "py-4 text-sm leading-[22.75px] text-[#444653]",
      render: (item) => (
        <>
          <p>• Aktif: {item.retensiAktif} Tahun</p>
          <p>• Inaktif: {item.retensiInaktif} Tahun</p>
        </>
      ),
    },
    {
      key: "aksi",
      header: "Aksi",
      align: "right",
      headerClassName: "w-44",
      cellClassName: "py-5",
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Lihat ${item.nama}`}
            onClick={() => handleViewClick(item)}
            className="size-7 rounded-lg text-[#00288e] hover:bg-[#e2e7ff] hover:text-[#00288e]"
          >
            <Eye className="size-4.5" />
          </Button>

          {canManage && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Edit ${item.nama}`}
                onClick={() => handleEditClick(item)}
                className="size-7 rounded-lg text-[#00288e] hover:bg-[#e2e7ff] hover:text-[#00288e]"
              >
                <Pencil className="size-4" />
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Hapus ${item.nama}`}
                onClick={() => setDeleteTarget(item)}
                className="size-7 rounded-lg text-[#ba1a1a] hover:bg-[#ba1a1a]/10 hover:text-[#ba1a1a]"
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div
      className={cn("flex w-full flex-col gap-6 bg-[#faf8ff] p-6", className)}
    >
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[28px] font-bold leading-9 tracking-[-0.7px] text-[#131b2e]">
          Kategori Arsip
        </h1>

        {canManage && (
          <Link
            href="/arsip/kategori/formulir"
            className="inline-flex h-auto items-center gap-2 rounded-xl bg-[#1e40af] px-6 py-2.5 text-sm font-semibold text-white shadow-[0_1px_1px_rgba(0,0,0,0.05)] hover:bg-[#1e40af]/90"
          >
            <Plus className="size-3 stroke-[2.5]" />
            Tambah Kategori
          </Link>
        )}
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
      <DataTable
        icon={<FolderOpen className="size-5 text-[#00288e]" aria-hidden />}
        title="Data Klasifikasi Kategori Arsip"
        headerActions={
          <p className="text-[11px] font-bold tracking-[0.44px] text-[#444653]">
            Total:{" "}
            <span className="font-semibold text-[#00288e]">
              {total} Kategori
            </span>
          </p>
        }
        columns={columns}
        data={filtered}
        getRowKey={(item) => item.id}
        loading={loading}
        loadingMessage="Memuat data kategori..."
        error={error}
        emptyState={
          query.trim()
            ? {
                icon: <Search className="size-6" aria-hidden />,
                title: "Kategori tidak ditemukan",
                description: `Tidak ada kode atau nama kategori yang cocok dengan "${query.trim()}".`,
                action: (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setQuery("")}
                    className="h-10 rounded-lg bg-[#eaedff] px-4 text-xs font-semibold text-[#131b2e] hover:bg-[#dde1ff]"
                  >
                    Reset Pencarian
                  </Button>
                ),
              }
            : {
                icon: <FolderOpen className="size-6" aria-hidden />,
                title: "Belum ada kategori klasifikasi arsip",
                description: canManage
                  ? "Buat kategori klasifikasi dan jadwal retensi arsip (JRA) pertama sebelum mulai menginput berkas arsip."
                  : "Belum ada kategori klasifikasi yang ditambahkan oleh staf program studi.",
                action: canManage ? (
                  <Link
                    href="/arsip/kategori/formulir"
                    className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-[#1e40af] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1e3a9f]"
                  >
                    <Plus className="size-3.5 stroke-[2.5]" aria-hidden />
                    Tambah Kategori Pertama
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
          itemLabel: "kategori",
          disabled: loading,
          onPageChange: handlePageChange,
        }}
      />

      {/* Dialog Detail Kategori */}
      {viewTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-kategori-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewTarget(null);
          }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-flex rounded bg-[#e2e7ff] px-2.5 py-0.5 font-mono text-xs font-bold text-[#00288e]">
                  {viewTarget.kode}
                </span>
                <h2
                  id="detail-kategori-title"
                  className="mt-2 text-xl font-bold text-[#131b2e]"
                >
                  {viewTarget.nama}
                </h2>
              </div>
              <button
                type="button"
                aria-label="Tutup detail kategori"
                onClick={() => setViewTarget(null)}
                className="rounded-lg p-1.5 text-[#444653] hover:bg-[#f2f3ff]"
              >
                <X className="size-4.5" />
              </button>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#f2f3ff] p-3.5">
                <dt className="text-xs font-semibold text-[#444653]">
                  Retensi Aktif
                </dt>
                <dd className="mt-1 text-base font-bold text-[#131b2e]">
                  {viewTarget.retensiAktif} Tahun
                </dd>
              </div>
              <div className="rounded-xl bg-[#f2f3ff] p-3.5">
                <dt className="text-xs font-semibold text-[#444653]">
                  Retensi Inaktif
                </dt>
                <dd className="mt-1 text-base font-bold text-[#131b2e]">
                  {viewTarget.retensiInaktif} Tahun
                </dd>
              </div>
              <div className="col-span-2 flex items-center justify-between rounded-xl bg-[#f2f3ff] p-3.5">
                <div>
                  <dt className="text-xs font-semibold text-[#444653]">
                    Jumlah Arsip Terkait
                  </dt>
                  <dd className="mt-0.5 text-base font-bold text-[#00288e]">
                    {viewTarget.jumlahArsip} Berkas Arsip
                  </dd>
                </div>
                <Link
                  href={`/arsip/daftar?kategoriId=${encodeURIComponent(
                    String(viewTarget.id),
                  )}`}
                  className="rounded-lg bg-[#00288e] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#001f6f]"
                >
                  Lihat Daftar Arsip
                </Link>
              </div>
            </dl>

            <div className="mt-6 flex justify-end gap-2">
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const target = viewTarget;
                    setViewTarget(null);
                    handleEditClick(target);
                  }}
                  className="rounded-lg bg-[#eaedff] px-4 text-xs font-semibold text-[#131b2e] hover:bg-[#dde1ff]"
                >
                  Ubah Kategori
                </Button>
              )}
              <Button
                type="button"
                onClick={() => setViewTarget(null)}
                className="rounded-lg bg-[#1e40af] px-4 text-xs font-semibold text-white hover:bg-[#1e3a9f]"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Edit Kategori */}
      {editTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-kategori-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget && !savingEdit) {
              setEditTarget(null);
            }
          }}
        >
          <form
            onSubmit={submitEdit}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h2
                id="edit-kategori-title"
                className="text-xl font-bold text-[#131b2e]"
              >
                Ubah Kategori Arsip
              </h2>
              <button
                type="button"
                disabled={savingEdit}
                aria-label="Tutup form ubah kategori"
                onClick={() => setEditTarget(null)}
                className="rounded-lg p-1.5 text-[#444653] hover:bg-[#f2f3ff]"
              >
                <X className="size-4.5" />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-kode" className="text-xs font-semibold">
                  Kode Klasifikasi
                </Label>
                <Input
                  id="edit-kode"
                  required
                  value={editForm.kode}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, kode: e.target.value }))
                  }
                  className="h-10"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-nama" className="text-xs font-semibold">
                  Nama Kategori
                </Label>
                <Input
                  id="edit-nama"
                  required
                  value={editForm.nama}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, nama: e.target.value }))
                  }
                  className="h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="edit-retensi-aktif"
                    className="text-xs font-semibold"
                  >
                    Retensi Aktif (Tahun)
                  </Label>
                  <Input
                    id="edit-retensi-aktif"
                    type="number"
                    min={1}
                    required
                    value={editForm.retensiAktif}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        retensiAktif: Number(e.target.value),
                      }))
                    }
                    className="h-10"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label
                    htmlFor="edit-retensi-inaktif"
                    className="text-xs font-semibold"
                  >
                    Retensi Inaktif (Tahun)
                  </Label>
                  <Input
                    id="edit-retensi-inaktif"
                    type="number"
                    min={1}
                    required
                    value={editForm.retensiInaktif}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        retensiInaktif: Number(e.target.value),
                      }))
                    }
                    className="h-10"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={savingEdit}
                onClick={() => setEditTarget(null)}
                className="rounded-lg bg-[#eaedff] px-4 text-xs font-semibold text-[#131b2e] hover:bg-[#dde1ff]"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={savingEdit}
                className="rounded-lg bg-[#1e40af] px-4 text-xs font-semibold text-white hover:bg-[#1e3a9f]"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Perubahan"
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

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
