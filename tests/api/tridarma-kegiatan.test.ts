import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, jsonRequest, sesi, USER_ID } from "../helpers/fixtures";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  catatLog: vi.fn(),
  db: {
    dosen: { findUnique: vi.fn(), findMany: vi.fn() },
    kegiatan: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    kegiatanAnggota: {
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/log-aktivitas", () => ({ catatLog: mocks.catatLog }));

import { Prisma } from "@/generated/prisma/client";
import { DELETE, PATCH } from "@/app/api/tridarma/kegiatan/[id]/route";
import { POST } from "@/app/api/tridarma/kegiatan/route";
import { kunciKegiatan } from "@/lib/kunci";

const URL_KEGIATAN = "http://localhost/api/tridarma/kegiatan";
const URL_KEGIATAN_ID = "http://localhost/api/tridarma/kegiatan/10";

const DOSEN_ID = 7;
const JUDUL = "Pengembangan Model Pembelajaran Digital";
const BODY_VALID = {
  jenis: "penelitian",
  judul: JUDUL,
  tahun: 2025,
  skema: "Penelitian Internal",
  dana_nominal: 30000000,
  sumber_dana: "UPI",
  tim: "Dosen Penguji; Rekan Dosen; Orang Luar",
};
const KUNCI_VALID = kunciKegiatan("penelitian", JUDUL, 2025);

// Keadaan database tiruan, diatur per tes.
const state = {
  identitas: { nama: "DOSEN PENGUJI", nama_normal: "dosen penguji" } as { nama: string | null; nama_normal: string | null },
  petaDosen: [{ id: 9, nama_normal: "rekan dosen" }] as { id: number; nama_normal: string | null }[],
  byKunci: null as unknown,
  byId: null as unknown,
  detail: null as unknown,
};

const DETAIL = {
  id: 10,
  kunci: KUNCI_VALID,
  jenis: "penelitian",
  judul: JUDUL,
  tahun: 2025,
  skema: "Penelitian Internal",
  dana_nominal: "30000000.00",
  sumber_dana: "UPI",
  sumber: "manual",
  created_at: new Date("2026-11-24T00:00:00.000Z"),
  updated_at: new Date("2026-11-24T00:00:00.000Z"),
  anggota: [{ nama: "Dosen Penguji", peran: "ketua", dosen_id: DOSEN_ID }],
};

const anggota = (nama_normal: string, peran: "ketua" | "anggota", dosen_id: number | null, nama = nama_normal.toUpperCase()) => ({
  nama,
  nama_normal,
  peran,
  dosen_id,
});

function galatPrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError("galat uji", { code, clientVersion: "uji" });
}

const baca = async (res: Response) => (await res.json()) as Record<string, unknown>;
const post = (body: unknown) => POST(jsonRequest(URL_KEGIATAN, "POST", body));
const patch = (body: unknown, id = "10") => PATCH(jsonRequest(URL_KEGIATAN_ID, "PATCH", body), ctx(id));
const hapus = (id = "10") => DELETE(jsonRequest(URL_KEGIATAN_ID, "DELETE"), ctx(id));

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});

  state.identitas = { nama: "DOSEN PENGUJI", nama_normal: "dosen penguji" };
  state.petaDosen = [{ id: 9, nama_normal: "rekan dosen" }];
  state.byKunci = null;
  state.byId = null;
  state.detail = DETAIL;

  mocks.getSession.mockResolvedValue({ ...sesi("Dosen"), dosen_id: DOSEN_ID });
  mocks.db.dosen.findUnique.mockImplementation(async ({ where }: { where: Record<string, unknown> }) =>
    "user_id" in where ? { id: DOSEN_ID } : state.identitas,
  );
  mocks.db.dosen.findMany.mockImplementation(async () => state.petaDosen);
  mocks.db.kegiatan.findUnique.mockImplementation(async (args: { where: Record<string, unknown>; include?: unknown }) => {
    if ("kunci" in args.where) return state.byKunci;
    return args.include ? state.detail : state.byId;
  });
  mocks.db.kegiatan.create.mockResolvedValue({ id: 10, judul: JUDUL });
  mocks.db.kegiatan.update.mockResolvedValue({});
  mocks.db.kegiatan.delete.mockResolvedValue({});
  mocks.db.kegiatanAnggota.count.mockResolvedValue(0);
  mocks.db.$transaction.mockImplementation(async (fn: (tx: typeof mocks.db) => Promise<unknown>) => fn(mocks.db));
});

