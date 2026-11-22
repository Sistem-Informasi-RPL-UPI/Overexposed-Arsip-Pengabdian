"use client";

import * as React from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  FileClock,
  FilePen,
  FilterX,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */

/* ----------------------------- Types ----------------------------- */

export type AksiLog =
  | "tambah"
  | "edit"
  | "hapus"
  | "validasi"
  | "sinkron"
  | "login"
  | "login_gagal";
export type RentangLog = "7d" | "30d" | "all";

export type LogAktivitas = {
  id: string | number;
  waktu: string;
  userNama: string;
  userPeran: string;
  aksi: AksiLog;
  judul: string;
  kode: string;
  keterangan: string;
};

export type LogStats = {
  tambah: number;
  edit: number;
  hapus: number;
};

/* ----------------------------- Konfigurasi ----------------------------- */

const LOG_ENDPOINT = "/api/log-aktivitas";
const PAGE_SIZE = 5;
const ZERO_STATS: LogStats = { tambah: 0, edit: 0, hapus: 0 };

// Backend memakai "ubah", UI memakai "edit".
const AKSI_DARI_BACKEND: Record<string, AksiLog> = {
  tambah: "tambah",
  ubah: "edit",
  hapus: "hapus",
  validasi: "validasi",
  sinkron: "sinkron",
  login: "login",
  login_gagal: "login_gagal",
};

const OBJEK_LABEL: Record<string, string> = {
  arsip: "Arsip",
  kategori: "Kategori",
  dosen: "Dosen",
  sso: "SSO",
};

function mapItem(row: any): LogAktivitas {
  return {
    id: row.id,
    waktu: row.created_at ?? "",
    userNama: row.user_nama ?? "-",
    userPeran: "",
    aksi: AKSI_DARI_BACKEND[String(row.aksi)] ?? "edit",
    judul: OBJEK_LABEL[row.objek] ?? row.objek ?? "-",
    kode: row.modul ? `Modul ${row.modul}` : "",
    keterangan:
      typeof row.detail === "string"
        ? row.detail
        : row.detail
          ? JSON.stringify(row.detail)
          : "-",
  };
}

