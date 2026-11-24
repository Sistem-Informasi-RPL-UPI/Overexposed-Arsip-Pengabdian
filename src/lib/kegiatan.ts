import type { JenisKegiatan, PeranKegiatan } from "@/generated/prisma/client";
import { kunciKegiatan, normNama } from "@/lib/kunci";

/**
 * Validasi tulis kegiatan manual (penelitian dan pengabdian, PRD 5.7). Fungsi di sini murni: tidak menyentuh database.
 * Peserta datang dalam satu kolom `tim` (nama dipisah `;`), lalu dipecah menjadi baris `kegiatan_anggota`.
 */

export const KEGIATAN_TAHUN_MIN = 1000;
export const KEGIATAN_TAHUN_MAX = 9999;
export const KEGIATAN_JUDUL_MIN = 3;
export const KEGIATAN_JUDUL_MAKS = 1000;
export const KEGIATAN_SKEMA_MAKS = 255;
export const KEGIATAN_SUMBER_DANA_MAKS = 100;
export const KEGIATAN_DANA_MAKS = 999_999_999_999_999;
export const TIM_JUMLAH_MAKS = 50;
export const TIM_NAMA_MAKS = 200;

export const PESAN_KEGIATAN_DUPLIKAT = "Kegiatan ini sudah ada di data.";
export const PESAN_KEGIATAN_DITAUTKAN = "Kegiatan ini sudah ada dan sudah dihubungkan ke akunmu.";
export const PESAN_NAMA_HARUS_ADA = "Nama kamu harus ada di daftar tim.";
export const PESAN_SINKRON_DULU =
  "Sinkron data SINTA dulu sebelum mengelola kegiatan, supaya nama kamu sama dengan nama di SINTA.";
export const PESAN_TANPA_STATUS = "Kegiatan tidak memiliki field status.";

const JENIS: readonly JenisKegiatan[] = ["penelitian", "pengabdian"];
const RE_HURUF = /\p{L}/gu;
const RE_ANGKA_DESIMAL = /^\d+(\.\d{1,2})?$/;

export interface KegiatanWriteData {
  jenis: JenisKegiatan;
  judul: string;
  tahun: number;
  skema: string | null;
  dana_nominal: number;
  sumber_dana: string | null;
}

export interface AnggotaTim {
  /** Nama apa adanya (dirapikan tepinya). */
  nama: string;
  nama_normal: string;
  peran: PeranKegiatan;
}

type Hasil<T> = { ok: true; value: T } | { ok: false; message: string };

function hitungHuruf(teks: string): number {
  return teks.match(RE_HURUF)?.length ?? 0;
}

function parseJenis(raw: unknown): Hasil<JenisKegiatan> {
  const teks = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const cocok = JENIS.find((j) => j === teks);
  if (!cocok) return { ok: false, message: "Jenis kegiatan harus penelitian atau pengabdian." };
  return { ok: true, value: cocok };
}

function parseJudul(raw: unknown): Hasil<string> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { ok: false, message: "Judul kegiatan harus diisi." };
  const panjang = Array.from(value).length;
  if (panjang < KEGIATAN_JUDUL_MIN || hitungHuruf(value) < 2) {
    return { ok: false, message: "Judul kegiatan minimal 3 karakter dan mengandung minimal 2 huruf." };
  }
  if (panjang > KEGIATAN_JUDUL_MAKS) {
    return { ok: false, message: `Judul kegiatan maksimal ${KEGIATAN_JUDUL_MAKS} karakter.` };
  }
  return { ok: true, value };
}

function parseTahun(raw: unknown): Hasil<number> {
  let value: number;
  if (typeof raw === "number") {
    if (!Number.isInteger(raw)) return { ok: false, message: "Tahun harus berupa bilangan bulat 4 digit." };
    value = raw;
  } else if (typeof raw === "string") {
    const teks = raw.trim();
    if (!teks) return { ok: false, message: "Tahun harus diisi." };
    if (!/^\d+$/.test(teks)) return { ok: false, message: "Tahun harus berupa bilangan bulat 4 digit." };
    value = Number.parseInt(teks, 10);
  } else {
    return { ok: false, message: "Tahun harus diisi." };
  }

  if (value < KEGIATAN_TAHUN_MIN || value > KEGIATAN_TAHUN_MAX) {
    return { ok: false, message: `Tahun harus antara ${KEGIATAN_TAHUN_MIN} dan ${KEGIATAN_TAHUN_MAX}.` };
  }
  return { ok: true, value };
}

function parseTeksOpsional(raw: unknown, label: string, maks: number): Hasil<string | null> {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, message: `${label} harus berupa teks.` };
  const teks = raw.trim();
  if (!teks) return { ok: true, value: null };
  if (Array.from(teks).length > maks) return { ok: false, message: `${label} maksimal ${maks} karakter.` };
  return { ok: true, value: teks };
}

