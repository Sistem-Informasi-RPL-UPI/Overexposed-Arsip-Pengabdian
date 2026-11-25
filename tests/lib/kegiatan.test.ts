import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  hitungKunciKegiatanSetelahUbah,
  parseCreateKegiatanPayload,
  parsePatchKegiatanPayload,
  parseTim,
  PESAN_TANPA_STATUS,
  rencanakanAnggota,
  type BarisAnggota,
} from "@/lib/kegiatan";
import { kunciKegiatan } from "@/lib/kunci";

// Fixture yang sama dipakai tes issue #14 dan crawler, jadi nama_normal dan kunci di sini pasti sama dengan crawler.
const fixture = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../crawler/tests/fixtures/kunci.json", import.meta.url)), "utf8"),
) as {
  kegiatan: { kasus: string; jenis: string; judul: string; tahun: number | string | null; kunci: string }[];
  norm_nama: { kasus: string; nama: string; hasil: string }[];
};

const DASAR = { jenis: "penelitian", judul: "Pengembangan Model Pembelajaran", tahun: 2024, tim: "Ketua Uji; Anggota Satu" };

function tim(teks: string) {
  const r = parseTim(teks);
  if (!r.ok) throw new Error(r.message);
  return r.value;
}

describe("parseTim", () => {
  it("nama pertama menjadi ketua, sisanya anggota", () => {
    expect(tim("Ketua Uji; Anggota Satu; Anggota Dua")).toEqual([
      { nama: "Ketua Uji", nama_normal: "ketua uji", peran: "ketua" },
      { nama: "Anggota Satu", nama_normal: "anggota satu", peran: "anggota" },
      { nama: "Anggota Dua", nama_normal: "anggota dua", peran: "anggota" },
    ]);
  });

  it("satu nama saja: ketua", () => {
    expect(tim("Hanya Aku")).toEqual([{ nama: "Hanya Aku", nama_normal: "hanya aku", peran: "ketua" }]);
  });

  it("nama disimpan apa adanya (dirapikan tepinya), nama_normal tanpa gelar", () => {
    const [ketua] = tim("  Dr. Mochamad Iqbal Ardimansyah, S.Kom., M.T.  ; Rekan Kerja");
    expect(ketua.nama).toBe("Dr. Mochamad Iqbal Ardimansyah, S.Kom., M.T.");
    expect(ketua.nama_normal).toBe("mochamad iqbal ardimansyah");
  });

  it.each(fixture.norm_nama.filter((c) => c.hasil))("nama_normal sama dengan fixture issue #14: $kasus", (c) => {
    expect(tim(c.nama)[0].nama_normal).toBe(c.hasil);
  });

  it("nama kembar digabung, posisi paling awal yang dipakai, huruf besar kecil dan gelar tidak membedakan", () => {
    const hasil = tim("Budi Santoso; Rekan; BUDI SANTOSO; Dr. Budi Santoso, S.T.; Rekan Lain");
    expect(hasil.map((h) => [h.nama, h.peran])).toEqual([
      ["Budi Santoso", "ketua"],
      ["Rekan", "anggota"],
      ["Rekan Lain", "anggota"],
    ]);
  });

  it("nama kembar di posisi pertama tidak menggeser ketua", () => {
    const hasil = tim("Ketua Asli; Rekan; ketua asli");
    expect(hasil.map((h) => h.peran)).toEqual(["ketua", "anggota"]);
  });

  it("segmen kosong dilewati", () => {
    expect(tim(";; Ketua Uji ;  ; Rekan ;").map((h) => h.nama)).toEqual(["Ketua Uji", "Rekan"]);
  });

  it.each([
    ["kosong", ""],
    ["hanya pemisah", " ; ; "],
    ["bukan teks", 123],
    ["array", ["A B", "C D"]],
    ["null", null],
    ["nama satu huruf", "A; Rekan Uji"],
    ["nama hanya gelar", "Dr.; Rekan Uji"],
    ["nama hanya angka", "12345; Rekan Uji"],
    ["nama mengandung angka", "Budi 99; Rekan Uji"],
    ["nama berisi simbol acak", "-?///ab; Rekan Uji"],
  ])("ditolak: %s", (_nama, nilai) => {
    expect(parseTim(nilai).ok).toBe(false);
  });

  it("maksimal 50 orang dan 200 karakter per nama", () => {
    const banyak = Array.from({ length: 51 }, (_, i) => `Orang Nomor${String.fromCharCode(97 + (i % 26))}${i}`).join(";");
    expect(parseTim(banyak)).toEqual({ ok: false, message: "Tim maksimal 50 orang." });
    expect(parseTim("a".repeat(201) + " bb").ok).toBe(false);
  });
});

