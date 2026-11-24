import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { PESAN_KEGIATAN_DUPLIKAT, parseCreateKegiatanPayload } from "@/lib/kegiatan";
import { tambahKegiatan } from "@/lib/kegiatan-tulis";
import { parseTridarmaJsonBody, requireTridarmaWriter } from "@/lib/tridarma";
import { jawabDaftar, parseDaftarFilters } from "@/lib/tridarma-baca";
import { daftarKegiatan } from "@/lib/tridarma-data";

// Terbuka untuk semua peran, termasuk Umum tanpa login (PRD 5.9). Parameter: dosen_id, jenis (penelitian atau pengabdian), tahun, skema, q, page, pageSize.
export async function GET(request: NextRequest) {
  return jawabDaftar(
    parseDaftarFilters(request.nextUrl.searchParams, { untuk: "kegiatan" }),
    (f, session) => daftarKegiatan(f, session),
    "kegiatan",
  );
}

// Tambah kegiatan manual (PRD 5.7). Peserta lewat satu kolom `tim`: nama dipisah `;`, nama pertama menjadi ketua.
export async function POST(request: NextRequest) {
  const auth = await requireTridarmaWriter("data kegiatan");
  if (!auth.ok) return auth.response;

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = parseCreateKegiatanPayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const hasil = await tambahKegiatan({
      pengguna: { session: auth.session, dosenId: auth.dosenId },
      data: parsed.data,
      tim: parsed.tim,
      kunci: parsed.kunci,
    });
    return NextResponse.json(hasil.body, { status: hasil.status });
  } catch (error) {
    // Dua permintaan yang sama masuk bersamaan: kunci unik menolak yang kedua.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: PESAN_KEGIATAN_DUPLIKAT }, { status: 409 });
    }
    console.error("POST /api/tridarma/kegiatan:", error);
    return NextResponse.json({ message: "Gagal menambah kegiatan." }, { status: 500 });
  }
}
