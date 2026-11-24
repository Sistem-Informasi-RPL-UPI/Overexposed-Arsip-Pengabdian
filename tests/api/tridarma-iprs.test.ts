import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, jsonRequest, sesi, USER_ID } from "../helpers/fixtures";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  catatLog: vi.fn(),
  db: {
    dosen: {
      findUnique: vi.fn(),
    },
    iprs: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    iprsDosen: {
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
import { DELETE, PATCH } from "@/app/api/tridarma/iprs/[id]/route";
import { POST } from "@/app/api/tridarma/iprs/route";
import { kunciIprs } from "@/lib/kunci";
import { STATUS_IPRS_MANUAL } from "@/lib/tridarma";

const URL_IPRS = "http://localhost/api/tridarma/iprs";
const URL_IPRS_ID = "http://localhost/api/tridarma/iprs/12";

const BODY_VALID = {
  judul: "Aplikasi Pengelolaan Arsip Digital",
  jenis: "Hak Cipta",
  tahun: 2025,
  nomor_permohonan: "EC00202512345",
  pemegang: "Universitas Pendidikan Indonesia",
  inventor: "Dosen A; Dosen B",
};

const KUNCI_VALID = kunciIprs(BODY_VALID.nomor_permohonan, BODY_VALID.judul, BODY_VALID.tahun);

const IPRS_TERSIMPAN = {
  id: 12,
  kunci: KUNCI_VALID,
  judul: BODY_VALID.judul,
  jenis: BODY_VALID.jenis,
  tahun: BODY_VALID.tahun,
  nomor_permohonan: BODY_VALID.nomor_permohonan,
  status: STATUS_IPRS_MANUAL,
  pemegang: BODY_VALID.pemegang,
  inventor: BODY_VALID.inventor,
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

    expect((await POST(jsonRequest(URL_IPRS, "POST", BODY_VALID))).status).toBe(401);
    expect((await PATCH(jsonRequest(URL_IPRS_ID, "PATCH", { judul: "Baru" }), ctx("12"))).status).toBe(401);
    expect((await DELETE(jsonRequest(URL_IPRS_ID, "DELETE"), ctx("12"))).status).toBe(401);
  });

  it.each(["Mahasiswa", "Umum"])("403 untuk peran %s pada POST, PATCH, dan DELETE", async (peran) => {
    mocks.getSession.mockResolvedValue(sesi(peran));

    expect((await POST(jsonRequest(URL_IPRS, "POST", BODY_VALID))).status).toBe(403);
    expect((await PATCH(jsonRequest(URL_IPRS_ID, "PATCH", { judul: "Baru" }), ctx("12"))).status).toBe(403);
    expect((await DELETE(jsonRequest(URL_IPRS_ID, "DELETE"), ctx("12"))).status).toBe(403);
    expect(mocks.db.dosen.findUnique).not.toHaveBeenCalled();
  });

  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])(
    "400 dengan pesan isi sinta_id dulu bila peran %s belum punya baris dosen",
    async (peran) => {
      mocks.getSession.mockResolvedValue(sesi(peran));
      mocks.db.dosen.findUnique.mockResolvedValue(null);

      const res = await POST(jsonRequest(URL_IPRS, "POST", BODY_VALID));
      expect(res.status).toBe(400);
      expect((await baca(res)).message).toContain("sinta_id");
    },
  );
});

