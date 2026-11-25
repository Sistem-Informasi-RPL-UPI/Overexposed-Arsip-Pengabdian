import { describe, expect, it } from "vitest";
import { kunciPublikasi } from "@/lib/kunci";
import {
  hitungKunciPublikasiSetelahUbah,
  parseCreatePublikasiPayload,
  parsePatchPublikasiPayload,
} from "@/lib/publikasi";

describe("parseCreatePublikasiPayload", () => {
  it("menerima field wajib saja, mengisi sitasi=0 bawaan, dan menghitung kunci dari judul", () => {
    const res = parseCreatePublikasiPayload({
      judul: "  Analisis Arsitektur Microservices pada Sistem Akademik  ",
      tahun: 2025,
    });

    expect(res).toEqual({
      ok: true,
      data: {
        judul: "Analisis Arsitektur Microservices pada Sistem Akademik",
        tahun: 2025,
        penulis: null,
        jurnal: null,
        link: null,
        jenis: null,
        penerbit: null,
        doi: null,
        sitasi: 0,
        kuartil: null,
        akreditasi: null,
      },
      kunci: kunciPublikasi(
        "Analisis Arsitektur Microservices pada Sistem Akademik",
      ),
    });
  });

  it("menerima semua field opsional termasuk kuartil dan akreditasi terisi sekaligus serta penulis dipisah ';'", () => {
    const res = parseCreatePublikasiPayload({
      judul: "Optimasi Query Database Terdistribusi",
      tahun: "2024",
      penulis: "A; B; C",
      jurnal: "Jurnal Rekayasa Perangkat Lunak",
      link: "https://journal.upi.edu/article/view/123",
      jenis: "Jurnal Nasional",
      penerbit: "UPI Press",
      doi: "10.17509/jrpl.v4i2.12345",
      sitasi: "14",
      kuartil: "Q2",
      akreditasi: "SINTA 2",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({
      judul: "Optimasi Query Database Terdistribusi",
      tahun: 2024,
      penulis: "A; B; C",
      jurnal: "Jurnal Rekayasa Perangkat Lunak",
      link: "https://journal.upi.edu/article/view/123",
      jenis: "Jurnal Nasional",
      penerbit: "UPI Press",
      doi: "10.17509/jrpl.v4i2.12345",
      sitasi: 14,
      kuartil: "Q2",
      akreditasi: "SINTA 2",
    });
    expect(res.kunci).toBe(
      kunciPublikasi("Optimasi Query Database Terdistribusi"),
    );
  });

  it("mengizinkan hanya kuartil saja atau hanya akreditasi saja", () => {
    const hanyaKuartil = parseCreatePublikasiPayload({
      judul: "Paper Internasional",
      tahun: 2025,
      kuartil: "Q1",
    });
    const hanyaAkreditasi = parseCreatePublikasiPayload({
      judul: "Paper Nasional",
      tahun: 2025,
      akreditasi: "SINTA 3",
    });

    expect(hanyaKuartil.ok).toBe(true);
    expect(hanyaAkreditasi.ok).toBe(true);
    if (hanyaKuartil.ok && hanyaAkreditasi.ok) {
      expect(hanyaKuartil.data.kuartil).toBe("Q1");
      expect(hanyaKuartil.data.akreditasi).toBeNull();
      expect(hanyaAkreditasi.data.kuartil).toBeNull();
      expect(hanyaAkreditasi.data.akreditasi).toBe("SINTA 3");
    }
  });

  it("menolak body tidak valid, judul acak, tahun di luar rentang, link bukan URL, sitasi negatif, atau angka di penulis/jenis", () => {
    expect(parseCreatePublikasiPayload(null).ok).toBe(false);
    expect(parseCreatePublikasiPayload([]).ok).toBe(false);
    expect(
      parseCreatePublikasiPayload({ judul: "-?///a/", tahun: 2025 }).ok,
    ).toBe(false);
    expect(
      parseCreatePublikasiPayload({ judul: "Paper Valid", tahun: 999 }).ok,
    ).toBe(false);
    expect(
      parseCreatePublikasiPayload({
        judul: "Paper Valid",
        tahun: 2025,
        link: "bukan-link-valid",
      }).ok,
    ).toBe(false);
    expect(
      parseCreatePublikasiPayload({
        judul: "Paper Valid",
        tahun: 2025,
        link: "ftp://example.com/paper.pdf",
      }).ok,
    ).toBe(false);
    expect(
      parseCreatePublikasiPayload({
        judul: "Paper Valid",
        tahun: 2025,
        sitasi: -1,
      }).ok,
    ).toBe(false);
    expect(
      parseCreatePublikasiPayload({
        judul: "Paper Valid",
        tahun: 2025,
        sitasi: "abc",
      }).ok,
    ).toBe(false);
    expect(
      parseCreatePublikasiPayload({
        judul: "Paper Valid",
        tahun: 2025,
        penulis: "Budi 99; Ani",
      }).ok,
    ).toBe(false);
    expect(
      parseCreatePublikasiPayload({
        judul: "Paper Valid",
        tahun: 2025,
        penulis: "A; ; B",
      }).ok,
    ).toBe(false);
    expect(
      parseCreatePublikasiPayload({
        judul: "Paper Valid",
        tahun: 2025,
        jenis: "Jurnal 123",
      }).ok,
    ).toBe(false);
    expect(
      parseCreatePublikasiPayload({
        judul: "Paper Valid",
        tahun: 2025,
        doi: "10.1000/ada spasi",
      }).ok,
    ).toBe(false);
  });

  it("menolak field opsional yang melebihi batas panjang kolom", () => {
    expect(
      parseCreatePublikasiPayload({
        judul: "Paper Valid",
        tahun: 2025,
        kuartil: "Q".repeat(11),
      }).ok,
    ).toBe(false);
    expect(
      parseCreatePublikasiPayload({
        judul: "Paper Valid",
        tahun: 2025,
        jenis: "a".repeat(51),
      }).ok,
    ).toBe(false);
    expect(
      parseCreatePublikasiPayload({
        judul: "Paper Valid",
        tahun: 2025,
        akreditasi: "S".repeat(51),
      }).ok,
    ).toBe(false);
    expect(
      parseCreatePublikasiPayload({
        judul: "Paper Valid",
        tahun: 2025,
        doi: "1".repeat(151),
      }).ok,
    ).toBe(false);
    expect(
      parseCreatePublikasiPayload({
        judul: "Paper Valid",
        tahun: 2025,
        penerbit: "a".repeat(201),
      }).ok,
    ).toBe(false);
  });
});

describe("parsePatchPublikasiPayload", () => {
  it("mendukung pembaruan parsial dan mengosongkan kolom opsional menjadi null (sitasi kosong menjadi 0)", () => {
    expect(
      parsePatchPublikasiPayload({
        jurnal: "  IEEE Access  ",
        kuartil: "  ",
        akreditasi: "SINTA 1",
        sitasi: "",
      }),
    ).toEqual({
      ok: true,
      data: {
        jurnal: "IEEE Access",
        kuartil: null,
        akreditasi: "SINTA 1",
        sitasi: 0,
      },
    });
  });

  it("menolak body kosong tanpa field publikasi", () => {
    expect(parsePatchPublikasiPayload({}).ok).toBe(false);
    expect(parsePatchPublikasiPayload({ asing: 123 }).ok).toBe(false);
  });
});

describe("hitungKunciPublikasiSetelahUbah", () => {
  it("menghitung ulang judul_hash saat judul diubah dan mempertahankan hash lama bila judul tidak diubah", () => {
    const lama = { judul: "Judul Paper Lama" };
    expect(hitungKunciPublikasiSetelahUbah(lama, { sitasi: 5 })).toBe(
      kunciPublikasi("Judul Paper Lama"),
    );
    expect(
      hitungKunciPublikasiSetelahUbah(lama, { judul: "Judul Paper Baru" }),
    ).toBe(kunciPublikasi("Judul Paper Baru"));
  });
});
