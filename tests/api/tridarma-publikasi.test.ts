import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, jsonRequest, sesi, USER_ID } from "../helpers/fixtures";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  catatLog: vi.fn(),
  db: {
    dosen: {
      findUnique: vi.fn(),
    },
    publikasi: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    publikasiDosen: {
      create: vi.fn(),
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
import { DELETE, PATCH } from "@/app/api/tridarma/publikasi/[id]/route";
import { POST } from "@/app/api/tridarma/publikasi/route";
import { kunciPublikasi } from "@/lib/kunci";

const URL_PUBLIKASI = "http://localhost/api/tridarma/publikasi";
const URL_PUBLIKASI_ID = "http://localhost/api/tridarma/publikasi/15";

const BODY_VALID = {
  judul: "Evaluasi Performa Sistem Informasi Akademik Berbasis Cloud",
  tahun: 2025,
  penulis: "Dosen A; Dosen B; Dosen C",
  jurnal: "Jurnal Sistem Informasi",
  link: "https://example.com/jurnal/paper-15",
  jenis: "Jurnal Nasional",
  penerbit: "UPI Press",
  doi: "10.17509/jsi.v5i1.15",
  sitasi: 3,
  kuartil: "Q3",
  akreditasi: "SINTA 2",
};

const KUNCI_VALID = kunciPublikasi(BODY_VALID.judul);

const PUBLIKASI_TERSIMPAN = {
  id: 15,
  judul_hash: KUNCI_VALID,
  judul: BODY_VALID.judul,
  tahun: BODY_VALID.tahun,
  penulis: BODY_VALID.penulis,
  jurnal: BODY_VALID.jurnal,
  sitasi: BODY_VALID.sitasi,
  link: BODY_VALID.link,
  kuartil: BODY_VALID.kuartil,
  jenis: BODY_VALID.jenis,
  penerbit: BODY_VALID.penerbit,
  doi: BODY_VALID.doi,
  akreditasi: BODY_VALID.akreditasi,
  sumber: "manual",
  created_at: new Date("2026-11-25T00:00:00.000Z"),
  updated_at: new Date("2026-11-25T00:00:00.000Z"),
};

function galatPrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError("galat uji", {
    code,
    clientVersion: "uji",
  });
}

async function baca(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSession.mockResolvedValue({ ...sesi("Dosen"), dosen_id: 7 });
  mocks.db.dosen.findUnique.mockResolvedValue({ id: 7 });
  mocks.db.$transaction.mockImplementation(
    async (fn: (tx: typeof mocks.db) => Promise<unknown>) => fn(mocks.db),
  );
});

describe("Hak akses & prasyarat baris dosen", () => {
  it("401 tanpa sesi untuk POST, PATCH, dan DELETE", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await POST(jsonRequest(URL_PUBLIKASI, "POST", BODY_VALID))).status).toBe(401);
    expect(
      (
        await PATCH(
          jsonRequest(URL_PUBLIKASI_ID, "PATCH", { judul: "Judul Baru" }),
          ctx("15"),
        )
      ).status,
    ).toBe(401);
    expect((await DELETE(jsonRequest(URL_PUBLIKASI_ID, "DELETE"), ctx("15"))).status).toBe(
      401,
    );
  });

  it.each(["Mahasiswa", "Umum"])(
    "403 untuk peran %s pada POST, PATCH, dan DELETE",
    async (peran) => {
      mocks.getSession.mockResolvedValue(sesi(peran));

      expect((await POST(jsonRequest(URL_PUBLIKASI, "POST", BODY_VALID))).status).toBe(403);
      expect(
        (
          await PATCH(
            jsonRequest(URL_PUBLIKASI_ID, "PATCH", { judul: "Judul Baru" }),
            ctx("15"),
          )
        ).status,
      ).toBe(403);
      expect((await DELETE(jsonRequest(URL_PUBLIKASI_ID, "DELETE"), ctx("15"))).status).toBe(
        403,
      );
      expect(mocks.db.dosen.findUnique).not.toHaveBeenCalled();
    },
  );

  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])(
    "400 dengan pesan isi sinta_id dulu bila peran %s belum punya baris dosen",
    async (peran) => {
      mocks.getSession.mockResolvedValue(sesi(peran));
      mocks.db.dosen.findUnique.mockResolvedValue(null);

      const res = await POST(jsonRequest(URL_PUBLIKASI, "POST", BODY_VALID));
      expect(res.status).toBe(400);
      expect((await baca(res)).message).toContain("sinta_id");
    },
  );
});

