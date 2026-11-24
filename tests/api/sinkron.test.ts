import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jsonRequest, sesi, USER_ID } from "../helpers/fixtures";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  catatLog: vi.fn(),
  db: { dosen: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() } },
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/log-aktivitas", () => ({ catatLog: mocks.catatLog }));

import { POST as sinkronSendiri } from "@/app/api/dosen/sinkron/route";
import { POST as sinkronStaff } from "@/app/api/staff-kaprodi/sinkron/route";

const CRAWLER_URL = "https://crawler.example.test";
const KUNCI = "kunci-rahasia-uji-12345";
const HARI = 24 * 60 * 60 * 1000;
const lalu = (ms: number) => new Date(Date.now() - ms);

type Baris = { id: number; sinta_id: string | null; sync_status: string | null; last_synced_at: Date | null };
const dosen = (id: number, status: string | null = null, terakhir: Date | null = null): Baris => ({
  id,
  sinta_id: String(1000 + id),
  sync_status: status,
  last_synced_at: terakhir,
});

const fetchMock = vi.fn();

function layananBalas(status: number, body: unknown = {}) {
  fetchMock.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}
const diterima = (diproses: string[], dilewati: string[] = []) =>
  layananBalas(202, { message: "Sinkron dimulai", data: { diproses, dilewati } });

const panggilSendiri = () => sinkronSendiri();
const panggilStaff = (body?: unknown) => sinkronStaff(jsonRequest("http://localhost/api/staff-kaprodi/sinkron", "POST", body));
const staffTanpaBody = () => sinkronStaff(new NextRequest("http://localhost/api/staff-kaprodi/sinkron", { method: "POST" }));

