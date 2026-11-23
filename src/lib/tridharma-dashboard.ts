import { db } from "@/lib/db";

export type Aktivitas = {
  judul: string;
  detail: string | null;
  kategori: "Penelitian" | "Pengabdian" | "Buku";
  tahun: number | null;
};

/**
 * Data dashboard Tridharma.
 * - dosenId diisi  → hanya data milik dosen itu (tampilan Dosen / Kaprodi)
 * - dosenId kosong → gabungan SEMUA dosen (tampilan Mahasiswa / Staff / Umum)
 */
export async function getTridharmaDashboard(dosenId?: number) {
  const personal = dosenId !== undefined;

  const kegiatanWhere = personal
    ? { anggota: { some: { dosen_id: dosenId } } }
    : { anggota: { some: { dosen_id: { not: null } } } };
  const publikasiWhere = personal ? { publikasi_dosen: { some: { dosen_id: dosenId } } } : {};
  const iprsWhere = personal ? { iprs_dosen: { some: { dosen_id: dosenId } } } : {};
  const bukuWhere = personal ? { buku_dosen: { some: { dosen_id: dosenId } } } : {};

  const [penelitian, pengabdian, iprs, publikasi, publikasiQ12, buku, kegiatan, bukuTerbaru] =
    await Promise.all([
      db.kegiatan.count({ where: { ...kegiatanWhere, jenis: "penelitian" as const } }),
      db.kegiatan.count({ where: { ...kegiatanWhere, jenis: "pengabdian" as const } }),
      db.iprs.count({ where: iprsWhere }),
      db.publikasi.count({ where: publikasiWhere }),
      db.publikasi.count({ where: { ...publikasiWhere, kuartil: { in: ["Q1", "Q2"] } } }),
      db.buku.count({ where: bukuWhere }),
      db.kegiatan.findMany({
        where: kegiatanWhere,
        orderBy: [{ tahun: "desc" }, { id: "desc" }],
        take: 5,
        select: {
          judul: true,
          jenis: true,
          skema: true,
          tahun: true,
          anggota: { where: { dosen_id: { not: null } }, take: 2, select: { nama: true } },
        },
      }),
      db.buku.findMany({
        where: bukuWhere,
        orderBy: [{ tahun: "desc" }, { id: "desc" }],
        take: 5,
        select: {
          judul: true,
          isbn: true,
          tahun: true,
          buku_dosen: { take: 2, select: { dosen: { select: { nama: true } } } },
        },
      }),
    ]);

  // Mode "semua dosen": tampilkan nama dosennya. Mode pribadi: skema / ISBN.
  const aktivitas: Aktivitas[] = [
    ...kegiatan.map((k) => ({
      judul: k.judul,
      detail: personal
        ? k.skema
          ? `Skema: ${k.skema}`
          : null
        : `Dosen: ${k.anggota.map((a) => a.nama).join(", ") || "-"}`,
      kategori: (k.jenis === "penelitian" ? "Penelitian" : "Pengabdian") as Aktivitas["kategori"],
      tahun: k.tahun,
    })),
    ...bukuTerbaru.map((b) => ({
      judul: b.judul,
      detail: personal
        ? b.isbn
          ? `ISBN: ${b.isbn}`
          : null
        : `Dosen: ${b.buku_dosen.map((d) => d.dosen.nama).filter(Boolean).join(", ") || "-"}`,
      kategori: "Buku" as const,
      tahun: b.tahun,
    })),
  ]
    .sort((a, b) => (b.tahun ?? 0) - (a.tahun ?? 0))
    .slice(0, 5);

  return { penelitian, pengabdian, iprs, publikasi, publikasiQ12, buku, aktivitas };
}

// Daftar semua dosen (untuk bagian "Daftar Dosen" yang bisa diklik)
export async function getDaftarDosen() {
  return db.dosen.findMany({
    where: { nama: { not: null } },
    orderBy: { nama: "asc" },
    select: { id: true, nama: true, departemen: true },
  });
}

export async function getDosenProfil(dosenId: number) {
  return db.dosen.findUnique({ where: { id: dosenId }, select: { nama: true, departemen: true } });
}

// Semester berjalan, dihitung dari tanggal hari ini
export function semesterSekarang(now = new Date()) {
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();
  if (bulan >= 8) return `Semester Ganjil ${tahun}/${tahun + 1}`;
  if (bulan === 1) return `Semester Ganjil ${tahun - 1}/${tahun}`;
  return `Semester Genap ${tahun - 1}/${tahun}`;
}
