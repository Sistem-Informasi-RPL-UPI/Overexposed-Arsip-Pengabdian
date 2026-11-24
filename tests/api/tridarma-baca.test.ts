import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sesi } from "../helpers/fixtures";

const model = () => ({ findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() });

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  db: {} as Record<string, { findMany: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> }>,
}));
for (const nama of ["dosen", "publikasi", "kegiatan", "iprs", "buku"]) mocks.db[nama] = model();

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));

import { GET as bukuDaftar } from "@/app/api/tridarma/buku/route";
import { GET as bukuDetail } from "@/app/api/tridarma/buku/[id]/route";
import { GET as dosenDaftar } from "@/app/api/tridarma/dosen/route";
import { GET as dosenDetail } from "@/app/api/tridarma/dosen/[id]/route";
import { GET as iprsDaftar } from "@/app/api/tridarma/iprs/route";
import { GET as iprsDetail } from "@/app/api/tridarma/iprs/[id]/route";
import { GET as kegiatanDaftar } from "@/app/api/tridarma/kegiatan/route";
import { GET as kegiatanDetail } from "@/app/api/tridarma/kegiatan/[id]/route";
import { GET as publikasiDaftar } from "@/app/api/tridarma/publikasi/route";
import { GET as publikasiDetail } from "@/app/api/tridarma/publikasi/[id]/route";

const BASE = "http://localhost/api/tridarma";
const tanggal = new Date("2026-11-24T00:00:00.000Z");
const dosen = (id: number) => ({ id, nama: `Dosen ${id}` });
const sesiDosen = (peran: string, dosenId: number | null) => ({ ...sesi(peran), dosen_id: dosenId });

type Entitas = {
  nama: string;
  path: string;
  daftar: (r: NextRequest) => Promise<Response>;
  detail: (r: Request, c: { params: Promise<{ id: string }> }) => Promise<Response>;
  /** Kunci relasi di `where` untuk filter dosen_id. */
  relasi: string;
  baris: (o: { id: number; sumber?: "sinta" | "manual"; dosenIds: number[] }) => Record<string, unknown>;
  rahasia: string[];
};

const ENTITAS: Entitas[] = [
  {
    nama: "publikasi",
    path: "publikasi",
    daftar: publikasiDaftar,
    detail: publikasiDetail,
    relasi: "publikasi_dosen",
    rahasia: ["judul_hash"],
    baris: ({ id, sumber = "sinta", dosenIds }) => ({
      id, judul_hash: "h".repeat(32), judul: `Paper ${id}`, tahun: 2024, penulis: "A; B", jurnal: "J", sitasi: 3,
      link: null, kuartil: null, jenis: null, penerbit: null, doi: null, akreditasi: null, sumber,
      created_at: tanggal, updated_at: tanggal,
      publikasi_dosen: dosenIds.map((d) => ({
        dosen_id: d, source: sumber === "manual" ? "manual" : "sinta_scopus", urutan_penulis: 1, total_penulis: 2,
        sitasi_sumber: null, link_sumber: null, dosen: dosen(d),
      })),
    }),
  },
  {
    nama: "kegiatan",
    path: "kegiatan",
    daftar: kegiatanDaftar,
    detail: kegiatanDetail,
    relasi: "anggota",
    rahasia: ["kunci"],
    baris: ({ id, sumber = "sinta", dosenIds }) => ({
      id, kunci: "k".repeat(32), jenis: "penelitian", judul: `Kegiatan ${id}`, tahun: 2024, skema: "Internal",
      dana_nominal: "30000000.00", sumber_dana: "UPI", sumber, created_at: tanggal, updated_at: tanggal,
      anggota: dosenIds.map((d, i) => ({ nama: `Dosen ${d}`, peran: i === 0 ? "ketua" : "anggota", dosen_id: d })),
    }),
  },
  {
    nama: "iprs",
    path: "iprs",
    daftar: iprsDaftar,
    detail: iprsDetail,
    relasi: "iprs_dosen",
    rahasia: ["kunci"],
    baris: ({ id, sumber = "sinta", dosenIds }) => ({
      id, kunci: "k".repeat(32), judul: `HKI ${id}`, jenis: "Hak Cipta", tahun: 2023, nomor_permohonan: "EC1",
      status: sumber === "manual" ? "Diterima" : "Granted", pemegang: "A", inventor: "B", sumber,
      created_at: tanggal, updated_at: tanggal,
      iprs_dosen: dosenIds.map((d) => ({ dosen_id: d, dosen: dosen(d) })),
    }),
  },
  {
    nama: "buku",
    path: "buku",
    daftar: bukuDaftar,
    detail: bukuDetail,
    relasi: "buku_dosen",
    rahasia: ["kunci"],
    baris: ({ id, sumber = "sinta", dosenIds }) => ({
      id, kunci: "k".repeat(32), judul: `Buku ${id}`, kategori: null, penulis: "A", penerbit: "P", tahun: 2022,
      tempat_terbit: "Bandung", isbn: "978", sumber, created_at: tanggal, updated_at: tanggal,
      buku_dosen: dosenIds.map((d) => ({ dosen_id: d, dosen: dosen(d) })),
    }),
  },
];

