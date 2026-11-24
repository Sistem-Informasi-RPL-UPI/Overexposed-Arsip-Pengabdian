import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, jsonRequest, sesi, USER_ID } from "../helpers/fixtures";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  catatLog: vi.fn(),
  db: {
    dosen: {
      findUnique: vi.fn(),
    },
    buku: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    bukuDosen: {
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/log-aktivitas", () => ({ catatLog: mocks.catatLog }));

import { Prisma } from "@/generated/prisma/client";
import { DELETE, PATCH } from "@/app/api/tridarma/buku/[id]/route";
import { POST } from "@/app/api/tridarma/buku/route";
import { kunciBuku } from "@/lib/kunci";

const URL_BUKU = "http://localhost/api/tridarma/buku";
const URL_BUKU_ID = "http://localhost/api/tridarma/buku/10";

const BODY_VALID = {
  judul: "Arsitektur Perangkat Lunak",
  tahun: 2025,
  kategori: "Buku Ajar",
  penulis: "Dosen A; Dosen B",
  penerbit: "UPI Press",
  tempat_terbit: "Bandung",
  isbn: "978-602-1111-22-3",
};

const KUNCI_VALID = kunciBuku(BODY_VALID.isbn, BODY_VALID.judul, BODY_VALID.tahun);

const BUKU_Tersimpan = {
  id: 10,
  kunci: KUNCI_VALID,
  judul: BODY_VALID.judul,
  kategori: BODY_VALID.kategori,
  penulis: BODY_VALID.penulis,
  penerbit: BODY_VALID.penerbit,
  tahun: BODY_VALID.tahun,
  tempat_terbit: BODY_VALID.tempat_terbit,
  isbn: BODY_VALID.isbn,
  sumber: "manual",
  created_at: new Date("2026-11-24T00:00:00.000Z"),
  updated_at: new Date("2026-11-24T00:00:00.000Z"),
};

function galatPrisma(code: string) {
  return new Prisma.PrismaClientKnownRequestError("galat uji", { code, clientVersion: "uji" });
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

    expect((await POST(jsonRequest(URL_BUKU, "POST", BODY_VALID))).status).toBe(401);
    expect((await PATCH(jsonRequest(URL_BUKU_ID, "PATCH", { judul: "Baru" }), ctx("10"))).status).toBe(401);
    expect((await DELETE(jsonRequest(URL_BUKU_ID, "DELETE"), ctx("10"))).status).toBe(401);
  });

  it.each(["Mahasiswa", "Umum"])("403 untuk peran %s pada POST, PATCH, dan DELETE", async (peran) => {
    mocks.getSession.mockResolvedValue(sesi(peran));

    expect((await POST(jsonRequest(URL_BUKU, "POST", BODY_VALID))).status).toBe(403);
    expect((await PATCH(jsonRequest(URL_BUKU_ID, "PATCH", { judul: "Baru" }), ctx("10"))).status).toBe(403);
    expect((await DELETE(jsonRequest(URL_BUKU_ID, "DELETE"), ctx("10"))).status).toBe(403);
    expect(mocks.db.dosen.findUnique).not.toHaveBeenCalled();
  });

  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])(
    "400 dengan pesan isi sinta_id dulu bila peran %s belum punya baris dosen",
    async (peran) => {
      mocks.getSession.mockResolvedValue(sesi(peran));
      mocks.db.dosen.findUnique.mockResolvedValue(null);

      const res = await POST(jsonRequest(URL_BUKU, "POST", BODY_VALID));
      expect(res.status).toBe(400);
      expect((await baca(res)).message).toContain("sinta_id");
    },
  );
});

