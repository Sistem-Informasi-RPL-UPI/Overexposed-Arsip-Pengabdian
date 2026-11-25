import { describe, expect, it } from "vitest";
import {
  JENIS_BERKAS_LIST,
  parseCreateBerkasPengajaranPayload,
  parseCreateKelasPayload,
  parseCreateMatkulPayload,
  parsePatchBerkasPengajaranPayload,
  parsePatchKelasPayload,
  parsePatchMatkulPayload,
} from "@/lib/pengajaran";

describe("Validasi Matkul", () => {
  it("menerima kode, nama, dan sks valid serta mengubah kode menjadi huruf kapital", () => {
    expect(
      parseCreateMatkulPayload({
        kode: "  rpl-301 ",
        nama: "  Arsitektur Perangkat Lunak  ",
        sks: "3",
      }),
    ).toEqual({
      ok: true,
      data: {
        kode: "RPL-301",
        nama: "Arsitektur Perangkat Lunak",
        sks: 3,
      },
    });
  });

  it("menolak kode kosong/tanpa huruf, nama acak, atau sks di luar rentang 1..24", () => {
    expect(
      parseCreateMatkulPayload({ kode: "", nama: "Pemrograman Web", sks: 3 }).ok,
    ).toBe(false);
    expect(
      parseCreateMatkulPayload({
        kode: "12345",
        nama: "Pemrograman Web",
        sks: 3,
      }).ok,
    ).toBe(false);
    expect(
      parseCreateMatkulPayload({
        kode: "RPL101",
        nama: "-?///a/",
        sks: 3,
      }).ok,
    ).toBe(false);
    expect(
      parseCreateMatkulPayload({
        kode: "RPL101",
        nama: "Pemrograman Web",
        sks: 0,
      }).ok,
    ).toBe(false);
    expect(
      parseCreateMatkulPayload({
        kode: "RPL101",
        nama: "Pemrograman Web",
        sks: 25,
      }).ok,
    ).toBe(false);
  });

  it("parsePatchMatkulPayload mendukung pembaruan sebagian dan menolak body kosong", () => {
    expect(parsePatchMatkulPayload({ sks: 4 })).toEqual({
      ok: true,
      data: { sks: 4 },
    });
    expect(parsePatchMatkulPayload({}).ok).toBe(false);
  });
});

describe("Validasi Kelas", () => {
  it("menerima matkul_id, tahun_ajaran YYYY/YYYY berurutan, dan semester Ganjil/Genap", () => {
    expect(
      parseCreateKelasPayload({
        matkulId: "10",
        tahunAjaran: "2025/2026",
        semester: "ganjil",
      }),
    ).toEqual({
      ok: true,
      data: {
        matkul_id: 10,
        tahun_ajaran: "2025/2026",
        semester: "Ganjil",
      },
    });
  });

  it("menolak tahun_ajaran tidak berurutan, semester selain Ganjil/Genap, atau matkul_id tidak valid", () => {
    expect(
      parseCreateKelasPayload({
        matkul_id: 0,
        tahun_ajaran: "2025/2026",
        semester: "Ganjil",
      }).ok,
    ).toBe(false);
    expect(
      parseCreateKelasPayload({
        matkul_id: 1,
        tahun_ajaran: "2025-2026",
        semester: "Ganjil",
      }).ok,
    ).toBe(false);
    expect(
      parseCreateKelasPayload({
        matkul_id: 1,
        tahun_ajaran: "2025/2027",
        semester: "Ganjil",
      }).ok,
    ).toBe(false);
    expect(
      parseCreateKelasPayload({
        matkul_id: 1,
        tahun_ajaran: "2025/2026",
        semester: "Pendek",
      }).ok,
    ).toBe(false);
  });

  it("parsePatchKelasPayload mendukung pembaruan parsial dan menolak body kosong", () => {
    expect(parsePatchKelasPayload({ semester: "GENAP" })).toEqual({
      ok: true,
      data: { semester: "Genap" },
    });
    expect(parsePatchKelasPayload({}).ok).toBe(false);
  });
});

describe("Validasi Berkas Pengajaran", () => {
  it.each(JENIS_BERKAS_LIST)(
    "menerima jenis berkas %s dan URL http/https valid",
    (jenis) => {
      const res = parseCreateBerkasPengajaranPayload({
        kelas_id: 5,
        jenis: jenis.toLowerCase(),
        judul: "Berkas Minggu 1",
        link: "https://drive.google.com/file/d/123/view",
        keterangan: "Tautan Google Drive",
      });
      expect(res).toEqual({
        ok: true,
        data: {
          kelas_id: 5,
          jenis,
          judul: "Berkas Minggu 1",
          link: "https://drive.google.com/file/d/123/view",
          keterangan: "Tautan Google Drive",
        },
      });
    },
  );

  it("menolak link bukan URL http/https atau jenis berkas tidak dikenal", () => {
    expect(
      parseCreateBerkasPengajaranPayload({
        kelas_id: 5,
        jenis: "RPS",
        link: "teks-biasa-bukan-url",
      }).ok,
    ).toBe(false);
    expect(
      parseCreateBerkasPengajaranPayload({
        kelas_id: 5,
        jenis: "RPS",
        link: "ftp://files.example.com/rps.pdf",
      }).ok,
    ).toBe(false);
    expect(
      parseCreateBerkasPengajaranPayload({
        kelas_id: 5,
        jenis: "TugasAkhir",
        link: "https://drive.google.com/file/d/1",
      }).ok,
    ).toBe(false);
  });

  it("parsePatchBerkasPengajaranPayload mendukung update parsial dan menolak link tidak valid", () => {
    expect(
      parsePatchBerkasPengajaranPayload({
        jenis: "kuis",
        judul: "  ",
        link: "https://drive.google.com/file/d/kuis-2",
      }),
    ).toEqual({
      ok: true,
      data: {
        jenis: "Kuis",
        judul: null,
        link: "https://drive.google.com/file/d/kuis-2",
      },
    });
    expect(
      parsePatchBerkasPengajaranPayload({ link: "bukan-link" }).ok,
    ).toBe(false);
    expect(parsePatchBerkasPengajaranPayload({}).ok).toBe(false);
  });
});
