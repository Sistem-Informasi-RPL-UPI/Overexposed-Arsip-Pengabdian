import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { PESAN_KEGIATAN_DUPLIKAT, parsePatchKegiatanPayload } from "@/lib/kegiatan";
import { ubahKegiatan } from "@/lib/kegiatan-tulis";
import {
  handleTridarmaDelete,
  parseTridarmaIdParam,
  parseTridarmaJsonBody,
  requireTridarmaWriter,
} from "@/lib/tridarma";
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
  return handleTridarmaDelete((await params).id, {
    namaObjekPenulis: "data kegiatan",
    labelId: "ID kegiatan",
    objekLog: "kegiatan",
    pesanTidakDitemukan: "Kegiatan tidak ditemukan.",
    pesanTidakDiizinkan:
      "Anda tidak memiliki izin untuk menghapus kegiatan ini.",
    pesanTerhapus: "Kegiatan berhasil dihapus.",
    pesanTautanTerhapus: "Tautan kegiatan dari akun Anda berhasil dihapus.",
    pesanGagalHapus: "Gagal menghapus kegiatan.",
    logLabel: "DELETE /api/tridarma/kegiatan/[id]",
    findExisting: async (id, dosenId) => {
      const existing = await db.kegiatan.findUnique({
        where: { id },
        select: {
          id: true,
          judul: true,
          anggota: { select: { dosen_id: true } },
        },
      });
      if (!existing) return null;
      return {
        id: existing.id,
        judul: existing.judul,
        tertautKePengguna: existing.anggota.some(
          (row) => row.dosen_id === dosenId,
        ),
      };
    },
    hapusTautanAtauData: (id, dosenId) =>
      db.$transaction(async (tx) => {
        await tx.kegiatanAnggota.deleteMany({
          where: { kegiatan_id: id, dosen_id: dosenId },
        });
        const sisa = await tx.kegiatanAnggota.count({
          where: { kegiatan_id: id, dosen_id: { not: null } },
        });
        if (sisa === 0) {
          await tx.kegiatan.delete({ where: { id } });
          return true;
        }
        return false;
      }),
  });
}