describe("POST /api/tridarma/iprs", () => {
  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])(
    "201 menambah IPRS manual oleh %s dengan status selalu Diterima walau body mengirim status lain",
    async (peran) => {
      mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: 7 });
      mocks.db.iprs.findUnique.mockResolvedValue(null);
      mocks.db.iprs.create.mockResolvedValue(IPRS_TERSIMPAN);

      const res = await POST(
        jsonRequest(URL_IPRS, "POST", { ...BODY_VALID, status: "Pending" }),
      );
      expect(res.status).toBe(201);

      expect(mocks.db.iprs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kunci: KUNCI_VALID,
            judul: BODY_VALID.judul,
            jenis: BODY_VALID.jenis,
            tahun: 2025,
            status: "Diterima",
            sumber: "manual",
            iprs_dosen: { create: { dosen_id: 7 } },
          }),
        }),
      );
      expect(mocks.catatLog).toHaveBeenCalledWith({
        userId: USER_ID,
        userNama: "Pengguna Uji",
        modul: "7",
        aksi: "tambah",
        objek: "iprs",
        detail: BODY_VALID.judul,
      });
    },
  );

  it("200 menautkan otomatis bila duplikat dengan IPRS sumber=manual yang belum tertaut ke pengguna", async () => {
    mocks.db.iprs.findUnique.mockResolvedValue({
      id: 12,
      judul: "IPRS Eksisting",
      sumber: "manual",
      iprs_dosen: [],
    });
    mocks.db.iprsDosen.create.mockResolvedValue({ iprs_id: 12, dosen_id: 7 });

    const res = await POST(jsonRequest(URL_IPRS, "POST", BODY_VALID));
    expect(res.status).toBe(200);
    expect(await baca(res)).toEqual({
      message: "IPRS ini sudah ada dan sudah dihubungkan ke akunmu.",
      data: {
        ditautkan: true,
        id: 12,
        judul: "IPRS Eksisting",
      },
    });
    expect(mocks.db.iprsDosen.create).toHaveBeenCalledWith({
      data: { iprs_id: 12, dosen_id: 7 },
    });
    expect(mocks.db.iprs.create).not.toHaveBeenCalled();
    expect(mocks.db.iprs.update).not.toHaveBeenCalled();
    expect(mocks.catatLog).toHaveBeenCalledWith(
      expect.objectContaining({ modul: "7", aksi: "tambah", objek: "iprs", detail: "IPRS Eksisting" }),
    );
  });

  it("409 menolak duplikat dengan IPRS sumber=sinta", async () => {
    mocks.db.iprs.findUnique.mockResolvedValue({
      id: 12,
      judul: "IPRS SINTA",
      sumber: "sinta",
      iprs_dosen: [],
    });

    const res = await POST(jsonRequest(URL_IPRS, "POST", BODY_VALID));
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({ message: "IPRS ini sudah ada di data." });
    expect(mocks.db.iprsDosen.create).not.toHaveBeenCalled();
    expect(mocks.catatLog).not.toHaveBeenCalled();
  });

  it("409 menolak duplikat bila pengguna sudah tertaut ke IPRS manual tersebut", async () => {
    mocks.db.iprs.findUnique.mockResolvedValue({
      id: 12,
      judul: "IPRS Manual",
      sumber: "manual",
      iprs_dosen: [{ dosen_id: 7 }],
    });

    const res = await POST(jsonRequest(URL_IPRS, "POST", BODY_VALID));
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({ message: "IPRS ini sudah ada di data." });
    expect(mocks.db.iprsDosen.create).not.toHaveBeenCalled();
  });

  it("409 saat race condition P2002 pada create", async () => {
    mocks.db.iprs.findUnique.mockResolvedValue(null);
    mocks.db.iprs.create.mockRejectedValue(galatPrisma("P2002"));

    const res = await POST(jsonRequest(URL_IPRS, "POST", BODY_VALID));
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({ message: "IPRS ini sudah ada di data." });
  });

  it("400 bila JSON rusak atau validasi field gagal", async () => {
    expect((await POST(jsonRequest(URL_IPRS, "POST", "{rusak"))).status).toBe(400);
    expect((await POST(jsonRequest(URL_IPRS, "POST", { judul: "Tanpa Jenis", tahun: 2025 }))).status).toBe(400);
  });
});

