import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { PESAN_KEGIATAN_DUPLIKAT, parsePatchKegiatanPayload } from "@/lib/kegiatan";
import { hapusKegiatan, ubahKegiatan } from "@/lib/kegiatan-tulis";
import { parseTridarmaIdParam, parseTridarmaJsonBody, requireTridarmaWriter } from "@/lib/tridarma";
import { jawabDetail, type KonteksRute } from "@/lib/tridarma-baca";
import { detailKegiatan } from "@/lib/tridarma-data";

export async function GET(_request: Request, { params }: KonteksRute) {
  const { id } = await params;
  return jawabDetail(id, (itemId, session) => detailKegiatan(itemId, session), "kegiatan");
}

// Ubah kegiatan milik sendiri (tertaut lewat kegiatan_anggota), data `sinta` maupun `manual` (PRD 5.7).
// Data `sinta` yang diubah menjadi `manual`. Daftar `tim` boleh diubah, dosen terdaftar lain tidak ikut terhapus.
export async function PATCH(request: NextRequest, { params }: KonteksRute) {
  const auth = await requireTridarmaWriter("data kegiatan");
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam((await params).id);
  if (id === null) {
    return NextResponse.json({ message: "ID kegiatan tidak valid." }, { status: 400 });
  }

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = parsePatchKegiatanPayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const hasil = await ubahKegiatan({
      pengguna: { session: auth.session, dosenId: auth.dosenId },
      id,
      patch: parsed.data,
      tim: parsed.tim,
    });
    return NextResponse.json(hasil.body, { status: hasil.status });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ message: PESAN_KEGIATAN_DUPLIKAT }, { status: 409 });
      }
      if (error.code === "P2025") {
        return NextResponse.json({ message: "Kegiatan tidak ditemukan." }, { status: 404 });
      }
    }
    console.error("PATCH /api/tridarma/kegiatan/[id]:", error);
    return NextResponse.json({ message: "Gagal memperbarui kegiatan." }, { status: 500 });
  }
}

// Hapus: melepas tautan pengguna. Kegiatan ikut terhapus hanya bila tidak ada lagi dosen terdaftar yang tertaut (PRD 5.7).
export async function DELETE(_request: NextRequest, { params }: KonteksRute) {
  const auth = await requireTridarmaWriter("data kegiatan");
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam((await params).id);
  if (id === null) {
    return NextResponse.json({ message: "ID kegiatan tidak valid." }, { status: 400 });
  }

  try {
    const hasil = await hapusKegiatan({ pengguna: { session: auth.session, dosenId: auth.dosenId }, id });
    return NextResponse.json(hasil.body, { status: hasil.status });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ message: "Kegiatan tidak ditemukan." }, { status: 404 });
    }
    console.error("DELETE /api/tridarma/kegiatan/[id]:", error);
    return NextResponse.json({ message: "Gagal menghapus kegiatan." }, { status: 500 });
  }
}