// "7d" -> YYYY-MM-DD (zona WIB) 7 hari lalu. "all" -> tanpa batas.
function dariRentang(rentang: RentangLog): string | undefined {
  const m = /^(\d+)d$/.exec(rentang);
  if (!m) return undefined;
  const d = new Date(Date.now() - Number(m[1]) * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

/* ----------------------------- Helpers tampilan ----------------------------- */

const AKSI_STYLE: Record<
  AksiLog,
  { label: string; bg: string; dot: string; text: string }
> = {
  tambah: { label: "Tambah", bg: "bg-[#6ffbbe]", dot: "bg-[#00563a]", text: "text-[#30976e]" },
  edit: { label: "Edit", bg: "bg-[#c9e6ff]", dot: "bg-[#006591]", text: "text-[#004c6e]" },
  hapus: { label: "Hapus", bg: "bg-[#ffdad6]", dot: "bg-[#ba1a1a]", text: "text-[#ba1a1a]" },
  validasi: { label: "Validasi", bg: "bg-[#e2e7ff]", dot: "bg-[#1e40af]", text: "text-[#1e40af]" },
  sinkron: { label: "Sinkron", bg: "bg-[#fff1c2]", dot: "bg-[#8a6100]", text: "text-[#8a6100]" },
  login: { label: "Login", bg: "bg-[#eaedff]", dot: "bg-[#444653]", text: "text-[#444653]" },
  login_gagal: { label: "Login Gagal", bg: "bg-[#ffdad6]", dot: "bg-[#ba1a1a]", text: "text-[#ba1a1a]" },
};

const dateFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function formatTanggal(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { tanggal: "-", jam: "-" };
  return {
    tanggal: dateFmt.format(d),
    jam: `${timeFmt.format(d).replace(".", ":")} WIB`,
  };
}

function getPageItems(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (page <= 3) return [1, 2, 3, "ellipsis", totalPages];
  if (page >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages];
}

const STAT_CARDS = [
  {
    key: "total",
    label: "Total Aktivitas",
    suffix: "Log tercatat",
    icon: FileClock,
    iconBg: "bg-[#e2e7ff]",
    iconColor: "text-[#1e40af]",
  },
  {
    key: "tambah",
    label: "Aktivitas Tambah",
    suffix: "Arsip Baru",
    icon: CirclePlus,
    iconBg: "bg-[#6ffbbe]",
    iconColor: "text-[#00563a]",
  },
  {
    key: "edit",
    label: "Aktivitas Edit",
    suffix: "Pembaruan",
    icon: FilePen,
    iconBg: "bg-[#c9e6ff]",
    iconColor: "text-[#006591]",
  },
  {
    key: "hapus",
    label: "Aktivitas Hapus",
    suffix: "Penghapusan",
    icon: Trash2,
    iconBg: "bg-[#ffdad6]",
    iconColor: "text-[#ba1a1a]",
  },
] as const;

const headClass =
  "h-auto px-4 py-3.5 text-xs font-bold tracking-[0.24px] text-[#444653]";

const selectTriggerClass =
  "h-10 w-auto min-w-[140px] gap-2 rounded-lg border-0 bg-[#f2f3ff] px-3 text-xs font-semibold tracking-[0.24px] text-[#131b2e] shadow-none focus-visible:ring-1 focus-visible:ring-[#1e40af]";

/* ----------------------------- Component ----------------------------- */

export function LogAktivitasPage({ className }: { className?: string }) {
  const [items, setItems] = React.useState<LogAktivitas[]>([]);
  const [total, setTotal] = React.useState(0);
  const [stats, setStats] = React.useState<LogStats>(ZERO_STATS);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const [searchInput, setSearchInput] = React.useState("");
  const [q, setQ] = React.useState("");
  const [aksi, setAksi] = React.useState<AksiLog | "semua">("semua");
  const [rentang, setRentang] = React.useState<RentangLog>("7d");
  const [page, setPage] = React.useState(1);

  // Debounce pencarian
  React.useEffect(() => {
    const t = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // 1) Daftar log (tabel + kartu Total dari pagination.total)
  React.useEffect(() => {
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });

        if (aksi !== "semua") {
          params.set("aksi", aksi === "edit" ? "ubah" : aksi);
        }
        const dari = dariRentang(rentang);
        if (dari) params.set("dari", dari);
        if (q) params.set("q", q);

        const res = await fetch(`${LOG_ENDPOINT}?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data: any = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(
            data?.message ?? `Gagal mengambil log (status ${res.status}).`,
          );
        }

        const rawItems: any[] = data?.items ?? [];
        setItems(rawItems.map(mapItem));
        setTotal(data?.pagination?.total ?? rawItems.length);
      } catch (err) {
        if (controller.signal.aborted) return;
        setItems([]);
        setTotal(0);
        setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [q, aksi, rentang, page]);

  // 2) Kartu Tambah / Edit / Hapus: total dari filter aksi masing-masing.
  //    Mengikuti rentang waktu dan pencarian, tidak mengikuti filter aksi dan halaman.
  React.useEffect(() => {
    const controller = new AbortController();

    async function hitung(aksiBackend: string): Promise<number> {
      const params = new URLSearchParams({
        page: "1",
        pageSize: "1", // cukup 1 baris, yang dibutuhkan hanya pagination.total
        aksi: aksiBackend,
      });
      const dari = dariRentang(rentang);
      if (dari) params.set("dari", dari);
      if (q) params.set("q", q);

      const res = await fetch(`${LOG_ENDPOINT}?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const data: any = await res.json().catch(() => null);
      return res.ok ? (data?.pagination?.total ?? 0) : 0;
    }

    Promise.all([hitung("tambah"), hitung("ubah"), hitung("hapus")])
      .then(([tambah, edit, hapus]) => {
        if (!controller.signal.aborted) setStats({ tambah, edit, hapus });
      })
      .catch(() => {
        if (!controller.signal.aborted) setStats(ZERO_STATS);
      });

    return () => controller.abort();
  }, [q, rentang]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = items.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = items.length ? from + items.length - 1 : 0;

  const angkaKartu: Record<(typeof STAT_CARDS)[number]["key"], number> = {
    total,
    tambah: stats.tambah,
    edit: stats.edit,
    hapus: stats.hapus,
  };

  const handleReset = () => {
    setSearchInput("");
    setQ("");
    setAksi("semua");
    setRentang("7d");
    setPage(1);
  };

  return (
    <div className={cn("flex w-full flex-col gap-6 bg-[#faf8ff] p-6", className)}>
      {error && (
        <div className="rounded-xl border border-[#ba1a1a]/30 bg-[#ba1a1a]/5 px-4 py-3 text-sm text-[#ba1a1a]">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between rounded-xl bg-white p-6 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
        <h1 className="text-[28px] font-bold leading-9 tracking-[-0.7px] text-black">
          Log Aktivitas
        </h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STAT_CARDS.map(({ key, label, suffix, icon: Icon, iconBg, iconColor }) => (
          <div
            key={key}
            className="flex flex-col justify-between rounded-xl bg-white p-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
          >
            <div className="flex items-center justify-between pb-2">
              <p className="text-xs font-semibold uppercase leading-4 tracking-[0.6px] text-[#444653]">
                {label}
              </p>
              <div className={cn("flex size-9 items-center justify-center rounded-lg", iconBg)}>
                <Icon className={cn("size-[18px]", iconColor)} />
              </div>
            </div>
            <p className="flex items-baseline gap-2">
              <span className="text-4xl font-bold leading-9 tracking-[-0.72px] text-[#131b2e]">
                {angkaKartu[key]}
              </span>
              <span className="text-[11px] font-medium leading-[14px] tracking-[0.44px] text-[#444653]">
                {suffix}
              </span>
            </p>
          </div>
        ))}
      </div>

      {/* Filter & search toolbar */}
      <div className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)] md:flex-row md:items-center">
        <div className="relative w-full flex-1 md:max-w-[512px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-[#757684]" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cari nama pengguna atau kata kunci..."
            className="h-10 rounded-lg border-0 bg-[#f2f3ff] pl-10 pr-4 text-sm text-[#131b2e] shadow-none placeholder:text-[#757684] focus-visible:ring-1 focus-visible:ring-[#1e40af]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={aksi}
            onValueChange={(v) => {
              setAksi(v as AksiLog | "semua");
              setPage(1);
            }}
          >
            <SelectTrigger className={selectTriggerClass} aria-label="Filter jenis aktivitas">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Aktivitas</SelectItem>
              <SelectItem value="tambah">Tambah</SelectItem>
              <SelectItem value="edit">Edit</SelectItem>
              <SelectItem value="hapus">Hapus</SelectItem>
              <SelectItem value="validasi">Validasi</SelectItem>
              <SelectItem value="sinkron">Sinkron</SelectItem>
              <SelectItem value="login">Login</SelectItem>
              <SelectItem value="login_gagal">Login Gagal</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={rentang}
            onValueChange={(v) => {
              setRentang(v as RentangLog);
              setPage(1);
            }}
          >
            <SelectTrigger className={selectTriggerClass} aria-label="Filter rentang waktu">
              <Calendar className="size-4 text-[#757684]" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 Hari Terakhir</SelectItem>
              <SelectItem value="30d">30 Hari Terakhir</SelectItem>
              <SelectItem value="all">Semua Waktu</SelectItem>
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            className="h-10 gap-1.5 rounded-lg bg-[#eaedff] px-4 text-xs font-semibold tracking-[0.24px] text-[#444653] hover:bg-[#e2e7ff] hover:text-[#444653]"
          >
            <FilterX className="size-[15px]" />
            Reset Filter
          </Button>
        </div>
      </div>

      {/* Table surface */}
      <div className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <Table className="min-w-[1044px]">
          <TableHeader>
            <TableRow className="border-0 bg-[#f2f3ff] hover:bg-[#f2f3ff]">
              <TableHead className={cn(headClass, "w-[128px]")}>Waktu Aktivitas</TableHead>
              <TableHead className={cn(headClass, "w-[263px]")}>Nama Pengguna</TableHead>
              <TableHead className={cn(headClass, "w-[112px] text-center")}>Aktivitas</TableHead>
              <TableHead className={cn(headClass, "min-w-[280px]")}>Data / Arsip</TableHead>
              <TableHead className={cn(headClass, "min-w-[260px]")}>Keterangan</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="px-6 py-10 text-center text-sm text-[#757684]">
                  Memuat log aktivitas...
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="px-6 py-10 text-center text-sm text-[#757684]">
                  Tidak ada aktivitas yang cocok.
                </TableCell>
              </TableRow>
            ) : (
              items.map((row) => {
                const { tanggal, jam } = formatTanggal(row.waktu);
                const style = AKSI_STYLE[row.aksi];
                const isHapus = row.aksi === "hapus";

                return (
                  <TableRow key={row.id} className="border-0 hover:bg-[#f2f3ff]/40">
                    <TableCell className="px-4 py-4 align-middle">
                      <p className="text-xs font-semibold leading-4 tracking-[0.24px] text-[#131b2e]">
                        {tanggal}
                      </p>
                      <p className="text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[#444653]">
                        {jam}
                      </p>
                    </TableCell>

                    <TableCell className="px-4 py-4 align-middle">
                      <p className="text-xs font-semibold leading-4 tracking-[0.24px] text-[#131b2e]">
                        {row.userNama}
                      </p>
                      {row.userPeran && (
                        <p className="text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[#444653]">
                          {row.userPeran}
                        </p>
                      )}
                    </TableCell>

                    <TableCell className="px-4 py-4 text-center align-middle">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold leading-[14px] tracking-[0.44px]",
                          style.bg,
                          style.text,
                        )}
                      >
                        <span className={cn("size-1.5 rounded-full", style.dot)} />
                        {style.label}
                      </span>
                    </TableCell>

                    <TableCell className="whitespace-normal px-4 py-4 align-middle">
                      <p
                        className={cn(
                          "text-xs font-semibold leading-4 tracking-[0.24px]",
                          isHapus ? "text-[#444653] line-through" : "text-[#00288e]",
                        )}
                      >
                        {row.judul}
                      </p>
                      <p
                        className={cn(
                          "font-mono text-[11px] font-bold leading-[14px] tracking-[0.44px]",
                          isHapus ? "text-[#757684]" : "text-[#444653]",
                        )}
                      >
                        {row.kode}
                      </p>
                    </TableCell>

                    <TableCell className="whitespace-normal p-4 align-middle text-sm leading-[22px] text-[#444653]">
                      {row.keterangan}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        <div className="flex flex-col gap-3 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-[18px] text-[#444653]">
            Menampilkan{" "}
            <span className="font-semibold text-[#131b2e]">
              {from} - {to}
            </span>{" "}
            dari <span className="font-semibold text-[#131b2e]">{total}</span> catatan
            aktivitas
          </p>

          <nav aria-label="Pagination" className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Halaman sebelumnya"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="size-8 rounded-lg text-[#757684] hover:bg-[#eaedff] disabled:opacity-40"
            >
              <ChevronLeft className="size-4" />
            </Button>

            {getPageItems(page, totalPages).map((p, i) =>
              p === "ellipsis" ? (
                <span key={`e-${i}`} className="px-1 text-base text-[#757684]">
                  ...
                </span>
              ) : (
                <Button
                  key={p}
                  variant="ghost"
                  disabled={loading}
                  onClick={() => setPage(p)}
                  aria-current={p === page ? "page" : undefined}
                  className={cn(
                    "size-8 rounded-lg p-0 text-[11px] font-bold tracking-[0.44px]",
                    p === page
                      ? "bg-[#1e40af] text-white hover:bg-[#1e40af] hover:text-white"
                      : "text-[#131b2e] hover:bg-[#eaedff]",
                  )}
                >
                  {p}
                </Button>
              ),
            )}

            <Button
              variant="ghost"
              size="icon"
              aria-label="Halaman berikutnya"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="size-8 rounded-lg text-[#757684] hover:bg-[#eaedff] disabled:opacity-40"
            >
              <ChevronRight className="size-4" />
            </Button>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default LogAktivitasPage;