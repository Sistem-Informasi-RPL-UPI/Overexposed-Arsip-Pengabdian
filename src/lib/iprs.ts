import { kunciIprs } from "@/lib/kunci";

export const IPRS_TAHUN_MIN = 1000;
export const IPRS_TAHUN_MAX = 9999;

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
export const PESAN_IPRS_DITAUTKAN = "IPRS ini sudah ada dan sudah dihubungkan ke akunmu.";

const RE_HURUF = /\p{L}/gu;
const RE_ANGKA = /\p{N}/u;
const RE_JUDUL_AWAL = /^[\p{L}\p{N}"'(]/u;
const RE_JUDUL_KARAKTER = /^[\p{L}\p{N}\s.,:;!?'"()&/+-]+$/u;
const RE_SIMBOL_BERUNTUN = /([/?!.,:;+-])\1+/;
const RE_JENIS_AWAL = /^\p{L}/u;
const RE_JENIS_KARAKTER = /^[\p{L}\s.,&/()-]+$/u;
const RE_NOMOR_KARAKTER = /^[\p{L}\p{N}\s./-]+$/u;
const RE_PEMEGANG_KARAKTER = /^[\p{L}\p{N}\s;.,&()'/-]+$/u;
const RE_INVENTOR_KARAKTER = /^[\p{L}\s;.,'-]+$/u;

export interface IprsWriteData {
  judul: string;
  jenis: string;
  tahun: number;
  nomor_permohonan: string | null;
  pemegang: string | null;
  inventor: string | null;
}

type FieldResult<T> = { ok: true; value: T } | { ok: false; message: string };

function hitungHuruf(teks: string): number {
  return teks.match(RE_HURUF)?.length ?? 0;
}

function parseJudul(raw: unknown): FieldResult<string> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return { ok: false, message: "Judul IPRS harus diisi." };
  }
  if (Array.from(value).length < 3 || hitungHuruf(value) < 2) {
    return { ok: false, message: "Judul IPRS minimal 3 karakter dan mengandung minimal 2 huruf." };
  }
  if (!RE_JUDUL_AWAL.test(value) || !RE_JUDUL_KARAKTER.test(value) || RE_SIMBOL_BERUNTUN.test(value)) {
    return {
      ok: false,
      message: "Judul IPRS tidak valid (tidak boleh diawali tanda baca acak atau berisi simbol berulang).",
    };
  }
  return { ok: true, value };
}

function parseJenis(raw: unknown): FieldResult<string> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return { ok: false, message: "Jenis HKI harus diisi." };
  }
  if (Array.from(value).length > 100) {
    return { ok: false, message: "Jenis HKI maksimal 100 karakter." };
  }
  if (RE_ANGKA.test(value)) {
    return { ok: false, message: "Jenis HKI tidak boleh mengandung angka." };
  }
  if (
    hitungHuruf(value) < 2 ||
    !RE_JENIS_AWAL.test(value) ||
    !RE_JENIS_KARAKTER.test(value) ||
    RE_SIMBOL_BERUNTUN.test(value)
  ) {
    return { ok: false, message: "Jenis HKI hanya boleh berisi huruf dan tanda baca yang wajar." };
  }
  return { ok: true, value };
}

function parseTahun(raw: unknown): FieldResult<number> {
  let value: number;
  if (typeof raw === "number") {
    if (!Number.isInteger(raw)) {
      return { ok: false, message: "Tahun IPRS harus berupa bilangan bulat 4 digit." };
    }
    value = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { ok: false, message: "Tahun IPRS harus diisi." };
    }
    if (!/^\d+$/.test(trimmed)) {
      return { ok: false, message: "Tahun IPRS harus berupa bilangan bulat 4 digit." };
    }
    value = Number.parseInt(trimmed, 10);
  } else {
    return { ok: false, message: "Tahun IPRS harus diisi." };
  }

  if (value < IPRS_TAHUN_MIN || value > IPRS_TAHUN_MAX) {
    return {
      ok: false,
      message: `Tahun IPRS harus antara ${IPRS_TAHUN_MIN} dan ${IPRS_TAHUN_MAX}.`,
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
      message: "Nomor permohonan hanya boleh berisi huruf, angka, spasi, '-', '.', atau '/'.",
    };
  }
  return base;
}

