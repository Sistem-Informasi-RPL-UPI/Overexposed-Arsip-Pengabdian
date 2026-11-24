import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { LocalSessionPayload } from "@/lib/session";
import {
  bisaDiubah,
  dosenUnik,
  offsetDari,
  type DaftarDosenFilters,
  type DaftarFilters,
  type FilterAkreditasi,
} from "@/lib/tridarma-baca";

/**
 * Query dan bentuk respons baca data tridarma (PRD 5.9). Data satu dosen dibaca lewat tabel penghubung
 * (`publikasi_dosen`, `kegiatan_anggota`, `iprs_dosen`, `buku_dosen`), tanpa menyaring `sumber`,
 * jadi data SINTA dan data manual muncul bersama.
 */

type Sesi = LocalSessionPayload | null;

// Tahun kosong di akhir. Urutan kedua menjaga halaman tetap stabil.
const URUTAN_TAHUN = [{ tahun: { sort: "desc", nulls: "last" } }, { id: "desc" }] as const;

// Kolom kunci anti-dobel hanya dipakai di sisi server, jadi tidak ikut ke respons.
function tanpaKolom<T extends object, K extends keyof T>(baris: T, ...kolom: K[]): Omit<T, K> {
  const salinan = { ...baris };
  for (const k of kolom) delete salinan[k];
  return salinan;
}

// Filter teks bebas dari dropdown: sama persis, tanpa membedakan huruf besar kecil.
function samaDengan(nilai: string): Prisma.StringFilter {
  return { equals: nilai, mode: "insensitive" };
}

/**
 * Q1 sampai Q4 membaca kolom kuartil (Scopus). SINTA 1 sampai 6 membaca kolom akreditasi, dengan tiga bentuk tulisan
 * ("Sinta 2", "Sinta2", "S2") supaya tidak bergantung pada cara SINTA atau pengguna menulisnya.
 * Teks lain dicocokkan persis ke kedua kolom.
 */
function kondisiAkreditasi(a: FilterAkreditasi): Prisma.PublikasiWhereInput {
  if (a.jenis === "kuartil") return { kuartil: samaDengan(a.nilai) };
  if (a.jenis === "sinta") {
    const n = a.peringkat;
    return {
      OR: [
        { akreditasi: { contains: `sinta ${n}`, mode: "insensitive" } },
        { akreditasi: { contains: `sinta${n}`, mode: "insensitive" } },
        { akreditasi: samaDengan(`s${n}`) },
      ],
    };
  }
  return { OR: [{ kuartil: samaDengan(a.nilai) }, { akreditasi: samaDengan(a.nilai) }] };
}

function cariJudul(f: DaftarFilters): { judul?: Prisma.StringFilter } {
  return f.q ? { judul: { contains: f.q, mode: "insensitive" } } : {};
}

function cariTahun(f: DaftarFilters): { tahun?: number } {
  return f.tahun ? { tahun: f.tahun } : {};
}

// ===== Dosen =====

