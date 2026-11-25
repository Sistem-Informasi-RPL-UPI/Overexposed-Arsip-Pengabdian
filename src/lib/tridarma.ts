import { NextRequest, NextResponse } from "next/server";
import { Prisma, type SumberData } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { catatLog, type ObjekLog } from "@/lib/log-aktivitas";
import { getTridharmaPermissions } from "@/lib/rbac";
import { getSession, type LocalSessionPayload } from "@/lib/session";

/** Status IPRS yang diisi server untuk data manual (PRD 5.7). IPRS hasil crawl menyimpan status SINTA apa adanya. */
export const STATUS_IPRS_MANUAL = "Diterima";

export const SUMBER_SINTA: SumberData = "sinta";
export const SUMBER_MANUAL: SumberData = "manual";

export const TRIDARMA_TAHUN_MIN = 1000;
export const TRIDARMA_TAHUN_MAX = 9999;
export const TRIDARMA_INT_MAX = 2147483647;

export type FieldResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

export const RE_HURUF = /\p{L}/gu;
export const RE_ANGKA = /\p{N}/u;
export const RE_JUDUL_AWAL = /^[\p{L}\p{N}"'(]/u;
export const RE_JUDUL_KARAKTER = /^[\p{L}\p{M}\p{N}\s.,:;!?'"()&/+-]+$/u;
export const RE_SIMBOL_BERUNTUN = /([/?!.,:;+-])\1+/;
export const RE_LABEL_HURUF_AWAL = /^\p{L}/u;
export const RE_LABEL_HURUF_KARAKTER = /^[\p{L}\p{M}\s.,&/()-]+$/u;
export const RE_NAMA_HURUF_KARAKTER = /^[\p{L}\p{M}\s;.,'()-]+$/u;
export const RE_NAMA_DENGAN_ANGKA_KARAKTER = /^[\p{L}\p{M}\p{N}\s;.,&()'/-]+$/u;

export function hitungHuruf(teks: string): number {
  return teks.match(RE_HURUF)?.length ?? 0;
}

export function isPlainObject(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && !Array.isArray(raw);
}

export function parseJudulTridarma(
  raw: unknown,
  label: string,
  maxLength?: number,
): FieldResult<string> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return { ok: false, message: `${label} harus diisi.` };
  }
  const panjang = Array.from(value).length;
  if (panjang < 3 || hitungHuruf(value) < 2) {
    return {
      ok: false,
      message: `${label} minimal 3 karakter dan mengandung minimal 2 huruf.`,
    };
  }
  if (maxLength !== undefined && panjang > maxLength) {
    return {
      ok: false,
      message: `${label} maksimal ${maxLength} karakter.`,
    };
  }
  if (
    !RE_JUDUL_AWAL.test(value) ||
    !RE_JUDUL_KARAKTER.test(value) ||
    RE_SIMBOL_BERUNTUN.test(value)
  ) {
    return {
      ok: false,
      message: `${label} tidak valid (tidak boleh diawali tanda baca acak atau berisi simbol berulang).`,
    };
  }
  return { ok: true, value };
}

export function parseTahunTridarma(
  raw: unknown,
  label: string,
  min = TRIDARMA_TAHUN_MIN,
  max = TRIDARMA_TAHUN_MAX,
): FieldResult<number> {
  let value: number;
  if (typeof raw === "number") {
    if (!Number.isInteger(raw)) {
      return {
        ok: false,
        message: `${label} harus berupa bilangan bulat 4 digit.`,
      };
    }
    value = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { ok: false, message: `${label} harus diisi.` };
    }
    if (!/^\d+$/.test(trimmed)) {
      return {
        ok: false,
        message: `${label} harus berupa bilangan bulat 4 digit.`,
      };
    }
    value = Number.parseInt(trimmed, 10);
  } else {
    return { ok: false, message: `${label} harus diisi.` };
  }

  if (value < min || value > max) {
    return {
      ok: false,
      message: `${label} harus antara ${min} dan ${max}.`,
    };
  }
  return { ok: true, value };
}

export function parseOptionalStringBase(
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

export function parseTeksBerhurufOpsional(
  raw: unknown,
  label: string,
  maxLength?: number,
): FieldResult<string | null> {
  const base = parseOptionalStringBase(raw, label, maxLength);
  if (!base.ok || base.value === null) return base;

  if (hitungHuruf(base.value) < 1) {
    return { ok: false, message: `${label} harus mengandung huruf.` };
  }
  return base;
}

export function parseLabelHurufOpsional(
  raw: unknown,
  label: string,
  maxLength: number,
): FieldResult<string | null> {
  const base = parseOptionalStringBase(raw, label, maxLength);
  if (!base.ok || base.value === null) return base;

  if (RE_ANGKA.test(base.value)) {
    return { ok: false, message: `${label} tidak boleh mengandung angka.` };
  }
  if (
    hitungHuruf(base.value) < 2 ||
    !RE_LABEL_HURUF_AWAL.test(base.value) ||
    !RE_LABEL_HURUF_KARAKTER.test(base.value) ||
    RE_SIMBOL_BERUNTUN.test(base.value)
  ) {
    return {
      ok: false,
      message: `${label} hanya boleh berisi huruf dan tanda baca yang wajar.`,
    };
  }
  return base;
}

export function parseLabelHurufWajib(
  raw: unknown,
  label: string,
  maxLength: number,
): FieldResult<string> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return { ok: false, message: `${label} harus diisi.` };
  }
  const parsed = parseLabelHurufOpsional(value, label, maxLength);
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value! };
}

