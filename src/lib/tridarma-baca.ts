import { NextResponse } from "next/server";
import type { JenisKegiatan, PublikasiSource } from "@/generated/prisma/client";
import { getTridharmaPermissions } from "@/lib/rbac";
import { getSession, type LocalSessionPayload } from "@/lib/session";

/**
 * Pembantu endpoint baca data tridarma (PRD 5.9): parameter, pagination, `bisa_diubah`, dan pembungkus
 * respons. Semua endpoint ini terbuka tanpa login. Sesi hanya dipakai untuk menentukan `bisa_diubah`.
 */

export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;
// Daftar dosen dipakai untuk dropdown filter, jadi halamannya lebih besar.
export const DEFAULT_PAGE_SIZE_DOSEN = 100;
export const MAX_PAGE_SIZE_DOSEN = 200;

const JENIS_KEGIATAN: readonly JenisKegiatan[] = ["penelitian", "pengabdian"];
const MAX_PANJANG_Q = 200;
const MAX_PANJANG_FILTER = 255;

// Nilai `publikasi_dosen.source` yang boleh dipakai sebagai filter. Awalan sinta_ boleh dihilangkan.
const SUMBER_ARTIKEL: Record<string, PublikasiSource> = {
  scopus: "sinta_scopus",
  garuda: "sinta_garuda",
  googlescholar: "sinta_googlescholar",
  rama: "sinta_rama",
  manual: "manual",
};
const MAX_INT4 = 2_147_483_647;

export interface Halaman {
  page: number;
  pageSize: number;
}

export interface DaftarFilters extends Halaman {
  dosenId?: number;
  tahun?: number;
  q?: string;
  /** Hanya kegiatan: penelitian atau pengabdian. */
  jenis?: JenisKegiatan;
  /** Hanya publikasi: akreditasi gabungan (PRD 5.9). Q1 sampai Q4 membaca kuartil, SINTA 1 sampai 6 membaca akreditasi. */
  akreditasi?: FilterAkreditasi;
  /** Hanya publikasi: nilai `publikasi_dosen.source`. */
  sumberArtikel?: PublikasiSource;
  /** Hanya kegiatan. */
  skema?: string;
  /** Hanya iprs. */
  status?: string;
  /** Hanya iprs: jenis HKI (teks bebas, misalnya "Hak Cipta"). */
  jenisIprs?: string;
  /** Hanya buku. */
  kategori?: string;
}

export type UntukEndpoint = "publikasi" | "kegiatan" | "iprs" | "buku";

/**
 * Pilihan akreditasi di desain: Q1 sampai Q4 (kuartil Scopus) dan SINTA 1 sampai SINTA 6 (akreditasi jurnal lokal).
 * Teks lain tetap diterima dan dicocokkan ke kedua kolom, supaya nilai lama atau manual tidak hilang.
 */
export type FilterAkreditasi =
  | { jenis: "kuartil"; nilai: string }
  | { jenis: "sinta"; peringkat: number }
  | { jenis: "teks"; nilai: string };

export function klasifikasiAkreditasi(teks: string): FilterAkreditasi {
  const kuartil = /^q\s*([1-4])$/i.exec(teks);
  if (kuartil) return { jenis: "kuartil", nilai: `Q${kuartil[1]}` };
  const sinta = /^(?:sinta|s)\s*([1-6])$/i.exec(teks);
  if (sinta) return { jenis: "sinta", peringkat: Number(sinta[1]) };
  return { jenis: "teks", nilai: teks };
}

export interface DaftarDosenFilters extends Halaman {
  q?: string;
}

type Hasil<T> = { ok: true; value: T } | { ok: false; message: string };

function bilanganBulat(raw: string | null, nama: string, min: number, max: number): Hasil<number | undefined> {
  const teks = (raw ?? "").trim();
  if (!teks) return { ok: true, value: undefined };
  const angka = Number(teks);
  if (!/^\d+$/.test(teks) || !Number.isSafeInteger(angka) || angka < min || angka > max) {
    return { ok: false, message: `Parameter ${nama} harus bilangan bulat antara ${min} dan ${max}.` };
  }
  return { ok: true, value: angka };
}

function bacaHalaman(params: URLSearchParams, bawaan: number, maks: number): Halaman {
  const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
  const rawPageSize = Number.parseInt(params.get("pageSize") ?? params.get("limit") ?? "", 10);
  const pageSize = Number.isInteger(rawPageSize) ? Math.min(maks, Math.max(1, rawPageSize)) : bawaan;
  return { page, pageSize };
}