/** Dana: angka atau teks angka (maksimal 2 desimal), 0 sampai batas kolom. Kosong berarti 0, sama dengan crawler. */
function parseDana(raw: unknown): Hasil<number> {
  if (raw === undefined || raw === null) return { ok: true, value: 0 };

  let value: number;
  if (typeof raw === "number") {
    value = raw;
  } else if (typeof raw === "string") {
    const teks = raw.trim();
    if (!teks) return { ok: true, value: 0 };
    if (!RE_ANGKA_DESIMAL.test(teks)) {
      return { ok: false, message: "Dana harus berupa angka (tanpa titik pemisah ribuan, maksimal 2 desimal)." };
    }
    value = Number(teks);
  } else {
    return { ok: false, message: "Dana harus berupa angka." };
  }

  if (!Number.isFinite(value) || value < 0 || value > KEGIATAN_DANA_MAKS) {
    return { ok: false, message: "Dana harus berupa angka 0 atau lebih." };
  }
  return { ok: true, value: Math.round(value * 100) / 100 };
}

/**
 * `tim`: nama dipisah `;`. Nama pertama menjadi ketua, nama berikutnya anggota. Nama yang sama (setelah normalisasi)
 * digabung menjadi satu baris dengan posisi paling awal, jadi nama pertama tetap pertama.
 */
export function parseTim(raw: unknown): Hasil<AnggotaTim[]> {
  if (typeof raw !== "string") {
    return { ok: false, message: "Tim harus diisi: nama dipisah titik koma (;), nama pertama menjadi ketua." };
  }

  const segmen = raw.split(";").map((s) => s.trim()).filter(Boolean);
  if (segmen.length === 0) {
    return { ok: false, message: "Tim harus diisi: nama dipisah titik koma (;), nama pertama menjadi ketua." };
  }
  if (segmen.length > TIM_JUMLAH_MAKS) {
    return { ok: false, message: `Tim maksimal ${TIM_JUMLAH_MAKS} orang.` };
  }

  const peta = new Map<string, string>();
  for (const nama of segmen) {
    if (Array.from(nama).length > TIM_NAMA_MAKS) {
      return { ok: false, message: `Setiap nama di tim maksimal ${TIM_NAMA_MAKS} karakter.` };
    }
    const namaNormal = normNama(nama);
    if (!namaNormal || hitungHuruf(nama) < 2) {
      return { ok: false, message: "Setiap nama di tim harus valid (minimal 2 huruf)." };
    }
    if (!peta.has(namaNormal)) peta.set(namaNormal, nama);
  }

  const anggota: AnggotaTim[] = [...peta].map(([nama_normal, nama], i) => ({
    nama,
    nama_normal,
    peran: i === 0 ? "ketua" : "anggota",
  }));
  return { ok: true, value: anggota };
}

function bacaKunci(body: Record<string, unknown>, ...kunci: string[]): unknown {
  for (const k of kunci) if (k in body) return body[k];
  return undefined;
}

export function parseCreateKegiatanPayload(
  rawBody: unknown,
): { ok: true; data: KegiatanWriteData; tim: AnggotaTim[]; kunci: string } | { ok: false; message: string } {
  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }
  const body = rawBody as Record<string, unknown>;
  if ("status" in body) return { ok: false, message: PESAN_TANPA_STATUS };

  const jenis = parseJenis(body.jenis);
  if (!jenis.ok) return jenis;
  const judul = parseJudul(body.judul);
  if (!judul.ok) return judul;
  const tahun = parseTahun(body.tahun);
  if (!tahun.ok) return tahun;
  const skema = parseTeksOpsional(body.skema, "Skema", KEGIATAN_SKEMA_MAKS);
  if (!skema.ok) return skema;
  const dana = parseDana(bacaKunci(body, "dana_nominal", "danaNominal"));
  if (!dana.ok) return dana;
  const sumberDana = parseTeksOpsional(bacaKunci(body, "sumber_dana", "sumberDana"), "Sumber dana", KEGIATAN_SUMBER_DANA_MAKS);
  if (!sumberDana.ok) return sumberDana;
  const tim = parseTim(body.tim);
  if (!tim.ok) return tim;

  const data: KegiatanWriteData = {
    jenis: jenis.value,
    judul: judul.value,
    tahun: tahun.value,
    skema: skema.value,
    dana_nominal: dana.value,
    sumber_dana: sumberDana.value,
  };
  return { ok: true, data, tim: tim.value, kunci: kunciKegiatan(data.jenis, data.judul, data.tahun) };
}