export function parseDaftarNamaTitikKoma(
  raw: unknown,
  options: {
    label: string;
    labelKecil: string;
    allowDigits?: boolean;
    minHurufPerNama?: number;
    maxLength?: number;
  },
): FieldResult<string | null> {
  const {
    label,
    labelKecil,
    allowDigits = false,
    minHurufPerNama = 2,
    maxLength,
  } = options;
  const base = parseOptionalStringBase(raw, label, maxLength);
  if (!base.ok || base.value === null) return base;

  if (!allowDigits && RE_ANGKA.test(base.value)) {
    return {
      ok: false,
      message: `Nama ${labelKecil} tidak boleh mengandung angka.`,
    };
  }

  const pattern = allowDigits
    ? RE_NAMA_DENGAN_ANGKA_KARAKTER
    : RE_NAMA_HURUF_KARAKTER;

  if (!pattern.test(base.value) || RE_SIMBOL_BERUNTUN.test(base.value)) {
    return {
      ok: false,
      message: allowDigits
        ? `${label} berisi karakter yang tidak valid (pisahkan beberapa nama dengan ';').`
        : `${label} hanya boleh berisi nama/gelar huruf dan dipisahkan tanda titik koma (;).`,
    };
  }

  const daftar = base.value.split(";").map((bagian) => bagian.trim());
  if (daftar.some((nama) => hitungHuruf(nama) < minHurufPerNama)) {
    return {
      ok: false,
      message:
        minHurufPerNama === 1
          ? `Setiap nama ${labelKecil} yang dipisahkan ';' harus valid (minimal 1 huruf).`
          : `Setiap nama ${labelKecil} yang dipisahkan ';' harus valid (minimal ${minHurufPerNama} huruf).`,
    };
  }

  return base;
}

export function parseOptionalHttpUrl(
  raw: unknown,
  label: string,
): FieldResult<string | null> {
  const base = parseOptionalStringBase(raw, label);
  if (!base.ok || base.value === null) return base;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(base.value);
  } catch {
    return {
      ok: false,
      message: `${label} harus berupa URL yang valid (contoh: https://...).`,
    };
  }

  const isHttp =
    parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  const hasValidHost =
    parsedUrl.hostname === "localhost" || parsedUrl.hostname.includes(".");
  if (!isHttp || !hasValidHost) {
    return {
      ok: false,
      message: `${label} harus berupa URL http:// atau https:// yang valid.`,
    };
  }

  return { ok: true, value: base.value };
}

