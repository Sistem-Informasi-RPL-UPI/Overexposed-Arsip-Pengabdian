import { describe, expect, it } from "vitest";
import {
  hitungKunciIprsSetelahUbah,
  parseCreateIprsPayload,
  parsePatchIprsPayload,
} from "@/lib/iprs";
import { kunciIprs } from "@/lib/kunci";

describe("parseCreateIprsPayload", () => {
  it("menerima field wajib saja, menghitung kunci dari judul + tahun, dan mengabaikan status dari body", () => {
    const res = parseCreateIprsPayload({
      judul: "  Aplikasi Pemantau Arsip Prodi  ",
      jenis: "Hak Cipta",
      tahun: 2025,
      status: "Pending",
    });

    expect(res).toEqual({
      ok: true,
      data: {
        judul: "Aplikasi Pemantau Arsip Prodi",
        jenis: "Hak Cipta",
        tahun: 2025,
        nomor_permohonan: null,
        pemegang: null,
        inventor: null,
      },
      kunci: kunciIprs(null, "Aplikasi Pemantau Arsip Prodi", 2025),
    });
    if (res.ok) {
      expect(res.data).not.toHaveProperty("status");
    }
  });

  it("menghitung kunci dari nomor_permohonan bila diisi dan menyimpan pemegang/inventor apa adanya", () => {
    const res = parseCreateIprsPayload({
      judul: "Sistem Deteksi Dini 2.0",
      jenis: "Paten Sederhana",
      tahun: "2024",
      nomorPermohonan: "S00202400123",
      pemegang: "Universitas Pendidikan Indonesia; LPPM UPI",
      inventor: "Dr. Mochamad Iqbal Ardimansyah, S.Kom., M.T.; Ani Wijaya",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({
      judul: "Sistem Deteksi Dini 2.0",
      jenis: "Paten Sederhana",
      tahun: 2024,
      nomor_permohonan: "S00202400123",
      pemegang: "Universitas Pendidikan Indonesia; LPPM UPI",
      inventor: "Dr. Mochamad Iqbal Ardimansyah, S.Kom., M.T.; Ani Wijaya",
    });
    expect(res.kunci).toBe(kunciIprs("S00202400123", "Sistem Deteksi Dini 2.0", 2024));
  });

  it("menolak body tidak valid, field wajib kosong, judul acak, atau angka di jenis/inventor", () => {
    expect(parseCreateIprsPayload(null).ok).toBe(false);
    expect(parseCreateIprsPayload([]).ok).toBe(false);
    expect(parseCreateIprsPayload({ judul: "-?///a/", jenis: "Hak Cipta", tahun: 2025 }).ok).toBe(false);
    expect(parseCreateIprsPayload({ judul: "Aplikasi Valid", jenis: "", tahun: 2025 }).ok).toBe(false);
    expect(parseCreateIprsPayload({ judul: "Aplikasi Valid", jenis: "Hak Cipta 123", tahun: 2025 }).ok).toBe(false);
    expect(parseCreateIprsPayload({ judul: "Aplikasi Valid", jenis: "Hak Cipta", tahun: 999 }).ok).toBe(false);
    expect(parseCreateIprsPayload({ judul: "Aplikasi Valid", jenis: "Hak Cipta", tahun: 2025, inventor: "Budi 99" }).ok).toBe(false);
    expect(parseCreateIprsPayload({ judul: "Aplikasi Valid", jenis: "Hak Cipta", tahun: 2025, inventor: "Budi; ; Ani" }).ok).toBe(false);
    expect(parseCreateIprsPayload({ judul: "Aplikasi Valid", jenis: "Hak Cipta", tahun: 2025, pemegang: "UPI; " }).ok).toBe(false);
    expect(parseCreateIprsPayload({ judul: "Aplikasi Valid", jenis: "Hak Cipta", tahun: 2025, nomor_permohonan: "///" }).ok).toBe(false);
  });

  it("menolak kolom opsional melebihi batas panjang schema", () => {
    expect(parseCreateIprsPayload({ judul: "Aplikasi Valid", jenis: "a".repeat(101), tahun: 2025 }).ok).toBe(false);
    expect(parseCreateIprsPayload({ judul: "Aplikasi Valid", jenis: "Hak Cipta", tahun: 2025, nomor_permohonan: "A".repeat(101) }).ok).toBe(false);
    expect(parseCreateIprsPayload({ judul: "Aplikasi Valid", jenis: "Hak Cipta", tahun: 2025, pemegang: "A".repeat(256) }).ok).toBe(false);
  });
});

describe("parsePatchIprsPayload", () => {
  it("mendukung update parsial, mengosongkan kolom opsional menjadi null, dan mengabaikan status", () => {
    expect(
      parsePatchIprsPayload({
        pemegang: "  UPI Bandung  ",
        nomor_permohonan: "  ",
        status: "Granted",
      }),
    ).toEqual({
      ok: true,
      data: {
        pemegang: "UPI Bandung",
        nomor_permohonan: null,
      },
    });
  });

  it("menolak body kosong atau body yang hanya mengirim status", () => {
    expect(parsePatchIprsPayload({}).ok).toBe(false);
    expect(parsePatchIprsPayload({ status: "Ditolak" }).ok).toBe(false);
  });
});

describe("hitungKunciIprsSetelahUbah", () => {
  it("menghitung ulang kunci saat nomor_permohonan dihapus atau judul/tahun diubah", () => {
    const lama = { nomor_permohonan: "EC002024001", judul: "Judul Lama", tahun: 2024 };
    expect(hitungKunciIprsSetelahUbah(lama, { nomor_permohonan: null })).toBe(
      kunciIprs(null, "Judul Lama", 2024),
    );
    expect(hitungKunciIprsSetelahUbah(lama, { nomor_permohonan: "EC002024999" })).toBe(
      kunciIprs("EC002024999", "Judul Lama", 2024),
    );
  });
});