const daftar = (e: Entitas, query = "") => e.daftar(new NextRequest(`${BASE}/${e.path}${query}`));
const detail = (e: Entitas, id: string) => e.detail(new Request(`${BASE}/${e.path}/${id}`), { params: Promise.resolve({ id }) });
// Panggilan terakhir, supaya tes yang memanggil endpoint berkali-kali membaca hasil yang tepat.
const ambilWhere = (e: Entitas) => mocks.db[e.nama].findMany.mock.lastCall?.[0].where;

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSession.mockResolvedValue(null);
  for (const e of ENTITAS) {
    mocks.db[e.nama].findMany.mockResolvedValue([e.baris({ id: 1, dosenIds: [3, 7] })]);
    mocks.db[e.nama].count.mockResolvedValue(1);
    mocks.db[e.nama].findUnique.mockResolvedValue(e.baris({ id: 1, dosenIds: [3, 7] }));
  }
});

describe.each(ENTITAS)("GET /api/tridarma/$path (daftar)", (e) => {
  it("Umum tanpa login bisa membaca, dan bisa_diubah salah", async () => {
    const res = await daftar(e);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].bisa_diubah).toBe(false);
    expect(body.pagination).toEqual({ page: 1, pageSize: 10, total: 1, totalPages: 1 });
  });

  it("setiap item memuat sumber, tanpa kolom kunci anti-dobel", async () => {
    const [item] = (await (await daftar(e)).json()).items;
    expect(item.sumber).toBe("sinta");
    for (const k of e.rahasia) expect(item).not.toHaveProperty(k);
    expect(item).not.toHaveProperty("user_id");
  });

  describe("bisa_diubah (apa pun sumbernya)", () => {
    it.each([["sinta"], ["manual"]] as const)("pemilik: benar untuk data %s", async (sumber) => {
      mocks.getSession.mockResolvedValue(sesiDosen("Dosen", 7));
      mocks.db[e.nama].findMany.mockResolvedValue([e.baris({ id: 1, sumber, dosenIds: [3, 7] })]);
      const [item] = (await (await daftar(e)).json()).items;
      expect(item.sumber).toBe(sumber);
      expect(item.bisa_diubah).toBe(true);
    });

    it("orang lain yang login: salah", async () => {
      mocks.getSession.mockResolvedValue(sesiDosen("Dosen", 9));
      expect((await (await daftar(e)).json()).items[0].bisa_diubah).toBe(false);
    });

    it("login tetapi belum punya baris dosen: salah", async () => {
      mocks.getSession.mockResolvedValue(sesiDosen("Dosen", null));
      expect((await (await daftar(e)).json()).items[0].bisa_diubah).toBe(false);
    });

    it.each([["Kaprodi"], ["Staff_Kaprodi"], ["Admin"]])("peran %s yang tertaut: benar", async (peran) => {
      mocks.getSession.mockResolvedValue(sesiDosen(peran, 3));
      expect((await (await daftar(e)).json()).items[0].bisa_diubah).toBe(true);
    });

    it("Mahasiswa: salah walau dosen_id kebetulan sama", async () => {
      mocks.getSession.mockResolvedValue(sesiDosen("Mahasiswa", 7));
      expect((await (await daftar(e)).json()).items[0].bisa_diubah).toBe(false);
    });

    it("per item: hanya yang tertaut ke pengguna", async () => {
      mocks.getSession.mockResolvedValue(sesiDosen("Dosen", 7));
      mocks.db[e.nama].findMany.mockResolvedValue([
        e.baris({ id: 1, dosenIds: [7] }),
        e.baris({ id: 2, dosenIds: [9] }),
        e.baris({ id: 3, sumber: "manual", dosenIds: [9, 7] }),
      ]);
      const { items } = await (await daftar(e)).json();
      expect(items.map((i: { bisa_diubah: boolean }) => i.bisa_diubah)).toEqual([true, false, true]);
    });
  });

  describe("filter dosen_id lewat tabel penghubung", () => {
    it("dosen_id memfilter lewat relasi, tanpa menyaring sumber, jadi data SINTA dan manual muncul bersama", async () => {
      mocks.db[e.nama].findMany.mockResolvedValue([
        e.baris({ id: 1, sumber: "sinta", dosenIds: [7] }),
        e.baris({ id: 2, sumber: "manual", dosenIds: [7] }),
      ]);
      mocks.db[e.nama].count.mockResolvedValue(2);

      const res = await daftar(e, "?dosen_id=7");
      expect(ambilWhere(e)).toEqual({ [e.relasi]: { some: { dosen_id: 7 } } });
      expect(JSON.stringify(ambilWhere(e))).not.toContain("sumber");
      expect(mocks.db[e.nama].count.mock.calls[0][0].where).toEqual(ambilWhere(e));

      const { items } = await res.json();
      expect(items.map((i: { sumber: string }) => i.sumber)).toEqual(["sinta", "manual"]);
    });

    it("tanpa dosen_id: semua data, server tidak memilih dosen bawaan", async () => {
      mocks.getSession.mockResolvedValue(sesiDosen("Dosen", 7));
      await daftar(e);
      expect(ambilWhere(e)).toEqual({});
    });

    it("item bersama dua dosen muncul untuk keduanya, dengan daftar dosennya", async () => {
      for (const id of ["3", "7"]) {
        mocks.db[e.nama].findMany.mockResolvedValue([e.baris({ id: 1, dosenIds: [3, 7] })]);
        const res = await daftar(e, `?dosen_id=${id}`);
        expect(res.status).toBe(200);
        expect(ambilWhere(e)[e.relasi].some.dosen_id).toBe(Number(id));
        const [item] = (await res.json()).items;
        if (e.nama !== "kegiatan") expect(item.dosen.map((d: { id: number }) => d.id)).toEqual([3, 7]);
      }
    });
  });

  describe("tahun, pencarian judul, dan pagination", () => {
    it("tahun dan q menjadi kondisi, q tanpa membedakan huruf besar kecil", async () => {
      await daftar(e, "?tahun=2024&q=%20Sistem%20");
      expect(ambilWhere(e)).toMatchObject({ tahun: 2024, judul: { contains: "Sistem", mode: "insensitive" } });
    });

    it("semua filter digabung", async () => {
      await daftar(e, "?dosen_id=7&tahun=2023&q=abc");
      expect(ambilWhere(e)).toMatchObject({ tahun: 2023, judul: { contains: "abc" }, [e.relasi]: { some: { dosen_id: 7 } } });
    });

    it("page dan pageSize menjadi skip dan take, total dan totalPages dihitung", async () => {
      mocks.db[e.nama].count.mockResolvedValue(12);
      const res = await daftar(e, "?page=2&pageSize=5");
      const args = mocks.db[e.nama].findMany.mock.calls[0][0];
      expect(args).toMatchObject({ skip: 5, take: 5 });
      expect((await res.json()).pagination).toEqual({ page: 2, pageSize: 5, total: 12, totalPages: 3 });
    });

    it("pageSize dibatasi 50, page tidak valid menjadi 1", async () => {
      await daftar(e, "?pageSize=500&page=-3");
      expect(mocks.db[e.nama].findMany.mock.calls[0][0]).toMatchObject({ skip: 0, take: 50 });
    });

    it("tahun terbaru dulu, tahun kosong di akhir", async () => {
      await daftar(e);
      expect(mocks.db[e.nama].findMany.mock.calls[0][0].orderBy).toEqual([
        { tahun: { sort: "desc", nulls: "last" } },
        { id: "desc" },
      ]);
    });

    it.each([
      ["dosen_id", "?dosen_id=abc"],
      ["dosen_id nol", "?dosen_id=0"],
      ["dosen_id negatif", "?dosen_id=-1"],
      ["dosen_id desimal", "?dosen_id=1.5"],
      ["tahun", "?tahun=dua-ribu"],
      ["tahun terlalu kecil", "?tahun=99"],
      ["q terlalu panjang", `?q=${"a".repeat(201)}`],
    ])("400 untuk %s tidak valid, tanpa query database", async (_nama, query) => {
      const res = await daftar(e, query);
      expect(res.status).toBe(400);
      expect(typeof (await res.json()).message).toBe("string");
      expect(mocks.db[e.nama].findMany).not.toHaveBeenCalled();
    });
  });

  it("500 dengan pesan umum bila database gagal", async () => {
    mocks.db[e.nama].findMany.mockRejectedValue(new Error("koneksi putus"));
    const res = await daftar(e);
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("koneksi putus");
  });
});

