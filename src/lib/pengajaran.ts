import { NextResponse } from "next/server";
import type { JenisBerkas, Semester } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getPengajaranPermissions } from "@/lib/rbac";
import { getSession, type LocalSessionPayload } from "@/lib/session";
import {
  hitungHuruf,
  isPlainObject,
  parseJudulTridarma,
  parseOptionalHttpUrl,
  parseOptionalStringBase,
  parseTridarmaIdParam,
  RE_SIMBOL_BERUNTUN,
  TRIDARMA_INT_MAX,
  type FieldResult,
} from "@/lib/tridarma";

export const MATKUL_SKS_MIN = 1;
export const MATKUL_SKS_MAX = 24;
export const MATKUL_KODE_MAKS = 30;
export const MATKUL_NAMA_MAKS = 200;

export const SEMESTER_LIST: readonly Semester[] = ["Ganjil", "Genap"];
export const JENIS_BERKAS_LIST: readonly JenisBerkas[] = [
  "RPS",
  "Slide",
  "UTS",
  "UAS",
  "Kuis",
  "Presensi",
  "Nilai",
  "Modul",
];

export const PESAN_MATKUL_DUPLIKAT = "Kode mata kuliah sudah dipakai.";
export const PESAN_MATKUL_DIPAKAI =
  "Mata kuliah tidak dapat dihapus karena masih digunakan oleh kelas.";
export const PESAN_KELAS_DUPLIKAT = "Kelas ini sudah ada di data.";

export const MATKUL_PUBLIC_SELECT = {
  id: true,
  kode: true,
  nama: true,
  sks: true,
  _count: {
    select: { kelas: true },
  },
} as const;

export const KELAS_PUBLIC_SELECT = {
  id: true,
  matkul_id: true,
  dosen_id: true,
  tahun_ajaran: true,
  semester: true,
  created_at: true,
  matkul: {
    select: {
      id: true,
      kode: true,
      nama: true,
      sks: true,
    },
  },
  dosen: {
    select: {
      id: true,
      nama: true,
      sinta_id: true,
    },
  },
  _count: {
    select: { berkas: true },
  },
} as const;

export const BERKAS_PENGAJARAN_PUBLIC_SELECT = {
  id: true,
  kelas_id: true,
  jenis: true,
  judul: true,
  link: true,
  keterangan: true,
  created_at: true,
  updated_at: true,
  kelas: {
    select: {
      id: true,
      matkul_id: true,
      dosen_id: true,
      tahun_ajaran: true,
      semester: true,
      matkul: {
        select: {
          id: true,
          kode: true,
          nama: true,
        },
      },
    },
  },
} as const;

const RE_KODE_MATKUL = /^[\p{L}\p{N}][\p{L}\p{N}._-]{0,29}$/u;
const RE_TAHUN_AJARAN = /^\d{4}\/\d{4}$/;

export type PengajaranViewerAuth =
  | {
      ok: true;
      session: LocalSessionPayload;
      role: ReturnType<typeof getPengajaranPermissions>["role"];
      dosenId: number | null;
    }
  | { ok: false; response: NextResponse };

export type MatkulManagerAuth =
  | { ok: true; session: LocalSessionPayload }
  | { ok: false; response: NextResponse };

export type DosenPengajaranWriterAuth =
  | { ok: true; session: LocalSessionPayload; dosenId: number }
  | { ok: false; response: NextResponse };

/**
 * Validasi akses baca pengajaran (PRD 5.4):
 * Hanya Dosen, Kaprodi, dan Staff Kaprodi / Admin. Mahasiswa dan Umum ditolak.
 */
export async function requirePengajaranViewer(
  namaObjek = "data pengajaran",
): Promise<PengajaranViewerAuth> {
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

  const perms = getPengajaranPermissions(session);
  if (!perms.canViewPengajaran) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: `Anda tidak memiliki izin untuk melihat ${namaObjek}.` },
        { status: 403 },
      ),
    };
  }

  let dosenId: number | null = session.dosen_id ?? null;
  if (perms.role === "Dosen") {
    try {
      const dosen = await db.dosen.findUnique({
        where: { user_id: session.sub },
        select: { id: true },
      });
      dosenId = dosen?.id ?? null;
    } catch (error) {
      console.error("requirePengajaranViewer:", error);
      return {
        ok: false,
        response: NextResponse.json(
          { message: "Gagal memeriksa data dosen." },
          { status: 500 },
        ),
      };
    }
  }

  return { ok: true, session, role: perms.role, dosenId };
}

