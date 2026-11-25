import { kunciBuku } from "@/lib/kunci";
import {
  isPlainObject,
  parseDaftarNamaTitikKoma,
  parseJudulTridarma,
  parseLabelHurufOpsional,
  parseOptionalFieldsCreate,
  parseOptionalFieldsPatch,
  parseOptionalStringBase,
  parseTahunTridarma,
  parseTeksBerhurufOpsional,
  TRIDARMA_TAHUN_MAX,
  TRIDARMA_TAHUN_MIN,
  type FieldResult,
  type OptionalFieldSpec,
} from "@/lib/tridarma";

export const BUKU_TAHUN_MIN = TRIDARMA_TAHUN_MIN;
export const BUKU_TAHUN_MAX = TRIDARMA_TAHUN_MAX;

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
export const PESAN_BUKU_DITAUTKAN =
  "Buku ini sudah ada dan sudah dihubungkan ke akunmu.";

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

type BukuOptionalData = Pick<
  BukuWriteData,
  "kategori" | "penulis" | "penerbit" | "tempat_terbit" | "isbn"
>;

function parseIsbn(raw: unknown): FieldResult<string | null> {
  const base = parseOptionalStringBase(raw, "ISBN", 50);
  if (!base.ok || base.value === null) return base;

  const value = base.value;
  if (
    !RE_ISBN_KARAKTER.test(value) ||
    value.startsWith("-") ||
    value.endsWith("-") ||
    value.includes("--")
  ) {
    return {
      ok: false,
      message:
        "ISBN harus berupa ISBN-10 (10 karakter) atau ISBN-13 (13 digit, awalan 978/979).",
    };
  }

  const compact = value.replace(/[\s-]+/g, "");
  if (!RE_ISBN_10.test(compact) && !RE_ISBN_13.test(compact)) {
    return {
      ok: false,
      message:
        "ISBN harus berupa ISBN-10 (10 karakter) atau ISBN-13 (13 digit, awalan 978/979).",
    };
  }

  return { ok: true, value };
}

const OPTIONAL_FIELD_PARSERS: readonly OptionalFieldSpec<BukuOptionalData>[] = [
  {
    field: "kategori",
    keys: ["kategori"],
    parse: (raw) => parseLabelHurufOpsional(raw, "Kategori", 100),
  },
  {
    field: "penulis",
    keys: ["penulis"],
    parse: (raw) =>
      parseDaftarNamaTitikKoma(raw, {
        label: "Penulis",
        labelKecil: "penulis",
        minHurufPerNama: 2,
      }),
  },
  {
    field: "penerbit",
    keys: ["penerbit"],
    parse: (raw) => parseTeksBerhurufOpsional(raw, "Penerbit", 200),
  },
  {
    field: "tempat_terbit",
    keys: ["tempat_terbit", "tempatTerbit"],
    parse: (raw) => parseTeksBerhurufOpsional(raw, "Tempat terbit", 200),
  },
  { field: "isbn", keys: ["isbn"], parse: parseIsbn },
];

export function parseCreateBukuPayload(
  rawBody: unknown,
): { ok: true; data: BukuWriteData; kunci: string } | { ok: false; message: string } {
  if (!isPlainObject(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const judul = parseJudulTridarma(rawBody.judul, "Judul buku");
  if (!judul.ok) return judul;

  const tahun = parseTahunTridarma(rawBody.tahun, "Tahun terbit");
  if (!tahun.ok) return tahun;

  const optionals = parseOptionalFieldsCreate<BukuOptionalData>(
    rawBody,
    {
      kategori: null,
      penulis: null,
      penerbit: null,
      tempat_terbit: null,
      isbn: null,
    },
    OPTIONAL_FIELD_PARSERS,
  );
  if (!optionals.ok) return optionals;

  const data: BukuWriteData = {
    judul: judul.value,
    tahun: tahun.value,
    ...optionals.value,
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
  if (!isPlainObject(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const data: Partial<BukuWriteData> = {};

  if ("judul" in rawBody) {
    const res = parseJudulTridarma(rawBody.judul, "Judul buku");
    if (!res.ok) return res;
    data.judul = res.value;
  }

  if ("tahun" in rawBody) {
    const res = parseTahunTridarma(rawBody.tahun, "Tahun terbit");
    if (!res.ok) return res;
    data.tahun = res.value;
  }

  const optionals = parseOptionalFieldsPatch<BukuOptionalData>(
    rawBody,
    data,
    OPTIONAL_FIELD_PARSERS,
  );
  if (!optionals.ok) return optionals;

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
