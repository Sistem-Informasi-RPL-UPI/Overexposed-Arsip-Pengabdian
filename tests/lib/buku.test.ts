import { describe, expect, it } from "vitest";
import {
  hitungKunciBukuSetelahUbah,
  parseCreateBukuPayload,
  parsePatchBukuPayload,
} from "@/lib/buku";
import { kunciBuku } from "@/lib/kunci";

describe("parseCreateBukuPayload", () => {
  it("menerima field wajib saja dan menghitung kunci dari judul + tahun", () => {
    const res = parseCreateBukuPayload({ judul: "  Rekayasa Perangkat Lunak  ", tahun: 2025 });
    expect(res).toEqual({
      ok: true,
      data: {
        judul: "Rekayasa Perangkat Lunak",
        tahun: 2025,
        kategori: null,
        penulis: null,
        penerbit: null,
        tempat_terbit: null,
        isbn: null,
      },
      kunci: kunciBuku(null, "Rekayasa Perangkat Lunak", 2025),
    });
  });

  it("menghitung kunci dari ISBN bila ISBN diisi dan menyimpan penulis apa adanya", () => {
    const res = parseCreateBukuPayload({
      judul: "Buku Ajar Web",
      tahun: "2024",
      kategori: "Buku Ajar",
      penulis: "Budi Santoso; Ani Wijaya",
      penerbit: "UPI Press",
      tempatTerbit: "Bandung",
      isbn: "978-602-0000-01-1",
    });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toEqual({
      judul: "Buku Ajar Web",
      tahun: 2024,
      kategori: "Buku Ajar",
      penulis: "Budi Santoso; Ani Wijaya",
      penerbit: "UPI Press",
      tempat_terbit: "Bandung",
      isbn: "978-602-0000-01-1",
    });
    expect(res.kunci).toBe(kunciBuku("978-602-0000-01-1", "Buku Ajar Web", 2024));
  });

  it("menolak body bukan objek, judul kosong, atau tahun tidak valid", () => {
    expect(parseCreateBukuPayload(null).ok).toBe(false);
    expect(parseCreateBukuPayload([]).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "   ", tahun: 2024 }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku" }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku", tahun: "abc" }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku", tahun: 999 }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku", tahun: 2024.5 }).ok).toBe(false);
  });

  it("menolak judul acak/simbol, ISBN bukan format ISBN, dan angka di kategori/penulis", () => {
    expect(parseCreateBukuPayload({ judul: "-?///a/", tahun: 2024 }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "123456", tahun: 2024 }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "ab", tahun: 2024 }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku Valid", tahun: 2024, isbn: "ababababa" }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku Valid", tahun: 2024, isbn: "12345" }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku Valid", tahun: 2024, isbn: "123-456-789-012-3" }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku Valid", tahun: 2024, kategori: "Buku 123" }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku Valid", tahun: 2024, penulis: "Budi 99; Ani" }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku Valid", tahun: 2024, penulis: "Budi; ; Ani" }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku Valid", tahun: 2024, penerbit: "---" }).ok).toBe(false);
  });

  it("menerima judul dengan angka/tanda baca wajar, ISBN-10/ISBN-13, penulis bergelar, dan penerbit bernomor", () => {
    const res = parseCreateBukuPayload({
      judul: "Pemrograman Web 2: HTML, CSS & JS (Edisi Revisi)",
      tahun: 2025,
      kategori: "Buku Ajar & Referensi",
      penulis: "Dr. Mochamad Iqbal Ardimansyah, S.Kom., M.T.; Ani Wijaya",
      penerbit: "Penerbit 3 Serangkai",
      tempat_terbit: "Jakarta Pusat 10110",
      isbn: "0-8044-2957-X",
    });
    expect(res.ok).toBe(true);
  });

  it("menolak teks opsional yang melebihi batas kolom atau bukan string", () => {
    expect(parseCreateBukuPayload({ judul: "Buku", tahun: 2024, isbn: "x".repeat(51) }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku", tahun: 2024, kategori: "x".repeat(101) }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku", tahun: 2024, penerbit: "x".repeat(201) }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku", tahun: 2024, tempat_terbit: "x".repeat(201) }).ok).toBe(false);
    expect(parseCreateBukuPayload({ judul: "Buku", tahun: 2024, penulis: 123 }).ok).toBe(false);
  });
});

describe("parsePatchBukuPayload", () => {
  it("mendukung pembaruan sebagian dan mengosongkan kolom opsional menjadi null", () => {
    expect(parsePatchBukuPayload({ penerbit: "  Gramedia  ", isbn: "  " })).toEqual({
      ok: true,
      data: {
        penerbit: "Gramedia",
        isbn: null,
      },
    });
  });

  it("menolak body kosong tanpa field yang bisa diubah", () => {
    expect(parsePatchBukuPayload({}).ok).toBe(false);
    expect(parsePatchBukuPayload({ asing: "abc" }).ok).toBe(false);
  });

  it("menolak judul kosong atau tahun tidak valid saat dikirim di PATCH", () => {
    expect(parsePatchBukuPayload({ judul: "" }).ok).toBe(false);
    expect(parsePatchBukuPayload({ tahun: null }).ok).toBe(false);
  });
});

describe("hitungKunciBukuSetelahUbah", () => {
  it("menghitung ulang kunci saat ISBN dihapus atau judul/tahun diubah", () => {
    const lama = { isbn: "978-602-1234", judul: "Judul Lama", tahun: 2023 };
    expect(hitungKunciBukuSetelahUbah(lama, { isbn: null })).toBe(
      kunciBuku(null, "Judul Lama", 2023),
    );
    expect(hitungKunciBukuSetelahUbah(lama, { judul: "Judul Baru" })).toBe(
      kunciBuku("978-602-1234", "Judul Baru", 2023),
    );
  });
});