function bodyKeCrawler() {
  return JSON.parse(fetchMock.mock.calls[0][1].body as string);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CRAWLER_URL", CRAWLER_URL);
  vi.stubEnv("INTERNAL_KEY", KUNCI);
  mocks.getSession.mockResolvedValue(sesi("Dosen"));
  mocks.db.dosen.findUnique.mockResolvedValue(dosen(1));
  mocks.db.dosen.findMany.mockResolvedValue([dosen(1), dosen(2)]);
  mocks.db.dosen.updateMany.mockResolvedValue({ count: 1 });
  diterima(["1001"]);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

async function bacaDan(res: Response) {
  const teks = await res.text();
  // INTERNAL_KEY tidak pernah ikut ke klien, apa pun hasilnya.
  expect(teks).not.toContain(KUNCI);
  return JSON.parse(teks);
}

describe("POST /api/dosen/sinkron (sinkron diri sendiri)", () => {
  it("401 tanpa sesi", async () => {
    mocks.getSession.mockResolvedValue(null);
    const res = await panggilSendiri();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: "Silakan login terlebih dahulu." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([["Mahasiswa"], ["Umum"]])("403 untuk peran %s", async (peran) => {
    mocks.getSession.mockResolvedValue(sesi(peran));
    const res = await panggilSendiri();
    expect(res.status).toBe(403);
    expect(mocks.db.dosen.findUnique).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([["Dosen"], ["Kaprodi"], ["Staff_Kaprodi"], ["Admin"]])("202 untuk peran %s yang sudah mengisi sinta_id", async (peran) => {
    mocks.getSession.mockResolvedValue(sesi(peran));
    const res = await panggilSendiri();
    expect(res.status).toBe(202);
  });

  it("400 bila baris dosen belum ada", async () => {
    mocks.db.dosen.findUnique.mockResolvedValue(null);
    const res = await panggilSendiri();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Isi sinta_id dulu sebelum menjalankan sinkron." });
    expect(mocks.db.dosen.updateMany).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400 bila baris dosen ada tetapi sinta_id kosong", async () => {
    mocks.db.dosen.findUnique.mockResolvedValue({ ...dosen(1), sinta_id: null });
    expect((await panggilSendiri()).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sinta_id diambil dari baris dosen milik sub sesi, bukan dari klien", async () => {
    await panggilSendiri();
    expect(mocks.db.dosen.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { user_id: USER_ID } }));
    expect(bodyKeCrawler()).toMatchObject({ sinta_id: "1001", pemicu_id: USER_ID, pemicu_nama: "Pengguna Uji" });
  });

  it("202: memesan IN_PROGRESS lalu memanggil layanan crawler dengan X-Internal-Key", async () => {
    const res = await panggilSendiri();
    const body = await bacaDan(res);

    expect(res.status).toBe(202);
    expect(body).toEqual({ message: "Sinkron dimulai", data: { diproses: ["1001"], dilewati: [] } });

    const update = mocks.db.dosen.updateMany.mock.calls[0][0];
    expect(update.data).toEqual({ sync_status: "IN_PROGRESS" });
    expect(update.where.id).toEqual({ in: [1] });
    expect(update.where.AND).toBeDefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${CRAWLER_URL}/sync`);
    expect(init.method).toBe("POST");
    expect(init.headers["X-Internal-Key"]).toBe(KUNCI);
  });

  it("mencatat log modul 7, aksi sinkron", async () => {
    await panggilSendiri();
    expect(mocks.catatLog).toHaveBeenCalledTimes(1);
    expect(mocks.catatLog.mock.calls[0][0]).toMatchObject({
      userId: USER_ID,
      userNama: "Pengguna Uji",
      modul: "7",
      aksi: "sinkron",
      objek: "dosen",
    });
    expect(mocks.catatLog.mock.calls[0][0].detail).toContain("sinta_id 1001");
  });

  describe("409 sedang berjalan", () => {
    it("baris sudah IN_PROGRESS: layanan tidak dipanggil", async () => {
      mocks.db.dosen.findUnique.mockResolvedValue(dosen(1, "IN_PROGRESS", lalu(HARI)));
      const res = await panggilSendiri();
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ message: "Sinkron sedang berjalan" });
      expect(mocks.db.dosen.updateMany).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("dosen memicu saat Staff Kaprodi sedang sinkron semua (barisnya sudah IN_PROGRESS)", async () => {
      mocks.getSession.mockResolvedValue(sesi("Dosen"));
      mocks.db.dosen.findUnique.mockResolvedValue(dosen(1, "IN_PROGRESS", null));
      const res = await panggilSendiri();
      expect(res.status).toBe(409);
      expect((await res.json()).message).toBe("Sinkron sedang berjalan");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mocks.catatLog).not.toHaveBeenCalled();
    });

    it("balapan: baris berubah menjadi IN_PROGRESS tepat setelah dibaca (updateMany tidak mengubah apa pun)", async () => {
      mocks.db.dosen.updateMany.mockResolvedValue({ count: 0 });
      const res = await panggilSendiri();
      expect(res.status).toBe(409);
      expect((await res.json()).message).toBe("Sinkron sedang berjalan");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("layanan crawler membalas 409: pesanan dikembalikan ke status lama", async () => {
      mocks.db.dosen.findUnique.mockResolvedValue(dosen(1, "PARTIAL", lalu(HARI)));
      layananBalas(409, { message: "Sinkron sedang berjalan" });

      const res = await panggilSendiri();
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ message: "Sinkron sedang berjalan" });

      const kembali = mocks.db.dosen.updateMany.mock.calls[1][0];
      expect(kembali).toEqual({ where: { id: { in: [1] }, sync_status: "IN_PROGRESS" }, data: { sync_status: "PARTIAL" } });
      expect(mocks.catatLog).not.toHaveBeenCalled();
    });
  });

  describe("aturan 7 hari", () => {
    it("SUCCESS belum 7 hari: dilewati dengan 200, layanan tidak dipanggil, dicatat", async () => {
      const terakhir = lalu(2 * HARI);
      mocks.db.dosen.findUnique.mockResolvedValue(dosen(1, "SUCCESS", terakhir));

      const res = await panggilSendiri();
      const body = await bacaDan(res);

      expect(res.status).toBe(200);
      expect(body.message).toBe("Tidak ada dosen yang perlu disinkron (aturan 7 hari)");
      expect(body.data.diproses).toEqual([]);
      expect(body.data.dilewati).toEqual([
        {
          sinta_id: "1001",
          sync_status: "SUCCESS",
          last_synced_at: terakhir.toISOString(),
          bisa_sinkron_lagi_pada: new Date(terakhir.getTime() + 7 * HARI).toISOString(),
        },
      ]);
      expect(mocks.db.dosen.updateMany).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(mocks.catatLog.mock.calls[0][0].detail).toContain("Dilewati (aturan 7 hari): 1001");
    });

    it.each([["FAILED"], ["PARTIAL"]])("pengecualian: %s boleh diulang sebelum 7 hari", async (status) => {
      mocks.db.dosen.findUnique.mockResolvedValue(dosen(1, status, lalu(HARI)));
      expect((await panggilSendiri()).status).toBe(202);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("SUCCESS lebih dari 7 hari: boleh", async () => {
      mocks.db.dosen.findUnique.mockResolvedValue(dosen(1, "SUCCESS", lalu(8 * HARI)));
      expect((await panggilSendiri()).status).toBe(202);
    });

    it("status kosong (belum pernah sinkron): boleh", async () => {
      mocks.db.dosen.findUnique.mockResolvedValue(dosen(1, null, null));
      expect((await panggilSendiri()).status).toBe(202);
    });
  });

  describe("layanan crawler bermasalah", () => {
    it("tidak terjangkau: 503 dan pesanan dikembalikan", async () => {
      mocks.db.dosen.findUnique.mockResolvedValue(dosen(1, "FAILED", lalu(HARI)));
      fetchMock.mockRejectedValue(new Error("fetch failed"));

      const res = await panggilSendiri();
      expect(res.status).toBe(503);
      expect(await bacaDan(res)).toEqual({ message: "Layanan crawler belum bisa dihubungi. Coba lagi sebentar." });
      expect(mocks.db.dosen.updateMany.mock.calls[1][0].data).toEqual({ sync_status: "FAILED" });
    });

    it("kunci ditolak (401) tidak membocorkan detail dan mengembalikan pesanan", async () => {
      layananBalas(401, { message: "Unauthorized" });
      const res = await panggilSendiri();
      expect(res.status).toBe(503);
      await bacaDan(res);
      expect(mocks.db.dosen.updateMany).toHaveBeenCalledTimes(2);
    });

    it("layanan membalas 5xx: 503", async () => {
      layananBalas(500, {});
      expect((await panggilSendiri()).status).toBe(503);
    });

    it("layanan membalas 404: 404 dan pesanan dikembalikan", async () => {
      layananBalas(404, { message: "sinta_id belum terdaftar" });
      const res = await panggilSendiri();
      expect(res.status).toBe(404);
      expect(mocks.db.dosen.updateMany).toHaveBeenCalledTimes(2);
    });

    it("CRAWLER_URL atau INTERNAL_KEY kosong: 500 tanpa menyentuh database", async () => {
      vi.stubEnv("INTERNAL_KEY", "");
      const res = await panggilSendiri();
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ message: "Layanan crawler belum dikonfigurasi di server." });
      expect(mocks.db.dosen.updateMany).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("galat database: 500 tanpa detail", async () => {
      mocks.db.dosen.findUnique.mockRejectedValue(new Error("koneksi putus"));
      const res = await panggilSendiri();
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ message: "Gagal memulai sinkron." });
    });
  });
});

describe("POST /api/staff-kaprodi/sinkron", () => {
  beforeEach(() => {
    mocks.getSession.mockResolvedValue(sesi("Staff_Kaprodi"));
    mocks.db.dosen.updateMany.mockResolvedValue({ count: 2 });
    diterima(["1001", "1002"]);
  });

  it("401 tanpa sesi", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await panggilStaff({})).status).toBe(401);
  });

  it.each([["Dosen"], ["Kaprodi"], ["Mahasiswa"], ["Umum"]])("403 untuk peran %s", async (peran) => {
    mocks.getSession.mockResolvedValue(sesi(peran));
    const res = await panggilStaff({});
    expect(res.status).toBe(403);
    expect(mocks.db.dosen.findMany).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([["Staff_Kaprodi"], ["Admin"]])("peran %s boleh", async (peran) => {
    mocks.getSession.mockResolvedValue(sesi(peran));
    expect((await panggilStaff({})).status).toBe(202);
  });

  it("body kosong atau tanpa sinta_id berarti semua dosen, sinta_id tidak dikirim ke layanan", async () => {
    for (const panggil of [() => panggilStaff({}), () => staffTanpaBody(), () => panggilStaff({ sinta_id: "" }), () => panggilStaff({ sinta_id: null })]) {
      fetchMock.mockClear();
      mocks.db.dosen.findMany.mockClear();
      diterima(["1001", "1002"]);

      const res = await panggil();
      expect(res.status).toBe(202);
      expect(mocks.db.dosen.findMany).toHaveBeenCalledTimes(1);
      expect(bodyKeCrawler()).not.toHaveProperty("sinta_id");
      expect(bodyKeCrawler()).toMatchObject({ pemicu_id: USER_ID, pemicu_nama: "Pengguna Uji" });
    }
  });

  it("semua dosen: hanya yang lolos aturan 7 hari dipesan, sisanya dilaporkan dilewati", async () => {
    const terakhir = lalu(HARI);
    mocks.db.dosen.findMany.mockResolvedValue([
      dosen(1, null, null),
      dosen(2, "SUCCESS", terakhir),
      dosen(3, "PARTIAL", lalu(HARI)),
      dosen(4, "SUCCESS", lalu(9 * HARI)),
    ]);
    mocks.db.dosen.updateMany.mockResolvedValue({ count: 3 });
    diterima(["1001", "1003", "1004"]);

    const res = await panggilStaff({});
    const body = await bacaDan(res);

    expect(res.status).toBe(202);
    expect(mocks.db.dosen.updateMany.mock.calls[0][0].where.id).toEqual({ in: [1, 3, 4] });
    expect(body.data.diproses).toEqual(["1001", "1003", "1004"]);
    expect(body.data.dilewati.map((d: { sinta_id: string }) => d.sinta_id)).toEqual(["1002"]);
    expect(mocks.catatLog.mock.calls[0][0].detail).toContain("Target: semua dosen");
  });

  it("satu dosen (pilih): sinta_id dikirim ke layanan", async () => {
    mocks.db.dosen.findUnique.mockResolvedValue(dosen(2));
    mocks.db.dosen.updateMany.mockResolvedValue({ count: 1 });
    diterima(["1002"]);

    const res = await panggilStaff({ sinta_id: " 1002 " });
    expect(res.status).toBe(202);
    expect(mocks.db.dosen.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { sinta_id: "1002" } }));
    expect(bodyKeCrawler()).toMatchObject({ sinta_id: "1002" });
    expect(mocks.catatLog.mock.calls[0][0].detail).toContain("Target: sinta_id 1002");
  });

  it("satu dosen yang tidak terdaftar: 404, Staff Kaprodi tidak membuat baris dosen", async () => {
    mocks.db.dosen.findUnique.mockResolvedValue(null);
    const res = await panggilStaff({ sinta_id: "999" });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ message: "sinta_id belum terdaftar." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([["abc"], ["12 34"], ["1".repeat(21)], [123]])("sinta_id %j tidak valid: 400", async (nilai) => {
    const res = await panggilStaff({ sinta_id: nilai });
    expect(res.status).toBe(400);
    expect(mocks.db.dosen.findMany).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([["{rusak"], ["[]"], ['"teks"']])("body %s ditolak, bukan diam-diam menjadi sinkron semua", async (body) => {
    const res = await panggilStaff(body);
    expect(res.status).toBe(400);
    expect(mocks.db.dosen.findMany).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("aturan 7 hari berlaku untuk Staff Kaprodi, tidak ada opsi paksa", async () => {
    mocks.db.dosen.findUnique.mockResolvedValue(dosen(2, "SUCCESS", lalu(HARI)));
    const res = await panggilStaff({ sinta_id: "1002", paksa: true, force: true });
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.db.dosen.updateMany).not.toHaveBeenCalled();
  });

  it("satu dosen dengan SUCCESS terbaru tetapi FAILED terakhir boleh (pengecualian)", async () => {
    mocks.db.dosen.findUnique.mockResolvedValue(dosen(2, "FAILED", lalu(HARI)));
    mocks.db.dosen.updateMany.mockResolvedValue({ count: 1 });
    diterima(["1002"]);
    expect((await panggilStaff({ sinta_id: "1002" })).status).toBe(202);
  });

  it("semua dosen tetapi sebagian sedang berjalan dan sisanya boleh: tetap diteruskan, layanan yang menentukan", async () => {
    mocks.db.dosen.findMany.mockResolvedValue([dosen(1, "IN_PROGRESS"), dosen(2, null)]);
    mocks.db.dosen.updateMany.mockResolvedValue({ count: 1 });
    diterima(["1002"]);
    expect((await panggilStaff({})).status).toBe(202);
    expect(mocks.db.dosen.updateMany.mock.calls[0][0].where.id).toEqual({ in: [2] });
  });

  it("semua dosen sedang IN_PROGRESS: 409 sedang berjalan", async () => {
    mocks.db.dosen.findMany.mockResolvedValue([dosen(1, "IN_PROGRESS"), dosen(2, "IN_PROGRESS")]);
    const res = await panggilStaff({});
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ message: "Sinkron sedang berjalan" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("layanan crawler membalas 409 (Staff Kaprodi sinkron semua saat dosen lain sudah memicu): pesanan dikembalikan", async () => {
    mocks.db.dosen.findMany.mockResolvedValue([dosen(1, null), dosen(2, "FAILED", lalu(HARI))]);
    layananBalas(409, { message: "Sinkron sedang berjalan" });

    const res = await panggilStaff({});
    expect(res.status).toBe(409);

    const dikembalikan = mocks.db.dosen.updateMany.mock.calls.slice(1).map((c) => c[0]);
    expect(dikembalikan).toContainEqual({ where: { id: { in: [1] }, sync_status: "IN_PROGRESS" }, data: { sync_status: null } });
    expect(dikembalikan).toContainEqual({ where: { id: { in: [2] }, sync_status: "IN_PROGRESS" }, data: { sync_status: "FAILED" } });
  });

  it("belum ada dosen yang terdaftar: 200 tanpa memanggil layanan", async () => {
    mocks.db.dosen.findMany.mockResolvedValue([]);
    const res = await panggilStaff({});
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("INTERNAL_KEY tidak ada di respons sukses maupun galat", async () => {
    await bacaDan(await panggilStaff({}));
    fetchMock.mockRejectedValue(new Error(`gagal membawa ${KUNCI}`));
    await bacaDan(await panggilStaff({}));
  });
});