describe("POST /api/tridarma/buku", () => {
  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])(
    "201 menambah buku manual baru oleh %s, menautkan ke buku_dosen, dan mencatat log",
    async (peran) => {
      mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: 7 });
      mocks.db.buku.findUnique.mockResolvedValue(null);
      mocks.db.buku.create.mockResolvedValue(BUKU_Tersimpan);

      const res = await POST(jsonRequest(URL_BUKU, "POST", BODY_VALID));
      expect(res.status).toBe(201);

      expect(mocks.db.buku.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kunci: KUNCI_VALID,
            judul: BODY_VALID.judul,
            tahun: 2025,
            penulis: "Dosen A; Dosen B",
            sumber: "manual",
            buku_dosen: { create: { dosen_id: 7 } },
          }),
        }),
      );
      expect(mocks.catatLog).toHaveBeenCalledWith({
        userId: USER_ID,
        userNama: "Pengguna Uji",
        modul: "7",
        aksi: "tambah",
        objek: "buku",
        detail: BODY_VALID.judul,
      });
    },
  );

  it("200 menautkan otomatis bila duplikat dengan buku sumber=manual yang belum tertaut ke pengguna", async () => {
    mocks.db.buku.findUnique.mockResolvedValue({
      id: 10,
      judul: "Judul Eksisting",
      sumber: "manual",
      buku_dosen: [],
    });
    mocks.db.bukuDosen.create.mockResolvedValue({ buku_id: 10, dosen_id: 7 });

    const res = await POST(jsonRequest(URL_BUKU, "POST", BODY_VALID));
    expect(res.status).toBe(200);
    expect(await baca(res)).toEqual({
      message: "Buku ini sudah ada dan sudah dihubungkan ke akunmu.",
      data: {
        ditautkan: true,
        id: 10,
        judul: "Judul Eksisting",
      },
    });
    expect(mocks.db.bukuDosen.create).toHaveBeenCalledWith({
      data: { buku_id: 10, dosen_id: 7 },
    });
    expect(mocks.db.buku.create).not.toHaveBeenCalled();
    expect(mocks.db.buku.update).not.toHaveBeenCalled();
    expect(mocks.catatLog).toHaveBeenCalledWith(
      expect.objectContaining({ modul: "7", aksi: "tambah", objek: "buku", detail: "Judul Eksisting" }),
    );
  });

  it("409 menolak duplikat dengan buku sumber=sinta", async () => {
    mocks.db.buku.findUnique.mockResolvedValue({
      id: 10,
      judul: "Buku SINTA",
      sumber: "sinta",
      buku_dosen: [],
    });

    const res = await POST(jsonRequest(URL_BUKU, "POST", BODY_VALID));
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({ message: "Buku ini sudah ada di data." });
    expect(mocks.db.bukuDosen.create).not.toHaveBeenCalled();
    expect(mocks.catatLog).not.toHaveBeenCalled();
  });

  it("409 menolak duplikat bila pengguna sudah tertaut ke buku manual tersebut", async () => {
    mocks.db.buku.findUnique.mockResolvedValue({
      id: 10,
      judul: "Buku Manual",
      sumber: "manual",
      buku_dosen: [{ dosen_id: 7 }],
    });

    const res = await POST(jsonRequest(URL_BUKU, "POST", BODY_VALID));
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({ message: "Buku ini sudah ada di data." });
    expect(mocks.db.bukuDosen.create).not.toHaveBeenCalled();
  });

  it("409 saat race condition P2002 pada create", async () => {
    mocks.db.buku.findUnique.mockResolvedValue(null);
    mocks.db.buku.create.mockRejectedValue(galatPrisma("P2002"));

    const res = await POST(jsonRequest(URL_BUKU, "POST", BODY_VALID));
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({ message: "Buku ini sudah ada di data." });
  });

  it("400 bila JSON rusak atau validasi field gagal", async () => {
    expect((await POST(jsonRequest(URL_BUKU, "POST", "{rusak"))).status).toBe(400);
    expect((await POST(jsonRequest(URL_BUKU, "POST", { judul: "Tanpa Tahun" }))).status).toBe(400);
  });
});