export function parsePatchKegiatanPayload(
  rawBody: unknown,
): { ok: true; data: Partial<KegiatanWriteData>; tim?: AnggotaTim[] } | { ok: false; message: string } {
  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }
  const body = rawBody as Record<string, unknown>;
  if ("status" in body) return { ok: false, message: PESAN_TANPA_STATUS };

  const data: Partial<KegiatanWriteData> = {};
  let tim: AnggotaTim[] | undefined;

  if ("jenis" in body) {
    const r = parseJenis(body.jenis);
    if (!r.ok) return r;
    data.jenis = r.value;
  }
  if ("judul" in body) {
    const r = parseJudul(body.judul);
    if (!r.ok) return r;
    data.judul = r.value;
  }
  if ("tahun" in body) {
    const r = parseTahun(body.tahun);
    if (!r.ok) return r;
    data.tahun = r.value;
  }
  if ("skema" in body) {
    const r = parseTeksOpsional(body.skema, "Skema", KEGIATAN_SKEMA_MAKS);
    if (!r.ok) return r;
    data.skema = r.value;
  }
  if ("dana_nominal" in body || "danaNominal" in body) {
    const r = parseDana(bacaKunci(body, "dana_nominal", "danaNominal"));
    if (!r.ok) return r;
    data.dana_nominal = r.value;
  }
  if ("sumber_dana" in body || "sumberDana" in body) {
    const r = parseTeksOpsional(bacaKunci(body, "sumber_dana", "sumberDana"), "Sumber dana", KEGIATAN_SUMBER_DANA_MAKS);
    if (!r.ok) return r;
    data.sumber_dana = r.value;
  }
  if ("tim" in body) {
    const r = parseTim(body.tim);
    if (!r.ok) return r;
    tim = r.value;
  }

  if (Object.keys(data).length === 0 && !tim) {
    return { ok: false, message: "Minimal satu field kegiatan harus diisi untuk diperbarui." };
  }
  return { ok: true, data, tim };
}

export function hitungKunciKegiatanSetelahUbah(
  existing: { jenis: JenisKegiatan; judul: string; tahun: number | null },
  patch: Partial<KegiatanWriteData>,
): string {
  return kunciKegiatan(patch.jenis ?? existing.jenis, patch.judul ?? existing.judul, patch.tahun ?? existing.tahun);
}

export interface BarisAnggota {
  nama: string;
  nama_normal: string;
  peran: PeranKegiatan;
  dosen_id: number | null;
}

export interface RencanaAnggota {
  /** `nama_normal` yang dihapus: ada di data lama, tidak ada di tim baru, dan bukan dosen terdaftar. */
  hapus: string[];
  buat: BarisAnggota[];
  /** Baris lama yang ada di tim baru dan berubah (nama, peran, atau dosen_id). */
  ubah: BarisAnggota[];
  /** Dosen lain yang dikeluarkan dari tim tetap tersimpan, tetapi bila ia ketua turun menjadi anggota. */
  turunkan: string[];
}

/**
 * Membandingkan anggota yang ada dengan `tim` baru (PRD 5.7). Baris dosen terdaftar (`dosen_id` terisi) tidak
 * pernah dihapus lewat PATCH, supaya tautan dosen lain tidak putus. Nama tanpa `dosen_id` yang tidak ada di tim baru dihapus.
 * `dosen_id` baris lama tidak diubah bila sudah terisi.
 */
export function rencanakanAnggota(args: {
  existing: BarisAnggota[];
  tim: AnggotaTim[];
  petaDosen: ReadonlyMap<string, number>;
  pengguna: { dosenId: number; namaNormal: string };
}): RencanaAnggota {
  const { existing, tim, petaDosen, pengguna } = args;
  const lama = new Map(existing.map((a) => [a.nama_normal, a]));
  const baru = new Set(tim.map((t) => t.nama_normal));
  const rencana: RencanaAnggota = { hapus: [], buat: [], ubah: [], turunkan: [] };

  for (const t of tim) {
    const ada = lama.get(t.nama_normal);
    const dosenId = ada?.dosen_id ?? (t.nama_normal === pengguna.namaNormal ? pengguna.dosenId : (petaDosen.get(t.nama_normal) ?? null));
    const hasil: BarisAnggota = { nama: t.nama, nama_normal: t.nama_normal, peran: t.peran, dosen_id: dosenId };

    if (!ada) rencana.buat.push(hasil);
    else if (ada.nama !== hasil.nama || ada.peran !== hasil.peran || ada.dosen_id !== hasil.dosen_id) rencana.ubah.push(hasil);
  }

  for (const a of existing) {
    if (baru.has(a.nama_normal)) continue;
    if (a.dosen_id === null) rencana.hapus.push(a.nama_normal);
    else if (a.peran === "ketua") rencana.turunkan.push(a.nama_normal);
  }
  return rencana;
}
