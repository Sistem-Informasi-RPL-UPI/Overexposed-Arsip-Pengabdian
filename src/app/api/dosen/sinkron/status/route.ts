import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSinkronPermissions } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { bisaSinkronLagiPada, klasifikasiSinkron, KANDIDAT_SELECT, type KandidatSinkron } from "@/lib/sinkron";

const NO_STORE = { "Cache-Control": "no-store" };
const SINTA_ID_PATTERN = /^\d{1,20}$/;

function bentuk(k: KandidatSinkron, sekarang: Date) {
  const kelas = klasifikasiSinkron(k.sync_status, k.last_synced_at, sekarang);
  return {
    sinta_id: k.sinta_id,
    sync_status: k.sync_status,
    last_synced_at: k.last_synced_at?.toISOString() ?? null,
    berjalan: kelas === "berjalan",
    // Menurut aturan 7 hari (PRD 5.3), bukan menurut siapa yang bertanya.
    bisa_sinkron: kelas === "boleh",
    bisa_sinkron_lagi_pada: bisaSinkronLagiPada(k.sync_status, k.last_synced_at, sekarang)?.toISOString() ?? null,
  };
}

/**
 * Status sinkron untuk polling front-end (PRD 8 langkah 6), langsung dari database.
 * - Tanpa parameter: baris dosen milik akun yang login.
 * - `?sinta_id=...` atau `?semua=true`: hanya Staff Kaprodi.
 * Hanya membaca, tidak memanggil layanan crawler.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  const izin = getSinkronPermissions(session);
  if (!izin.canSyncSelf) {
    return NextResponse.json({ message: "Anda tidak memiliki izin untuk melihat status sinkron." }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const sintaId = params.get("sinta_id")?.trim() || null;
  const semua = params.get("semua") === "true";

  if ((sintaId || semua) && !izin.canSyncAny) {
    return NextResponse.json({ message: "Anda tidak memiliki izin untuk melihat status dosen lain." }, { status: 403 });
  }
  if (sintaId && semua) {
    return NextResponse.json({ message: "Pakai sinta_id atau semua, tidak keduanya." }, { status: 400 });
  }
  if (sintaId && !SINTA_ID_PATTERN.test(sintaId)) {
    return NextResponse.json({ message: "sinta_id harus berupa angka, 1 sampai 20 digit." }, { status: 400 });
  }

  try {
    const sekarang = new Date();

    if (semua) {
      const baris = await db.dosen.findMany({
        where: { sinta_id: { not: null } },
        select: KANDIDAT_SELECT,
        orderBy: { id: "asc" },
      });
      const items = baris.map((k) => bentuk(k, sekarang));
      return NextResponse.json(
        { data: { berjalan: items.some((i) => i.berjalan), items } },
        { headers: NO_STORE },
      );
    }

    const dosen = sintaId
      ? await db.dosen.findUnique({ where: { sinta_id: sintaId }, select: KANDIDAT_SELECT })
      : await db.dosen.findUnique({ where: { user_id: session.sub }, select: KANDIDAT_SELECT });

    if (!dosen || !dosen.sinta_id) {
      const pesan = sintaId ? "sinta_id belum terdaftar." : "Isi sinta_id dulu sebelum menjalankan sinkron.";
      return NextResponse.json({ message: pesan }, { status: sintaId ? 404 : 400 });
    }

    return NextResponse.json({ data: bentuk(dosen, sekarang) }, { headers: NO_STORE });
  } catch (error) {
    console.error("GET Status sinkron:", error);
    return NextResponse.json({ message: "Gagal mengambil status sinkron." }, { status: 500 });
  }
}