describe.each(ENTITAS)("GET /api/tridarma/$path/[id] (detail)", (e) => {
  it("200 untuk Umum tanpa login", async () => {
    const res = await detail(e, "1");
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({ id: 1, sumber: "sinta", bisa_diubah: false });
    for (const k of e.rahasia) expect(data).not.toHaveProperty(k);
    expect(mocks.db[e.nama].findUnique.mock.calls[0][0].where).toEqual({ id: 1 });
  });

  it("bisa_diubah benar untuk pemilik, termasuk data manual", async () => {
    mocks.getSession.mockResolvedValue(sesiDosen("Dosen", 7));
    mocks.db[e.nama].findUnique.mockResolvedValue(e.baris({ id: 1, sumber: "manual", dosenIds: [7] }));
    expect((await (await detail(e, "1")).json()).data).toMatchObject({ sumber: "manual", bisa_diubah: true });
  });

  it("404 bila tidak ada", async () => {
    mocks.db[e.nama].findUnique.mockResolvedValue(null);
    expect((await detail(e, "999")).status).toBe(404);
  });

  it.each([["abc"], ["0"], ["-1"], ["1.5"], ["99999999999"]])("400 untuk id %s", async (id) => {
    expect((await detail(e, id)).status).toBe(400);
    expect(mocks.db[e.nama].findUnique).not.toHaveBeenCalled();
  });
});