describe("POST /api/tridarma/publikasi", () => {
  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])(
    "201 menambah publikasi manual baru oleh %s, menautkan ke publikasi_dosen (source=manual), dan mencatat log",
    async (peran) => {
      mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: 7 });
      mocks.db.publikasi.findUnique.mockResolvedValue(null);
      mocks.db.publikasi.create.mockResolvedValue(PUBLIKASI_TERSIMPAN);

      const res = await POST(jsonRequest(URL_PUBLIKASI, "POST", BODY_VALID));
      expect(res.status).toBe(201);

      expect(mocks.db.publikasi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            judul_hash: KUNCI_VALID,
            judul: BODY_VALID.judul,
            tahun: 2025,
            penulis: "Dosen A; Dosen B; Dosen C",
            kuartil: "Q3",
            akreditasi: "SINTA 2",
            sumber: "manual",
            publikasi_dosen: {
              create: {
                dosen_id: 7,
                source: "manual",
              },
            },
          }),
        }),
      );
      expect(mocks.catatLog).toHaveBeenCalledWith({
        userId: USER_ID,
        userNama: "Pengguna Uji",
        modul: "7",
        aksi: "tambah",
        objek: "publikasi",
        detail: BODY_VALID.judul,
      });
    },
  );

  it("201 mengizinkan kuartil dan akreditasi sama-sama kosong", async () => {
    mocks.db.publikasi.findUnique.mockResolvedValue(null);
    mocks.db.publikasi.create.mockResolvedValue({
      ...PUBLIKASI_TERSIMPAN,
      kuartil: null,
      akreditasi: null,
      sitasi: 0,
    });

    const res = await POST(
      jsonRequest(URL_PUBLIKASI, "POST", {
        judul: BODY_VALID.judul,
        tahun: 2025,
      }),
    );
    expect(res.status).toBe(201);
    expect(mocks.db.publikasi.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kuartil: null,
          akreditasi: null,
          sitasi: 0,
        }),
      }),
    );
  });

  it("200 menautkan otomatis bila duplikat dengan publikasi sumber=manual milik dosen lain", async () => {
    mocks.db.publikasi.findUnique.mockResolvedValue({
      id: 15,
      judul: "Paper Manual Dosen Lain",
      sumber: "manual",
      publikasi_dosen: [],
    });
    mocks.db.publikasiDosen.create.mockResolvedValue({
      publikasi_id: 15,
      dosen_id: 7,
      source: "manual",
    });

    const res = await POST(jsonRequest(URL_PUBLIKASI, "POST", BODY_VALID));
    expect(res.status).toBe(200);
    expect(await baca(res)).toEqual({
      message: "Paper ini sudah ada dan sudah dihubungkan ke akunmu.",
      data: {
        ditautkan: true,
        id: 15,
        judul: "Paper Manual Dosen Lain",
      },
    });
    expect(mocks.db.publikasiDosen.create).toHaveBeenCalledWith({
      data: {
        publikasi_id: 15,
        dosen_id: 7,
        source: "manual",
      },
    });
    expect(mocks.db.publikasi.create).not.toHaveBeenCalled();
    expect(mocks.db.publikasi.update).not.toHaveBeenCalled();
    expect(mocks.catatLog).toHaveBeenCalledWith(
      expect.objectContaining({
        modul: "7",
        aksi: "tambah",
        objek: "publikasi",
        detail: "Paper Manual Dosen Lain",
      }),
    );
  });

  it("409 menolak duplikat dengan publikasi sumber=sinta", async () => {
    mocks.db.publikasi.findUnique.mockResolvedValue({
      id: 15,
      judul: "Paper SINTA",
      sumber: "sinta",
      publikasi_dosen: [],
    });

    const res = await POST(jsonRequest(URL_PUBLIKASI, "POST", BODY_VALID));
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({
      message: "Paper ini sudah ada di data.",
    });
    expect(mocks.db.publikasiDosen.create).not.toHaveBeenCalled();
    expect(mocks.catatLog).not.toHaveBeenCalled();
  });

  it("409 menolak duplikat bila pengguna sudah tertaut ke publikasi tersebut", async () => {
    mocks.db.publikasi.findUnique.mockResolvedValue({
      id: 15,
      judul: "Paper Manual",
      sumber: "manual",
      publikasi_dosen: [{ dosen_id: 7 }],
    });

    const res = await POST(jsonRequest(URL_PUBLIKASI, "POST", BODY_VALID));
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({
      message: "Paper ini sudah ada di data.",
    });
    expect(mocks.db.publikasiDosen.create).not.toHaveBeenCalled();
  });

  it("409 saat race condition P2002 pada create", async () => {
    mocks.db.publikasi.findUnique.mockResolvedValue(null);
    mocks.db.publikasi.create.mockRejectedValue(galatPrisma("P2002"));

    const res = await POST(jsonRequest(URL_PUBLIKASI, "POST", BODY_VALID));
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({
      message: "Paper ini sudah ada di data.",
    });
  });

  it("400 bila JSON rusak atau validasi field gagal", async () => {
    expect(
      (await POST(jsonRequest(URL_PUBLIKASI, "POST", "{rusak"))).status,
    ).toBe(400);
    expect(
      (
        await POST(
          jsonRequest(URL_PUBLIKASI, "POST", { judul: "Tanpa Tahun" }),
        )
      ).status,
    ).toBe(400);
  });
});

