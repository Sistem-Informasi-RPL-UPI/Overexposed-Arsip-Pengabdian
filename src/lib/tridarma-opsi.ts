import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { OpsiFilters } from "@/lib/tridarma-baca";

/**
 * Pilihan untuk dropdown filter (PRD 5.9). Front-end memakainya sebagai combobox yang bisa diketik, jadi daftar
 * dikirim lengkap dan penyaringan saat mengetik dilakukan di sisi klien.
 */

export interface Opsi {
  value: string;
  label: string;
}

// Tetap, tidak dibaca dari database (keputusan 2026-11-24): kuartil Scopus lalu akreditasi jurnal lokal.
export const OPSI_AKREDITASI: readonly Opsi[] = [
  ...[1, 2, 3, 4].map((n) => ({ value: `Q${n}`, label: `Q${n}` })),
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: `SINTA ${n}`, label: `SINTA ${n}` })),
];

// Nilai `value` sama dengan yang diterima parameter `sumber_artikel`.
export const OPSI_SUMBER_ARTIKEL: readonly Opsi[] = [
  { value: "scopus", label: "Scopus" },
  { value: "garuda", label: "Garuda" },
  { value: "googlescholar", label: "Google Scholar" },
  { value: "rama", label: "RAMA" },
  { value: "manual", label: "Manual" },
];

// Batas pengaman jumlah nilai unik per field.
const BATAS = 500;

function dariTahun(baris: { tahun: number | null }[]): Opsi[] {
  const tahun = new Set<number>();
  for (const b of baris) if (b.tahun !== null) tahun.add(b.tahun);
  return [...tahun].sort((a, b) => b - a).map((t) => ({ value: String(t), label: String(t) }));
}

/** Teks unik: spasi dirapikan, kosong dibuang, dan tulisan yang hanya beda huruf besar kecil digabung (yang pertama dipakai). */
function dariTeks(nilai: (string | null)[]): Opsi[] {
  const peta = new Map<string, string>();
  for (const n of nilai) {
    const teks = n?.trim();
    if (teks && !peta.has(teks.toLowerCase())) peta.set(teks.toLowerCase(), teks);
  }
  return [...peta.values()]
    .sort((a, b) => a.localeCompare(b, "id", { sensitivity: "base", numeric: true }))
    .map((t) => ({ value: t, label: t }));
}

export async function ambilOpsi(f: OpsiFilters) {
  const { dosenId } = f;

  if (f.untuk === "publikasi") {
    const where: Prisma.PublikasiWhereInput = dosenId ? { publikasi_dosen: { some: { dosen_id: dosenId } } } : {};
    const baris = await db.publikasi.findMany({
      where: { ...where, tahun: { not: null } },
      distinct: ["tahun"],
      select: { tahun: true },
      orderBy: { tahun: "desc" },
      take: BATAS,
    });
    return { tahun: dariTahun(baris), akreditasi: OPSI_AKREDITASI, sumber_artikel: OPSI_SUMBER_ARTIKEL };
  }

  if (f.untuk === "kegiatan") {
    const where: Prisma.KegiatanWhereInput = {
      ...(dosenId ? { anggota: { some: { dosen_id: dosenId } } } : {}),
      ...(f.jenis ? { jenis: f.jenis } : {}),
    };
    const [tahun, skema] = await Promise.all([
      db.kegiatan.findMany({
        where: { ...where, tahun: { not: null } },
        distinct: ["tahun"],
        select: { tahun: true },
        orderBy: { tahun: "desc" },
        take: BATAS,
      }),
      db.kegiatan.findMany({
        where: { ...where, skema: { not: null } },
        distinct: ["skema"],
        select: { skema: true },
        orderBy: { skema: "asc" },
        take: BATAS,
      }),
    ]);
    return { tahun: dariTahun(tahun), skema: dariTeks(skema.map((s) => s.skema)) };
  }

  if (f.untuk === "iprs") {
    const where: Prisma.IprsWhereInput = dosenId ? { iprs_dosen: { some: { dosen_id: dosenId } } } : {};
    const [tahun, status, jenis] = await Promise.all([
      db.iprs.findMany({
        where: { ...where, tahun: { not: null } },
        distinct: ["tahun"],
        select: { tahun: true },
        orderBy: { tahun: "desc" },
        take: BATAS,
      }),
      db.iprs.findMany({
        where: { ...where, status: { not: null } },
        distinct: ["status"],
        select: { status: true },
        orderBy: { status: "asc" },
        take: BATAS,
      }),
      db.iprs.findMany({
        where: { ...where, jenis: { not: null } },
        distinct: ["jenis"],
        select: { jenis: true },
        orderBy: { jenis: "asc" },
        take: BATAS,
      }),
    ]);
    return {
      tahun: dariTahun(tahun),
      status: dariTeks(status.map((s) => s.status)),
      jenis: dariTeks(jenis.map((j) => j.jenis)),
    };
  }

  const where: Prisma.BukuWhereInput = dosenId ? { buku_dosen: { some: { dosen_id: dosenId } } } : {};
  const [tahun, kategori] = await Promise.all([
    db.buku.findMany({
      where: { ...where, tahun: { not: null } },
      distinct: ["tahun"],
      select: { tahun: true },
      orderBy: { tahun: "desc" },
      take: BATAS,
    }),
    db.buku.findMany({
      where: { ...where, kategori: { not: null } },
      distinct: ["kategori"],
      select: { kategori: true },
      orderBy: { kategori: "asc" },
      take: BATAS,
    }),
  ]);
  return { tahun: dariTahun(tahun), kategori: dariTeks(kategori.map((k) => k.kategori)) };
}
