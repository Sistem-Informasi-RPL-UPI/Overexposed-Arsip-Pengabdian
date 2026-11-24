import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSinkronPermissions } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { KANDIDAT_SELECT } from "@/lib/sinkron";
import { prosesSinkron } from "@/lib/sinkron-proses";

// Batas waktu fungsi di Vercel. Panggilan ke layanan crawler berhenti lebih awal (TIMEOUT_SYNC_MS),
// supaya pesanan IN_PROGRESS sempat dikembalikan bila layanan tidak menjawab.
export const maxDuration = 30;

// Sinkron diri sendiri (PRD 8.1). sinta_id diambil dari baris dosen milik sub sesi, bukan dari klien.
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  if (!getSinkronPermissions(session).canSyncSelf) {
    return NextResponse.json({ message: "Anda tidak memiliki izin untuk menjalankan sinkron." }, { status: 403 });
  }

  try {
    const dosen = await db.dosen.findUnique({ where: { user_id: session.sub }, select: KANDIDAT_SELECT });
    if (!dosen || !dosen.sinta_id) {
      return NextResponse.json({ message: "Isi sinta_id dulu sebelum menjalankan sinkron." }, { status: 400 });
    }

    const hasil = await prosesSinkron({
      kandidat: [dosen],
      sintaId: dosen.sinta_id,
      pemicu: { id: session.sub, nama: session.name },
    });
    return NextResponse.json(hasil.body, { status: hasil.status });
  } catch (error) {
    console.error("POST Sinkron dosen:", error);
    return NextResponse.json({ message: "Gagal memulai sinkron." }, { status: 500 });
  }
}