describe("parseCreateKegiatanPayload", () => {
  const ok = (body: unknown) => {
    const r = parseCreateKegiatanPayload(body);
    if (!r.ok) throw new Error(r.message);
    return r;
  };

  it.each(["penelitian", "pengabdian"])("menerima jenis %s", (jenis) => {
    expect(ok({ ...DASAR, jenis }).data.jenis).toBe(jenis);
  });

  it("jenis tidak huruf besar kecil dan dirapikan", () => {
    expect(ok({ ...DASAR, jenis: " Pengabdian " }).data.jenis).toBe("pengabdian");
  });

  it("wajib: jenis, judul, tahun, dan tim", () => {
    for (const hapus of ["jenis", "judul", "tahun", "tim"]) {
      const body: Record<string, unknown> = { ...DASAR };
      delete body[hapus];
      expect(parseCreateKegiatanPayload(body).ok, hapus).toBe(false);
    }
  });

  it.each([["hibah"], [""], [null], [1]])("jenis %j ditolak", (jenis) => {
    expect(parseCreateKegiatanPayload({ ...DASAR, jenis })).toEqual({
      ok: false,
      message: "Jenis kegiatan harus penelitian atau pengabdian.",
    });
  });

  it("field status ditolak (kegiatan tidak punya status)", () => {
    expect(parseCreateKegiatanPayload({ ...DASAR, status: "Diterima" })).toEqual({ ok: false, message: PESAN_TANPA_STATUS });
    expect(parseCreateKegiatanPayload({ ...DASAR, status: null }).ok).toBe(false);
  });

  it("field peran_saya, ketua, dan anggota_lain tidak dipakai", () => {
    const r = ok({ ...DASAR, peran_saya: "anggota", ketua: "Orang Lain", anggota_lain: "X Y" });
    expect(r.tim.map((t) => t.nama)).toEqual(["Ketua Uji", "Anggota Satu"]);
  });

  it("bawaan: skema dan sumber dana kosong, dana 0", () => {
    expect(ok(DASAR).data).toEqual({
      jenis: "penelitian",
      judul: "Pengembangan Model Pembelajaran",
      tahun: 2024,
      skema: null,
      dana_nominal: 0,
      sumber_dana: null,
    });
  });

  it("opsional terisi, termasuk alias camelCase", () => {
    const r = ok({ ...DASAR, skema: " Internal ", dana_nominal: "30000000", sumberDana: "UPI" });
    expect(r.data).toMatchObject({ skema: "Internal", dana_nominal: 30000000, sumber_dana: "UPI" });
    expect(ok({ ...DASAR, danaNominal: 1500.5 }).data.dana_nominal).toBe(1500.5);
  });

  it.each([[-1], ["abc"], ["1.234"], ["30.000.000"], [1e16], [Number.NaN], [true]])("dana %j ditolak", (dana) => {
    expect(parseCreateKegiatanPayload({ ...DASAR, dana_nominal: dana }).ok).toBe(false);
  });

  it.each([[""], [null]])("dana kosong %j dianggap 0", (dana) => {
    expect(ok({ ...DASAR, dana_nominal: dana }).data.dana_nominal).toBe(0);
  });

  it.each([[999], [10000], [2024.5], ["dua ribu"], [""], [null]])("tahun %j ditolak", (tahun) => {
    expect(parseCreateKegiatanPayload({ ...DASAR, tahun }).ok).toBe(false);
  });

  it("tahun sebagai teks angka diterima", () => {
    expect(ok({ ...DASAR, tahun: " 2023 " }).data.tahun).toBe(2023);
  });

  it.each([[""], ["ab"], ["12"], [" "], [123], ["-?///a/"], ["Judul /// Simbol"]])("judul %j ditolak", (judul) => {
    expect(parseCreateKegiatanPayload({ ...DASAR, judul }).ok).toBe(false);
  });

  it("skema atau sumber dana tanpa huruf ditolak", () => {
    expect(parseCreateKegiatanPayload({ ...DASAR, skema: "---" }).ok).toBe(false);
    expect(parseCreateKegiatanPayload({ ...DASAR, sumber_dana: "12345" }).ok).toBe(false);
  });

  it("skema maksimal 255 dan sumber dana maksimal 100 karakter", () => {
    expect(parseCreateKegiatanPayload({ ...DASAR, skema: "x".repeat(256) }).ok).toBe(false);
    expect(parseCreateKegiatanPayload({ ...DASAR, sumber_dana: "x".repeat(101) }).ok).toBe(false);
    expect(parseCreateKegiatanPayload({ ...DASAR, skema: "x".repeat(255), sumber_dana: "y".repeat(100) }).ok).toBe(true);
  });

  it.each([[null], ["teks"], [[]], [42]])("body %j ditolak", (body) => {
    expect(parseCreateKegiatanPayload(body)).toEqual({ ok: false, message: "Body request tidak valid." });
  });

  it("kunci sama dengan kunciKegiatan (jenis, judul, tahun)", () => {
    const r = ok(DASAR);
    expect(r.kunci).toBe(kunciKegiatan("penelitian", "Pengembangan Model Pembelajaran", 2024));
  });

  it.each(fixture.kegiatan.filter((c) => c.tahun !== null))("kunci sama dengan fixture issue #14: $kasus", (c) => {
    const r = ok({ ...DASAR, jenis: c.jenis, judul: c.judul, tahun: c.tahun });
    expect(r.kunci).toBe(c.kunci);
  });
});