describe("hak akses dan prasyarat", () => {
  it("401 tanpa sesi untuk POST, PATCH, dan DELETE", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await post(BODY_VALID)).status).toBe(401);
    expect((await patch({ judul: "Judul Baru" })).status).toBe(401);
    expect((await hapus()).status).toBe(401);
  });

  it.each(["Mahasiswa", "Umum"])("403 untuk peran %s", async (peran) => {
    mocks.getSession.mockResolvedValue(sesi(peran));
    expect((await post(BODY_VALID)).status).toBe(403);
    expect((await patch({ judul: "Judul Baru" })).status).toBe(403);
    expect((await hapus()).status).toBe(403);
    expect(mocks.db.dosen.findUnique).not.toHaveBeenCalled();
    expect(mocks.db.kegiatan.create).not.toHaveBeenCalled();
  });

  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])(
    "400 minta isi sinta_id dulu bila %s belum punya baris dosen",
    async (peran) => {
      mocks.getSession.mockResolvedValue(sesi(peran));
      mocks.db.dosen.findUnique.mockResolvedValue(null);
      for (const res of [await post(BODY_VALID), await patch({ judul: "Judul Baru" }), await hapus()]) {
        expect(res.status).toBe(400);
        expect((await baca(res)).message).toContain("sinta_id");
      }
    },
  );
});