export async function daftarDosen(f: DaftarDosenFilters) {
  const where: Prisma.DosenWhereInput = f.q ? { nama: { contains: f.q, mode: "insensitive" } } : {};

  const [baris, total] = await Promise.all([
    db.dosen.findMany({
      where,
      orderBy: [{ nama: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      ...offsetDari(f),
      // user_id (sub SSO) tidak ikut: endpoint ini publik.
      select: {
        id: true,
        sinta_id: true,
        nama: true,
        afiliasi: true,
        departemen: true,
        sync_status: true,
        last_synced_at: true,
      },
    }),
    db.dosen.count({ where }),
  ]);

  return { items: baris, total };
}

export async function profilDosen(id: number) {
  const dosen = await db.dosen.findUnique({
    where: { id },
    select: {
      id: true,
      sinta_id: true,
      nama: true,
      afiliasi: true,
      departemen: true,
      sync_status: true,
      last_synced_at: true,
      sinta_skor: { select: { label: true, nilai: true }, orderBy: { label: "asc" } },
      sinta_metrik: {
        select: { label: true, scopus: true, gscholar: true, wos: true },
        orderBy: { label: "asc" },
      },
    },
  });
  if (!dosen) return null;

  const { sinta_skor, sinta_metrik, ...profil } = dosen;
  return {
    ...profil,
    skor: sinta_skor.map((s) => ({ label: s.label, nilai: Number(s.nilai) })),
    metrik: sinta_metrik,
  };
}

// ===== Publikasi =====

const PUBLIKASI_INCLUDE = {
  publikasi_dosen: {
    select: {
      dosen_id: true,
      source: true,
      urutan_penulis: true,
      total_penulis: true,
      sitasi_sumber: true,
      link_sumber: true,
      dosen: { select: { id: true, nama: true } },
    },
    orderBy: [{ dosen_id: "asc" }, { source: "asc" }],
  },
} satisfies Prisma.PublikasiInclude;

type BarisPublikasi = Prisma.PublikasiGetPayload<{ include: typeof PUBLIKASI_INCLUDE }>;

function bentukPublikasi(p: BarisPublikasi, session: Sesi, denganTautan: boolean) {
  const { publikasi_dosen, ...isi } = tanpaKolom(p, "judul_hash");
  const item = {
    ...isi,
    dosen: dosenUnik(publikasi_dosen),
    // Asal tiap tautan (PRD 9): sumber per paper dihitung dari publikasi_dosen.source saat dibaca.
    sumber_artikel: [...new Set(publikasi_dosen.map((d) => d.source))],
    bisa_diubah: bisaDiubah(session, publikasi_dosen.map((d) => d.dosen_id)),
  };
  if (!denganTautan) return item;
  return {
    ...item,
    tautan: publikasi_dosen.map(({ dosen_id, source, urutan_penulis, total_penulis, sitasi_sumber, link_sumber }) => ({
      dosen_id,
      source,
      urutan_penulis,
      total_penulis,
      sitasi_sumber,
      link_sumber,
    })),
  };
}

export async function daftarPublikasi(f: DaftarFilters, session: Sesi) {
  // Satu `some` untuk dosen_id dan sumber, jadi artinya "tertaut ke dosen itu lewat sumber itu".
  const tautan: Prisma.PublikasiDosenWhereInput = {
    ...(f.dosenId ? { dosen_id: f.dosenId } : {}),
    ...(f.sumberArtikel ? { source: f.sumberArtikel } : {}),
  };
  const where: Prisma.PublikasiWhereInput = {
    ...cariJudul(f),
    ...cariTahun(f),
    ...(Object.keys(tautan).length ? { publikasi_dosen: { some: tautan } } : {}),
    ...(f.akreditasi ? kondisiAkreditasi(f.akreditasi) : {}),
  };

  const [baris, total] = await Promise.all([
    db.publikasi.findMany({ where, include: PUBLIKASI_INCLUDE, orderBy: [...URUTAN_TAHUN], ...offsetDari(f) }),
    db.publikasi.count({ where }),
  ]);
  return { items: baris.map((b) => bentukPublikasi(b, session, false)), total };
}

export async function detailPublikasi(id: number, session: Sesi) {
  const baris = await db.publikasi.findUnique({ where: { id }, include: PUBLIKASI_INCLUDE });
  return baris ? bentukPublikasi(baris, session, true) : null;
}

// ===== Kegiatan (penelitian dan pengabdian) =====

const KEGIATAN_INCLUDE = {
  anggota: {
    select: { nama: true, peran: true, dosen_id: true },
    // Ketua lebih dulu (urutan enum), lalu nama.
    orderBy: [{ peran: "asc" }, { nama: "asc" }],
  },
} satisfies Prisma.KegiatanInclude;

type BarisKegiatan = Prisma.KegiatanGetPayload<{ include: typeof KEGIATAN_INCLUDE }>;

// Kegiatan tidak punya status (PRD 5.3), dan kolom `kunci` hanya untuk anti-dobel.
function bentukKegiatan(k: BarisKegiatan, session: Sesi) {
  const { anggota, dana_nominal, ...isi } = tanpaKolom(k, "kunci");
  return {
    ...isi,
    dana_nominal: Number(dana_nominal),
    peserta: anggota,
    bisa_diubah: bisaDiubah(
      session,
      anggota.flatMap((a) => (a.dosen_id === null ? [] : [a.dosen_id])),
    ),
  };
}

export async function daftarKegiatan(f: DaftarFilters, session: Sesi) {
  const where: Prisma.KegiatanWhereInput = {
    ...cariJudul(f),
    ...cariTahun(f),
    ...(f.jenis ? { jenis: f.jenis } : {}),
    ...(f.skema ? { skema: samaDengan(f.skema) } : {}),
    ...(f.dosenId ? { anggota: { some: { dosen_id: f.dosenId } } } : {}),
  };

  const [baris, total] = await Promise.all([
    db.kegiatan.findMany({ where, include: KEGIATAN_INCLUDE, orderBy: [...URUTAN_TAHUN], ...offsetDari(f) }),
    db.kegiatan.count({ where }),
  ]);
  return { items: baris.map((b) => bentukKegiatan(b, session)), total };
}

export async function detailKegiatan(id: number, session: Sesi) {
  const baris = await db.kegiatan.findUnique({ where: { id }, include: KEGIATAN_INCLUDE });
  return baris ? bentukKegiatan(baris, session) : null;
}

// ===== IPRS (label tampilan: HKI) =====

const IPRS_INCLUDE = {
  iprs_dosen: {
    select: { dosen_id: true, dosen: { select: { id: true, nama: true } } },
    orderBy: { dosen_id: "asc" },
  },
} satisfies Prisma.IprsInclude;

type BarisIprs = Prisma.IprsGetPayload<{ include: typeof IPRS_INCLUDE }>;

function bentukIprs(i: BarisIprs, session: Sesi) {
  const { iprs_dosen, ...isi } = tanpaKolom(i, "kunci");
  return {
    ...isi,
    dosen: dosenUnik(iprs_dosen),
    bisa_diubah: bisaDiubah(session, iprs_dosen.map((d) => d.dosen_id)),
  };
}

export async function daftarIprs(f: DaftarFilters, session: Sesi) {
  const where: Prisma.IprsWhereInput = {
    ...cariJudul(f),
    ...cariTahun(f),
    ...(f.status ? { status: samaDengan(f.status) } : {}),
    ...(f.jenisIprs ? { jenis: samaDengan(f.jenisIprs) } : {}),
    ...(f.dosenId ? { iprs_dosen: { some: { dosen_id: f.dosenId } } } : {}),
  };

  const [baris, total] = await Promise.all([
    db.iprs.findMany({ where, include: IPRS_INCLUDE, orderBy: [...URUTAN_TAHUN], ...offsetDari(f) }),
    db.iprs.count({ where }),
  ]);
  return { items: baris.map((b) => bentukIprs(b, session)), total };
}

export async function detailIprs(id: number, session: Sesi) {
  const baris = await db.iprs.findUnique({ where: { id }, include: IPRS_INCLUDE });
  return baris ? bentukIprs(baris, session) : null;
}

// ===== Buku =====

const BUKU_INCLUDE = {
  buku_dosen: {
    select: { dosen_id: true, dosen: { select: { id: true, nama: true } } },
    orderBy: { dosen_id: "asc" },
  },
} satisfies Prisma.BukuInclude;

type BarisBuku = Prisma.BukuGetPayload<{ include: typeof BUKU_INCLUDE }>;

function bentukBuku(b: BarisBuku, session: Sesi) {
  const { buku_dosen, ...isi } = tanpaKolom(b, "kunci");
  return {
    ...isi,
    dosen: dosenUnik(buku_dosen),
    bisa_diubah: bisaDiubah(session, buku_dosen.map((d) => d.dosen_id)),
  };
}

export async function daftarBuku(f: DaftarFilters, session: Sesi) {
  const where: Prisma.BukuWhereInput = {
    ...cariJudul(f),
    ...cariTahun(f),
    ...(f.kategori ? { kategori: samaDengan(f.kategori) } : {}),
    ...(f.dosenId ? { buku_dosen: { some: { dosen_id: f.dosenId } } } : {}),
  };

  const [baris, total] = await Promise.all([
    db.buku.findMany({ where, include: BUKU_INCLUDE, orderBy: [...URUTAN_TAHUN], ...offsetDari(f) }),
    db.buku.count({ where }),
  ]);
  return { items: baris.map((b) => bentukBuku(b, session)), total };
}

export async function detailBuku(id: number, session: Sesi) {
  const baris = await db.buku.findUnique({ where: { id }, include: BUKU_INCLUDE });
  return baris ? bentukBuku(baris, session) : null;
}