describe("parsePatchKegiatanPayload", () => {
  it("hanya field yang dikirim", () => {
    expect(parsePatchKegiatanPayload({ judul: "Judul Baru" })).toEqual({
      ok: true,
      data: { judul: "Judul Baru" },
      tim: undefined,
    });
  });

  it("kosongkan skema dan sumber dana, dana kembali 0", () => {
    const r = parsePatchKegiatanPayload({ skema: "", sumber_dana: null, dana_nominal: null });
    expect(r).toMatchObject({ ok: true, data: { skema: null, sumber_dana: null, dana_nominal: 0 } });
  });

  it("tim dipecah dengan aturan yang sama dengan tambah", () => {
    const r = parsePatchKegiatanPayload({ tim: "Baru Satu; Baru Dua" });
    expect(r).toMatchObject({ ok: true, data: {} });
    expect(r.ok && r.tim?.map((t) => t.peran)).toEqual(["ketua", "anggota"]);
  });

  it("tanpa field apa pun ditolak", () => {
    expect(parsePatchKegiatanPayload({})).toEqual({
      ok: false,
      message: "Minimal satu field kegiatan harus diisi untuk diperbarui.",
    });
  });

  it("status ditolak, tim kosong ditolak, jenis salah ditolak", () => {
    expect(parsePatchKegiatanPayload({ status: "x" })).toEqual({ ok: false, message: PESAN_TANPA_STATUS });
    expect(parsePatchKegiatanPayload({ tim: " ; " }).ok).toBe(false);
    expect(parsePatchKegiatanPayload({ jenis: "hibah" }).ok).toBe(false);
  });

  it("kunci dihitung ulang dari nilai lama dan baru", () => {
    const lama = { jenis: "penelitian" as const, judul: "Judul Lama", tahun: 2024 };
    expect(hitungKunciKegiatanSetelahUbah(lama, {})).toBe(kunciKegiatan("penelitian", "Judul Lama", 2024));
    expect(hitungKunciKegiatanSetelahUbah(lama, { judul: "Judul Baru" })).toBe(kunciKegiatan("penelitian", "Judul Baru", 2024));
    expect(hitungKunciKegiatanSetelahUbah(lama, { jenis: "pengabdian", tahun: 2025 })).toBe(
      kunciKegiatan("pengabdian", "Judul Lama", 2025),
    );
  });
});