describe("PATCH /api/tridarma/iprs/[id]", () => {
  it("400 bila ID tidak valid atau body hanya mengirim status", async () => {
    expect((await PATCH(jsonRequest(URL_IPRS_ID, "PATCH", { judul: "Baru" }), ctx("abc"))).status).toBe(400);
    expect((await PATCH(jsonRequest(URL_IPRS_ID, "PATCH", { status: "Ditolak" }), ctx("12"))).status).toBe(400);
  });

  it("404 bila IPRS tidak ditemukan", async () => {
    mocks.db.iprs.findUnique.mockResolvedValue(null);
    const res = await PATCH(jsonRequest(URL_IPRS_ID, "PATCH", { judul: "Judul Baru" }), ctx("12"));
    expect(res.status).toBe(404);
  });

  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])(
    "403 untuk %s bila IPRS tidak tertaut ke dosen miliknya",
    async (peran) => {
      mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: 7 });
      mocks.db.iprs.findUnique.mockResolvedValue({
        id: 12,
        kunci: KUNCI_VALID,
        judul: "IPRS Orang Lain",
        tahun: 2024,
        nomor_permohonan: null,
        sumber: "manual",
        iprs_dosen: [{ dosen_id: 99 }],
      });

      const res = await PATCH(jsonRequest(URL_IPRS_ID, "PATCH", { judul: "Ubah Judul" }), ctx("12"));
      expect(res.status).toBe(403);
      expect(mocks.db.iprs.update).not.toHaveBeenCalled();
    },
  );

  it("200 mengubah IPRS sumber=sinta menjadi sumber=manual tanpa mengubah status (tetap Granted)", async () => {
    const kunciLama = kunciIprs("P002023001", "Paten SINTA", 2023);
    mocks.db.iprs.findUnique.mockResolvedValueOnce({
      id: 12,
      kunci: kunciLama,
      judul: "Paten SINTA",
      tahun: 2023,
      nomor_permohonan: "P002023001",
      sumber: "sinta",
      iprs_dosen: [{ dosen_id: 7 }],
    });
    mocks.db.iprs.update.mockResolvedValue({
      ...IPRS_TERSIMPAN,
      kunci: kunciLama,
      judul: "Paten SINTA",
      tahun: 2023,
      nomor_permohonan: "P002023001",
      pemegang: "UPI Bandung",
      status: "Granted",
      sumber: "manual",
    });

    const res = await PATCH(
      jsonRequest(URL_IPRS_ID, "PATCH", { pemegang: "UPI Bandung", status: "Ditolak" }),
      ctx("12"),
    );
    expect(res.status).toBe(200);
    const body = (await baca(res)) as { data: { status: string; sumber: string } };
    expect(body.data.status).toBe("Granted");
    expect(body.data.sumber).toBe("manual");

    const updateArgs = mocks.db.iprs.update.mock.calls[0][0];
    expect(updateArgs.data).toEqual({
      pemegang: "UPI Bandung",
      kunci: kunciLama,
      sumber: "manual",
    });
    expect(updateArgs.data).not.toHaveProperty("status");
    expect(mocks.catatLog).toHaveBeenCalledWith({
      userId: USER_ID,
      userNama: "Pengguna Uji",
      modul: "7",
      aksi: "ubah",
      objek: "iprs",
      detail: "Paten SINTA",
    });
  });

  it("409 bila perubahan membuat kunci bentrok dengan IPRS lain", async () => {
    mocks.db.iprs.findUnique
      .mockResolvedValueOnce({
        id: 12,
        kunci: kunciIprs("EC001", "IPRS Satu", 2024),
        judul: "IPRS Satu",
        tahun: 2024,
        nomor_permohonan: "EC001",
        sumber: "manual",
        iprs_dosen: [{ dosen_id: 7 }],
      })
      .mockResolvedValueOnce({ id: 25 });

    const res = await PATCH(
      jsonRequest(URL_IPRS_ID, "PATCH", { nomor_permohonan: "EC002" }),
      ctx("12"),
    );
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({ message: "IPRS ini sudah ada di data." });
    expect(mocks.db.iprs.update).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/tridarma/iprs/[id]", () => {
  it("404 bila IPRS tidak ditemukan", async () => {
    mocks.db.iprs.findUnique.mockResolvedValue(null);
    const res = await DELETE(jsonRequest(URL_IPRS_ID, "DELETE"), ctx("12"));
    expect(res.status).toBe(404);
  });

  it.each(["Dosen", "Kaprodi", "Staff_Kaprodi", "Admin"])(
    "403 untuk %s bila IPRS tidak tertaut ke dosen miliknya",
    async (peran) => {
      mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: 7 });
      mocks.db.iprs.findUnique.mockResolvedValue({
        id: 12,
        judul: "IPRS Orang Lain",
        iprs_dosen: [{ dosen_id: 99 }],
      });

      const res = await DELETE(jsonRequest(URL_IPRS_ID, "DELETE"), ctx("12"));
      expect(res.status).toBe(403);
      expect(mocks.db.$transaction).not.toHaveBeenCalled();
    },
  );

  it("200 hanya melepas tautan pengguna bila masih ada dosen lain yang tertaut (sinta maupun manual)", async () => {
    mocks.db.iprs.findUnique.mockResolvedValue({
      id: 12,
      judul: "IPRS Bersama",
      iprs_dosen: [{ dosen_id: 7 }, { dosen_id: 8 }],
    });
    mocks.db.iprsDosen.delete.mockResolvedValue({ iprs_id: 12, dosen_id: 7 });
    mocks.db.iprsDosen.count.mockResolvedValue(1);

    const res = await DELETE(jsonRequest(URL_IPRS_ID, "DELETE"), ctx("12"));
    expect(res.status).toBe(200);
    expect(await baca(res)).toEqual({
      message: "Tautan IPRS dari akun Anda berhasil dihapus.",
      data: { id: 12, judul: "IPRS Bersama", data_dihapus: false },
    });
    expect(mocks.db.iprsDosen.delete).toHaveBeenCalledWith({
      where: { iprs_id_dosen_id: { iprs_id: 12, dosen_id: 7 } },
    });
    expect(mocks.db.iprs.delete).not.toHaveBeenCalled();
    expect(mocks.catatLog).toHaveBeenCalledWith({
      userId: USER_ID,
      userNama: "Pengguna Uji",
      modul: "7",
      aksi: "hapus",
      objek: "iprs",
      detail: "IPRS Bersama",
    });
  });

  it("200 menghapus baris IPRS juga bila hanya tertaut ke pengguna", async () => {
    mocks.db.iprs.findUnique.mockResolvedValue({
      id: 12,
      judul: "IPRS Sendiri",
      iprs_dosen: [{ dosen_id: 7 }],
    });
    mocks.db.iprsDosen.delete.mockResolvedValue({ iprs_id: 12, dosen_id: 7 });
    mocks.db.iprsDosen.count.mockResolvedValue(0);
    mocks.db.iprs.delete.mockResolvedValue({ id: 12 });

    const res = await DELETE(jsonRequest(URL_IPRS_ID, "DELETE"), ctx("12"));
    expect(res.status).toBe(200);
    expect(await baca(res)).toEqual({
      message: "IPRS berhasil dihapus.",
      data: { id: 12, judul: "IPRS Sendiri", data_dihapus: true },
    });
    expect(mocks.db.iprs.delete).toHaveBeenCalledWith({ where: { id: 12 } });
    expect(mocks.catatLog).toHaveBeenCalledWith({
      userId: USER_ID,
      userNama: "Pengguna Uji",
      modul: "7",
      aksi: "hapus",
      objek: "iprs",
      detail: "IPRS Sendiri",
    });
  });
});