describe("POST /api/tridarma/kegiatan", () => {
  it.each(["penelitian", "pengabdian"])("201 menambah kegiatan %s manual, sumber = manual, kunci dari kunci.ts", async (jenis) => {
    const res = await post({ ...BODY_VALID, jenis });
    expect(res.status).toBe(201);

    const data = mocks.db.kegiatan.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      jenis,
      judul: JUDUL,
      tahun: 2025,
      skema: "Penelitian Internal",
      dana_nominal: 30000000,
      sumber_dana: "UPI",
      sumber: "manual",
      kunci: kunciKegiatan(jenis, JUDUL, 2025),
    });
    expect(data).not.toHaveProperty("status");
    expect(await baca(res)).toMatchObject({ message: "Kegiatan berhasil ditambahkan.", data: { id: 10, bisa_diubah: true } });
  });

  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])("peran %s boleh menambah", async (peran) => {
    mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: DOSEN_ID });
    expect((await post(BODY_VALID)).status).toBe(201);
  });

  it("tim dipecah menjadi baris: nama pertama ketua, sisanya anggota, dosen_id dari pencocokan nama", async () => {
    await post(BODY_VALID);
    expect(mocks.db.kegiatan.create.mock.calls[0][0].data.anggota.create).toEqual([
      { nama: "Dosen Penguji", nama_normal: "dosen penguji", peran: "ketua", dosen_id: DOSEN_ID },
      { nama: "Rekan Dosen", nama_normal: "rekan dosen", peran: "anggota", dosen_id: 9 },
      { nama: "Orang Luar", nama_normal: "orang luar", peran: "anggota", dosen_id: null },
    ]);
  });

  it("nama pengguna boleh bukan yang pertama: ketua tetap nama pertama, baris pengguna tetap diberi dosen_id", async () => {
    await post({ ...BODY_VALID, tim: "Orang Luar; Rekan Dosen; Dosen Penguji" });
    const rows = mocks.db.kegiatan.create.mock.calls[0][0].data.anggota.create;
    expect(rows.map((r: { nama: string; peran: string }) => [r.nama, r.peran])).toEqual([
      ["Orang Luar", "ketua"],
      ["Rekan Dosen", "anggota"],
      ["Dosen Penguji", "anggota"],
    ]);
    expect(rows[2].dosen_id).toBe(DOSEN_ID);
  });

  it("nama pengguna ditulis dengan gelar dan huruf lain tetap dikenali lewat nama_normal", async () => {
    await post({ ...BODY_VALID, tim: "Dr. DOSEN Penguji, S.Kom., M.T.; Rekan Dosen" });
    const [pertama] = mocks.db.kegiatan.create.mock.calls[0][0].data.anggota.create;
    expect(pertama).toMatchObject({ nama: "Dr. DOSEN Penguji, S.Kom., M.T.", nama_normal: "dosen penguji", dosen_id: DOSEN_ID });
  });

  it("nama kembar digabung jadi satu baris dengan posisi paling awal", async () => {
    await post({ ...BODY_VALID, tim: "Dosen Penguji; Rekan Dosen; DOSEN PENGUJI; rekan dosen" });
    const rows = mocks.db.kegiatan.create.mock.calls[0][0].data.anggota.create;
    expect(rows).toHaveLength(2);
    expect(rows.map((r: { peran: string }) => r.peran)).toEqual(["ketua", "anggota"]);
  });

  it("nama yang cocok dengan lebih dari satu dosen tidak diberi dosen_id", async () => {
    state.petaDosen = [
      { id: 9, nama_normal: "rekan dosen" },
      { id: 11, nama_normal: "rekan dosen" },
    ];
    await post(BODY_VALID);
    const rows = mocks.db.kegiatan.create.mock.calls[0][0].data.anggota.create;
    expect(rows[1]).toMatchObject({ nama_normal: "rekan dosen", dosen_id: null });
  });

  it("pencocokan nama memakai satu query berisi semua nama_normal tim", async () => {
    await post(BODY_VALID);
    expect(mocks.db.dosen.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.db.dosen.findMany.mock.calls[0][0].where).toEqual({
      nama_normal: { in: ["dosen penguji", "rekan dosen", "orang luar"] },
    });
  });

  it("mencatat log: modul 7, aksi tambah, objek kegiatan, detail judul", async () => {
    await post(BODY_VALID);
    expect(mocks.catatLog).toHaveBeenCalledWith({
      userId: USER_ID,
      userNama: "Pengguna Uji",
      modul: "7",
      aksi: "tambah",
      objek: "kegiatan",
      detail: JUDUL,
    });
  });

  it("400 bila nama pengguna tidak ada di tim", async () => {
    const res = await post({ ...BODY_VALID, tim: "Rekan Dosen; Orang Luar" });
    expect(res.status).toBe(400);
    expect(await baca(res)).toEqual({ message: "Nama kamu harus ada di daftar tim." });
    expect(mocks.db.kegiatan.create).not.toHaveBeenCalled();
  });

  it.each([
    ["nama kosong", { nama: null, nama_normal: null }],
    ["nama hanya spasi dan nama_normal kosong", { nama: "   ", nama_normal: "" }],
    ["baris dosen tidak ditemukan", null as never],
  ])("400 minta sinkron dulu bila dosen belum pernah sinkron (%s)", async (_nama, identitas) => {
    state.identitas = identitas;
    const res = await post(BODY_VALID);
    expect(res.status).toBe(400);
    expect((await baca(res)).message).toContain("Sinkron");
    expect(mocks.db.kegiatan.create).not.toHaveBeenCalled();
    expect(mocks.db.kegiatan.findUnique).not.toHaveBeenCalled();
  });

  it("nama_normal dosen dibaca dari kolom, atau dihitung dari nama bila kolom kosong", async () => {
    state.identitas = { nama: "Dr. DOSEN Penguji, M.T.", nama_normal: null };
    expect((await post(BODY_VALID)).status).toBe(201);
  });

  it("field status ditolak 400 dan tidak menyentuh database", async () => {
    const res = await post({ ...BODY_VALID, status: "Diterima" });
    expect(res.status).toBe(400);
    expect(await baca(res)).toEqual({ message: "Kegiatan tidak memiliki field status." });
    expect(mocks.db.dosen.findUnique).toHaveBeenCalledTimes(1); // hanya pengecekan hak
    expect(mocks.db.kegiatan.create).not.toHaveBeenCalled();
  });

  it.each([
    ["jenis", { jenis: "hibah" }],
    ["judul kosong", { judul: "" }],
    ["tahun", { tahun: 99 }],
    ["tim kosong", { tim: "" }],
    ["tim bukan teks", { tim: ["A B"] }],
    ["dana negatif", { dana_nominal: -5 }],
  ])("400 untuk %s tidak valid", async (_nama, ubahan) => {
    const res = await post({ ...BODY_VALID, ...ubahan });
    expect(res.status).toBe(400);
    expect(mocks.db.kegiatan.create).not.toHaveBeenCalled();
  });

  it("400 untuk body yang bukan JSON", async () => {
    expect((await post("{rusak")).status).toBe(400);
  });

  describe("duplikat", () => {
    const ada = (sumber: string, anggotaAda: { nama_normal: string; dosen_id: number | null }[]) => ({
      id: 55,
      judul: JUDUL,
      sumber,
      anggota: anggotaAda,
    });

    it("manual milik dosen lain, pengguna belum tertaut: tautkan otomatis, 200, ditautkan = true", async () => {
      state.byKunci = ada("manual", [{ nama_normal: "orang lain", dosen_id: 3 }]);

      const res = await post(BODY_VALID);
      expect(res.status).toBe(200);
      expect(await baca(res)).toEqual({
        message: "Kegiatan ini sudah ada dan sudah dihubungkan ke akunmu.",
        data: { ditautkan: true, id: 55, judul: JUDUL },
      });

      // baris baru untuk pengguna, dengan peran dari posisinya di tim (nama pertama = ketua)
      expect(mocks.db.kegiatanAnggota.create).toHaveBeenCalledWith({
        data: { kegiatan_id: 55, nama: "Dosen Penguji", nama_normal: "dosen penguji", peran: "ketua", dosen_id: DOSEN_ID },
      });
      // tidak ada kegiatan baru, tidak ada perubahan pada isi kegiatan atau baris orang lain
      expect(mocks.db.kegiatan.create).not.toHaveBeenCalled();
      expect(mocks.db.kegiatan.update).not.toHaveBeenCalled();
      expect(mocks.db.kegiatanAnggota.update).not.toHaveBeenCalled();
      expect(mocks.db.kegiatanAnggota.updateMany).not.toHaveBeenCalled();
      expect(mocks.db.kegiatanAnggota.deleteMany).not.toHaveBeenCalled();
      expect(mocks.catatLog).toHaveBeenCalledTimes(1);
    });

    it("peran baris baru mengikuti posisi nama pengguna di tim", async () => {
      state.byKunci = ada("manual", [{ nama_normal: "orang lain", dosen_id: 3 }]);
      await post({ ...BODY_VALID, tim: "Orang Lain; Dosen Penguji" });
      expect(mocks.db.kegiatanAnggota.create.mock.calls[0][0].data.peran).toBe("anggota");
    });

    it("sudah ada baris dengan nama pengguna tetapi dosen_id kosong: isi dosen_id-nya, tidak menambah baris", async () => {
      state.byKunci = ada("manual", [
        { nama_normal: "dosen penguji", dosen_id: null },
        { nama_normal: "orang lain", dosen_id: 3 },
      ]);

      const res = await post(BODY_VALID);
      expect(res.status).toBe(200);
      expect(mocks.db.kegiatanAnggota.update).toHaveBeenCalledWith({
        where: { kegiatan_id_nama_normal: { kegiatan_id: 55, nama_normal: "dosen penguji" } },
        data: { dosen_id: DOSEN_ID },
      });
      expect(mocks.db.kegiatanAnggota.create).not.toHaveBeenCalled();
    });

    it("duplikat dengan data sinta: 409 'Kegiatan ini sudah ada di data.'", async () => {
      state.byKunci = ada("sinta", [{ nama_normal: "orang lain", dosen_id: 3 }]);
      const res = await post(BODY_VALID);
      expect(res.status).toBe(409);
      expect(await baca(res)).toEqual({ message: "Kegiatan ini sudah ada di data." });
      expect(mocks.db.kegiatanAnggota.create).not.toHaveBeenCalled();
      expect(mocks.db.kegiatan.create).not.toHaveBeenCalled();
    });

    it("duplikat dengan data manual yang sudah tertaut ke pengguna: 409", async () => {
      state.byKunci = ada("manual", [{ nama_normal: "dosen penguji", dosen_id: DOSEN_ID }]);
      expect((await post(BODY_VALID)).status).toBe(409);
      expect(mocks.db.kegiatanAnggota.create).not.toHaveBeenCalled();
    });

    it("duplikat manual tetapi baris dengan nama itu sudah milik dosen lain: 409, tidak menimpa", async () => {
      state.byKunci = ada("manual", [{ nama_normal: "dosen penguji", dosen_id: 3 }]);
      expect((await post(BODY_VALID)).status).toBe(409);
      expect(mocks.db.kegiatanAnggota.update).not.toHaveBeenCalled();
    });

    it("jenis berbeda dengan judul dan tahun sama bukan duplikat (kunci memuat jenis)", async () => {
      await post({ ...BODY_VALID, jenis: "pengabdian" });
      expect(mocks.db.kegiatan.findUnique.mock.calls[0][0].where).toEqual({
        kunci: kunciKegiatan("pengabdian", JUDUL, 2025),
      });
      expect(KUNCI_VALID).not.toBe(kunciKegiatan("pengabdian", JUDUL, 2025));
    });

    it("kunci unik bentrok saat penyimpanan (dua permintaan bersamaan): 409", async () => {
      mocks.db.kegiatan.create.mockRejectedValue(galatPrisma("P2002"));
      const res = await post(BODY_VALID);
      expect(res.status).toBe(409);
      expect((await baca(res)).message).toBe("Kegiatan ini sudah ada di data.");
    });
  });

  it("500 dengan pesan umum untuk galat lain", async () => {
    mocks.db.kegiatan.create.mockRejectedValue(new Error("koneksi putus"));
    const res = await post(BODY_VALID);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await baca(res))).not.toContain("koneksi putus");
  });
});