function parsePemegang(raw: unknown): FieldResult<string | null> {
  const base = parseOptionalStringBase(raw, "Pemegang", 255);
  if (!base.ok || base.value === null) return base;

  if (!RE_PEMEGANG_KARAKTER.test(base.value) || RE_SIMBOL_BERUNTUN.test(base.value)) {
    return {
      ok: false,
      message: "Pemegang berisi karakter yang tidak valid (pisahkan beberapa nama dengan ';').",
    };
  }

  const daftar = base.value.split(";").map((bagian) => bagian.trim());
  if (daftar.some((nama) => hitungHuruf(nama) < 2)) {
    return {
      ok: false,
      message: "Setiap nama pemegang yang dipisahkan ';' harus valid (minimal 2 huruf).",
    };
  }

  return base;
}

function parseInventor(raw: unknown): FieldResult<string | null> {
  const base = parseOptionalStringBase(raw, "Inventor");
  if (!base.ok || base.value === null) return base;

  if (RE_ANGKA.test(base.value)) {
    return { ok: false, message: "Nama inventor tidak boleh mengandung angka." };
  }
  if (!RE_INVENTOR_KARAKTER.test(base.value) || RE_SIMBOL_BERUNTUN.test(base.value)) {
    return {
      ok: false,
      message: "Inventor hanya boleh berisi nama/gelar huruf dan dipisahkan tanda titik koma (;).",
    };
  }

  const daftar = base.value.split(";").map((bagian) => bagian.trim());
  if (daftar.some((nama) => hitungHuruf(nama) < 2)) {
    return {
      ok: false,
      message: "Setiap nama inventor yang dipisahkan ';' harus valid (minimal 2 huruf).",
    };
  }

  return base;
}

const OPTIONAL_FIELD_PARSERS = [
  {
    field: "nomor_permohonan",
    keys: ["nomor_permohonan", "nomorPermohonan"],
    parse: parseNomorPermohonan,
  },
  { field: "pemegang", keys: ["pemegang"], parse: parsePemegang },
  { field: "inventor", keys: ["inventor"], parse: parseInventor },
] as const;

/**
 * Validasi body POST IPRS manual (PRD 5.7).
 * Field `status` diabaikan bila dikirim klien karena server selalu mengisi `Diterima`.
 */
export function parseCreateIprsPayload(
  rawBody: unknown,
): { ok: true; data: IprsWriteData; kunci: string } | { ok: false; message: string } {
  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const body = rawBody as Record<string, unknown>;

  const judul = parseJudul(body.judul);
  if (!judul.ok) return judul;

  const jenis = parseJenis(body.jenis);
  if (!jenis.ok) return jenis;

  const tahun = parseTahun(body.tahun);
  if (!tahun.ok) return tahun;

  const optionals: Pick<IprsWriteData, "nomor_permohonan" | "pemegang" | "inventor"> = {
    nomor_permohonan: null,
    pemegang: null,
    inventor: null,
  };

  for (const spec of OPTIONAL_FIELD_PARSERS) {
    const raw =
      spec.keys.length === 2 ? (body[spec.keys[0]] ?? body[spec.keys[1]]) : body[spec.keys[0]];
    const parsed = spec.parse(raw);
    if (!parsed.ok) return parsed;
    optionals[spec.field] = parsed.value;
  }

  const data: IprsWriteData = {
    judul: judul.value,
    jenis: jenis.value,
    tahun: tahun.value,
    ...optionals,
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
  if (typeof rawBody !== "object" || rawBody === null || Array.isArray(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const body = rawBody as Record<string, unknown>;
  const data: Partial<IprsWriteData> = {};

  if ("judul" in body) {
    const res = parseJudul(body.judul);
    if (!res.ok) return res;
    data.judul = res.value;
  }

  if ("jenis" in body) {
    const res = parseJenis(body.jenis);
    if (!res.ok) return res;
    data.jenis = res.value;
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
    "nomor_permohonan" in patch ? (patch.nomor_permohonan ?? null) : existing.nomor_permohonan;
  const nextJudul = patch.judul ?? existing.judul;
  const nextTahun = patch.tahun ?? existing.tahun;
  return kunciIprs(nextNomor, nextJudul, nextTahun);
}