describe("PATCH /api/tridarma/buku/[id]", () => {
  it("400 bila ID tidak valid", async () => {
    const res = await PATCH(jsonRequest(URL_BUKU_ID, "PATCH", { judul: "Baru" }), ctx("abc"));
    expect(res.status).toBe(400);
  });

  it("404 bila buku tidak ditemukan", async () => {
    mocks.db.buku.findUnique.mockResolvedValue(null);
    const res = await PATCH(jsonRequest(URL_BUKU_ID, "PATCH", { judul: "Baru" }), ctx("10"));
    expect(res.status).toBe(404);
  });

  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])(
    "403 untuk %s bila buku tidak tertaut ke dosen miliknya",
    async (peran) => {
      mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: 7 });
      mocks.db.buku.findUnique.mockResolvedValue({
        id: 10,
        kunci: KUNCI_VALID,
        judul: "Buku Orang Lain",
        tahun: 2024,
        isbn: null,
        sumber: "manual",
        buku_dosen: [{ dosen_id: 99 }],
      });

      const res = await PATCH(jsonRequest(URL_BUKU_ID, "PATCH", { judul: "Ubah" }), ctx("10"));
      expect(res.status).toBe(403);
      expect(mocks.db.buku.update).not.toHaveBeenCalled();
    },
  );

  it("200 mengubah buku sumber=sinta menjadi sumber=manual, memperbarui kunci, dan mencatat log", async () => {
    const kunciLama = kunciBuku(null, "Judul SINTA", 2023);
    const kunciBaru = kunciBuku(null, "Judul Revisi", 2023);
    mocks.db.buku.findUnique
      .mockResolvedValueOnce({
        id: 10,
        kunci: kunciLama,
        judul: "Judul SINTA",
        tahun: 2023,
        isbn: null,
        sumber: "sinta",
        buku_dosen: [{ dosen_id: 7 }],
      })
      .mockResolvedValueOnce(null);
    mocks.db.buku.update.mockResolvedValue({
      ...BUKU_Tersimpan,
      kunci: kunciBaru,
      judul: "Judul Revisi",
      tahun: 2023,
      isbn: null,
      sumber: "manual",
    });

    const res = await PATCH(jsonRequest(URL_BUKU_ID, "PATCH", { judul: "Judul Revisi" }), ctx("10"));
    expect(res.status).toBe(200);
    expect(mocks.db.buku.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 10 },
        data: {
          judul: "Judul Revisi",
          kunci: kunciBaru,
          sumber: "manual",
        },
      }),
    );
    expect(mocks.catatLog).toHaveBeenCalledWith({
      userId: USER_ID,
      userNama: "Pengguna Uji",
      modul: "7",
      aksi: "ubah",
      objek: "buku",
      detail: "Judul Revisi",
    });
  });

  it("409 bila perubahan membuat kunci bentrok dengan buku lain", async () => {
    mocks.db.buku.findUnique
      .mockResolvedValueOnce({
        id: 10,
        kunci: kunciBuku(null, "Buku Satu", 2023),
        judul: "Buku Satu",
        tahun: 2023,
        isbn: null,
        sumber: "manual",
        buku_dosen: [{ dosen_id: 7 }],
      })
      .mockResolvedValueOnce({ id: 25 });

    const res = await PATCH(jsonRequest(URL_BUKU_ID, "PATCH", { judul: "Buku Dua" }), ctx("10"));
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({ message: "Buku ini sudah ada di data." });
    expect(mocks.db.buku.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/tridarma/buku/[id]", () => {
  it("404 bila buku tidak ditemukan", async () => {
    mocks.db.buku.findUnique.mockResolvedValue(null);
    const res = await DELETE(jsonRequest(URL_BUKU_ID, "DELETE"), ctx("10"));
    expect(res.status).toBe(404);
  });

  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi"])(
    "403 untuk %s bila buku tidak tertaut ke dosen miliknya",
    async (peran) => {
      mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: 7 });
      mocks.db.buku.findUnique.mockResolvedValue({
        id: 10,
        judul: "Buku Orang Lain",
        buku_dosen: [{ dosen_id: 99 }],
      });

      const res = await DELETE(jsonRequest(URL_BUKU_ID, "DELETE"), ctx("10"));
      expect(res.status).toBe(403);
      expect(mocks.db.$transaction).not.toHaveBeenCalled();
    },
  );

  it("200 hanya menghapus tautan pengguna bila masih ada dosen lain yang tertaut", async () => {
    mocks.db.buku.findUnique.mockResolvedValue({
      id: 10,
      judul: "Buku Bersama",
      buku_dosen: [{ dosen_id: 7 }, { dosen_id: 8 }],
    });
    mocks.db.bukuDosen.delete.mockResolvedValue({ buku_id: 10, dosen_id: 7 });
    mocks.db.bukuDosen.count.mockResolvedValue(1);

    const res = await DELETE(jsonRequest(URL_BUKU_ID, "DELETE"), ctx("10"));
    expect(res.status).toBe(200);
    expect(await baca(res)).toEqual({
      message: "Tautan buku dari akun Anda berhasil dihapus.",
      data: { id: 10, judul: "Buku Bersama", data_dihapus: false },
    });
    expect(mocks.db.bukuDosen.delete).toHaveBeenCalledWith({
      where: { buku_id_dosen_id: { buku_id: 10, dosen_id: 7 } },
    });
    expect(mocks.db.buku.delete).not.toHaveBeenCalled();
    expect(mocks.catatLog).toHaveBeenCalledWith({
      userId: USER_ID,
      userNama: "Pengguna Uji",
      modul: "7",
      aksi: "hapus",
      objek: "buku",
      detail: "Buku Bersama",
    });
  });

  it("200 menghapus baris buku juga bila tidak ada dosen lain yang tersisa (termasuk sumber=sinta)", async () => {
    mocks.db.buku.findUnique.mockResolvedValue({
      id: 10,
      judul: "Buku SINTA Sendiri",
      buku_dosen: [{ dosen_id: 7 }],
    });
    mocks.db.bukuDosen.delete.mockResolvedValue({ buku_id: 10, dosen_id: 7 });
    mocks.db.bukuDosen.count.mockResolvedValue(0);
    mocks.db.buku.delete.mockResolvedValue({ id: 10 });

    const res = await DELETE(jsonRequest(URL_BUKU_ID, "DELETE"), ctx("10"));
    expect(res.status).toBe(200);
    expect(await baca(res)).toEqual({
      message: "Buku berhasil dihapus.",
      data: { id: 10, judul: "Buku SINTA Sendiri", data_dihapus: true },
    });
    expect(mocks.db.buku.delete).toHaveBeenCalledWith({ where: { id: 10 } });
    expect(mocks.catatLog).toHaveBeenCalledWith({
      userId: USER_ID,
      userNama: "Pengguna Uji",
      modul: "7",
      aksi: "hapus",
      objek: "buku",
      detail: "Buku SINTA Sendiri",
    });
  });
});