describe("filter sesuai Figma", () => {
  const [pub, keg, iprs, buku] = ENTITAS;

  describe("publikasi: akreditasi (gabungan kuartil dan akreditasi) dan sumber_artikel", () => {
    it.each([["Q1", "Q1"], [" q2 ", "Q2"], ["Q 3", "Q3"], ["q4", "Q4"]])(
      "akreditasi=%j (kuartil Scopus) membaca kolom kuartil, tanpa membedakan huruf besar kecil",
      async (nilai, kuartil) => {
        await daftar(pub, `?akreditasi=${encodeURIComponent(nilai)}`);
        expect(ambilWhere(pub)).toEqual({ kuartil: { equals: kuartil, mode: "insensitive" } });
        expect(mocks.db.publikasi.count.mock.calls[0][0].where).toEqual(ambilWhere(pub));
      },
    );

    it.each([["SINTA 1", 1], ["Sinta 2", 2], ["sinta3", 3], ["S4", 4], ["s 5", 5], ["SINTA 6", 6]])(
      "akreditasi=%j (akreditasi lokal) membaca kolom akreditasi dengan tiga bentuk tulisan",
      async (nilai, n) => {
        await daftar(pub, `?akreditasi=${encodeURIComponent(nilai)}`);
        expect(ambilWhere(pub)).toEqual({
          OR: [
            { akreditasi: { contains: `sinta ${n}`, mode: "insensitive" } },
            { akreditasi: { contains: `sinta${n}`, mode: "insensitive" } },
            { akreditasi: { equals: `s${n}`, mode: "insensitive" } },
          ],
        });
      },
    );

    it.each([["Q5"], ["SINTA 7"], ["SINTA 0"], ["Terakreditasi"]])(
      "akreditasi=%j di luar pilihan tetap diterima dan dicocokkan persis ke kedua kolom",
      async (nilai) => {
        await daftar(pub, `?akreditasi=${encodeURIComponent(nilai)}`);
        expect(ambilWhere(pub)).toEqual({
          OR: [
            { kuartil: { equals: nilai, mode: "insensitive" } },
            { akreditasi: { equals: nilai, mode: "insensitive" } },
          ],
        });
      },
    );

    it.each([
      ["scopus", "sinta_scopus"],
      ["garuda", "sinta_garuda"],
      ["googlescholar", "sinta_googlescholar"],
      ["rama", "sinta_rama"],
      ["manual", "manual"],
      ["sinta_garuda", "sinta_garuda"],
      ["GARUDA", "sinta_garuda"],
    ])("sumber_artikel=%s memfilter publikasi_dosen.source = %s", async (nilai, source) => {
      await daftar(pub, `?sumber_artikel=${nilai}`);
      expect(ambilWhere(pub)).toEqual({ publikasi_dosen: { some: { source } } });
    });

    it("sumber diterima sebagai alias sumber_artikel", async () => {
      await daftar(pub, "?sumber=scopus");
      expect(ambilWhere(pub)).toEqual({ publikasi_dosen: { some: { source: "sinta_scopus" } } });
    });

    it("dosen_id dan sumber_artikel memakai satu `some`: tertaut ke dosen itu lewat sumber itu", async () => {
      await daftar(pub, "?dosen_id=7&sumber_artikel=garuda");
      expect(ambilWhere(pub)).toEqual({ publikasi_dosen: { some: { dosen_id: 7, source: "sinta_garuda" } } });
    });

    it("semua filter publikasi digabung dengan tahun dan q", async () => {
      await daftar(pub, "?dosen_id=7&tahun=2024&q=sistem&akreditasi=Sinta%202&sumber_artikel=scopus");
      expect(ambilWhere(pub)).toMatchObject({
        tahun: 2024,
        judul: { contains: "sistem" },
        publikasi_dosen: { some: { dosen_id: 7, source: "sinta_scopus" } },
        OR: [{ akreditasi: { contains: "sinta 2" } }, { akreditasi: { contains: "sinta2" } }, { akreditasi: { equals: "s2" } }],
      });
    });

    it.each([["sinta"], ["lainnya"], ["__proto__"], ["constructor"]])("sumber_artikel=%s tidak dikenal: 400", async (nilai) => {
      const res = await daftar(pub, `?sumber_artikel=${nilai}`);
      expect(res.status).toBe(400);
      expect((await res.json()).message).toBe(
        "Parameter sumber_artikel harus salah satu dari: scopus, garuda, googlescholar, rama, manual.",
      );
      expect(mocks.db.publikasi.findMany).not.toHaveBeenCalled();
    });

    it("tanpa filter tambahan, where tetap kosong", async () => {
      await daftar(pub);
      expect(ambilWhere(pub)).toEqual({});
    });
  });

  it("kegiatan: skema bersama jenis (penelitian dan pengabdian)", async () => {
    await daftar(keg, "?jenis=penelitian&skema=PENELITIAN%20INTERNAL%20UPI&tahun=2025");
    expect(ambilWhere(keg)).toEqual({
      tahun: 2025,
      jenis: "penelitian",
      skema: { equals: "PENELITIAN INTERNAL UPI", mode: "insensitive" },
    });
    await daftar(keg, "?jenis=pengabdian&skema=Hibah");
    expect(ambilWhere(keg)).toMatchObject({ jenis: "pengabdian", skema: { equals: "Hibah" } });
  });

  it("iprs (HKI): status dan jenis", async () => {
    await daftar(iprs, "?tahun=2023&status=Granted&jenis=Hak%20Cipta");
    expect(ambilWhere(iprs)).toEqual({
      tahun: 2023,
      status: { equals: "Granted", mode: "insensitive" },
      jenis: { equals: "Hak Cipta", mode: "insensitive" },
    });
  });

  it("buku: kategori", async () => {
    await daftar(buku, "?tahun=2022&kategori=Buku%20Ajar");
    expect(ambilWhere(buku)).toEqual({ tahun: 2022, kategori: { equals: "Buku Ajar", mode: "insensitive" } });
  });

  it("filter khusus satu endpoint diabaikan di endpoint lain", async () => {
    await daftar(buku, "?status=Granted&skema=X&akreditasi=Q1&sumber_artikel=tidak-dikenal&jenis=hibah");
    expect(ambilWhere(buku)).toEqual({});
    await daftar(iprs, "?kategori=X&skema=X&akreditasi=Q1");
    expect(ambilWhere(iprs)).toEqual({});
    await daftar(keg, "?status=Granted&kategori=X");
    expect(ambilWhere(keg)).toEqual({});
  });

  it.each([
    ["publikasi", "akreditasi"],
    ["kegiatan", "skema"],
    ["iprs", "status"],
    ["iprs", "jenis"],
    ["buku", "kategori"],
  ])("%s: %s lebih dari 255 karakter ditolak 400", async (nama, param) => {
    const e = ENTITAS.find((x) => x.nama === nama)!;
    const res = await daftar(e, `?${param}=${"a".repeat(256)}`);
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe(`Parameter ${param} maksimal 255 karakter.`);
    expect(mocks.db[e.nama].findMany).not.toHaveBeenCalled();
  });

  it("filter kosong atau hanya spasi tidak menambah kondisi", async () => {
    await daftar(pub, "?akreditasi=%20&sumber_artikel=");
    expect(ambilWhere(pub)).toEqual({});
    await daftar(iprs, "?status=&jenis=%20");
    expect(ambilWhere(iprs)).toEqual({});
  });
});

