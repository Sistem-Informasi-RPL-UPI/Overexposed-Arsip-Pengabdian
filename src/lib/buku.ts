import { kunciBuku } from "@/lib/kunci";

export const BUKU_TAHUN_MIN = 1000;
export const BUKU_TAHUN_MAX = 9999;

export const BUKU_PUBLIC_SELECT = {
  id: true,
  kunci: true,
  judul: true,
  kategori: true,
  penulis: true,
  penerbit: true,
  tahun: true,
  tempat_terbit: true,
  isbn: true,
  sumber: true,
  created_at: true,
  updated_at: true,
} as const;

export const PESAN_BUKU_DUPLIKAT = "Buku ini sudah ada di data.";
export const PESAN_BUKU_DITAUTKAN = "Buku ini sudah ada dan sudah dihubungkan ke akunmu.";

const RE_HURUF = /\p{L}/gu;
const RE_ANGKA = /\p{N}/u;
const RE_JUDUL_AWAL = /^[\p{L}\p{N}"'(]/u;
const RE_JUDUL_KARAKTER = /^[\p{L}\p{N}\s.,:;!?'"()&/+-]+$/u;
const RE_SIMBOL_BERUNTUN = /([/?!.,:;+-])\1+/;
const RE_KATEGORI_KARAKTER = /^[\p{L}\s.,&/()-]+$/u;
const RE_KATEGORI_AWAL = /^\p{L}/u;
const RE_PENULIS_KARAKTER = /^[\p{L}\s;.,'-]+$/u;
const RE_ISBN_KARAKTER = /^[\dXx\s-]+$/;
const RE_ISBN_10 = /^\d{9}[\dXx]$/;
const RE_ISBN_13 = /^(978|979)\d{10}$/;

export interface BukuWriteData {
  judul: string;
  tahun: number;
  kategori: string | null;
  penulis: string | null;
  penerbit: string | null;
  tempat_terbit: string | null;
  isbn: string | null;
}

type FieldResult<T> = { ok: true; value: T } | { ok: false; message: string };

function hitungHuruf(teks: string): number {
  return teks.match(RE_HURUF)?.length ?? 0;
}

function parseJudul(raw: unknown): FieldResult<string> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return { ok: false, message: "Judul buku harus diisi." };
  }
  if (Array.from(value).length < 3 || hitungHuruf(value) < 2) {
    return { ok: false, message: "Judul buku minimal 3 karakter dan mengandung minimal 2 huruf." };
  }
  if (!RE_JUDUL_AWAL.test(value) || !RE_JUDUL_KARAKTER.test(value) || RE_SIMBOL_BERUNTUN.test(value)) {
    return {
      ok: false,
      message: "Judul buku tidak valid (tidak boleh diawali tanda baca acak atau berisi simbol berulang).",
    };
  }
  return { ok: true, value };
}

function parseTahun(raw: unknown): FieldResult<number> {
  let value: number;
  if (typeof raw === "number") {
    if (!Number.isInteger(raw)) {
      return { ok: false, message: "Tahun terbit harus berupa bilangan bulat 4 digit." };
    }
    value = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { ok: false, message: "Tahun terbit harus diisi." };
    }
    if (!/^\d+$/.test(trimmed)) {
      return { ok: false, message: "Tahun terbit harus berupa bilangan bulat 4 digit." };
    }
    value = Number.parseInt(trimmed, 10);
  } else {
    return { ok: false, message: "Tahun terbit harus diisi." };
  }

  if (value < BUKU_TAHUN_MIN || value > BUKU_TAHUN_MAX) {
    return {
      ok: false,
      message: `Tahun terbit harus antara ${BUKU_TAHUN_MIN} dan ${BUKU_TAHUN_MAX}.`,
    };
  }
  return { ok: true, value };
}

function parseOptionalStringBase(
  raw: unknown,
  label: string,
  maxLength?: number,
): FieldResult<string | null> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, message: `${label} harus berupa teks.` };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (maxLength !== undefined && Array.from(trimmed).length > maxLength) {
    return { ok: false, message: `${label} maksimal ${maxLength} karakter.` };
  }
  return { ok: true, value: trimmed };
}

function parseKategori(raw: unknown): FieldResult<string | null> {
  const base = parseOptionalStringBase(raw, "Kategori", 100);
  if (!base.ok || base.value === null) return base;

  if (RE_ANGKA.test(base.value)) {
    return { ok: false, message: "Kategori tidak boleh mengandung angka." };
  }
  if (
    hitungHuruf(base.value) < 2 ||
    !RE_KATEGORI_AWAL.test(base.value) ||
    !RE_KATEGORI_KARAKTER.test(base.value) ||
    RE_SIMBOL_BERUNTUN.test(base.value)
  ) {
    return { ok: false, message: "Kategori hanya boleh berisi huruf dan tanda baca yang wajar." };
  }
  return base;
}