function bacaQ(params: URLSearchParams): Hasil<string | undefined> {
  const q = (params.get("q") ?? "").trim();
  if (q.length > MAX_PANJANG_Q) {
    return { ok: false, message: `Parameter q maksimal ${MAX_PANJANG_Q} karakter.` };
  }
  return { ok: true, value: q || undefined };
}

// Filter teks bebas: tanpa membedakan huruf besar kecil, nilainya harus sama persis (dari pilihan dropdown).
function bacaTeks(params: URLSearchParams, nama: string): Hasil<string | undefined> {
  const teks = (params.get(nama) ?? "").trim();
  if (teks.length > MAX_PANJANG_FILTER) {
    return { ok: false, message: `Parameter ${nama} maksimal ${MAX_PANJANG_FILTER} karakter.` };
  }
  return { ok: true, value: teks || undefined };
}

function bacaSumberArtikel(params: URLSearchParams): Hasil<PublikasiSource | undefined> {
  // `sumber_artikel` sama dengan nama kolom respons. `sumber` diterima sebagai alias.
  const raw = (params.get("sumber_artikel") ?? params.get("sumber") ?? "").trim().toLowerCase();
  if (!raw) return { ok: true, value: undefined };
  const kunci = raw.replace(/^sinta_/, "");
  const cocok = Object.hasOwn(SUMBER_ARTIKEL, kunci) ? SUMBER_ARTIKEL[kunci] : undefined;
  if (!cocok) {
    return {
      ok: false,
      message: `Parameter sumber_artikel harus salah satu dari: ${Object.keys(SUMBER_ARTIKEL).join(", ")}.`,
    };
  }
  return { ok: true, value: cocok };
}

/**
 * Filter daftar publikasi, kegiatan, IPRS, dan buku. `dosen_id`, `tahun`, `q`, dan halaman berlaku untuk semua.
 * Filter lain hanya dibaca untuk endpoint yang memakainya, dan diabaikan di endpoint lain.
 */
export function parseDaftarFilters(params: URLSearchParams, opsi: { untuk: UntukEndpoint }): Hasil<DaftarFilters> {
  const dosenId = bilanganBulat(params.get("dosen_id"), "dosen_id", 1, MAX_INT4);
  if (!dosenId.ok) return dosenId;

  const tahun = bilanganBulat(params.get("tahun"), "tahun", 1000, 9999);
  if (!tahun.ok) return tahun;

  const q = bacaQ(params);
  if (!q.ok) return q;

  const filters: DaftarFilters = {
    dosenId: dosenId.value,
    tahun: tahun.value,
    q: q.value,
    ...bacaHalaman(params, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };

  if (opsi.untuk === "publikasi") {
    const akreditasi = bacaTeks(params, "akreditasi");
    if (!akreditasi.ok) return akreditasi;
    const sumber = bacaSumberArtikel(params);
    if (!sumber.ok) return sumber;
    filters.akreditasi = akreditasi.value ? klasifikasiAkreditasi(akreditasi.value) : undefined;
    filters.sumberArtikel = sumber.value;
  }

  if (opsi.untuk === "kegiatan") {
    const raw = (params.get("jenis") ?? "").trim().toLowerCase();
    if (raw) {
      const cocok = JENIS_KEGIATAN.find((j) => j === raw);
      if (!cocok) return { ok: false, message: "Parameter jenis harus penelitian atau pengabdian." };
      filters.jenis = cocok;
    }
    const skema = bacaTeks(params, "skema");
    if (!skema.ok) return skema;
    filters.skema = skema.value;
  }

  if (opsi.untuk === "iprs") {
    const status = bacaTeks(params, "status");
    if (!status.ok) return status;
    const jenis = bacaTeks(params, "jenis");
    if (!jenis.ok) return jenis;
    filters.status = status.value;
    filters.jenisIprs = jenis.value;
  }

  if (opsi.untuk === "buku") {
    const kategori = bacaTeks(params, "kategori");
    if (!kategori.ok) return kategori;
    filters.kategori = kategori.value;
  }

  return { ok: true, value: filters };
}

export interface OpsiFilters {
  untuk: UntukEndpoint;
  /** Membatasi pilihan ke data satu dosen. */
  dosenId?: number;
  /** Hanya untuk kegiatan: membatasi pilihan ke penelitian atau pengabdian. */
  jenis?: JenisKegiatan;
}

const UNTUK: readonly UntukEndpoint[] = ["publikasi", "kegiatan", "iprs", "buku"];

/** Parameter endpoint pilihan filter (dropdown): `untuk` wajib, `dosen_id` dan `jenis` opsional. */
export function parseOpsiFilters(params: URLSearchParams): Hasil<OpsiFilters> {
  const raw = (params.get("untuk") ?? "").trim().toLowerCase();
  const untuk = UNTUK.find((u) => u === raw);
  if (!untuk) return { ok: false, message: `Parameter untuk wajib diisi: ${UNTUK.join(", ")}.` };

  const dosenId = bilanganBulat(params.get("dosen_id"), "dosen_id", 1, MAX_INT4);
  if (!dosenId.ok) return dosenId;

  let jenis: JenisKegiatan | undefined;
  const rawJenis = (params.get("jenis") ?? "").trim().toLowerCase();
  if (untuk === "kegiatan" && rawJenis) {
    jenis = JENIS_KEGIATAN.find((j) => j === rawJenis);
    if (!jenis) return { ok: false, message: "Parameter jenis harus penelitian atau pengabdian." };
  }

  return { ok: true, value: { untuk, dosenId: dosenId.value, jenis } };
}

export function parseDaftarDosenFilters(params: URLSearchParams): Hasil<DaftarDosenFilters> {
  const q = bacaQ(params);
  if (!q.ok) return q;
  return { ok: true, value: { q: q.value, ...bacaHalaman(params, DEFAULT_PAGE_SIZE_DOSEN, MAX_PAGE_SIZE_DOSEN) } };
}

/** Id di path: bilangan bulat positif. Selain itu null. */
export function parseIdParam(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id >= 1 && id <= MAX_INT4 ? id : null;
}

export function buatPagination(halaman: Halaman, total: number) {
  return {
    page: halaman.page,
    pageSize: halaman.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / halaman.pageSize)),
  };
}