describe("publikasi", () => {
  const pub = ENTITAS[0];

  it("memuat sumber_artikel dari publikasi_dosen.source dan daftar dosen unik", async () => {
    mocks.db.publikasi.findMany.mockResolvedValue([
      {
        ...pub.baris({ id: 1, dosenIds: [3] }),
        publikasi_dosen: [
          { dosen_id: 3, source: "sinta_scopus", urutan_penulis: 1, total_penulis: 2, sitasi_sumber: 4, link_sumber: null, dosen: dosen(3) },
          { dosen_id: 3, source: "sinta_garuda", urutan_penulis: 1, total_penulis: 2, sitasi_sumber: null, link_sumber: null, dosen: dosen(3) },
          { dosen_id: 7, source: "sinta_garuda", urutan_penulis: 2, total_penulis: 2, sitasi_sumber: null, link_sumber: null, dosen: dosen(7) },
        ],
      },
    ]);
    const [item] = (await (await daftar(pub)).json()).items;
    expect(item.sumber_artikel).toEqual(["sinta_scopus", "sinta_garuda"]);
    expect(item.dosen).toEqual([dosen(3), dosen(7)]);
    expect(item).not.toHaveProperty("tautan");
  });

  it("detail memuat rincian tautan per dosen dan sumber", async () => {
    const { data } = await (await detail(pub, "1")).json();
    expect(data.tautan).toEqual([
      { dosen_id: 3, source: "sinta_scopus", urutan_penulis: 1, total_penulis: 2, sitasi_sumber: null, link_sumber: null },
      { dosen_id: 7, source: "sinta_scopus", urutan_penulis: 1, total_penulis: 2, sitasi_sumber: null, link_sumber: null },
    ]);
  });
});

