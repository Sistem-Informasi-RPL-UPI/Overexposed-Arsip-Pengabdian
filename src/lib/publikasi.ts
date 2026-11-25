import { kunciPublikasi } from "@/lib/kunci";
import {
  hitungHuruf,
  isPlainObject,
  parseDaftarNamaTitikKoma,
  parseJudulTridarma,
  parseLabelHurufOpsional,
  parseOptionalFieldsCreate,
  parseOptionalFieldsPatch,
  parseOptionalHttpUrl,
  parseOptionalStringBase,
  parseTahunTridarma,
  parseTeksBerhurufOpsional,
  RE_SIMBOL_BERUNTUN,
  TRIDARMA_INT_MAX,
  TRIDARMA_TAHUN_MAX,
  TRIDARMA_TAHUN_MIN,
  type FieldResult,
  type OptionalFieldSpec,
} from "@/lib/tridarma";

export const PUBLIKASI_TAHUN_MIN = TRIDARMA_TAHUN_MIN;
export const PUBLIKASI_TAHUN_MAX = TRIDARMA_TAHUN_MAX;

export const PUBLIKASI_PUBLIC_SELECT = {
  id: true,
  judul_hash: true,
  judul: true,
  tahun: true,
  penulis: true,
  jurnal: true,
  sitasi: true,
  link: true,
  kuartil: true,
  jenis: true,
  penerbit: true,
  doi: true,
  akreditasi: true,
  sumber: true,
  created_at: true,
  updated_at: true,
} as const;

export const PESAN_PUBLIKASI_DUPLIKAT = "Paper ini sudah ada di data.";
export const PESAN_PUBLIKASI_DITAUTKAN =
  "Paper ini sudah ada dan sudah dihubungkan ke akunmu.";

export interface PublikasiWriteData {
  judul: string;
  tahun: number;
  penulis: string | null;
  jurnal: string | null;
  link: string | null;
  jenis: string | null;
  penerbit: string | null;
  doi: string | null;
  sitasi: number;
  kuartil: string | null;
  akreditasi: string | null;
}

type PublikasiOptionalData = Omit<PublikasiWriteData, "judul" | "tahun">;

function parseSitasi(raw: unknown): FieldResult<number> {
  if (raw === undefined || raw === null) {
    return { ok: true, value: 0 };
  }

  let value: number;
  if (typeof raw === "number") {
    if (!Number.isInteger(raw)) {
      return {
        ok: false,
        message: "Sitasi harus berupa bilangan bulat 0 atau lebih.",
      };
    }
    value = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { ok: true, value: 0 };
    }
    if (!/^\d+$/.test(trimmed)) {
      return {
        ok: false,
        message: "Sitasi harus berupa bilangan bulat 0 atau lebih.",
      };
    }
    value = Number.parseInt(trimmed, 10);
  } else {
    return {
      ok: false,
      message: "Sitasi harus berupa bilangan bulat 0 atau lebih.",
    };
  }

  if (value < 0 || value > TRIDARMA_INT_MAX) {
    return {
      ok: false,
      message: "Sitasi harus berupa bilangan bulat 0 atau lebih.",
    };
  }

  return { ok: true, value };
}

function parseDoi(raw: unknown): FieldResult<string | null> {
  const base = parseOptionalStringBase(raw, "DOI", 150);
  if (!base.ok || base.value === null) return base;

  if (!/[\p{L}\p{N}]/u.test(base.value) || /\s/.test(base.value)) {
    return {
      ok: false,
      message: "DOI tidak valid (tidak boleh mengandung spasi atau hanya simbol).",
    };
  }
  return base;
}

function parseKuartilAtauAkreditasi(
  raw: unknown,
  label: string,
  maxLength: number,
): FieldResult<string | null> {
  const base = parseOptionalStringBase(raw, label, maxLength);
  if (!base.ok || base.value === null) return base;

  if (
    hitungHuruf(base.value) < 1 ||
    !/^[\p{L}\p{N}\s.()-]+$/u.test(base.value) ||
    RE_SIMBOL_BERUNTUN.test(base.value)
  ) {
    return {
      ok: false,
      message: `${label} hanya boleh berisi huruf/angka yang wajar (contoh: Q1, SINTA 2).`,
    };
  }
  return base;
}

