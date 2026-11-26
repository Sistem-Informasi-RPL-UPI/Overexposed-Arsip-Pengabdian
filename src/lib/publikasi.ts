import { db } from "@/lib/db";

export const PAGE_SIZE = 10;

export type PublikasiFilters = {
  q?: string;
  tahun?: number;
  jenis?: string;
  akreditasi?: string; // cocok ke kolom akreditasi ATAU kuartil
  dosenId?: number; // kosong = semua dosen
  page: number;
};

function buildWhere(f: Omit<PublikasiFilters, "page">) {
  return {
    ...(f.dosenId ? { publikasi_dosen: { some: { dosen_id: f.dosenId } } } : {}),
    ...(f.tahun ? { tahun: f.tahun } : {}),
    ...(f.jenis ? { jenis: f.jenis } : {}),
    ...(f.akreditasi ? { OR: [{ akreditasi: f.akreditasi }, { kuartil: f.akreditasi }] } : {}),
    ...(f.q ? { judul: { contains: f.q, mode: "insensitive" as const } } : {}),
  };
}

export async function getPublikasiList(f: PublikasiFilters) {
  const where = buildWhere(f);
  // Cakupan tanpa filter (untuk grafik, total, dan isi dropdown filter)
  const scope = buildWhere({ dosenId: f.dosenId });

  const [total, items, perTahun, jenisList, kuartilList, akreditasiList, dosen] = await Promise.all([
    db.publikasi.count({ where }),
    db.publikasi.findMany({
      where,
      orderBy: [{ tahun: "desc" }, { id: "desc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        judul: true,
        tahun: true,
        jurnal: true,
        jenis: true,
        kuartil: true,
        akreditasi: true,
        link: true,
        doi: true,
        publikasi_dosen: { select: { dosen: { select: { id: true, nama: true } } } },
      },
    }),
    db.publikasi.groupBy({
      by: ["tahun"],
      where: { ...scope, tahun: { not: null } },
      _count: { _all: true },
      orderBy: { tahun: "asc" },
    }),
    db.publikasi.findMany({ where: scope, distinct: ["jenis"], select: { jenis: true } }),
    db.publikasi.findMany({ where: scope, distinct: ["kuartil"], select: { kuartil: true } }),
    db.publikasi.findMany({ where: scope, distinct: ["akreditasi"], select: { akreditasi: true } }),
    f.dosenId
      ? db.dosen.findUnique({ where: { id: f.dosenId }, select: { nama: true, last_synced_at: true } })
      : null,
  ]);

  const grafik = perTahun.map((t) => ({ tahun: t.tahun as number, jumlah: t._count._all }));
  const totalScope = grafik.reduce((n, g) => n + g.jumlah, 0);

  const unik = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort();

  return {
    total,
    totalScope,
    grafik,
    rows: items.map((p) => {
      // Satu dosen bisa muncul beberapa kali (beda sumber), jadi dibuang duplikatnya
      const byId = new Map<number, string>();
      for (const pd of p.publikasi_dosen) if (pd.dosen.nama) byId.set(pd.dosen.id, pd.dosen.nama);
      return {
        id: p.id,
        dosenIds: [...byId.keys()], // dipakai untuk cek izin edit/hapus (pemilik)
        judul: p.judul,
        tahun: p.tahun,
        jurnal: p.jurnal,
        jenis: p.jenis,
        kuartil: p.kuartil,
        akreditasi: p.akreditasi,
        url: p.link ?? (p.doi ? `https://doi.org/${p.doi}` : null),
        dosen: [...byId.values()],
      };
    }),
    opsi: {
      tahun: grafik.map((g) => g.tahun).reverse(),
      jenis: unik(jenisList.map((j) => j.jenis)),
      akreditasi: unik([...kuartilList.map((k) => k.kuartil), ...akreditasiList.map((a) => a.akreditasi)]),
    },
    dosen,
  };
}

// Satu publikasi lengkap untuk halaman edit (beserta id dosen pemiliknya)
export async function getPublikasiUntukEdit(id: number) {
  const p = await db.publikasi.findUnique({
    where: { id },
    select: {
      id: true,
      judul: true,
      tahun: true,
      jurnal: true,
      jenis: true,
      kuartil: true,
      akreditasi: true,
      doi: true,
      publikasi_dosen: { select: { dosen_id: true } },
    },
  });
  if (!p) return null;
  return {
    id: p.id,
    judul: p.judul,
    tahun: p.tahun,
    jurnal: p.jurnal ?? "",
    jenis: p.jenis ?? "",
    akreditasi: p.kuartil ?? p.akreditasi ?? "",
    doi: p.doi ?? "",
    dosenIds: [...new Set(p.publikasi_dosen.map((x) => x.dosen_id))],
  };
}