describe("kegiatan", () => {
  const keg = ENTITAS[1];

  it("jenis memfilter, dan tanpa jenis penelitian dan pengabdian sama-sama muncul", async () => {
    await daftar(keg, "?jenis=pengabdian");
    expect(ambilWhere(keg)).toEqual({ jenis: "pengabdian" });

    mocks.db.kegiatan.findMany.mockClear();
    await daftar(keg, "?jenis=Penelitian&dosen_id=7");
    expect(ambilWhere(keg)).toEqual({ jenis: "penelitian", anggota: { some: { dosen_id: 7 } } });

    mocks.db.kegiatan.findMany.mockClear();
    await daftar(keg);
    expect(ambilWhere(keg)).not.toHaveProperty("jenis");
  });

  it("jenis tidak dikenal: 400", async () => {
    const res = await daftar(keg, "?jenis=hibah");
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Parameter jenis harus penelitian atau pengabdian.");
  });

  it("memuat peserta dengan peran, tanpa status, dana sebagai angka", async () => {
    const [item] = (await (await daftar(keg)).json()).items;
    expect(item.peserta).toEqual([
      { nama: "Dosen 3", peran: "ketua", dosen_id: 3 },
      { nama: "Dosen 7", peran: "anggota", dosen_id: 7 },
    ]);
    expect(item).not.toHaveProperty("status");
    expect(item).not.toHaveProperty("anggota");
    expect(item.dana_nominal).toBe(30000000);
  });

  it("peserta mengurutkan ketua lebih dulu", async () => {
    await daftar(keg);
    expect(mocks.db.kegiatan.findMany.mock.calls[0][0].include.anggota.orderBy).toEqual([{ peran: "asc" }, { nama: "asc" }]);
  });

  it("peserta tanpa dosen_id tidak membuat item bisa diubah", async () => {
    mocks.getSession.mockResolvedValue(sesiDosen("Dosen", 7));
    mocks.db.kegiatan.findMany.mockResolvedValue([
      {
        ...keg.baris({ id: 1, dosenIds: [] }),
        anggota: [{ nama: "Orang Luar", peran: "ketua", dosen_id: null }],
      },
    ]);
    expect((await (await daftar(keg)).json()).items[0].bisa_diubah).toBe(false);
  });

  it("jenis diabaikan di endpoint lain", async () => {
    const res = await daftar(ENTITAS[0], "?jenis=hibah");
    expect(res.status).toBe(200);
  });
});

