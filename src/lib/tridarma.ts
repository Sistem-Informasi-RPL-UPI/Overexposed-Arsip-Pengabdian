import { NextRequest, NextResponse } from "next/server";
import type { SumberData } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getTridharmaPermissions } from "@/lib/rbac";
import { getSession, type LocalSessionPayload } from "@/lib/session";

/** Status IPRS yang diisi server untuk data manual (PRD 5.7). IPRS hasil crawl menyimpan status SINTA apa adanya. */
export const STATUS_IPRS_MANUAL = "Diterima";

export const SUMBER_SINTA: SumberData = "sinta";
export const SUMBER_MANUAL: SumberData = "manual";

export const TRIDARMA_INT_MAX = 2147483647;

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
