import { beforeEach, describe, expect, it, vi } from "vitest";
import { ctx, jsonRequest, sesi, USER_ID } from "../helpers/fixtures";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  catatLog: vi.fn(),
  db: {
    dosen: {
      findUnique: vi.fn(),
    },
    matkul: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    kelas: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    berkasPengajaran: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/log-aktivitas", () => ({ catatLog: mocks.catatLog }));

import {
  DELETE as deleteBerkas,
  GET as getBerkasDetail,
  PATCH as patchBerkas,
} from "@/app/api/tridarma/pengajaran/berkas_pengajaran/[id]/route";
import {
  GET as getBerkasList,
  POST as postBerkas,
} from "@/app/api/tridarma/pengajaran/berkas_pengajaran/route";
import {
  DELETE as deleteKelas,
  GET as getKelasDetail,
  PATCH as patchKelas,
} from "@/app/api/tridarma/pengajaran/kelas/[id]/route";
import {
  GET as getKelasList,
  POST as postKelas,
} from "@/app/api/tridarma/pengajaran/kelas/route";
import {
  DELETE as deleteMatkul,
  GET as getMatkulDetail,
  PATCH as patchMatkul,
} from "@/app/api/tridarma/pengajaran/matkul/[id]/route";
import {
  GET as getMatkulList,
  POST as postMatkul,
} from "@/app/api/tridarma/pengajaran/matkul/route";

const URL_MATKUL = "http://localhost/api/tridarma/pengajaran/matkul";
const URL_MATKUL_ID = "http://localhost/api/tridarma/pengajaran/matkul/1";
const URL_KELAS = "http://localhost/api/tridarma/pengajaran/kelas";
const URL_KELAS_ID = "http://localhost/api/tridarma/pengajaran/kelas/10";
const URL_BERKAS = "http://localhost/api/tridarma/pengajaran/berkas_pengajaran";
const URL_BERKAS_ID =
  "http://localhost/api/tridarma/pengajaran/berkas_pengajaran/20";

const MATKUL_ROW = {
  id: 1,
  kode: "RPL101",
  nama: "Rekayasa Perangkat Lunak",
  sks: 3,
  _count: { kelas: 0 },
};

const KELAS_ROW = {
  id: 10,
  matkul_id: 1,
  dosen_id: 7,
  tahun_ajaran: "2025/2026",
  semester: "Ganjil",
  created_at: new Date("2026-11-25T00:00:00.000Z"),
  matkul: { id: 1, kode: "RPL101", nama: "Rekayasa Perangkat Lunak", sks: 3 },
  dosen: { id: 7, nama: "Dosen Penguji", sinta_id: "6658552" },
  _count: { berkas: 0 },
};

const BERKAS_ROW = {
  id: 20,
  kelas_id: 10,
  jenis: "Kuis",
  judul: "Kuis 1",
  link: "https://drive.google.com/file/d/kuis-1/view",
  keterangan: null,
  created_at: new Date("2026-11-25T00:00:00.000Z"),
  updated_at: new Date("2026-11-25T00:00:00.000Z"),
  kelas: {
    id: 10,
    matkul_id: 1,
    dosen_id: 7,
    tahun_ajaran: "2025/2026",
    semester: "Ganjil",
    matkul: { id: 1, kode: "RPL101", nama: "Rekayasa Perangkat Lunak" },
  },
};

async function baca(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.getSession.mockResolvedValue({ ...sesi("Dosen"), dosen_id: 7 });
  mocks.db.dosen.findUnique.mockResolvedValue({ id: 7 });
});