function parsePenulis(raw: unknown): FieldResult<string | null> {
  const base = parseOptionalStringBase(raw, "Penulis");
  if (!base.ok || base.value === null) return base;

  if (RE_ANGKA.test(base.value)) {
    return { ok: false, message: "Nama penulis tidak boleh mengandung angka." };
  }
  if (!RE_PENULIS_KARAKTER.test(base.value) || RE_SIMBOL_BERUNTUN.test(base.value)) {
    return {
      ok: false,
      message: "Penulis hanya boleh berisi nama/gelar huruf dan dipisahkan tanda titik koma (;).",
    };
  }

  const daftar = base.value.split(";").map((bagian) => bagian.trim());
  if (daftar.some((nama) => hitungHuruf(nama) < 2)) {
    return {
      ok: false,
      message: "Setiap nama penulis yang dipisahkan ';' harus valid (minimal 2 huruf).",
    };
  }

  return base;
}

function parseIsbn(raw: unknown): FieldResult<string | null> {
  const base = parseOptionalStringBase(raw, "ISBN", 50);
  if (!base.ok || base.value === null) return base;

  const value = base.value;
  if (!RE_ISBN_KARAKTER.test(value) || value.startsWith("-") || value.endsWith("-") || value.includes("--")) {
    return {
      ok: false,
      message: "ISBN harus berupa ISBN-10 (10 karakter) atau ISBN-13 (13 digit, awalan 978/979).",
    };
  }

  const compact = value.replace(/[\s-]+/g, "");
  if (!RE_ISBN_10.test(compact) && !RE_ISBN_13.test(compact)) {
    return {
      ok: false,
      message: "ISBN harus berupa ISBN-10 (10 karakter) atau ISBN-13 (13 digit, awalan 978/979).",
    };
  }

  return { ok: true, value };
}

function parsePenerbitAtauTempat(raw: unknown, label: string): FieldResult<string | null> {
  const base = parseOptionalStringBase(raw, label, 200);
  if (!base.ok || base.value === null) return base;

  if (hitungHuruf(base.value) < 1) {
    return { ok: false, message: `${label} harus mengandung huruf.` };
  }
  return base;
}

const OPTIONAL_FIELD_PARSERS = [
  { field: "kategori", keys: ["kategori"], parse: parseKategori },
  { field: "penulis", keys: ["penulis"], parse: parsePenulis },
  {
    field: "penerbit",
    keys: ["penerbit"],
    parse: (raw: unknown) => parsePenerbitAtauTempat(raw, "Penerbit"),
  },
  {
    field: "tempat_terbit",
    keys: ["tempat_terbit", "tempatTerbit"],
    parse: (raw: unknown) => parsePenerbitAtauTempat(raw, "Tempat terbit"),
  },
  { field: "isbn", keys: ["isbn"], parse: parseIsbn },
] as const;

export function parseCreateBukuPayload(
  rawBody: unknown,
): { ok: true; data: BukuWriteData; kunci: string } | { ok: false; message: string } {
  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const body = rawBody as Record<string, unknown>;

  const judul = parseJudul(body.judul);
  if (!judul.ok) return judul;

  const tahun = parseTahun(body.tahun);
  if (!tahun.ok) return tahun;

  const optionals: Pick<
    BukuWriteData,
    "kategori" | "penulis" | "penerbit" | "tempat_terbit" | "isbn"
  > = {
    kategori: null,
    penulis: null,
    penerbit: null,
    tempat_terbit: null,
    isbn: null,
  };

  for (const spec of OPTIONAL_FIELD_PARSERS) {
    const raw =
      spec.keys.length === 2 ? (body[spec.keys[0]] ?? body[spec.keys[1]]) : body[spec.keys[0]];
    const parsed = spec.parse(raw);
    if (!parsed.ok) return parsed;
    optionals[spec.field] = parsed.value;
  }

  const data: BukuWriteData = {
    judul: judul.value,
    tahun: tahun.value,
    ...optionals,
  };

  return {
    ok: true,
    data,
    kunci: kunciBuku(data.isbn, data.judul, data.tahun),
  };
}

export function parsePatchBukuPayload(
  rawBody: unknown,
): { ok: true; data: Partial<BukuWriteData> } | { ok: false; message: string } {
  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const body = rawBody as Record<string, unknown>;
  const data: Partial<BukuWriteData> = {};

  if ("judul" in body) {
    const res = parseJudul(body.judul);
    if (!res.ok) return res;
    data.judul = res.value;
  }

  if ("tahun" in body) {
    const res = parseTahun(body.tahun);
    if (!res.ok) return res;
    data.tahun = res.value;
  }

  for (const spec of OPTIONAL_FIELD_PARSERS) {
    const hasKey = spec.keys.some((key) => key in body);
    if (!hasKey) continue;
    const raw =
      spec.keys.length === 2
        ? spec.keys[0] in body
          ? body[spec.keys[0]]
          : body[spec.keys[1]]
        : body[spec.keys[0]];
    const res = spec.parse(raw);
    if (!res.ok) return res;
    data[spec.field] = res.value;
  }

  if (Object.keys(data).length === 0) {
    return {
      ok: false,
      message: "Minimal satu field buku harus diisi untuk diperbarui.",
    };
  }

  return { ok: true, data };
}

export function hitungKunciBukuSetelahUbah(
  existing: { isbn: string | null; judul: string; tahun: number | null },
  patch: Partial<BukuWriteData>,
): string {
  const nextIsbn = "isbn" in patch ? (patch.isbn ?? null) : existing.isbn;
  const nextJudul = patch.judul ?? existing.judul;
  const nextTahun = patch.tahun ?? existing.tahun;
  return kunciBuku(nextIsbn, nextJudul, nextTahun);
}