/**
 * Validasi akses tulis matkul (PRD 5.4):
 * Hanya Kaprodi dan Staff Kaprodi / Admin. Dosen, Mahasiswa, dan Umum ditolak 403.
 */
export async function requireMatkulManager(): Promise<MatkulManagerAuth> {
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

  if (!getPengajaranPermissions(session).canManageMatkul) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Anda tidak memiliki izin untuk mengelola mata kuliah." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, session };
}

/**
 * Validasi akses tulis kelas & berkas pengajaran (PRD 5.4):
 * Hanya Dosen (dan wajib sudah memiliki baris dosen / mengisi sinta_id).
 * Kaprodi dan Staff Kaprodi tidak boleh menambah, mengubah, atau menghapus kelas maupun berkas (403).
 */
export async function requireDosenPengajaranWriter(
  namaObjek = "data pengajaran",
): Promise<DosenPengajaranWriterAuth> {
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

  if (!getPengajaranPermissions(session).canManageOwnKelasBerkas) {
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
    console.error("requireDosenPengajaranWriter:", error);
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Gagal memeriksa data dosen." },
        { status: 500 },
      ),
    };
  }
}

// ===== Validasi Matkul =====

export interface MatkulWriteData {
  kode: string;
  nama: string;
  sks: number;
}

function parseKodeMatkul(raw: unknown): FieldResult<string> {
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  if (!value) {
    return { ok: false, message: "Kode mata kuliah harus diisi." };
  }
  if (Array.from(value).length > MATKUL_KODE_MAKS) {
    return {
      ok: false,
      message: `Kode mata kuliah maksimal ${MATKUL_KODE_MAKS} karakter.`,
    };
  }
  if (
    !RE_KODE_MATKUL.test(value) ||
    hitungHuruf(value) < 1 ||
    RE_SIMBOL_BERUNTUN.test(value)
  ) {
    return {
      ok: false,
      message:
        "Kode mata kuliah hanya boleh berisi huruf kapital, angka, '-', '_', atau '.' dan mengandung huruf.",
    };
  }
  return { ok: true, value };
}

function parseSksMatkul(raw: unknown): FieldResult<number> {
  let value: number;
  if (typeof raw === "number") {
    if (!Number.isInteger(raw)) {
      return { ok: false, message: "SKS harus berupa bilangan bulat." };
    }
    value = raw;
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return { ok: false, message: "SKS harus diisi." };
    }
    if (!/^\d+$/.test(trimmed)) {
      return { ok: false, message: "SKS harus berupa bilangan bulat." };
    }
    value = Number.parseInt(trimmed, 10);
  } else {
    return { ok: false, message: "SKS harus diisi." };
  }

  if (value < MATKUL_SKS_MIN || value > MATKUL_SKS_MAX) {
    return {
      ok: false,
      message: `SKS harus antara ${MATKUL_SKS_MIN} dan ${MATKUL_SKS_MAX}.`,
    };
  }
  return { ok: true, value };
}