describe("rencanakanAnggota", () => {
  const SAYA = { dosenId: 7, namaNormal: "saya sendiri" };
  const baris = (nama_normal: string, peran: "ketua" | "anggota", dosen_id: number | null): BarisAnggota => ({
    nama: nama_normal.toUpperCase(),
    nama_normal,
    peran,
    dosen_id,
  });
  const peta = new Map([["rekan dosen", 9]]);

  it("tim sama persis: tidak ada perubahan", () => {
    const r = rencanakanAnggota({
      existing: [{ ...baris("saya sendiri", "ketua", 7), nama: "Saya Sendiri" }],
      tim: [{ nama: "Saya Sendiri", nama_normal: "saya sendiri", peran: "ketua" }],
      petaDosen: peta,
      pengguna: SAYA,
    });
    expect(r).toEqual({ hapus: [], buat: [], ubah: [], turunkan: [] });
  });

  it("nama baru dicocokkan ke dosen terdaftar lewat peta, nama pengguna diberi dosen_id sendiri", () => {
    const r = rencanakanAnggota({
      existing: [],
      tim: [
        { nama: "Saya Sendiri", nama_normal: "saya sendiri", peran: "ketua" },
        { nama: "Rekan Dosen", nama_normal: "rekan dosen", peran: "anggota" },
        { nama: "Orang Luar", nama_normal: "orang luar", peran: "anggota" },
      ],
      petaDosen: peta,
      pengguna: SAYA,
    });
    expect(r.buat.map((b) => [b.nama_normal, b.dosen_id])).toEqual([
      ["saya sendiri", 7],
      ["rekan dosen", 9],
      ["orang luar", null],
    ]);
  });

  it("nama tanpa dosen_id yang dikeluarkan dari tim dihapus", () => {
    const r = rencanakanAnggota({
      existing: [baris("saya sendiri", "ketua", 7), baris("orang luar", "anggota", null)],
      tim: [{ nama: "SAYA SENDIRI", nama_normal: "saya sendiri", peran: "ketua" }],
      petaDosen: peta,
      pengguna: SAYA,
    });
    expect(r.hapus).toEqual(["orang luar"]);
  });

  it("dosen terdaftar lain yang dikeluarkan dari tim TIDAK dihapus", () => {
    const r = rencanakanAnggota({
      existing: [baris("saya sendiri", "ketua", 7), baris("dosen lain", "anggota", 9)],
      tim: [{ nama: "SAYA SENDIRI", nama_normal: "saya sendiri", peran: "ketua" }],
      petaDosen: peta,
      pengguna: SAYA,
    });
    expect(r.hapus).toEqual([]);
    expect(r.turunkan).toEqual([]);
  });

  it("dosen lain yang tadinya ketua dan dikeluarkan turun menjadi anggota, supaya tidak ada dua ketua", () => {
    const r = rencanakanAnggota({
      existing: [baris("dosen lain", "ketua", 9), baris("saya sendiri", "anggota", 7)],
      tim: [{ nama: "Saya Sendiri", nama_normal: "saya sendiri", peran: "ketua" }],
      petaDosen: peta,
      pengguna: SAYA,
    });
    expect(r.turunkan).toEqual(["dosen lain"]);
    expect(r.ubah).toEqual([{ nama: "Saya Sendiri", nama_normal: "saya sendiri", peran: "ketua", dosen_id: 7 }]);
  });

  it("dosen_id yang sudah terisi tidak diubah, dosen_id kosong pada nama pengguna diisi", () => {
    const r = rencanakanAnggota({
      existing: [baris("saya sendiri", "ketua", null), baris("rekan dosen", "anggota", 9)],
      tim: [
        { nama: "Saya Sendiri", nama_normal: "saya sendiri", peran: "ketua" },
        { nama: "REKAN DOSEN", nama_normal: "rekan dosen", peran: "anggota" },
      ],
      petaDosen: new Map([["rekan dosen", 99]]),
      pengguna: SAYA,
    });
    expect(r.ubah.find((u) => u.nama_normal === "saya sendiri")?.dosen_id).toBe(7);
    expect(r.ubah.find((u) => u.nama_normal === "rekan dosen")).toBeUndefined();
  });

  it("peran mengikuti posisi baru", () => {
    const r = rencanakanAnggota({
      existing: [baris("saya sendiri", "ketua", 7), baris("rekan dosen", "anggota", 9)],
      tim: [
        { nama: "REKAN DOSEN", nama_normal: "rekan dosen", peran: "ketua" },
        { nama: "SAYA SENDIRI", nama_normal: "saya sendiri", peran: "anggota" },
      ],
      petaDosen: peta,
      pengguna: SAYA,
    });
    expect(r.ubah.map((u) => [u.nama_normal, u.peran])).toEqual([
      ["rekan dosen", "ketua"],
      ["saya sendiri", "anggota"],
    ]);
  });
});