describe("Kriteria 4: 401 tanpa sesi serta 403 untuk Mahasiswa dan Umum pada semua endpoint pengajaran", () => {
  it("401 tanpa sesi untuk seluruh endpoint matkul, kelas, dan berkas_pengajaran", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await getMatkulList(jsonRequest(URL_MATKUL, "GET"))).status).toBe(401);
    expect((await getMatkulDetail(jsonRequest(URL_MATKUL_ID, "GET"), ctx("1"))).status).toBe(401);
    expect((await postMatkul(jsonRequest(URL_MATKUL, "POST", { kode: "IF1", nama: "Algoritma", sks: 3 }))).status).toBe(401);
    expect((await patchMatkul(jsonRequest(URL_MATKUL_ID, "PATCH", { sks: 4 }), ctx("1"))).status).toBe(401);
    expect((await deleteMatkul(jsonRequest(URL_MATKUL_ID, "DELETE"), ctx("1"))).status).toBe(401);

    expect((await getKelasList(jsonRequest(URL_KELAS, "GET"))).status).toBe(401);
    expect((await getKelasDetail(jsonRequest(URL_KELAS_ID, "GET"), ctx("10"))).status).toBe(401);
    expect((await postKelas(jsonRequest(URL_KELAS, "POST", { matkul_id: 1, tahun_ajaran: "2025/2026", semester: "Ganjil" }))).status).toBe(401);
    expect((await patchKelas(jsonRequest(URL_KELAS_ID, "PATCH", { semester: "Genap" }), ctx("10"))).status).toBe(401);
    expect((await deleteKelas(jsonRequest(URL_KELAS_ID, "DELETE"), ctx("10"))).status).toBe(401);

    expect((await getBerkasList(jsonRequest(URL_BERKAS, "GET"))).status).toBe(401);
    expect((await getBerkasDetail(jsonRequest(URL_BERKAS_ID, "GET"), ctx("20"))).status).toBe(401);
    expect((await postBerkas(jsonRequest(URL_BERKAS, "POST", { kelas_id: 10, jenis: "RPS", link: "https://drive.google.com/1" }))).status).toBe(401);
    expect((await patchBerkas(jsonRequest(URL_BERKAS_ID, "PATCH", { jenis: "UTS" }), ctx("20"))).status).toBe(401);
    expect((await deleteBerkas(jsonRequest(URL_BERKAS_ID, "DELETE"), ctx("20"))).status).toBe(401);
  });

  it.each(["Mahasiswa", "Umum"])(
    "403 untuk peran %s pada seluruh endpoint baca maupun tulis pengajaran",
    async (peran) => {
      mocks.getSession.mockResolvedValue(sesi(peran));

      expect((await getMatkulList(jsonRequest(URL_MATKUL, "GET"))).status).toBe(403);
      expect((await getMatkulDetail(jsonRequest(URL_MATKUL_ID, "GET"), ctx("1"))).status).toBe(403);
      expect((await postMatkul(jsonRequest(URL_MATKUL, "POST", { kode: "IF1", nama: "Algoritma", sks: 3 }))).status).toBe(403);
      expect((await patchMatkul(jsonRequest(URL_MATKUL_ID, "PATCH", { sks: 4 }), ctx("1"))).status).toBe(403);
      expect((await deleteMatkul(jsonRequest(URL_MATKUL_ID, "DELETE"), ctx("1"))).status).toBe(403);

      expect((await getKelasList(jsonRequest(URL_KELAS, "GET"))).status).toBe(403);
      expect((await getKelasDetail(jsonRequest(URL_KELAS_ID, "GET"), ctx("10"))).status).toBe(403);
      expect((await postKelas(jsonRequest(URL_KELAS, "POST", { matkul_id: 1, tahun_ajaran: "2025/2026", semester: "Ganjil" }))).status).toBe(403);
      expect((await patchKelas(jsonRequest(URL_KELAS_ID, "PATCH", { semester: "Genap" }), ctx("10"))).status).toBe(403);
      expect((await deleteKelas(jsonRequest(URL_KELAS_ID, "DELETE"), ctx("10"))).status).toBe(403);

      expect((await getBerkasList(jsonRequest(URL_BERKAS, "GET"))).status).toBe(403);
      expect((await getBerkasDetail(jsonRequest(URL_BERKAS_ID, "GET"), ctx("20"))).status).toBe(403);
      expect((await postBerkas(jsonRequest(URL_BERKAS, "POST", { kelas_id: 10, jenis: "RPS", link: "https://drive.google.com/1" }))).status).toBe(403);
      expect((await patchBerkas(jsonRequest(URL_BERKAS_ID, "PATCH", { jenis: "UTS" }), ctx("20"))).status).toBe(403);
      expect((await deleteBerkas(jsonRequest(URL_BERKAS_ID, "DELETE"), ctx("20"))).status).toBe(403);
    },
  );
});