const OPTIONAL_FIELD_PARSERS: readonly OptionalFieldSpec<PublikasiOptionalData>[] =
  [
    {
      field: "penulis",
      keys: ["penulis"],
      parse: (raw) =>
        parseDaftarNamaTitikKoma(raw, {
          label: "Penulis",
          labelKecil: "penulis",
          minHurufPerNama: 1,
        }),
    },
    {
      field: "jurnal",
      keys: ["jurnal"],
      parse: (raw) => parseTeksBerhurufOpsional(raw, "Jurnal"),
    },
    {
      field: "link",
      keys: ["link"],
      parse: (raw) => parseOptionalHttpUrl(raw, "Link publikasi"),
    },
    {
      field: "jenis",
      keys: ["jenis"],
      parse: (raw) => parseLabelHurufOpsional(raw, "Jenis publikasi", 50),
    },
    {
      field: "penerbit",
      keys: ["penerbit"],
      parse: (raw) => parseTeksBerhurufOpsional(raw, "Penerbit", 200),
    },
    {
      field: "doi",
      keys: ["doi"],
      parse: parseDoi,
    },
    {
      field: "sitasi",
      keys: ["sitasi"],
      parse: parseSitasi,
    },
    {
      field: "kuartil",
      keys: ["kuartil"],
      parse: (raw) => parseKuartilAtauAkreditasi(raw, "Kuartil", 10),
    },
    {
      field: "akreditasi",
      keys: ["akreditasi"],
      parse: (raw) => parseKuartilAtauAkreditasi(raw, "Akreditasi", 50),
    },
  ];

export function parseCreatePublikasiPayload(
  rawBody: unknown,
):
  | { ok: true; data: PublikasiWriteData; kunci: string }
  | { ok: false; message: string } {
  if (!isPlainObject(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const judul = parseJudulTridarma(rawBody.judul, "Judul publikasi");
  if (!judul.ok) return judul;

  const tahun = parseTahunTridarma(rawBody.tahun, "Tahun publikasi");
  if (!tahun.ok) return tahun;

  const optionals = parseOptionalFieldsCreate<PublikasiOptionalData>(
    rawBody,
    {
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
    OPTIONAL_FIELD_PARSERS,
  );
  if (!optionals.ok) return optionals;

  const data: PublikasiWriteData = {
    judul: judul.value,
    tahun: tahun.value,
    ...optionals.value,
  };

  return {
    ok: true,
    data,
    kunci: kunciPublikasi(data.judul),
  };
}

export function parsePatchPublikasiPayload(
  rawBody: unknown,
):
  | { ok: true; data: Partial<PublikasiWriteData> }
  | { ok: false; message: string } {
  if (!isPlainObject(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const data: Partial<PublikasiWriteData> = {};

  if ("judul" in rawBody) {
    const res = parseJudulTridarma(rawBody.judul, "Judul publikasi");
    if (!res.ok) return res;
    data.judul = res.value;
  }

  if ("tahun" in rawBody) {
    const res = parseTahunTridarma(rawBody.tahun, "Tahun publikasi");
    if (!res.ok) return res;
    data.tahun = res.value;
  }

  const optionals = parseOptionalFieldsPatch<PublikasiOptionalData>(
    rawBody,
    data,
    OPTIONAL_FIELD_PARSERS,
  );
  if (!optionals.ok) return optionals;

  if (Object.keys(data).length === 0) {
    return {
      ok: false,
      message: "Minimal satu field publikasi harus diisi untuk diperbarui.",
    };
  }

  return { ok: true, data };
}

export function hitungKunciPublikasiSetelahUbah(
  existing: { judul: string },
  patch: Partial<PublikasiWriteData>,
): string {
  return kunciPublikasi(patch.judul ?? existing.judul);
}