describe("iprs", () => {
  it("memuat status, dan IPRS manual berstatus Diterima", async () => {
    const iprs = ENTITAS[2];
    mocks.db.iprs.findMany.mockResolvedValue([
      iprs.baris({ id: 1, sumber: "sinta", dosenIds: [3] }),
      iprs.baris({ id: 2, sumber: "manual", dosenIds: [3] }),
    ]);
    const { items } = await (await daftar(iprs)).json();
    expect(items.map((i: { status: string }) => i.status)).toEqual(["Granted", "Diterima"]);
  });
});

describe("GET /api/tridarma/dosen", () => {
  const profil = {
    id: 1, sinta_id: "6658552", nama: "IQBAL", afiliasi: "UPI", departemen: "RPL", sync_status: "SUCCESS", last_synced_at: tanggal,
  };

  it("Umum bisa membaca daftar tanpa user_id, dengan halaman bawaan 100", async () => {
    mocks.db.dosen.findMany.mockResolvedValue([profil]);
    mocks.db.dosen.count.mockResolvedValue(1);

    const res = await dosenDaftar(new NextRequest(`${BASE}/dosen`));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items[0]).toEqual({ ...profil, last_synced_at: tanggal.toISOString() });
    expect(body.pagination).toEqual({ page: 1, pageSize: 100, total: 1, totalPages: 1 });

    const args = mocks.db.dosen.findMany.mock.calls[0][0];
    expect(args.select).not.toHaveProperty("user_id");
    expect(args).toMatchObject({ skip: 0, take: 100 });
  });

  it("q mencari nama, pageSize dibatasi 200", async () => {
    mocks.db.dosen.findMany.mockResolvedValue([]);
    mocks.db.dosen.count.mockResolvedValue(0);
    await dosenDaftar(new NextRequest(`${BASE}/dosen?q=iqbal&pageSize=999`));
    expect(mocks.db.dosen.findMany.mock.calls[0][0]).toMatchObject({
      where: { nama: { contains: "iqbal", mode: "insensitive" } },
      take: 200,
    });
  });

  it("400 untuk q terlalu panjang", async () => {
    expect((await dosenDaftar(new NextRequest(`${BASE}/dosen?q=${"a".repeat(201)}`))).status).toBe(400);
  });
});

describe("GET /api/tridarma/dosen/[id]", () => {
  const panggil = (id: string) => dosenDetail(new Request(`${BASE}/dosen/${id}`), { params: Promise.resolve({ id }) });
  const baris = {
    id: 1, sinta_id: "6658552", nama: "IQBAL", afiliasi: "UPI", departemen: "RPL", sync_status: "SUCCESS", last_synced_at: tanggal,
    sinta_skor: [{ label: "SINTA Score Overall", nilai: "504.00" }],
    sinta_metrik: [{ label: "Article", scopus: 10, gscholar: 20, wos: null }],
  };

  it("profil dengan skor sebagai angka dan metrik, untuk Umum", async () => {
    mocks.db.dosen.findUnique.mockResolvedValue(baris);
    const res = await panggil("1");
    expect(res.status).toBe(200);
    const { data } = await res.json();
    expect(data).toMatchObject({
      id: 1,
      nama: "IQBAL",
      skor: [{ label: "SINTA Score Overall", nilai: 504 }],
      metrik: [{ label: "Article", scopus: 10, gscholar: 20, wos: null }],
    });
    expect(data).not.toHaveProperty("user_id");
    expect(data).not.toHaveProperty("sinta_skor");
    expect(mocks.db.dosen.findUnique.mock.calls[0][0].select).not.toHaveProperty("user_id");
  });

  it("404 dan 400", async () => {
    mocks.db.dosen.findUnique.mockResolvedValue(null);
    expect((await panggil("99")).status).toBe(404);
    expect((await panggil("abc")).status).toBe(400);
  });
});
