import { db } from "@/lib/db";
import type { JenisKegiatan } from "@/generated/prisma/enums";

// Tabel `kegiatan` dipakai bersama oleh Penelitian dan Pengabdian.
// Bedanya hanya kolom `jenis` ("penelitian" / "pengabdian"), jadi semua fungsi di sini
// menerima parameter jenis dan bisa dipakai ulang untuk halaman Pengabdian.

export const PAGE_SIZE = 5;

export type KegiatanFilters = {
  jenis: JenisKegiatan;
  q?: string;
  tahun?: number;
  skema?: string;
  dosenId?: number; // kosong = semua dosen
  page: number;
};

function buildWhere(f: Omit<KegiatanFilters, "page">) {
  return {
    jenis: f.jenis,
    ...(f.dosenId ? { anggota: { some: { dosen_id: f.dosenId } } } : {}),
    ...(f.tahun ? { tahun: f.tahun } : {}),
    ...(f.skema ? { skema: f.skema } : {}),
    ...(f.q ? { judul: { contains: f.q, mode: "insensitive" as const } } : {}),
  };
}

export async function getKegiatanList(f: KegiatanFilters) {
  const where = buildWhere(f);
  // Cakupan tanpa filter (untuk grafik, total, dan isi dropdown)
  const scope = buildWhere({ jenis: f.jenis, dosenId: f.dosenId });

  const [total, items, perTahun, skemaList, dosen] = await Promise.all([
    db.kegiatan.count({ where }),
    db.kegiatan.findMany({
      where,
      orderBy: [{ tahun: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        judul: true,
        tahun: true,
        skema: true,
        dana_nominal: true,
        anggota: { select: { nama: true, peran: true, dosen_id: true, dosen: { select: { sinta_id: true } } } },
      },
    }),
    db.kegiatan.groupBy({
      by: ["tahun"],
      where: { ...scope, tahun: { not: null } },
      _count: { _all: true },
      orderBy: { tahun: "asc" },
    }),
    db.kegiatan.findMany({ where: scope, distinct: ["skema"], select: { skema: true } }),
    f.dosenId
      ? db.dosen.findUnique({ where: { id: f.dosenId }, select: { nama: true, last_synced_at: true } })
      : null,
  ]);

  const grafik = perTahun.map((t) => ({ tahun: t.tahun as number, jumlah: t._count._all }));
  const totalScope = grafik.reduce((n, g) => n + g.jumlah, 0);

  return {
    total,
    totalScope,
    grafik,
    rows: items.map((k) => ({
      id: k.id,
      judul: k.judul,
      tahun: k.tahun,
      skema: k.skema,
      dana: Number(k.dana_nominal),
      ketua: k.anggota.find((a) => a.peran === "ketua")?.nama ?? null,
      // ID SINTA dosen untuk tombol "lihat di SINTA": dosen yang sedang dilihat dulu, lalu ketua, lalu anggota lain.
      // Data penelitian di database tidak menyimpan link per judul, jadi tujuannya profil SINTA dosen.
      sintaId:
        (f.dosenId ? k.anggota.find((a) => a.dosen_id === f.dosenId)?.dosen?.sinta_id : null) ??
        k.anggota.find((a) => a.peran === "ketua")?.dosen?.sinta_id ??
        k.anggota.find((a) => a.dosen?.sinta_id)?.dosen?.sinta_id ??
        null,
      // id dosen yang terlibat → dipakai untuk cek hak edit/hapus (RBAC)
      dosenIds: k.anggota.map((a) => a.dosen_id).filter((x): x is number => x !== null),
    })),
    opsi: {
      tahun: grafik.map((g) => g.tahun).reverse(),
      skema: [...new Set(skemaList.map((s) => s.skema).filter((x): x is string => !!x))].sort(),
    },
    dosen,
  };
}

// Satu kegiatan lengkap dengan timnya (untuk halaman formulir)
export async function getKegiatanDetail(id: number, jenis: JenisKegiatan) {
  const k = await db.kegiatan.findFirst({
    where: { id, jenis },
    select: {
      id: true,
      judul: true,
      tahun: true,
      skema: true,
      sumber_dana: true,
      dana_nominal: true,
      anggota: { select: { nama: true, peran: true, dosen_id: true } },
    },
  });
  if (!k) return null;

  const ketua = k.anggota.find((a) => a.peran === "ketua") ?? null;
  return {
    id: k.id,
    judul: k.judul,
    tahun: k.tahun,
    skema: k.skema,
    sumberDana: k.sumber_dana,
    dana: Number(k.dana_nominal),
    ketua: ketua ? { nama: ketua.nama } : null,
    anggota: k.anggota
      .filter((a) => a.peran !== "ketua")
      .map((a) => ({ tipe: a.dosen_id !== null ? ("Dosen" as const) : ("Mahasiswa" as const), nama: a.nama })),
    dosenIds: k.anggota.map((a) => a.dosen_id).filter((x): x is number => x !== null),
  };
}

// Daftar skema yang sudah ada (saran isian di formulir)
export async function getOpsiSkema(jenis: JenisKegiatan) {
  const rows = await db.kegiatan.findMany({ where: { jenis }, distinct: ["skema"], select: { skema: true } });
  return [...new Set(rows.map((r) => r.skema).filter((x): x is string => !!x))].sort();
}

export const rupiah = (n: number) => (n > 0 ? `Rp ${n.toLocaleString("id-ID")}` : "-");
