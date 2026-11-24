import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSinkronPermissions } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { KANDIDAT_SELECT } from "@/lib/sinkron";
import { prosesSinkron } from "@/lib/sinkron-proses";

export const maxDuration = 30;

const SINTA_ID_PATTERN = /^\d{1,20}$/;

type Bacaan = { ok: true; sintaId: string | null } | { ok: false; message: string };

// Body boleh kosong atau `{}` (semua dosen). Body yang rusak ditolak, supaya salah ketik tidak
// diam-diam menjadi "sinkron semua".
async function bacaSintaId(request: NextRequest): Promise<Bacaan> {
  const teks = (await request.text()).trim();
  if (!teks) return { ok: true, sintaId: null };

  let body: unknown;
  try {
    body = JSON.parse(teks);
  } catch {
    return { ok: false, message: "Body harus berupa JSON." };
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, message: "Body harus berupa objek JSON." };
  }

  const nilai = (body as { sinta_id?: unknown }).sinta_id;
  if (nilai === undefined || nilai === null || nilai === "") return { ok: true, sintaId: null };

  const sintaId = typeof nilai === "string" ? nilai.trim() : "";
  if (!SINTA_ID_PATTERN.test(sintaId)) {
    return { ok: false, message: "sinta_id harus berupa angka, 1 sampai 20 digit." };
  }
  return { ok: true, sintaId };
}

// Sinkron satu dosen (pilih) atau semua dosen, hanya Staff Kaprodi (PRD 8.1). proxy.ts juga membatasi rute ini.
// Aturan 7 hari tetap berlaku, tidak ada opsi paksa.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  if (!getSinkronPermissions(session).canSyncAny) {
    return NextResponse.json({ message: "Anda tidak memiliki izin untuk menjalankan sinkron." }, { status: 403 });
  }

  const bacaan = await bacaSintaId(request);
  if (!bacaan.ok) {
    return NextResponse.json({ message: bacaan.message }, { status: 400 });
  }

  try {
    let kandidat;
    if (bacaan.sintaId) {
      const dosen = await db.dosen.findUnique({ where: { sinta_id: bacaan.sintaId }, select: KANDIDAT_SELECT });
      if (!dosen) {
        return NextResponse.json({ message: "sinta_id belum terdaftar." }, { status: 404 });
      }
      kandidat = [dosen];
    } else {
      kandidat = await db.dosen.findMany({
        where: { sinta_id: { not: null } },
        select: KANDIDAT_SELECT,
        orderBy: { id: "asc" },
      });
    }

    const hasil = await prosesSinkron({
      kandidat,
      sintaId: bacaan.sintaId,
      pemicu: { id: session.sub, nama: session.name },
    });
    return NextResponse.json(hasil.body, { status: hasil.status });
  } catch (error) {
    console.error("POST Sinkron Staff Kaprodi:", error);
    return NextResponse.json({ message: "Gagal memulai sinkron." }, { status: 500 });
  }
}
