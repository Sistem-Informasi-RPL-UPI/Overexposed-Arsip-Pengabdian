// Aman diimpor dari komponen client (tidak menyentuh database).
import type { JenisKegiatan } from "@/generated/prisma/enums";

export const JUDUL_MAKS = 500;
export const SKEMA_MAKS = 255; // sama dengan kegiatan.skema (VarChar 255)
export const SUMBER_DANA_MAKS = 100; // sama dengan kegiatan.sumber_dana (VarChar 100)
export const NAMA_PENULIS_MAKS = 150;
export const PENULIS_MAKS = 20;
export const TAHUN_MIN = 2000;
export const DANA_MAKS = 9_999_999_999_999; // 13 digit, jauh di bawah batas Decimal(18,2)
export const STATUS_DIAJUKAN = "Menunggu Verifikasi"; // kegiatan.status maksimal 30 karakter

export interface PenulisParsed {
  nama: string;
  normal: string;
}

/**
 * Bentuk pembanding nama: huruf kecil, tanpa aksen, tanda baca menjadi spasi.
 * Dipakai untuk kolom kegiatan_anggota.nama_normal dan untuk mencocokkan nama ke tabel dosen.
 * Kalau proses sinkronisasi SINTA sudah punya fungsi normalisasi sendiri, ganti isi fungsi ini
 * supaya hasilnya sama persis.
 */
export function normalisasiNama(nama: string): string {
  return nama
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Memecah "Penulis A; Penulis B; Penulis C" menjadi daftar berurutan.
 * Urutan input = urutan penulis. Segmen kosong dibuang, nama ganda dilaporkan di `duplikat`.
 */
export function parsePenulis(raw: string): { penulis: PenulisParsed[]; duplikat: string[] } {
  const terlihat = new Set<string>();
  const penulis: PenulisParsed[] = [];
  const duplikat: string[] = [];

  for (const potongan of raw.split(";")) {
    const nama = potongan.replace(/\s+/g, " ").trim();
    if (!nama) continue;

    const normal = normalisasiNama(nama);
    if (!normal) continue;

    if (terlihat.has(normal)) {
      if (!duplikat.includes(nama)) duplikat.push(nama);
      continue;
    }

    terlihat.add(normal);
    penulis.push({ nama, normal });
  }

  return { penulis, duplikat };
}

/** Ambil angka saja dari input dana, maksimal 13 digit. */
export function digitDana(raw: string): string {
  return raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 13);
}

/** "45000000" -> "Rp 45.000.000". String kosong tetap kosong. */
export function tampilDana(digit: string): string {
  return digit ? `Rp ${new Intl.NumberFormat("id-ID").format(Number(digit))}` : "";
}

export interface KegiatanPayload {
  jenis: JenisKegiatan;
  judul: string;
  tahun: number;
  /** Hanya penelitian. Null untuk pengabdian. */
  skema: string | null;
  sumberDana: string;
  dana: number;
  penulis: PenulisParsed[];
}

type Hasil<T> = { ok: true; value: T } | { ok: false; message: string };

function teks(raw: unknown, label: string, maks: number): Hasil<string> {
  const nilai = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!nilai) return { ok: false, message: `${label} harus diisi.` };
  if (nilai.length > maks) return { ok: false, message: `${label} maksimal ${maks} karakter.` };
  return { ok: true, value: nilai };
}

function bilanganBulat(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isInteger(raw) ? raw : null;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  return null;
}

export function parseKegiatanPayload(
  rawBody: unknown,
  sekarang: Date = new Date(),
): { ok: true; data: KegiatanPayload } | { ok: false; message: string } {
  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }
  const body = rawBody as Record<string, unknown>;

  if (body.jenis !== "penelitian" && body.jenis !== "pengabdian") {
    return { ok: false, message: 'Field "jenis" wajib diisi: "penelitian" atau "pengabdian".' };
  }

  const judul = teks(body.judul, "Judul", JUDUL_MAKS);
  if (!judul.ok) return judul;

  const tahun = bilanganBulat(body.tahun);
  const tahunMaks = sekarang.getFullYear() + 1;
  if (tahun === null || tahun < TAHUN_MIN || tahun > tahunMaks) {
    return { ok: false, message: `Tahun harus berupa angka antara ${TAHUN_MIN} dan ${tahunMaks}.` };
  }

  // Skema hanya untuk penelitian.
  let skema: string | null = null;
  if (body.jenis === "penelitian") {
    const hasil = teks(body.skema, "Skema", SKEMA_MAKS);
    if (!hasil.ok) return hasil;
    skema = hasil.value;
  }

  const sumberDana = teks(body.sumberDana, "Sumber pendanaan", SUMBER_DANA_MAKS);
  if (!sumberDana.ok) return sumberDana;

  const dana = bilanganBulat(body.dana);
  if (dana === null || dana < 0 || dana > DANA_MAKS) {
    return { ok: false, message: "Nilai dana harus berupa angka rupiah yang valid." };
  }

  if (typeof body.penulis !== "string") {
    return { ok: false, message: "Penulis harus diisi." };
  }
  const { penulis, duplikat } = parsePenulis(body.penulis);
  if (penulis.length === 0) {
    return { ok: false, message: "Isi minimal satu nama penulis." };
  }
  if (penulis.length > PENULIS_MAKS) {
    return { ok: false, message: `Penulis maksimal ${PENULIS_MAKS} orang.` };
  }
  if (duplikat.length > 0) {
    return { ok: false, message: `Nama penulis ganda: ${duplikat.join(", ")}. Tulis setiap nama satu kali.` };
  }
  const terlaluPanjang = penulis.find((p) => p.nama.length > NAMA_PENULIS_MAKS);
  if (terlaluPanjang) {
    return { ok: false, message: `Nama penulis maksimal ${NAMA_PENULIS_MAKS} karakter: "${terlaluPanjang.nama.slice(0, 30)}...".` };
  }

  return {
    ok: true,
    data: {
      jenis: body.jenis,
      judul: judul.value,
      tahun,
      skema,
      sumberDana: sumberDana.value,
      dana,
      penulis,
    },
  };
}
