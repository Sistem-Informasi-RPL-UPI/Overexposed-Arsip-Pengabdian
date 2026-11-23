import { createHash } from "node:crypto";

/**
 * Kunci anti-dobel dan normalisasi nama (PRD 5.3, 5.7).
 * Port dari `norm`, `kunci`, `nz`, dan `norm_nama` di crawler/app/loader.py. Hasilnya harus identik dengan
 * Python untuk masukan yang sama, jadi perubahan di salah satu sisi wajib diikuti sisi lain dan
 * crawler/tests/fixtures/kunci.json (dipakai tes Vitest dan unittest).
 */

type Nilai = string | number | null | undefined;

// Himpunan spasi menurut str.isspace() Python. \s di JS berbeda: memuat ﻿, tidak memuat \x1C-\x1F dan \x85.
const SPASI = "\\t\\n\\v\\f\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const RE_SPASI = new RegExp(`[${SPASI}]+`, "gu");
const RE_TEPI_SPASI = new RegExp(`^[${SPASI}]+|[${SPASI}]+$`, "gu");

/** Python: re.sub(r"[\W_]+", "", str(teks).lower()). \w Python = huruf (L*) dan angka (N*). */
export function normTeks(teks: Nilai): string {
  return String(teks ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

function md5Bagian(...bagian: Nilai[]): string {
  return createHash("md5").update(bagian.map(normTeks).join("|"), "utf8").digest("hex");
}

/** Python `nz`: teks dirapikan tepinya, kosong menjadi null, dipotong per code point seperti slicing str. */
function nz(v: Nilai, panjang?: number): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).replace(RE_TEPI_SPASI, "");
  if (!t) return null;
  return panjang ? Array.from(t).slice(0, panjang).join("") : t;
}

/** Sama dengan publikasi.judul_hash lama. */
export function kunciPublikasi(judul: Nilai): string {
  return md5Bagian(nz(judul));
}

export function kunciKegiatan(jenis: Nilai, judul: Nilai, tahun: Nilai): string {
  return md5Bagian(jenis, nz(judul), tahun);
}

/** Nomor permohonan (dipotong 100 karakter seperti kolomnya), atau judul dan tahun bila kosong. */
export function kunciIprs(nomorPermohonan: Nilai, judul: Nilai, tahun: Nilai): string {
  const nomor = nz(nomorPermohonan, 100);
  return nomor ? md5Bagian(nomor) : md5Bagian(nz(judul), tahun);
}

/** ISBN (dipotong 50 karakter seperti kolomnya), atau judul dan tahun bila kosong. */
export function kunciBuku(isbn: Nilai, judul: Nilai, tahun: Nilai): string {
  const nomor = nz(isbn, 50);
  return nomor ? md5Bagian(nomor) : md5Bagian(nz(judul), tahun);
}

const GELAR_DEPAN = new Set(["prof", "dr", "drs", "dra", "ir", "h", "hj"]);

// Gelar belakang bertitik (s.kom. / m.t. / ph.d). Tiap segmen maksimal 4 huruf supaya "m.iqbal" tidak terbuang.
const GELAR_BELAKANG = /^[a-z]{1,4}(?:\.[a-z]{1,4})+\.?$/;

/**
 * Python `norm_nama`: tanpa aksen, huruf kecil, hanya gelar akademik yang dibuang, tanda baca menjadi spasi.
 * 'Dr. Mochamad Iqbal Ardimansyah, S.Kom., M.T.' -> 'mochamad iqbal ardimansyah'
 * Aksen dibuang lewat \p{Mn}, padanan unicodedata.combining() untuk huruf Latin.
 */
export function normNama(nama: string | null | undefined): string {
  const t = (nama ?? "").normalize("NFKD").replace(/\p{Mn}/gu, "").toLowerCase();
  let kata = t.replaceAll(",", " ").split(RE_SPASI).filter(Boolean);
  while (kata.length && GELAR_DEPAN.has(kata[0].replace(/^\.+|\.+$/g, ""))) kata.shift();
  // Kata pertama tidak diperiksa: "M.Ali Rahman" adalah nama, bukan gelar.
  kata = kata.slice(0, 1).concat(kata.slice(1).filter((k) => !GELAR_BELAKANG.test(k)));
  return kata
    .join(" ")
    .replace(new RegExp(`[^a-z0-9${SPASI}]`, "gu"), " ")
    .replace(RE_SPASI, " ")
    .replace(RE_TEPI_SPASI, "");
}
