import { createHash } from "node:crypto";

// Pembantu untuk data yang diinput MANUAL (bukan hasil tarik SINTA).

const GELAR_DEPAN = new Set(["prof", "dr", "drs", "dra", "ir", "h", "hj", "ing", "dipl"]);

/** Nama untuk dicocokkan: huruf kecil, tanpa aksen/tanda baca, tanpa gelar depan dan gelar belakang (setelah koma). */
export function normalNama(nama: string): string {
  const tanpaGelarBelakang = nama.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().split(",")[0];
  return tanpaGelarBelakang
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !GELAR_DEPAN.has(t))
    .join(" ");
}

/** Judul untuk dibandingkan: huruf kecil, hanya huruf dan angka. */
export function normalJudul(judul: string): string {
  return judul.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function md5(teks: string): string {
  return createHash("md5").update(teks).digest("hex"); // 32 karakter, cocok untuk kolom CHAR(32)
}

type DosenRingkas = { id: number; nama: string | null; nama_normal: string | null };

/**
 * Mengubah daftar nama penulis (urutan dipertahankan) menjadi daftar yang sudah dicocokkan
 * dengan tabel dosen. Pengaju SELALU ada di daftar: kalau namanya tidak diketik, dia ditaruh di depan.
 */
export function susunPenulis(namaDiketik: string[], semuaDosen: DosenRingkas[], pengaju: DosenRingkas, namaSesi: string) {
  const kunciDosen = new Map<string, DosenRingkas>();
  for (const d of semuaDosen) {
    const k = normalNama(d.nama ?? d.nama_normal ?? "");
    if (k) kunciDosen.set(k, d);
  }
  const kunciPengaju = normalNama(pengaju.nama ?? pengaju.nama_normal ?? namaSesi);
  if (kunciPengaju) kunciDosen.set(kunciPengaju, pengaju); // pengaju pasti terhubung ke akunnya

  const hasil: { nama: string; kunci: string; dosen: DosenRingkas | null }[] = [];
  const terpakai = new Set<string>();
  const tambah = (nama: string) => {
    const kunci = normalNama(nama);
    if (!kunci || terpakai.has(kunci)) return;
    terpakai.add(kunci);
    hasil.push({ nama, kunci, dosen: kunciDosen.get(kunci) ?? null });
  };

  for (const n of namaDiketik.slice(0, 30)) tambah(n.slice(0, 150));
  if (!hasil.some((h) => h.dosen?.id === pengaju.id)) {
    const namaPengaju = pengaju.nama ?? namaSesi;
    const kunci = normalNama(namaPengaju);
    // jangan duplikat kalau ada nama yang sama persis tapi gagal tercocokkan
    const sudah = hasil.find((h) => h.kunci === kunci);
    if (sudah) sudah.dosen = pengaju;
    else {
      terpakai.add(kunci);
      hasil.unshift({ nama: namaPengaju, kunci, dosen: pengaju });
    }
  }
  return hasil;
}