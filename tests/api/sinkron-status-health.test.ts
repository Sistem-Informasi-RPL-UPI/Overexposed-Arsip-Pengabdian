import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sesi, USER_ID } from "../helpers/fixtures";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  db: { dosen: { findUnique: vi.fn(), findMany: vi.fn() } },
}));

vi.mock("@/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));

import { GET as health } from "@/app/api/crawler/health/route";
import { GET as status } from "@/app/api/dosen/sinkron/status/route";

const CRAWLER_URL = "https://crawler.example.test";
const KUNCI = "kunci-rahasia-uji-12345";
const HARI = 24 * 60 * 60 * 1000;
const lalu = (ms: number) => new Date(Date.now() - ms);
const fetchMock = vi.fn();

const baris = (id: number, sync_status: string | null, last_synced_at: Date | null) => ({
  id,
  sinta_id: String(1000 + id),
  sync_status,
  last_synced_at,
});

const panggilStatus = (query = "") => status(new NextRequest(`http://localhost/api/dosen/sinkron/status${query}`));

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CRAWLER_URL", CRAWLER_URL);
  vi.stubEnv("INTERNAL_KEY", KUNCI);
  mocks.getSession.mockResolvedValue(sesi("Dosen"));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/dosen/sinkron/status", () => {
  it("401 tanpa sesi", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await panggilStatus()).status).toBe(401);
  });

  it.each([["Mahasiswa"], ["Umum"]])("403 untuk peran %s", async (peran) => {
    mocks.getSession.mockResolvedValue(sesi(peran));
    expect((await panggilStatus()).status).toBe(403);
    expect(mocks.db.dosen.findUnique).not.toHaveBeenCalled();
  });

  it("membaca baris dosen milik sub sesi dari database, tanpa memanggil layanan crawler", async () => {
    const terakhir = lalu(2 * HARI);
    mocks.db.dosen.findUnique.mockResolvedValue(baris(1, "SUCCESS", terakhir));

    const res = await panggilStatus();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({
      data: {
        sinta_id: "1001",
        sync_status: "SUCCESS",
        last_synced_at: terakhir.toISOString(),
        berjalan: false,
        bisa_sinkron: false,
        bisa_sinkron_lagi_pada: new Date(terakhir.getTime() + 7 * HARI).toISOString(),
      },
    });
    expect(mocks.db.dosen.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { user_id: USER_ID } }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("IN_PROGRESS: berjalan true untuk polling", async () => {
    mocks.db.dosen.findUnique.mockResolvedValue(baris(1, "IN_PROGRESS", null));
    const { data } = await (await panggilStatus()).json();
    expect(data).toMatchObject({ sync_status: "IN_PROGRESS", berjalan: true, bisa_sinkron: false, bisa_sinkron_lagi_pada: null });
  });

  it.each(["FAILED", "PARTIAL"])("%s: boleh sinkron lagi tanpa menunggu", async (s) => {
    mocks.db.dosen.findUnique.mockResolvedValue(baris(1, s, lalu(HARI)));
    const { data } = await (await panggilStatus()).json();
    expect(data).toMatchObject({ berjalan: false, bisa_sinkron: true, bisa_sinkron_lagi_pada: null });
  });

  it("belum pernah sinkron: status dan tanggal null", async () => {
    mocks.db.dosen.findUnique.mockResolvedValue(baris(1, null, null));
    const { data } = await (await panggilStatus()).json();
    expect(data).toMatchObject({ sync_status: null, last_synced_at: null, bisa_sinkron: true });
  });

  it("400 bila baris dosen belum ada", async () => {
    mocks.db.dosen.findUnique.mockResolvedValue(null);
    const res = await panggilStatus();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ message: "Isi sinta_id dulu sebelum menjalankan sinkron." });
  });

  describe("hanya Staff Kaprodi: sinta_id dan semua", () => {
    it.each([["Dosen"], ["Kaprodi"]])("403 untuk peran %s", async (peran) => {
      mocks.getSession.mockResolvedValue(sesi(peran));
      expect((await panggilStatus("?sinta_id=1002")).status).toBe(403);
      expect((await panggilStatus("?semua=true")).status).toBe(403);
      expect(mocks.db.dosen.findUnique).not.toHaveBeenCalled();
      expect(mocks.db.dosen.findMany).not.toHaveBeenCalled();
    });

    it("satu dosen lewat sinta_id", async () => {
      mocks.getSession.mockResolvedValue(sesi("Staff_Kaprodi"));
      mocks.db.dosen.findUnique.mockResolvedValue(baris(2, "FAILED", lalu(HARI)));
      const res = await panggilStatus("?sinta_id=1002");
      expect(res.status).toBe(200);
      expect(mocks.db.dosen.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { sinta_id: "1002" } }));
    });

    it("sinta_id tidak terdaftar: 404", async () => {
      mocks.getSession.mockResolvedValue(sesi("Staff_Kaprodi"));
      mocks.db.dosen.findUnique.mockResolvedValue(null);
      expect((await panggilStatus("?sinta_id=999")).status).toBe(404);
    });

    it("sinta_id tidak valid atau dipakai bersama semua: 400", async () => {
      mocks.getSession.mockResolvedValue(sesi("Staff_Kaprodi"));
      expect((await panggilStatus("?sinta_id=abc")).status).toBe(400);
      expect((await panggilStatus("?sinta_id=1002&semua=true")).status).toBe(400);
    });

    it("semua dosen: daftar dan bendera berjalan", async () => {
      mocks.getSession.mockResolvedValue(sesi("Staff_Kaprodi"));
      mocks.db.dosen.findMany.mockResolvedValue([baris(1, "SUCCESS", lalu(HARI)), baris(2, "IN_PROGRESS", null)]);
      const { data } = await (await panggilStatus("?semua=true")).json();
      expect(data.berjalan).toBe(true);
      expect(data.items.map((i: { sinta_id: string }) => i.sinta_id)).toEqual(["1001", "1002"]);

      mocks.db.dosen.findMany.mockResolvedValue([baris(1, "SUCCESS", lalu(HARI))]);
      expect((await (await panggilStatus("?semua=true")).json()).data.berjalan).toBe(false);
    });
  });
});