describe("PATCH /api/tridarma/publikasi/[id]", () => {
  it("400 bila ID tidak valid atau body kosong", async () => {
    expect(
      (
        await PATCH(
          jsonRequest(URL_PUBLIKASI_ID, "PATCH", { judul: "Judul Baru" }),
          ctx("abc"),
        )
      ).status,
    ).toBe(400);
    expect(
      (await PATCH(jsonRequest(URL_PUBLIKASI_ID, "PATCH", {}), ctx("15")))
        .status,
    ).toBe(400);
  });

  it("404 bila publikasi tidak ditemukan", async () => {
    mocks.db.publikasi.findUnique.mockResolvedValue(null);
    const res = await PATCH(
      jsonRequest(URL_PUBLIKASI_ID, "PATCH", { judul: "Judul Baru" }),
      ctx("15"),
    );
    expect(res.status).toBe(404);
  });

  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])(
    "403 untuk %s bila publikasi tidak tertaut ke dosen miliknya",
    async (peran) => {
      mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: 7 });
      mocks.db.publikasi.findUnique.mockResolvedValue({
        id: 15,
        judul_hash: KUNCI_VALID,
        judul: "Paper Orang Lain",
        sumber: "manual",
        publikasi_dosen: [{ dosen_id: 99 }],
      });

      const res = await PATCH(
        jsonRequest(URL_PUBLIKASI_ID, "PATCH", { judul: "Ubah Judul" }),
        ctx("15"),
      );
      expect(res.status).toBe(403);
      expect(mocks.db.publikasi.update).not.toHaveBeenCalled();
    },
  );

  it("200 mengubah publikasi sumber=sinta milik sendiri menjadi sumber=manual, memperbarui judul_hash, dan mencatat log", async () => {
    const hashLama = kunciPublikasi("Paper SINTA Lama");
    const hashBaru = kunciPublikasi("Paper SINTA Revisi");
    mocks.db.publikasi.findUnique
      .mockResolvedValueOnce({
        id: 15,
        judul_hash: hashLama,
        judul: "Paper SINTA Lama",
        sumber: "sinta",
        publikasi_dosen: [{ dosen_id: 7 }],
      })
      .mockResolvedValueOnce(null);
    mocks.db.publikasi.update.mockResolvedValue({
      ...PUBLIKASI_TERSIMPAN,
      judul_hash: hashBaru,
      judul: "Paper SINTA Revisi",
      sumber: "manual",
    });

    const res = await PATCH(
      jsonRequest(URL_PUBLIKASI_ID, "PATCH", {
        judul: "Paper SINTA Revisi",
        kuartil: "Q1",
        akreditasi: "SINTA 1",
      }),
      ctx("15"),
    );
    expect(res.status).toBe(200);
    expect(mocks.db.publikasi.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 15 },
        data: {
          judul: "Paper SINTA Revisi",
          kuartil: "Q1",
          akreditasi: "SINTA 1",
          judul_hash: hashBaru,
          sumber: "manual",
        },
      }),
    );
    expect(mocks.catatLog).toHaveBeenCalledWith({
      userId: USER_ID,
      userNama: "Pengguna Uji",
      modul: "7",
      aksi: "ubah",
      objek: "publikasi",
      detail: "Paper SINTA Revisi",
    });
  });

  it("409 bila perubahan judul membuat judul_hash bentrok dengan publikasi lain", async () => {
    mocks.db.publikasi.findUnique
      .mockResolvedValueOnce({
        id: 15,
        judul_hash: kunciPublikasi("Paper Satu"),
        judul: "Paper Satu",
        sumber: "manual",
        publikasi_dosen: [{ dosen_id: 7 }],
      })
      .mockResolvedValueOnce({ id: 42 });

    const res = await PATCH(
      jsonRequest(URL_PUBLIKASI_ID, "PATCH", { judul: "Paper Dua" }),
      ctx("15"),
    );
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({
      message: "Paper ini sudah ada di data.",
    });
    expect(mocks.db.publikasi.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/tridarma/publikasi/[id]", () => {
  it("404 bila publikasi tidak ditemukan", async () => {
    mocks.db.publikasi.findUnique.mockResolvedValue(null);
    const res = await DELETE(
      jsonRequest(URL_PUBLIKASI_ID, "DELETE"),
      ctx("15"),
    );
    expect(res.status).toBe(404);
  });

  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])(
    "403 untuk %s bila publikasi tidak tertaut ke dosen miliknya",
    async (peran) => {
      mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: 7 });
      mocks.db.publikasi.findUnique.mockResolvedValue({
        id: 15,
        judul: "Paper Orang Lain",
        publikasi_dosen: [{ dosen_id: 99 }],
      });

      const res = await DELETE(
        jsonRequest(URL_PUBLIKASI_ID, "DELETE"),
        ctx("15"),
      );
      expect(res.status).toBe(403);
      expect(mocks.db.$transaction).not.toHaveBeenCalled();
    },
  );

  it("200 melepas semua baris publikasi_dosen milik pengguna (semua source) dan mempertahankan paper bila masih ada dosen lain", async () => {
    mocks.db.publikasi.findUnique.mockResolvedValue({
      id: 15,
      judul: "Paper Kolaborasi",
      publikasi_dosen: [
        { dosen_id: 7 },
        { dosen_id: 7 },
        { dosen_id: 8 },
      ],
    });
    mocks.db.publikasiDosen.deleteMany.mockResolvedValue({ count: 2 });
    mocks.db.publikasiDosen.count.mockResolvedValue(1);

    const res = await DELETE(
      jsonRequest(URL_PUBLIKASI_ID, "DELETE"),
      ctx("15"),
    );
    expect(res.status).toBe(200);
    expect(await baca(res)).toEqual({
      message: "Tautan publikasi dari akun Anda berhasil dihapus.",
      data: { id: 15, judul: "Paper Kolaborasi", data_dihapus: false },
    });
    expect(mocks.db.publikasiDosen.deleteMany).toHaveBeenCalledWith({
      where: { publikasi_id: 15, dosen_id: 7 },
    });
    expect(mocks.db.publikasi.delete).not.toHaveBeenCalled();
    expect(mocks.catatLog).toHaveBeenCalledWith({
      userId: USER_ID,
      userNama: "Pengguna Uji",
      modul: "7",
      aksi: "hapus",
      objek: "publikasi",
      detail: "Paper Kolaborasi",
    });
  });

  it("200 menghapus baris publikasi juga bila tidak ada lagi dosen lain yang tertaut (termasuk sumber=sinta)", async () => {
    mocks.db.publikasi.findUnique.mockResolvedValue({
      id: 15,
      judul: "Paper SINTA Sendiri",
      publikasi_dosen: [{ dosen_id: 7 }],
    });
    mocks.db.publikasiDosen.deleteMany.mockResolvedValue({ count: 1 });
    mocks.db.publikasiDosen.count.mockResolvedValue(0);
    mocks.db.publikasi.delete.mockResolvedValue({ id: 15 });

    const res = await DELETE(
      jsonRequest(URL_PUBLIKASI_ID, "DELETE"),
      ctx("15"),
    );
    expect(res.status).toBe(200);
    expect(await baca(res)).toEqual({
      message: "Publikasi berhasil dihapus.",
      data: { id: 15, judul: "Paper SINTA Sendiri", data_dihapus: true },
    });
    expect(mocks.db.publikasiDosen.deleteMany).toHaveBeenCalledWith({
      where: { publikasi_id: 15, dosen_id: 7 },
    });
    expect(mocks.db.publikasi.delete).toHaveBeenCalledWith({
      where: { id: 15 },
    });
    expect(mocks.catatLog).toHaveBeenCalledWith({
      userId: USER_ID,
      userNama: "Pengguna Uji",
      modul: "7",
      aksi: "hapus",
      objek: "publikasi",
      detail: "Paper SINTA Sendiri",
    });
  });
});