export function parseCreateMatkulPayload(
  rawBody: unknown,
): { ok: true; data: MatkulWriteData } | { ok: false; message: string } {
  if (!isPlainObject(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const kode = parseKodeMatkul(rawBody.kode);
  if (!kode.ok) return kode;

  const nama = parseJudulTridarma(
    rawBody.nama,
    "Nama mata kuliah",
    MATKUL_NAMA_MAKS,
  );
  if (!nama.ok) return nama;

  const sks = parseSksMatkul(rawBody.sks);
  if (!sks.ok) return sks;

  return {
    ok: true,
    data: {
      kode: kode.value,
      nama: nama.value,
      sks: sks.value,
    },
  };
}

export function parsePatchMatkulPayload(
  rawBody: unknown,
):
  | { ok: true; data: Partial<MatkulWriteData> }
  | { ok: false; message: string } {
  if (!isPlainObject(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const data: Partial<MatkulWriteData> = {};

  if ("kode" in rawBody) {
    const res = parseKodeMatkul(rawBody.kode);
    if (!res.ok) return res;
    data.kode = res.value;
  }

  if ("nama" in rawBody) {
    const res = parseJudulTridarma(
      rawBody.nama,
      "Nama mata kuliah",
      MATKUL_NAMA_MAKS,
    );
    if (!res.ok) return res;
    data.nama = res.value;
  }

  if ("sks" in rawBody) {
    const res = parseSksMatkul(rawBody.sks);
    if (!res.ok) return res;
    data.sks = res.value;
  }

  if (Object.keys(data).length === 0) {
    return {
      ok: false,
      message: "Minimal satu field mata kuliah harus diisi untuk diperbarui.",
    };
  }

  return { ok: true, data };
}

export async function isMatkulKodeTaken(
  kode: string,
  excludeId?: number,
): Promise<boolean> {
  const duplicate = await db.matkul.findFirst({
    where: {
      kode: { equals: kode, mode: "insensitive" },
      ...(excludeId !== undefined ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  return duplicate !== null;
}

// ===== Validasi Kelas =====

export interface KelasWriteData {
  matkul_id: number;
  tahun_ajaran: string;
  semester: Semester;
}

function parsePositiveIdField(raw: unknown, label: string): FieldResult<number> {
  if (typeof raw === "number") {
    if (!Number.isInteger(raw) || raw < 1 || raw > TRIDARMA_INT_MAX) {
      return { ok: false, message: `${label} tidak valid.` };
    }
    return { ok: true, value: raw };
  }
  if (typeof raw === "string") {
    const parsed = parseTridarmaIdParam(raw.trim());
    if (parsed !== null) return { ok: true, value: parsed };
  }
  return { ok: false, message: `${label} harus diisi.` };
}

function parseTahunAjaran(raw: unknown): FieldResult<string> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return { ok: false, message: "Tahun ajaran harus diisi." };
  }
  if (!RE_TAHUN_AJARAN.test(value)) {
    return {
      ok: false,
      message: "Tahun ajaran harus berformat YYYY/YYYY (contoh: 2025/2026).",
    };
  }
  const [awal, akhir] = value.split("/").map((bagian) => Number.parseInt(bagian, 10));
  if (akhir !== awal + 1) {
    return {
      ok: false,
      message: "Tahun ajaran harus berurutan (contoh: 2025/2026).",
    };
  }
  return { ok: true, value };
}

function parseSemester(raw: unknown): FieldResult<Semester> {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!value) {
    return { ok: false, message: "Semester harus diisi." };
  }
  const cocok = SEMESTER_LIST.find((s) => s.toLowerCase() === value);
  if (!cocok) {
    return { ok: false, message: "Semester harus Ganjil atau Genap." };
  }
  return { ok: true, value: cocok };
}

export function parseCreateKelasPayload(
  rawBody: unknown,
): { ok: true; data: KelasWriteData } | { ok: false; message: string } {
  if (!isPlainObject(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const matkulId = parsePositiveIdField(
    rawBody.matkul_id ?? rawBody.matkulId,
    "ID mata kuliah",
  );
  if (!matkulId.ok) return matkulId;

  const tahunAjaran = parseTahunAjaran(
    rawBody.tahun_ajaran ?? rawBody.tahunAjaran,
  );
  if (!tahunAjaran.ok) return tahunAjaran;

  const semester = parseSemester(rawBody.semester);
  if (!semester.ok) return semester;

  return {
    ok: true,
    data: {
      matkul_id: matkulId.value,
      tahun_ajaran: tahunAjaran.value,
      semester: semester.value,
    },
  };
}

export function parsePatchKelasPayload(
  rawBody: unknown,
):
  | { ok: true; data: Partial<KelasWriteData> }
  | { ok: false; message: string } {
  if (!isPlainObject(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const data: Partial<KelasWriteData> = {};

  if ("matkul_id" in rawBody || "matkulId" in rawBody) {
    const raw =
      "matkul_id" in rawBody ? rawBody.matkul_id : rawBody.matkulId;
    const res = parsePositiveIdField(raw, "ID mata kuliah");
    if (!res.ok) return res;
    data.matkul_id = res.value;
  }

  if ("tahun_ajaran" in rawBody || "tahunAjaran" in rawBody) {
    const raw =
      "tahun_ajaran" in rawBody ? rawBody.tahun_ajaran : rawBody.tahunAjaran;
    const res = parseTahunAjaran(raw);
    if (!res.ok) return res;
    data.tahun_ajaran = res.value;
  }

  if ("semester" in rawBody) {
    const res = parseSemester(rawBody.semester);
    if (!res.ok) return res;
    data.semester = res.value;
  }

  if (Object.keys(data).length === 0) {
    return {
      ok: false,
      message: "Minimal satu field kelas harus diisi untuk diperbarui.",
    };
  }

  return { ok: true, data };
}

// ===== Validasi Berkas Pengajaran =====

export interface BerkasPengajaranWriteData {
  kelas_id: number;
  jenis: JenisBerkas;
  judul: string | null;
  link: string;
  keterangan: string | null;
}

function parseJenisBerkas(raw: unknown): FieldResult<JenisBerkas> {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!value) {
    return { ok: false, message: "Jenis berkas harus diisi." };
  }
  const cocok = JENIS_BERKAS_LIST.find((j) => j.toLowerCase() === value);
  if (!cocok) {
    return {
      ok: false,
      message: `Jenis berkas harus salah satu dari: ${JENIS_BERKAS_LIST.join(", ")}.`,
    };
  }
  return { ok: true, value: cocok };
}

function parseRequiredHttpUrl(raw: unknown, label: string): FieldResult<string> {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) {
    return { ok: false, message: `${label} harus diisi.` };
  }
  const parsed = parseOptionalHttpUrl(value, label);
  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value! };
}

export function parseCreateBerkasPengajaranPayload(
  rawBody: unknown,
):
  | { ok: true; data: BerkasPengajaranWriteData }
  | { ok: false; message: string } {
  if (!isPlainObject(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const kelasId = parsePositiveIdField(
    rawBody.kelas_id ?? rawBody.kelasId,
    "ID kelas",
  );
  if (!kelasId.ok) return kelasId;

  const jenis = parseJenisBerkas(rawBody.jenis);
  if (!jenis.ok) return jenis;

  const link = parseRequiredHttpUrl(
    rawBody.link ?? rawBody.link_berkas ?? rawBody.linkBerkas,
    "Link berkas",
  );
  if (!link.ok) return link;

  const judul = parseOptionalStringBase(rawBody.judul, "Judul berkas", 255);
  if (!judul.ok) return judul;

  const keterangan = parseOptionalStringBase(
    rawBody.keterangan,
    "Keterangan",
    500,
  );
  if (!keterangan.ok) return keterangan;

  return {
    ok: true,
    data: {
      kelas_id: kelasId.value,
      jenis: jenis.value,
      judul: judul.value,
      link: link.value,
      keterangan: keterangan.value,
    },
  };
}

export function parsePatchBerkasPengajaranPayload(
  rawBody: unknown,
):
  | { ok: true; data: Partial<BerkasPengajaranWriteData> }
  | { ok: false; message: string } {
  if (!isPlainObject(rawBody)) {
    return { ok: false, message: "Body request tidak valid." };
  }

  const data: Partial<BerkasPengajaranWriteData> = {};

  if ("kelas_id" in rawBody || "kelasId" in rawBody) {
    const raw = "kelas_id" in rawBody ? rawBody.kelas_id : rawBody.kelasId;
    const res = parsePositiveIdField(raw, "ID kelas");
    if (!res.ok) return res;
    data.kelas_id = res.value;
  }

  if ("jenis" in rawBody) {
    const res = parseJenisBerkas(rawBody.jenis);
    if (!res.ok) return res;
    data.jenis = res.value;
  }

  if ("link" in rawBody || "link_berkas" in rawBody || "linkBerkas" in rawBody) {
    const raw =
      "link" in rawBody
        ? rawBody.link
        : "link_berkas" in rawBody
          ? rawBody.link_berkas
          : rawBody.linkBerkas;
    const res = parseRequiredHttpUrl(raw, "Link berkas");
    if (!res.ok) return res;
    data.link = res.value;
  }

  if ("judul" in rawBody) {
    const res = parseOptionalStringBase(rawBody.judul, "Judul berkas", 255);
    if (!res.ok) return res;
    data.judul = res.value;
  }

  if ("keterangan" in rawBody) {
    const res = parseOptionalStringBase(rawBody.keterangan, "Keterangan", 500);
    if (!res.ok) return res;
    data.keterangan = res.value;
  }

  if (Object.keys(data).length === 0) {
    return {
      ok: false,
      message:
        "Minimal satu field berkas pengajaran harus diisi untuk diperbarui.",
    };
  }

  return { ok: true, data };
}