export interface OptionalFieldSpec<T extends object, K extends keyof T = keyof T> {
  field: K;
  keys: readonly [string] | readonly [string, string];
  parse: (raw: unknown) => FieldResult<T[K]>;
}

export function parseOptionalFieldsCreate<T extends object>(
  body: Record<string, unknown>,
  defaults: T,
  specs: readonly OptionalFieldSpec<T>[],
): FieldResult<T> {
  const out = { ...defaults };
  for (const spec of specs) {
    const raw =
      spec.keys.length === 2
        ? (body[spec.keys[0]] ?? body[spec.keys[1]])
        : body[spec.keys[0]];
    const parsed = spec.parse(raw);
    if (!parsed.ok) return parsed;
    out[spec.field] = parsed.value;
  }
  return { ok: true, value: out };
}

export function parseOptionalFieldsPatch<T extends object>(
  body: Record<string, unknown>,
  target: Partial<T>,
  specs: readonly OptionalFieldSpec<T>[],
): FieldResult<Partial<T>> {
  for (const spec of specs) {
    const hasKey = spec.keys.some((key) => key in body);
    if (!hasKey) continue;
    const raw =
      spec.keys.length === 2
        ? spec.keys[0] in body
          ? body[spec.keys[0]]
          : body[spec.keys[1]]
        : body[spec.keys[0]];
    const parsed = spec.parse(raw);
    if (!parsed.ok) return parsed;
    target[spec.field] = parsed.value;
  }
  return { ok: true, value: target };
}

export type TridarmaWriterAuth =
  | { ok: true; session: LocalSessionPayload; dosenId: number }
  | { ok: false; response: NextResponse };

/**
 * Validasi sesi, peran tulis modul 7 (Dosen, Kaprodi, Staff Kaprodi), dan keberadaan baris dosen
 * (pengguna wajib sudah mengisi sinta_id, PRD 5.1 & 5.7).
 */
export async function requireTridarmaWriter(
  namaObjek = "data tridarma",
): Promise<TridarmaWriterAuth> {
  const session = await getSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Silakan login terlebih dahulu." },
        { status: 401 },
      ),
    };
  }

  if (!getTridharmaPermissions(session).canManageOwn) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: `Anda tidak memiliki izin untuk mengelola ${namaObjek}.` },
        { status: 403 },
      ),
    };
  }

  try {
    const dosen = await db.dosen.findUnique({
      where: { user_id: session.sub },
      select: { id: true },
    });

    if (!dosen) {
      return {
        ok: false,
        response: NextResponse.json(
          { message: `Isi sinta_id dulu sebelum mengelola ${namaObjek}.` },
          { status: 400 },
        ),
      };
    }

    return { ok: true, session, dosenId: dosen.id };
  } catch (error) {
    console.error("requireTridarmaWriter:", error);
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Gagal memeriksa data dosen." },
        { status: 500 },
      ),
    };
  }
}

export function parseTridarmaIdParam(rawId: string): number | null {
  if (!/^\d+$/.test(rawId)) return null;
  const parsed = Number.parseInt(rawId, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > TRIDARMA_INT_MAX) {
    return null;
  }
  return parsed;
}

export async function parseTridarmaJsonBody(
  request: NextRequest,
): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Body request harus berupa JSON yang valid." },
        { status: 400 },
      ),
    };
  }
}

/**
 * Handler bersama untuk POST koleksi data manual Tridarma (buku, iprs, publikasi) sesuai PRD 5.7:
 * - Cek sesi + baris dosen
 * - Validasi body & hitung kunci anti-dobel
 * - Bila kunci cocok dengan data manual milik dosen lain -> tautkan otomatis (200, ditautkan=true)
 * - Bila kunci cocok dengan data sinta atau sudah tertaut -> tolak 409
 * - Bila belum ada -> simpan baris baru (sumber=manual) + tautan dosen pembuat (201)
 * - Catat log modul 7
 */