describe("PATCH /api/tridarma/kegiatan/[id]", () => {
  const existing = (sumber = "sinta", anggotaAda = [anggota("dosen penguji", "ketua", DOSEN_ID)]) => ({
    id: 10,
    kunci: kunciKegiatan("penelitian", "Judul Lama Kegiatan", 2024),
    jenis: "penelitian",
    judul: "Judul Lama Kegiatan",
    tahun: 2024,
    sumber,
    anggota: anggotaAda,
  });

  beforeEach(() => {
    state.byId = existing();
  });

  it("mengubah data sinta milik sendiri: berhasil, sumber menjadi manual, kunci dihitung ulang", async () => {
    const res = await patch({ judul: "Judul Baru Kegiatan", dana_nominal: 5000000 });
    expect(res.status).toBe(200);

    expect(mocks.db.kegiatan.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        judul: "Judul Baru Kegiatan",
        dana_nominal: 5000000,
        kunci: kunciKegiatan("penelitian", "Judul Baru Kegiatan", 2024),
        sumber: "manual",
      },
    });
    expect((await baca(res)).message).toBe("Kegiatan berhasil diperbarui.");
    expect(mocks.catatLog).toHaveBeenCalledWith(expect.objectContaining({ modul: "7", aksi: "ubah", objek: "kegiatan" }));
  });

  it("data manual milik sendiri juga bisa diubah", async () => {
    state.byId = existing("manual");
    expect((await patch({ skema: "Skema Baru" })).status).toBe(200);
  });

  it("tanpa perubahan judul, jenis, dan tahun: kunci tetap dan tidak ada pengecekan bentrok", async () => {
    await patch({ skema: "Skema Baru" });
    const data = mocks.db.kegiatan.update.mock.calls[0][0].data;
    expect(data.kunci).toBe(existing().kunci);
    expect(mocks.db.kegiatan.findUnique.mock.calls.filter(([a]) => "kunci" in a.where)).toHaveLength(0);
  });

  it("409 bila perubahan membuat kunci bentrok dengan kegiatan lain", async () => {
    state.byKunci = { id: 99 };
    const res = await patch({ judul: "Judul Yang Sudah Ada" });
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({ message: "Kegiatan ini sudah ada di data." });
    expect(mocks.db.kegiatan.update).not.toHaveBeenCalled();
  });

  it("404 bila kegiatan tidak ada", async () => {
    state.byId = null;
    expect((await patch({ judul: "Judul Baru Kegiatan" })).status).toBe(404);
  });

  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])(
    "403 untuk %s bila kegiatan tidak tertaut ke dirinya (tidak ada hak tambahan atas data dosen lain)",
    async (peran) => {
      mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: DOSEN_ID });
      state.byId = existing("sinta", [anggota("orang lain", "ketua", 3), anggota("tanpa dosen", "anggota", null)]);
      const res = await patch({ judul: "Judul Baru Kegiatan" });
      expect(res.status).toBe(403);
      expect(mocks.db.kegiatan.update).not.toHaveBeenCalled();
    },
  );

  it("nama yang sama dengan pengguna tetapi dosen_id kosong tidak dihitung sebagai tertaut", async () => {
    state.byId = existing("sinta", [anggota("dosen penguji", "ketua", null)]);
    expect((await patch({ judul: "Judul Baru Kegiatan" })).status).toBe(403);
  });

  it.each([["id abc", "abc"], ["id nol", "0"], ["id negatif", "-1"]])("400 untuk %s", async (_nama, id) => {
    expect((await patch({ judul: "Judul Baru Kegiatan" }, id)).status).toBe(400);
    expect(mocks.db.kegiatan.findUnique).not.toHaveBeenCalled();
  });

  it("400 untuk status, body kosong, dan jenis salah", async () => {
    expect((await patch({ status: "x" })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ jenis: "hibah" })).status).toBe(400);
  });

  describe("mengubah tim", () => {
    it("400 bila nama pengguna tidak ada di tim baru", async () => {
      const res = await patch({ tim: "Rekan Dosen; Orang Baru" });
      expect(res.status).toBe(400);
      expect(await baca(res)).toEqual({ message: "Nama kamu harus ada di daftar tim." });
      expect(mocks.db.kegiatan.update).not.toHaveBeenCalled();
    });

    it("400 minta sinkron dulu bila dosen belum pernah sinkron", async () => {
      state.identitas = { nama: null, nama_normal: null };
      expect((await patch({ tim: "Dosen Penguji; Rekan Dosen" })).status).toBe(400);
    });

    it("tanpa tim, anggota tidak disentuh dan nama pengguna tidak diperiksa", async () => {
      state.identitas = { nama: null, nama_normal: null };
      expect((await patch({ skema: "Skema Baru" })).status).toBe(200);
      expect(mocks.db.kegiatanAnggota.createMany).not.toHaveBeenCalled();
      expect(mocks.db.kegiatanAnggota.deleteMany).not.toHaveBeenCalled();
    });

    it("menambah anggota, memutakhirkan peran, dan menghapus nama tanpa dosen_id yang dikeluarkan", async () => {
      state.byId = existing("sinta", [
        anggota("dosen penguji", "ketua", DOSEN_ID, "DOSEN PENGUJI"),
        anggota("orang lama", "anggota", null),
      ]);

      const res = await patch({ tim: "Rekan Dosen; Dosen Penguji; Orang Baru" });
      expect(res.status).toBe(200);

      expect(mocks.db.kegiatanAnggota.deleteMany).toHaveBeenCalledWith({
        where: { kegiatan_id: 10, nama_normal: { in: ["orang lama"] } },
      });
      expect(mocks.db.kegiatanAnggota.update).toHaveBeenCalledWith({
        where: { kegiatan_id_nama_normal: { kegiatan_id: 10, nama_normal: "dosen penguji" } },
        data: { nama: "Dosen Penguji", peran: "anggota", dosen_id: DOSEN_ID },
      });
      expect(mocks.db.kegiatanAnggota.createMany).toHaveBeenCalledWith({
        data: [
          { kegiatan_id: 10, nama: "Rekan Dosen", nama_normal: "rekan dosen", peran: "ketua", dosen_id: 9 },
          { kegiatan_id: 10, nama: "Orang Baru", nama_normal: "orang baru", peran: "anggota", dosen_id: null },
        ],
      });
    });

    it("dosen terdaftar lain yang dikeluarkan dari tim tidak ikut terhapus, tetapi ketua turun menjadi anggota", async () => {
      state.byId = existing("sinta", [
        anggota("dosen lain", "ketua", 3),
        anggota("dosen penguji", "anggota", DOSEN_ID, "DOSEN PENGUJI"),
        anggota("orang lama", "anggota", null),
      ]);

      await patch({ tim: "Dosen Penguji; Rekan Dosen" });

      for (const [arg] of mocks.db.kegiatanAnggota.deleteMany.mock.calls) {
        expect(arg.where.nama_normal.in).not.toContain("dosen lain");
      }
      expect(mocks.db.kegiatanAnggota.updateMany).toHaveBeenCalledWith({
        where: { kegiatan_id: 10, nama_normal: { in: ["dosen lain"] } },
        data: { peran: "anggota" },
      });
    });

    it("mengubah tim pada kegiatan sinta juga menjadikannya manual", async () => {
      await patch({ tim: "Dosen Penguji; Rekan Dosen" });
      expect(mocks.db.kegiatan.update.mock.calls[0][0].data.sumber).toBe("manual");
    });

    it("semua perubahan berjalan dalam satu transaksi", async () => {
      await patch({ judul: "Judul Baru Kegiatan", tim: "Dosen Penguji; Rekan Dosen" });
      expect(mocks.db.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  it("galat P2002 saat menyimpan: 409, P2025: 404, lainnya: 500", async () => {
    mocks.db.$transaction.mockRejectedValueOnce(galatPrisma("P2002"));
    expect((await patch({ skema: "A B" })).status).toBe(409);
    mocks.db.$transaction.mockRejectedValueOnce(galatPrisma("P2025"));
    expect((await patch({ skema: "A B" })).status).toBe(404);
    mocks.db.$transaction.mockRejectedValueOnce(new Error("koneksi putus"));
    const res = await patch({ skema: "A B" });
    expect(res.status).toBe(500);
    expect(JSON.stringify(await baca(res))).not.toContain("koneksi putus");
  });
});

describe("DELETE /api/tridarma/kegiatan/[id]", () => {
  const ada = (anggotaAda: { dosen_id: number | null }[]) => ({ id: 10, judul: "Judul Kegiatan Uji", anggota: anggotaAda });

  it("hanya tertaut ke pengguna: baris anggotanya dihapus lalu kegiatan ikut dihapus", async () => {
    state.byId = ada([{ dosen_id: DOSEN_ID }, { dosen_id: null }]);
    mocks.db.kegiatanAnggota.count.mockResolvedValue(0);

    const res = await hapus();
    expect(res.status).toBe(200);
    expect(await baca(res)).toEqual({
      message: "Kegiatan berhasil dihapus.",
      data: { id: 10, judul: "Judul Kegiatan Uji", data_dihapus: true },
    });
    expect(mocks.db.kegiatanAnggota.deleteMany).toHaveBeenCalledWith({ where: { kegiatan_id: 10, dosen_id: DOSEN_ID } });
    expect(mocks.db.kegiatanAnggota.count).toHaveBeenCalledWith({ where: { kegiatan_id: 10, dosen_id: { not: null } } });
    expect(mocks.db.kegiatan.delete).toHaveBeenCalledWith({ where: { id: 10 } });
  });

  it("juga tertaut ke dosen lain: hanya tautan pengguna yang dilepas, kegiatan tetap ada", async () => {
    state.byId = ada([{ dosen_id: DOSEN_ID }, { dosen_id: 3 }]);
    mocks.db.kegiatanAnggota.count.mockResolvedValue(1);

    const res = await hapus();
    expect(res.status).toBe(200);
    expect(await baca(res)).toEqual({
      message: "Tautan kegiatan dari akun Anda berhasil dihapus.",
      data: { id: 10, judul: "Judul Kegiatan Uji", data_dihapus: false },
    });
    expect(mocks.db.kegiatanAnggota.deleteMany).toHaveBeenCalledWith({ where: { kegiatan_id: 10, dosen_id: DOSEN_ID } });
    expect(mocks.db.kegiatan.delete).not.toHaveBeenCalled();
  });

  it("peserta tanpa dosen_id tidak dihitung: kegiatan dihapus walau masih ada nama luar", async () => {
    state.byId = ada([{ dosen_id: DOSEN_ID }, { dosen_id: null }, { dosen_id: null }]);
    mocks.db.kegiatanAnggota.count.mockResolvedValue(0);
    expect((await baca(await hapus())).data).toMatchObject({ data_dihapus: true });
  });

  it("pelepasan dan penghapusan berjalan dalam satu transaksi", async () => {
    state.byId = ada([{ dosen_id: DOSEN_ID }]);
    await hapus();
    expect(mocks.db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("mencatat log: modul 7, aksi hapus, objek kegiatan", async () => {
    state.byId = ada([{ dosen_id: DOSEN_ID }]);
    await hapus();
    expect(mocks.catatLog).toHaveBeenCalledWith({
      userId: USER_ID,
      userNama: "Pengguna Uji",
      modul: "7",
      aksi: "hapus",
      objek: "kegiatan",
      detail: "Judul Kegiatan Uji",
    });
  });

  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])("403 untuk %s bila tidak tertaut ke dirinya", async (peran) => {
    mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: DOSEN_ID });
    state.byId = ada([{ dosen_id: 3 }, { dosen_id: null }]);
    const res = await hapus();
    expect(res.status).toBe(403);
    expect(mocks.db.kegiatanAnggota.deleteMany).not.toHaveBeenCalled();
    expect(mocks.db.kegiatan.delete).not.toHaveBeenCalled();
    expect(mocks.catatLog).not.toHaveBeenCalled();
  });

  it("404 bila tidak ada, 400 untuk id tidak valid", async () => {
    state.byId = null;
    expect((await hapus()).status).toBe(404);
    expect((await hapus("abc")).status).toBe(400);
  });

  it("galat P2025 saat menghapus: 404, lainnya: 500", async () => {
    state.byId = ada([{ dosen_id: DOSEN_ID }]);
    mocks.db.$transaction.mockRejectedValueOnce(galatPrisma("P2025"));
    expect((await hapus()).status).toBe(404);
    mocks.db.$transaction.mockRejectedValueOnce(new Error("koneksi putus"));
    expect((await hapus()).status).toBe(500);
  });
});
