import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { JenisKegiatan } from "@/generated/prisma/enums";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from "@/lib/kegiatan-config";
import { normalizeRole } from "@/lib/rbac";
import type { LocalSessionPayload } from "@/lib/sso";
import EksporKegiatan from "@/components/Tridharma/Pengabdian/EksporKegiatan";

// Data untuk halaman Pengabdian. Daftar/detail/opsi kegiatan bersama ada di "@/lib/penelitian".

export type FilterHalaman = {
  search: string;
  tahun: number | null;
  page: number;
  pageSize: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function positiveInt(v: string | undefined): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function isJenisKegiatan(v: unknown): v is JenisKegiatan {
  return v === "penelitian" || v === "pengabdian";
}

// Dosen & Kaprodi melihat kegiatan miliknya saja, role lain melihat semua.
export function resolveKegiatanScope(session: LocalSessionPayload | null) {
  const role = normalizeRole(session?.role);
  const personal = role === "Dosen" || role === "Kaprodi";
  const dosenId = session?.dosen_id ?? null;
  return { role, personal, dosenId, belumTerhubung: personal && dosenId === null };
}

// Query string -> filter yang sudah aman dipakai ke query.
export function parseKegiatanFilters(sp: RawParams): FilterHalaman {
  const pageSize = positiveInt(first(sp.pageSize));
  return {
    search: (first(sp.q) ?? "").trim().slice(0, 200),
    tahun: positiveInt(first(sp.tahun)),
    page: positiveInt(first(sp.page)) ?? 1,
    pageSize: PAGE_SIZES.find((s) => s === pageSize) ?? DEFAULT_PAGE_SIZE,
  };
}

/**
 * Data halaman Penelitian / Pengabdian, dibaca dari tabel `kegiatan`.
 * - dosenId diisi  -> hanya kegiatan yang anggotanya termasuk dosen itu (Dosen / Kaprodi)
 * - dosenId kosong -> semua kegiatan yang punya anggota dosen terdaftar (role lain)
 * Aturan ini sama dengan getTridharmaDashboard supaya angkanya konsisten.
 */
export async function getKegiatanPage(jenis: JenisKegiatan, filters: FilterHalaman, dosenId?: number) {
  const personal = dosenId !== undefined;

  // Cakupan dasar: dipakai untuk total, grafik, dan opsi filter.
  const base: Prisma.KegiatanWhereInput = {
    jenis,
    anggota: { some: personal ? { dosen_id: dosenId } : { dosen_id: { not: null } } },
  };

  const where: Prisma.KegiatanWhereInput = {
    ...base,
    ...(filters.search && { judul: { contains: filters.search, mode: "insensitive" } }),
    ...(filters.tahun !== null && { tahun: filters.tahun }),
  };

  const [totalAll, total, perTahun, lastSync] = await Promise.all([
    db.kegiatan.count({ where: base }),
    db.kegiatan.count({ where }),
    db.kegiatan.groupBy({ by: ["tahun"], where: base, _count: { _all: true }, orderBy: { tahun: "asc" } }),
    personal
      ? db.dosen.findUnique({ where: { id: dosenId }, select: { last_synced_at: true } }).then((d) => d?.last_synced_at ?? null)
      : db.dosen.aggregate({ _max: { last_synced_at: true } }).then((r) => r._max.last_synced_at),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));
  const page = Math.min(filters.page, totalPages);

  const rows = await db.kegiatan.findMany({
    where,
    orderBy: [{ tahun: "desc" }, { id: "desc" }],
    skip: (page - 1) * filters.pageSize,
    take: filters.pageSize,
    select: {
      id: true,
      judul: true,
      tahun: true,
      dana_nominal: true,
      anggota: {
        select: {
          nama: true,
          peran: true,
          dosen_id: true,
        },
      },
    },
  });

  const items = rows.map((k) => ({
    id: k.id,
    judul: k.judul,
    tahun: k.tahun,
    dana: Number(k.dana_nominal),
    ketua: (k.anggota.find((a) => a.peran === "ketua") ?? k.anggota[0])?.nama ?? null,
    ownerDosenIds: k.anggota.flatMap((a) =>
      a.dosen_id === null ? [] : [a.dosen_id]
    ),
    link: `https://scholar.google.com/scholar?q=${encodeURIComponent(k.judul)}`,
  }));

  const tahunData = perTahun.flatMap((r) => (r.tahun === null ? [] : [{ tahun: r.tahun, jumlah: r._count._all }]));

  return {
    items,
    total,
    totalAll,
    page,
    totalPages,
    perTahun: tahunData,
    tahunOptions: tahunData.map((t) => t.tahun).reverse(),
    lastSync,
  };
}

export function formatRupiah(n: number): string {
  return n > 0 ? `Rp ${new Intl.NumberFormat("id-ID").format(n)}` : "-";
}

// "Hari ini, 08:30 WIB" atau "12 Nov 2026, 08:30 WIB"
export function formatSinkron(d: Date | null, now = new Date()): string {
  if (!d) return "Belum pernah";
  const tz = "Asia/Jakarta";
  const hari = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(x);
  const jam = new Intl.DateTimeFormat("id-ID", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(d)
    .replace(".", ":");
  const tanggal =
    hari(d) === hari(now)
      ? "Hari ini"
      : new Intl.DateTimeFormat("id-ID", { timeZone: tz, day: "numeric", month: "short", year: "numeric" }).format(d);
  return `${tanggal}, ${jam} WIB`;
}