export function offsetDari(halaman: Halaman): { skip: number; take: number } {
  return { skip: (halaman.page - 1) * halaman.pageSize, take: halaman.pageSize };
}

/**
 * `bisa_diubah` (PRD 5.9): pengguna login dengan peran yang boleh mengubah data milik sendiri, dan item
 * tertaut ke baris dosen miliknya lewat tabel penghubung. Sumber data (sinta atau manual) tidak berpengaruh.
 */
export function bisaDiubah(session: LocalSessionPayload | null, dosenTertaut: number[]): boolean {
  return getTridharmaPermissions(session, dosenTertaut).canUpdate;
}

/** Daftar dosen unik (id dan nama) dari baris tabel penghubung, urut id. */
export function dosenUnik(baris: { dosen: { id: number; nama: string | null } | null }[]) {
  const peta = new Map<number, { id: number; nama: string | null }>();
  for (const b of baris) if (b.dosen && !peta.has(b.dosen.id)) peta.set(b.dosen.id, { id: b.dosen.id, nama: b.dosen.nama });
  return [...peta.values()].sort((a, b) => a.id - b.id);
}

// Respons berisi `bisa_diubah` yang bergantung pada sesi, jadi tidak boleh disimpan cache bersama.
const NO_STORE = { "Cache-Control": "no-store" };

export async function jawabDaftar<F extends Halaman, T>(
  parsed: Hasil<F>,
  ambil: (filters: F, session: LocalSessionPayload | null) => Promise<{ items: T[]; total: number }>,
  nama: string,
): Promise<NextResponse> {
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 });

  try {
    const session = await getSession();
    const { items, total } = await ambil(parsed.value, session);
    return NextResponse.json({ items, pagination: buatPagination(parsed.value, total) }, { headers: NO_STORE });
  } catch (error) {
    console.error(`GET ${nama}:`, error);
    return NextResponse.json({ message: `Gagal mengambil data ${nama}.` }, { status: 500 });
  }
}

export async function jawabDetail<T>(
  rawId: string,
  ambil: (id: number, session: LocalSessionPayload | null) => Promise<T | null>,
  nama: string,
): Promise<NextResponse> {
  const id = parseIdParam(rawId);
  if (id === null) return NextResponse.json({ message: "ID tidak valid." }, { status: 400 });

  try {
    const session = await getSession();
    const data = await ambil(id, session);
    if (!data) return NextResponse.json({ message: `Data ${nama} tidak ditemukan.` }, { status: 404 });
    return NextResponse.json({ data }, { headers: NO_STORE });
  } catch (error) {
    console.error(`GET ${nama} (detail):`, error);
    return NextResponse.json({ message: `Gagal mengambil data ${nama}.` }, { status: 500 });
  }
}

export type KonteksRute = { params: Promise<{ id: string }> };