describe("GET /api/crawler/health", () => {
  it("401 tanpa sesi: Umum tidak boleh membangunkan layanan", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await health()).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([["Mahasiswa"], ["Umum"]])("403 untuk peran %s", async (peran) => {
    mocks.getSession.mockResolvedValue(sesi(peran));
    expect((await health()).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([["Dosen"], ["Kaprodi"], ["Staff_Kaprodi"], ["Admin"]])("200 untuk peran %s", async (peran) => {
    mocks.getSession.mockResolvedValue(sesi(peran));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
    const res = await health();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });

  it("meneruskan GET /health dari server tanpa X-Internal-Key, dan kunci tidak muncul di respons", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const res = await health();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${CRAWLER_URL}/health`);
    expect(init.method).toBeUndefined();
    expect(JSON.stringify(init)).not.toContain(KUNCI);
    expect(await res.text()).not.toContain(KUNCI);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("CRAWLER_URL dengan garis miring di akhir tidak menghasilkan //health", async () => {
    vi.stubEnv("CRAWLER_URL", `${CRAWLER_URL}/`);
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    await health();
    expect(fetchMock.mock.calls[0][0]).toBe(`${CRAWLER_URL}/health`);
  });

  it("layanan belum bangun (galat jaringan atau timeout): 503 agar front-end mengulang", async () => {
    fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    const res = await health();
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ message: "Server belum merespons, coba lagi sebentar." });
  });

  it("layanan membalas bukan 200: 503", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 502 }));
    expect((await health()).status).toBe(503);
  });

  it("CRAWLER_URL belum diisi: 500", async () => {
    vi.stubEnv("CRAWLER_URL", "");
    const res = await health();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ message: "Layanan crawler belum dikonfigurasi di server." });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