describe("Kriteria 3: Pembatasan peran tulis antara Matkul vs Kelas & Berkas", () => {
  it("403 untuk Dosen pada endpoint tulis matkul (POST, PATCH, DELETE), namun 200 pada GET matkul", async () => {
    mocks.getSession.mockResolvedValue({ ...sesi("Dosen"), dosen_id: 7 });
    mocks.db.matkul.findMany.mockResolvedValue([MATKUL_ROW]);

    expect((await getMatkulList(jsonRequest(URL_MATKUL, "GET"))).status).toBe(200);
    expect(
      (
        await postMatkul(
          jsonRequest(URL_MATKUL, "POST", {
            kode: "RPL101",
            nama: "Rekayasa Perangkat Lunak",
            sks: 3,
          }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await patchMatkul(
          jsonRequest(URL_MATKUL_ID, "PATCH", { sks: 4 }),
          ctx("1"),
        )
      ).status,
    ).toBe(403);
    expect(
      (await deleteMatkul(jsonRequest(URL_MATKUL_ID, "DELETE"), ctx("1")))
        .status,
    ).toBe(403);
  });

  it.each(["Kaprodi", "Staff_Kaprodi", "Admin"])(
    "403 untuk %s pada endpoint tulis kelas dan berkas_pengajaran, namun 200 pada GET",
    async (peran) => {
      mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: 7 });
      mocks.db.kelas.findMany.mockResolvedValue([KELAS_ROW]);
      mocks.db.berkasPengajaran.findMany.mockResolvedValue([BERKAS_ROW]);

      expect((await getKelasList(jsonRequest(URL_KELAS, "GET"))).status).toBe(200);
      expect((await getBerkasList(jsonRequest(URL_BERKAS, "GET"))).status).toBe(200);

      expect(
        (
          await postKelas(
            jsonRequest(URL_KELAS, "POST", {
              matkul_id: 1,
              tahun_ajaran: "2025/2026",
              semester: "Ganjil",
            }),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await patchKelas(
            jsonRequest(URL_KELAS_ID, "PATCH", { semester: "Genap" }),
            ctx("10"),
          )
        ).status,
      ).toBe(403);
      expect(
        (await deleteKelas(jsonRequest(URL_KELAS_ID, "DELETE"), ctx("10")))
          .status,
      ).toBe(403);

      expect(
        (
          await postBerkas(
            jsonRequest(URL_BERKAS, "POST", {
              kelas_id: 10,
              jenis: "RPS",
              link: "https://drive.google.com/file/d/rps",
            }),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await patchBerkas(
            jsonRequest(URL_BERKAS_ID, "PATCH", { jenis: "Slide" }),
            ctx("20"),
          )
        ).status,
      ).toBe(403);
      expect(
        (await deleteBerkas(jsonRequest(URL_BERKAS_ID, "DELETE"), ctx("20")))
          .status,
      ).toBe(403);
    },
  );
});

describe("Kriteria 1: CRUD Matkul oleh Kaprodi dan Staff Kaprodi", () => {
  it.each(["Kaprodi", "Staff_Kaprodi", "Admin"])(
    "201 POST, 200 PATCH, dan 200 DELETE matkul oleh %s serta mencatat log modul 7 objek matkul",
    async (peran) => {
      mocks.getSession.mockResolvedValue({ ...sesi(peran), dosen_id: null });
      mocks.db.matkul.findFirst.mockResolvedValue(null);
      mocks.db.matkul.create.mockResolvedValue(MATKUL_ROW);

      const postRes = await postMatkul(
        jsonRequest(URL_MATKUL, "POST", {
          kode: "rpl101",
          nama: "Rekayasa Perangkat Lunak",
          sks: 3,
        }),
      );
      expect(postRes.status).toBe(201);
      expect(mocks.catatLog).toHaveBeenCalledWith({
        userId: USER_ID,
        userNama: "Pengguna Uji",
        modul: "7",
        aksi: "tambah",
        objek: "matkul",
        detail: "RPL101 - Rekayasa Perangkat Lunak",
      });

      mocks.db.matkul.findUnique.mockResolvedValue({ id: 1 });
      mocks.db.matkul.update.mockResolvedValue({ ...MATKUL_ROW, sks: 4 });
      const patchRes = await patchMatkul(
        jsonRequest(URL_MATKUL_ID, "PATCH", { sks: 4 }),
        ctx("1"),
      );
      expect(patchRes.status).toBe(200);

      mocks.db.matkul.findUnique.mockResolvedValue(MATKUL_ROW);
      mocks.db.matkul.delete.mockResolvedValue({ id: 1 });
      const delRes = await deleteMatkul(
        jsonRequest(URL_MATKUL_ID, "DELETE"),
        ctx("1"),
      );
      expect(delRes.status).toBe(200);
    },
  );

  it("409 bila kode matkul duplikat saat POST maupun PATCH", async () => {
    mocks.getSession.mockResolvedValue(sesi("Kaprodi"));
    mocks.db.matkul.findFirst.mockResolvedValue({ id: 99 });

    const postRes = await postMatkul(
      jsonRequest(URL_MATKUL, "POST", {
        kode: "RPL101",
        nama: "Rekayasa Perangkat Lunak",
        sks: 3,
      }),
    );
    expect(postRes.status).toBe(409);
    expect(await baca(postRes)).toEqual({
      message: "Kode mata kuliah sudah dipakai.",
    });

    mocks.db.matkul.findUnique.mockResolvedValue({ id: 1 });
    const patchRes = await patchMatkul(
      jsonRequest(URL_MATKUL_ID, "PATCH", { kode: "RPL101" }),
      ctx("1"),
    );
    expect(patchRes.status).toBe(409);
  });

  it("409 bila menghapus matkul yang masih dipakai oleh kelas", async () => {
    mocks.getSession.mockResolvedValue(sesi("Staff_Kaprodi"));
    mocks.db.matkul.findUnique.mockResolvedValue({
      ...MATKUL_ROW,
      _count: { kelas: 2 },
    });

    const res = await deleteMatkul(
      jsonRequest(URL_MATKUL_ID, "DELETE"),
      ctx("1"),
    );
    expect(res.status).toBe(409);
    expect(await baca(res)).toEqual({
      message:
        "Mata kuliah tidak dapat dihapus karena masih digunakan oleh kelas.",
    });
    expect(mocks.db.matkul.delete).not.toHaveBeenCalled();
  });
});

describe("Kriteria 2: CRUD Kelas & Berkas Pengajaran milik sendiri oleh Dosen", () => {
  it("400 minta isi sinta_id dulu bila Dosen belum punya baris dosen", async () => {
    mocks.getSession.mockResolvedValue({ ...sesi("Dosen"), dosen_id: null });
    mocks.db.dosen.findUnique.mockResolvedValue(null);

    const res = await postKelas(
      jsonRequest(URL_KELAS, "POST", {
        matkul_id: 1,
        tahun_ajaran: "2025/2026",
        semester: "Ganjil",
      }),
    );
    expect(res.status).toBe(400);
    expect((await baca(res)).message).toContain("sinta_id");
  });

  it("201 menambah kelas, 409 bila kelas duplikat (matkul_id, dosen_id, tahun_ajaran, semester), 200 PATCH & DELETE milik sendiri", async () => {
    mocks.db.matkul.findUnique.mockResolvedValue({
      id: 1,
      kode: "RPL101",
      nama: "Rekayasa Perangkat Lunak",
    });
    mocks.db.kelas.findUnique.mockResolvedValueOnce(null);
    mocks.db.kelas.create.mockResolvedValue(KELAS_ROW);

    const postRes = await postKelas(
      jsonRequest(URL_KELAS, "POST", {
        matkul_id: 1,
        tahun_ajaran: "2025/2026",
        semester: "Ganjil",
      }),
    );
    expect(postRes.status).toBe(201);
    expect(mocks.catatLog).toHaveBeenCalledWith(
      expect.objectContaining({
        modul: "7",
        aksi: "tambah",
        objek: "kelas",
        detail: "RPL101 (2025/2026 Ganjil)",
      }),
    );

    // Duplikat kelas -> 409
    mocks.db.kelas.findUnique.mockResolvedValueOnce({ id: 10 });
    const dupRes = await postKelas(
      jsonRequest(URL_KELAS, "POST", {
        matkul_id: 1,
        tahun_ajaran: "2025/2026",
        semester: "Ganjil",
      }),
    );
    expect(dupRes.status).toBe(409);
    expect(await baca(dupRes)).toEqual({
      message: "Kelas ini sudah ada di data.",
    });

    // PATCH milik sendiri -> 200
    mocks.db.kelas.findUnique
      .mockResolvedValueOnce({
        id: 10,
        matkul_id: 1,
        dosen_id: 7,
        tahun_ajaran: "2025/2026",
        semester: "Ganjil",
      })
      .mockResolvedValueOnce(null);
    mocks.db.kelas.update.mockResolvedValue({
      ...KELAS_ROW,
      semester: "Genap",
    });

    const patchRes = await patchKelas(
      jsonRequest(URL_KELAS_ID, "PATCH", { semester: "Genap" }),
      ctx("10"),
    );
    expect(patchRes.status).toBe(200);

    // DELETE milik sendiri -> 200
    mocks.db.kelas.findUnique.mockResolvedValueOnce({
      id: 10,
      dosen_id: 7,
      tahun_ajaran: "2025/2026",
      semester: "Genap",
      matkul: { kode: "RPL101" },
    });
    mocks.db.kelas.delete.mockResolvedValue({ id: 10 });
    const delRes = await deleteKelas(
      jsonRequest(URL_KELAS_ID, "DELETE"),
      ctx("10"),
    );
    expect(delRes.status).toBe(200);
  });

  it("403 bila Dosen mencoba melihat, mengubah, atau menghapus kelas milik dosen lain", async () => {
    mocks.db.kelas.findUnique.mockResolvedValue({
      ...KELAS_ROW,
      dosen_id: 99,
      berkas: [],
    });

    expect(
      (await getKelasDetail(jsonRequest(URL_KELAS_ID, "GET"), ctx("10")))
        .status,
    ).toBe(403);
    expect(
      (
        await patchKelas(
          jsonRequest(URL_KELAS_ID, "PATCH", { semester: "Genap" }),
          ctx("10"),
        )
      ).status,
    ).toBe(403);
    expect(
      (await deleteKelas(jsonRequest(URL_KELAS_ID, "DELETE"), ctx("10")))
        .status,
    ).toBe(403);
  });

  it("mengizinkan beberapa berkas dengan jenis sama (misalnya dua Kuis) pada satu kelas, menolak URL tidak valid, dan mencatat log", async () => {
    mocks.db.kelas.findUnique.mockResolvedValue({ id: 10, dosen_id: 7 });
    mocks.db.berkasPengajaran.create
      .mockResolvedValueOnce(BERKAS_ROW)
      .mockResolvedValueOnce({
        ...BERKAS_ROW,
        id: 21,
        judul: "Kuis 2",
        link: "https://drive.google.com/file/d/kuis-2/view",
      });

    const kuis1 = await postBerkas(
      jsonRequest(URL_BERKAS, "POST", {
        kelas_id: 10,
        jenis: "Kuis",
        judul: "Kuis 1",
        link: "https://drive.google.com/file/d/kuis-1/view",
      }),
    );
    const kuis2 = await postBerkas(
      jsonRequest(URL_BERKAS, "POST", {
        kelas_id: 10,
        jenis: "Kuis",
        judul: "Kuis 2",
        link: "https://drive.google.com/file/d/kuis-2/view",
      }),
    );

    expect(kuis1.status).toBe(201);
    expect(kuis2.status).toBe(201);
    expect(mocks.catatLog).toHaveBeenCalledWith(
      expect.objectContaining({
        modul: "7",
        aksi: "tambah",
        objek: "berkas_pengajaran",
      }),
    );

    // URL tidak valid -> 400
    const badUrl = await postBerkas(
      jsonRequest(URL_BERKAS, "POST", {
        kelas_id: 10,
        jenis: "Kuis",
        link: "bukan-url-sama-sekali",
      }),
    );
    expect(badUrl.status).toBe(400);
  });

  it("403 bila Dosen mencoba menambah, mengubah, atau menghapus berkas pada kelas milik dosen lain", async () => {
    mocks.db.kelas.findUnique.mockResolvedValue({ id: 10, dosen_id: 99 });
    expect(
      (
        await postBerkas(
          jsonRequest(URL_BERKAS, "POST", {
            kelas_id: 10,
            jenis: "RPS",
            link: "https://drive.google.com/file/d/rps",
          }),
        )
      ).status,
    ).toBe(403);

    mocks.db.berkasPengajaran.findUnique.mockResolvedValue({
      ...BERKAS_ROW,
      kelas: { ...BERKAS_ROW.kelas, dosen_id: 99 },
    });
    expect(
      (
        await patchBerkas(
          jsonRequest(URL_BERKAS_ID, "PATCH", { judul: "Ubah" }),
          ctx("20"),
        )
      ).status,
    ).toBe(403);
    expect(
      (await deleteBerkas(jsonRequest(URL_BERKAS_ID, "DELETE"), ctx("20")))
        .status,
    ).toBe(403);
  });
});
