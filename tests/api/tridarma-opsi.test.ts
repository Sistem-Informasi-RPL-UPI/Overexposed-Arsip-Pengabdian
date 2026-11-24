import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const model = () => ({ findMany: vi.fn() });

const mocks = vi.hoisted(() => ({
  db: {} as Record<string, { findMany: ReturnType<typeof vi.fn> }>,
}));
for (const nama of ["publikasi", "kegiatan", "iprs", "buku"]) mocks.db[nama] = model();

vi.mock("@/lib/db", () => ({ db: mocks.db }));

import { GET } from "@/app/api/tridarma/opsi/route";

const panggil = (query: string) => GET(new NextRequest(`http://localhost/api/tridarma/opsi${query}`));
const nilai = (opsi: { value: string }[]) => opsi.map((o) => o.value);

const AKREDITASI = ["Q1", "Q2", "Q3", "Q4", "SINTA 1", "SINTA 2", "SINTA 3", "SINTA 4", "SINTA 5", "SINTA 6"];

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  for (const m of Object.values(mocks.db)) m.findMany.mockResolvedValue([]);
});

describe("GET /api/tridarma/opsi", () => {
  describe("publikasi", () => {
    it("akreditasi tetap Q1 sampai Q4 lalu SINTA 1 sampai 6, tanpa membaca database", async () => {
      const res = await panggil("?untuk=publikasi");
      expect(res.status).toBe(200);
      const { data } = await res.json();

      expect(data.akreditasi).toEqual(AKREDITASI.map((v) => ({ value: v, label: v })));
      // hanya tahun yang dibaca dari database: satu query, bukan untuk akreditasi
      expect(mocks.db.publikasi.findMany).toHaveBeenCalledTimes(1);
      expect(mocks.db.publikasi.findMany.mock.calls[0][0].select).toEqual({ tahun: true });
    });

    it("sumber_artikel tetap, nilainya sama dengan yang diterima parameter filter", async () => {
      const { data } = await (await panggil("?untuk=publikasi")).json();
      expect(data.sumber_artikel).toEqual([
        { value: "scopus", label: "Scopus" },
        { value: "garuda", label: "Garuda" },
        { value: "googlescholar", label: "Google Scholar" },
        { value: "rama", label: "RAMA" },
        { value: "manual", label: "Manual" },
      ]);
    });

    it("tahun dari data: unik, terbaru dulu, sebagai teks, tahun kosong dibuang", async () => {
      mocks.db.publikasi.findMany.mockResolvedValue([{ tahun: 2022 }, { tahun: 2024 }, { tahun: null }, { tahun: 2022 }, { tahun: 2023 }]);
      const { data } = await (await panggil("?untuk=publikasi")).json();
      expect(data.tahun).toEqual([
        { value: "2024", label: "2024" },
        { value: "2023", label: "2023" },
        { value: "2022", label: "2022" },
      ]);
    });

    it("dosen_id membatasi tahun ke data dosen itu lewat tabel penghubung", async () => {
      await panggil("?untuk=publikasi&dosen_id=7");
      expect(mocks.db.publikasi.findMany.mock.calls[0][0].where).toEqual({
        publikasi_dosen: { some: { dosen_id: 7 } },
        tahun: { not: null },
      });
    });

    it("daftar akreditasi tidak berubah walau dosen_id dipakai", async () => {
      const { data } = await (await panggil("?untuk=publikasi&dosen_id=7")).json();
      expect(nilai(data.akreditasi)).toEqual(AKREDITASI);
    });
  });

  describe("kegiatan", () => {
    it("tahun dan skema dari data, skema unik tanpa membedakan huruf besar kecil dan tanpa yang kosong", async () => {
      mocks.db.kegiatan.findMany
        .mockResolvedValueOnce([{ tahun: 2025 }, { tahun: 2024 }])
        .mockResolvedValueOnce([
          { skema: "Penelitian Internal" },
          { skema: "  PENELITIAN INTERNAL " },
          { skema: "Hibah Dikti" },
          { skema: "" },
          { skema: null },
        ]);
      const { data } = await (await panggil("?untuk=kegiatan")).json();
      expect(nilai(data.tahun)).toEqual(["2025", "2024"]);
      expect(nilai(data.skema)).toEqual(["Hibah Dikti", "Penelitian Internal"]);
      expect(data).not.toHaveProperty("akreditasi");
    });

    it("jenis dan dosen_id membatasi pilihan", async () => {
      await panggil("?untuk=kegiatan&jenis=Pengabdian&dosen_id=7");
      for (const call of mocks.db.kegiatan.findMany.mock.calls) {
        expect(call[0].where).toMatchObject({ jenis: "pengabdian", anggota: { some: { dosen_id: 7 } } });
      }
      expect(mocks.db.kegiatan.findMany).toHaveBeenCalledTimes(2);
    });

    it("tanpa jenis, penelitian dan pengabdian sama-sama masuk", async () => {
      await panggil("?untuk=kegiatan");
      expect(mocks.db.kegiatan.findMany.mock.calls[0][0].where).not.toHaveProperty("jenis");
    });

    it("jenis tidak dikenal: 400", async () => {
      const res = await panggil("?untuk=kegiatan&jenis=hibah");
      expect(res.status).toBe(400);
      expect((await res.json()).message).toBe("Parameter jenis harus penelitian atau pengabdian.");
    });

    it("jenis diabaikan untuk endpoint lain", async () => {
      expect((await panggil("?untuk=buku&jenis=hibah")).status).toBe(200);
    });
  });

  it("iprs: tahun, status, dan jenis dari data", async () => {
    mocks.db.iprs.findMany
      .mockResolvedValueOnce([{ tahun: 2023 }])
      .mockResolvedValueOnce([{ status: "Granted" }, { status: "Diterima" }, { status: "granted" }])
      .mockResolvedValueOnce([{ jenis: "Hak Cipta" }, { jenis: "Paten" }]);
    const { data } = await (await panggil("?untuk=iprs&dosen_id=3")).json();

    expect(nilai(data.tahun)).toEqual(["2023"]);
    expect(nilai(data.status)).toEqual(["Diterima", "Granted"]);
    expect(nilai(data.jenis)).toEqual(["Hak Cipta", "Paten"]);
    for (const call of mocks.db.iprs.findMany.mock.calls) {
      expect(call[0].where).toMatchObject({ iprs_dosen: { some: { dosen_id: 3 } } });
    }
  });

  it("buku: tahun dan kategori dari data", async () => {
    mocks.db.buku.findMany
      .mockResolvedValueOnce([{ tahun: 2021 }, { tahun: 2022 }])
      .mockResolvedValueOnce([{ kategori: "Buku Ajar" }, { kategori: "Monograf" }]);
    const { data } = await (await panggil("?untuk=buku")).json();
    expect(nilai(data.tahun)).toEqual(["2022", "2021"]);
    expect(nilai(data.kategori)).toEqual(["Buku Ajar", "Monograf"]);
  });

  it("terbuka untuk Umum tanpa login dan tidak disimpan cache", async () => {
    const res = await panggil("?untuk=buku");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each([
    ["tanpa untuk", ""],
    ["untuk tidak dikenal", "?untuk=dosen"],
    ["untuk kosong", "?untuk="],
    ["dosen_id bukan angka", "?untuk=buku&dosen_id=abc"],
    ["dosen_id nol", "?untuk=buku&dosen_id=0"],
  ])("400 untuk %s, tanpa query database", async (_nama, query) => {
    const res = await panggil(query);
    expect(res.status).toBe(400);
    expect(typeof (await res.json()).message).toBe("string");
    for (const m of Object.values(mocks.db)) expect(m.findMany).not.toHaveBeenCalled();
  });

  it("500 dengan pesan umum bila database gagal", async () => {
    mocks.db.buku.findMany.mockRejectedValue(new Error("koneksi putus"));
    const res = await panggil("?untuk=buku");
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("koneksi putus");
  });
});