export async function handleTridarmaPost<
  TCreateData,
  TCreated extends { judul: string },
>(
  request: NextRequest,
  config: {
    namaObjekPenulis: string;
    objekLog: ObjekLog;
    pesanDuplikat: string;
    pesanDitautkan: string;
    pesanBerhasilTambah: string;
    pesanGagalTambah: string;
    logLabel: string;
    parsePayload: (
      rawBody: unknown,
    ) =>
      | { ok: true; data: TCreateData; kunci: string }
      | { ok: false; message: string };
    findByKunci: (
      kunci: string,
      dosenId: number,
    ) => Promise<{
      id: number;
      judul: string;
      sumber: SumberData;
      sudahTertaut: boolean;
    } | null>;
    createTautan: (itemId: number, dosenId: number) => Promise<unknown>;
    createData: (
      data: TCreateData,
      kunci: string,
      dosenId: number,
    ) => Promise<TCreated>;
  },
): Promise<NextResponse> {
  const auth = await requireTridarmaWriter(config.namaObjekPenulis);
  if (!auth.ok) return auth.response;

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = config.parsePayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const existing = await config.findByKunci(parsed.kunci, auth.dosenId);

    if (existing) {
      if (existing.sumber !== SUMBER_MANUAL || existing.sudahTertaut) {
        return NextResponse.json(
          { message: config.pesanDuplikat },
          { status: 409 },
        );
      }

      await config.createTautan(existing.id, auth.dosenId);

      await catatLog({
        userId: auth.session.sub,
        userNama: auth.session.name,
        modul: "7",
        aksi: "tambah",
        objek: config.objekLog,
        detail: existing.judul,
      });

      return NextResponse.json({
        message: config.pesanDitautkan,
        data: {
          ditautkan: true,
          id: existing.id,
          judul: existing.judul,
        },
      });
    }

    const created = await config.createData(
      parsed.data,
      parsed.kunci,
      auth.dosenId,
    );

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "tambah",
      objek: config.objekLog,
      detail: created.judul,
    });

    return NextResponse.json(
      { message: config.pesanBerhasilTambah, data: created },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: config.pesanDuplikat },
        { status: 409 },
      );
    }
    console.error(`${config.logLabel}:`, error);
    return NextResponse.json(
      { message: config.pesanGagalTambah },
      { status: 500 },
    );
  }
}

/**
 * Handler bersama untuk PATCH item Tridarma (buku, iprs, publikasi) sesuai PRD 5.7:
 * - Diizinkan untuk sumber=manual maupun sumber=sinta selama tertaut ke dosen milik pengguna
 * - Bila tidak tertaut -> 403 (termasuk Kaprodi & Staff Kaprodi)
 * - Bila perubahan membuat kunci bentrok dengan item lain -> 409
 * - Mengubah sumber menjadi manual agar crawl berikutnya hanya mengisi kolom kosong
 * - Catat log modul 7
 */
export async function handleTridarmaPatch<
  TPatchData,
  TUpdated extends { judul: string },
