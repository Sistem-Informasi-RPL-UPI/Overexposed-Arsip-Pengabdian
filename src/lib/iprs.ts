import { kunciIprs } from "@/lib/kunci";
import {
  isPlainObject,
  parseDaftarNamaTitikKoma,
  parseJudulTridarma,
  parseLabelHurufWajib,
  parseOptionalFieldsCreate,
  parseOptionalFieldsPatch,
  parseOptionalStringBase,
  parseTahunTridarma,
  RE_SIMBOL_BERUNTUN,
  TRIDARMA_TAHUN_MAX,
  TRIDARMA_TAHUN_MIN,
  type FieldResult,
  type OptionalFieldSpec,
} from "@/lib/tridarma";

export const IPRS_TAHUN_MIN = TRIDARMA_TAHUN_MIN;
export const IPRS_TAHUN_MAX = TRIDARMA_TAHUN_MAX;

export const IPRS_PUBLIC_SELECT = {
  id: true,
  kunci: true,
  judul: true,
  jenis: true,
  tahun: true,
  nomor_permohonan: true,
  status: true,
  pemegang: true,
  inventor: true,
  sumber: true,
  created_at: true,
  updated_at: true,
} as const;

export const PESAN_IPRS_DUPLIKAT = "IPRS ini sudah ada di data.";
export const PESAN_IPRS_DITAUTKAN =
  "IPRS ini sudah ada dan sudah dihubungkan ke akunmu.";

const RE_NOMOR_KARAKTER = /^[\p{L}\p{N}\s./-]+$/u;

export interface IprsWriteData {
  judul: string;
  jenis: string;
  tahun: number;
  nomor_permohonan: string | null;
  pemegang: string | null;
  inventor: string | null;
}

type IprsOptionalData = Pick<
  IprsWriteData,
  "nomor_permohonan" | "pemegang" | "inventor"
>;

function parseNomorPermohonan(raw: unknown): FieldResult<string | null> {
  const base = parseOptionalStringBase(raw, "Nomor permohonan", 100);
  if (!base.ok || base.value === null) return base;

  if (
    !RE_NOMOR_KARAKTER.test(base.value) ||
    RE_SIMBOL_BERUNTUN.test(base.value) ||
    !/[\p{L}\p{N}]/u.test(base.value)
  ) {
    return {
      ok: false,
      message:
        "Nomor permohonan hanya boleh berisi huruf, angka, spasi, '-', '.', atau '/'.",
    };
  }
  return base;
}

const OPTIONAL_FIELD_PARSERS: readonly OptionalFieldSpec<IprsOptionalData>[] = [
  {
    field: "nomor_permohonan",
    keys: ["nomor_permohonan", "nomorPermohonan"],
    parse: parseNomorPermohonan,
  },
  {
    field: "pemegang",
    keys: ["pemegang"],
    parse: (raw) =>
      parseDaftarNamaTitikKoma(raw, {
        label: "Pemegang",
        labelKecil: "pemegang",
        allowDigits: true,
        minHurufPerNama: 2,
        maxLength: 255,
      }),
  },
  {
    field: "inventor",
    keys: ["inventor"],
    parse: (raw) =>
      parseDaftarNamaTitikKoma(raw, {
        label: "Inventor",
        labelKecil: "inventor",
        minHurufPerNama: 2,
      }),
  },
];

/**
 * Validasi body POST IPRS manual (PRD 5.7).
 * Field `status` diabaikan bila dikirim klien karena server selalu mengisi `Diterima`.
 */
export function parseCreateIprsPayload(
  rawBody: unknown,
): { ok: true; data: IprsWriteData; kunci: string } | { ok: false; message: string } {
  if (!isPlainObject(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const judul = parseJudulTridarma(rawBody.judul, "Judul IPRS");
  if (!judul.ok) return judul;

  const jenis = parseLabelHurufWajib(rawBody.jenis, "Jenis HKI", 100);
  if (!jenis.ok) return jenis;

  const tahun = parseTahunTridarma(rawBody.tahun, "Tahun IPRS");
  if (!tahun.ok) return tahun;

  const optionals = parseOptionalFieldsCreate<IprsOptionalData>(
    rawBody,
    {
      nomor_permohonan: null,
      pemegang: null,
      inventor: null,
    },
    OPTIONAL_FIELD_PARSERS,
  );
  if (!optionals.ok) return optionals;

  const data: IprsWriteData = {
    judul: judul.value,
    jenis: jenis.value,
    tahun: tahun.value,
    ...optionals.value,
  };

  return {
    ok: true,
    data,
    kunci: kunciIprs(data.nomor_permohonan, data.judul, data.tahun),
  };
}

/**
 * Validasi body PATCH IPRS (PRD 5.7).
 * Field `status` tidak bisa diubah pengguna (diabaikan bila ikut dikirim).
 */
export function parsePatchIprsPayload(
  rawBody: unknown,
): { ok: true; data: Partial<IprsWriteData> } | { ok: false; message: string } {
  if (!isPlainObject(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const data: Partial<IprsWriteData> = {};

  if ("judul" in rawBody) {
    const res = parseJudulTridarma(rawBody.judul, "Judul IPRS");
    if (!res.ok) return res;
    data.judul = res.value;
  }

  if ("jenis" in rawBody) {
    const res = parseLabelHurufWajib(rawBody.jenis, "Jenis HKI", 100);
    if (!res.ok) return res;
    data.jenis = res.value;
  }

  if ("tahun" in rawBody) {
    const res = parseTahunTridarma(rawBody.tahun, "Tahun IPRS");
    if (!res.ok) return res;
    data.tahun = res.value;
  }

  const optionals = parseOptionalFieldsPatch<IprsOptionalData>(
    rawBody,
    data,
    OPTIONAL_FIELD_PARSERS,
  );
  if (!optionals.ok) return optionals;

  if (Object.keys(data).length === 0) {
    return {
      ok: false,
      message: "Minimal satu field IPRS harus diisi untuk diperbarui.",
    };
  }

  return { ok: true, data };
}

export function hitungKunciIprsSetelahUbah(
  existing: { nomor_permohonan: string | null; judul: string; tahun: number | null },
  patch: Partial<IprsWriteData>,
): string {
  const nextNomor =
    "nomor_permohonan" in patch
      ? (patch.nomor_permohonan ?? null)
      : existing.nomor_permohonan;
  const nextJudul = patch.judul ?? existing.judul;
  const nextTahun = patch.tahun ?? existing.tahun;
  return kunciIprs(nextNomor, nextJudul, nextTahun);
}
