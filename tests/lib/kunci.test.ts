import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { kunciBuku, kunciIprs, kunciKegiatan, kunciPublikasi, normNama, normTeks } from "@/lib/kunci";

type Nilai = string | number | null;

// Fixture yang sama dibaca crawler/tests/test_kunci.py, supaya Next.js dan crawler menghasilkan kunci yang sama.
const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../crawler/tests/fixtures/kunci.json", import.meta.url)), "utf8"),
) as {
  publikasi: { kasus: string; judul: string; kunci: string }[];
  kegiatan: { kasus: string; jenis: string; judul: string; tahun: Nilai; kunci: string }[];
  iprs: { kasus: string; nomor_permohonan: Nilai; judul: string; tahun: Nilai; kunci: string }[];
  buku: { kasus: string; isbn: Nilai; judul: string; tahun: Nilai; kunci: string }[];
  norm_nama: { kasus: string; nama: string; hasil: string }[];
};

describe("kunci anti-dobel sama dengan crawler", () => {
  it.each(fixture.publikasi)("publikasi: $kasus", (c) => {
    expect(kunciPublikasi(c.judul)).toBe(c.kunci);
  });

  it.each(fixture.kegiatan)("kegiatan: $kasus", (c) => {
    expect(kunciKegiatan(c.jenis, c.judul, c.tahun)).toBe(c.kunci);
  });

  it.each(fixture.iprs)("iprs: $kasus", (c) => {
    expect(kunciIprs(c.nomor_permohonan, c.judul, c.tahun)).toBe(c.kunci);
  });

  it.each(fixture.buku)("buku: $kasus", (c) => {
    expect(kunciBuku(c.isbn, c.judul, c.tahun)).toBe(c.kunci);
  });
});

describe("normNama sama dengan norm_nama crawler", () => {
  it.each(fixture.norm_nama)("$kasus", (c) => {
    expect(normNama(c.nama)).toBe(c.hasil);
  });

  it("null dan undefined menjadi teks kosong", () => {
    expect(normNama(null)).toBe("");
    expect(normNama(undefined)).toBe("");
  });
});

describe("normTeks", () => {
  it("huruf kecil, tanpa tanda baca, spasi, dan garis bawah", () => {
    expect(normTeks("  Halo_Dunia, Apa Kabar?! ")).toBe("haloduniaapakabar");
    expect(normTeks(null)).toBe("");
    expect(normTeks(2023)).toBe("2023");
  });
});