>(
  request: NextRequest,
  rawId: string,
  config: {
    namaObjekPenulis: string;
    labelId: string;
    objekLog: ObjekLog;
    pesanTidakDitemukan: string;
    pesanTidakDiizinkan: string;
    pesanDuplikat: string;
    pesanBerhasilUbah: string;
    pesanGagalUbah: string;
    logLabel: string;
    parsePayload: (
      rawBody: unknown,
    ) => { ok: true; data: TPatchData } | { ok: false; message: string };
    findExisting: (
      id: number,
      dosenId: number,
    ) => Promise<{
      id: number;
      judul: string;
      currentKunci: string;
      tertautKePengguna: boolean;
      hitungKunciBaru: (patch: TPatchData) => string;
    } | null>;
    findConflictByKunci: (kunci: string) => Promise<{ id: number } | null>;
    updateData: (
      id: number,
      patch: TPatchData,
      nextKunci: string,
    ) => Promise<TUpdated>;
  },
): Promise<NextResponse> {
  const auth = await requireTridarmaWriter(config.namaObjekPenulis);
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam(rawId);
  if (id === null) {
    return NextResponse.json(
      { message: `${config.labelId} tidak valid.` },
      { status: 400 },
    );
  }

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = config.parsePayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const existing = await config.findExisting(id, auth.dosenId);
    if (!existing) {
      return NextResponse.json(
        { message: config.pesanTidakDitemukan },
        { status: 404 },
      );
    }

    if (!existing.tertautKePengguna) {
      return NextResponse.json(
        { message: config.pesanTidakDiizinkan },
        { status: 403 },
      );
    }

    const nextKunci = existing.hitungKunciBaru(parsed.data);
    if (nextKunci !== existing.currentKunci) {
      const bentrok = await config.findConflictByKunci(nextKunci);
      if (bentrok && bentrok.id !== existing.id) {
        return NextResponse.json(
          { message: config.pesanDuplikat },
          { status: 409 },
        );
      }
    }

    const updated = await config.updateData(id, parsed.data, nextKunci);

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "ubah",
      objek: config.objekLog,
      detail: updated.judul,
    });

    return NextResponse.json({
      message: config.pesanBerhasilUbah,
      data: updated,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { message: config.pesanDuplikat },
          { status: 409 },
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json(
          { message: config.pesanTidakDitemukan },
          { status: 404 },
        );
      }
    }
    console.error(`${config.logLabel}:`, error);
    return NextResponse.json(
      { message: config.pesanGagalUbah },
      { status: 500 },
    );
  }
}

/**
 * Handler bersama untuk DELETE item Tridarma (buku, iprs, publikasi) sesuai PRD 5.7:
 * - Diizinkan untuk sumber=manual maupun sumber=sinta selama tertaut ke dosen milik pengguna
 * - Bila tidak tertaut -> 403
 * - Lepas tautan milik pengguna dalam transaksi; hapus baris utama hanya bila tidak ada lagi dosen yang tertaut
 * - Catat log modul 7
 */
export async function handleTridarmaDelete(
  rawId: string,
  config: {
    namaObjekPenulis: string;
    labelId: string;
    objekLog: ObjekLog;
    pesanTidakDitemukan: string;
    pesanTidakDiizinkan: string;
    pesanTerhapus: string;
    pesanTautanTerhapus: string;
    pesanGagalHapus: string;
    logLabel: string;
    findExisting: (
      id: number,
      dosenId: number,
    ) => Promise<{
      id: number;
      judul: string;
      tertautKePengguna: boolean;
    } | null>;
    hapusTautanAtauData: (id: number, dosenId: number) => Promise<boolean>;
  },
): Promise<NextResponse> {
  const auth = await requireTridarmaWriter(config.namaObjekPenulis);
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam(rawId);
  if (id === null) {
    return NextResponse.json(
      { message: `${config.labelId} tidak valid.` },
      { status: 400 },
    );
  }

  try {
    const existing = await config.findExisting(id, auth.dosenId);
    if (!existing) {
      return NextResponse.json(
        { message: config.pesanTidakDitemukan },
        { status: 404 },
      );
    }

    if (!existing.tertautKePengguna) {
      return NextResponse.json(
        { message: config.pesanTidakDiizinkan },
        { status: 403 },
      );
    }

    const dataDihapus = await config.hapusTautanAtauData(id, auth.dosenId);

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "hapus",
      objek: config.objekLog,
      detail: existing.judul,
    });

    return NextResponse.json({
      message: dataDihapus ? config.pesanTerhapus : config.pesanTautanTerhapus,
      data: {
        id: existing.id,
        judul: existing.judul,
        data_dihapus: dataDihapus,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { message: config.pesanTidakDitemukan },
        { status: 404 },
      );
    }
    console.error(`${config.logLabel}:`, error);
    return NextResponse.json(
      { message: config.pesanGagalHapus },
      { status: 500 },
    );
  }
}
