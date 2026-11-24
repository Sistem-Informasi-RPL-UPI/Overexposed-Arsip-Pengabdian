import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import {
  BUKU_PUBLIC_SELECT,
  hitungKunciBukuSetelahUbah,
  parsePatchBukuPayload,
  PESAN_BUKU_DUPLIKAT,
} from "@/lib/buku";
import { db } from "@/lib/db";
import { catatLog } from "@/lib/log-aktivitas";
import {
  parseTridarmaIdParam,
  parseTridarmaJsonBody,
  requireTridarmaWriter,
  SUMBER_MANUAL,
} from "@/lib/tridarma";

export async function PATCH(
  request: NextRequest,
  context: RouteContext<"/api/tridarma/buku/[id]">,
) {
  const auth = await requireTridarmaWriter("data buku");
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const id = parseTridarmaIdParam(rawId);
  if (id === null) {
    return NextResponse.json({ message: "ID buku tidak valid." }, { status: 400 });
  }

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = parsePatchBukuPayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const existing = await db.buku.findUnique({
      where: { id },
      select: {
        id: true,
        kunci: true,
        judul: true,
        tahun: true,
        isbn: true,
        sumber: true,
        buku_dosen: {
          select: { dosen_id: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ message: "Buku tidak ditemukan." }, { status: 404 });
    }

    const tertautKePengguna = existing.buku_dosen.some((row) => row.dosen_id === auth.dosenId);
    if (!tertautKePengguna) {
      return NextResponse.json(
        { message: "Anda tidak memiliki izin untuk mengubah buku ini." },
        { status: 403 },
      );
    }

    const nextKunci = hitungKunciBukuSetelahUbah(existing, parsed.data);
    if (nextKunci !== existing.kunci) {
      const bentrok = await db.buku.findUnique({
        where: { kunci: nextKunci },
        select: { id: true },
      });
      if (bentrok && bentrok.id !== existing.id) {
        return NextResponse.json({ message: PESAN_BUKU_DUPLIKAT }, { status: 409 });
      }
    }

    // PRD 5.7 & 12 #19/#21: data SINTA yang diubah menjadi sumber = manual agar crawl tidak menimpa.
    const buku = await db.buku.update({
      where: { id },
      data: {
        ...parsed.data,
        kunci: nextKunci,
        sumber: SUMBER_MANUAL,
      },
      select: BUKU_PUBLIC_SELECT,
    });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "ubah",
      objek: "buku",
      detail: buku.judul,
    });

    return NextResponse.json({ message: "Buku berhasil diperbarui.", data: buku });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ message: PESAN_BUKU_DUPLIKAT }, { status: 409 });
      }
      if (error.code === "P2025") {
        return NextResponse.json({ message: "Buku tidak ditemukan." }, { status: 404 });
      }
    }
    console.error("PATCH /api/tridarma/buku/[id]:", error);
    return NextResponse.json({ message: "Gagal memperbarui buku." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext<"/api/tridarma/buku/[id]">,
) {
  const auth = await requireTridarmaWriter("data buku");
  if (!auth.ok) return auth.response;

  const { id: rawId } = await context.params;
  const id = parseTridarmaIdParam(rawId);
  if (id === null) {
    return NextResponse.json({ message: "ID buku tidak valid." }, { status: 400 });
  }

  try {
    const existing = await db.buku.findUnique({
      where: { id },
      select: {
        id: true,
        judul: true,
        buku_dosen: {
          select: { dosen_id: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ message: "Buku tidak ditemukan." }, { status: 404 });
    }

    const tertautKePengguna = existing.buku_dosen.some((row) => row.dosen_id === auth.dosenId);
    if (!tertautKePengguna) {
      return NextResponse.json(
        { message: "Anda tidak memiliki izin untuk menghapus buku ini." },
        { status: 403 },
      );
    }

    // PRD 5.7: lepas tautan milik pengguna dulu; hapus baris buku hanya bila tidak ada dosen lain yang tertaut.
    const dataDihapus = await db.$transaction(async (tx) => {
      await tx.bukuDosen.delete({
        where: {
          buku_id_dosen_id: {
            buku_id: id,
            dosen_id: auth.dosenId,
          },
        },
      });
      const sisaTautan = await tx.bukuDosen.count({ where: { buku_id: id } });
      if (sisaTautan === 0) {
        await tx.buku.delete({ where: { id } });
        return true;
      }
      return false;
    });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "hapus",
      objek: "buku",
      detail: existing.judul,
    });

    return NextResponse.json({
      message: dataDihapus
        ? "Buku berhasil dihapus."
        : "Tautan buku dari akun Anda berhasil dihapus.",
      data: {
        id: existing.id,
        judul: existing.judul,
        data_dihapus: dataDihapus,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ message: "Buku tidak ditemukan." }, { status: 404 });
    }
    console.error("DELETE /api/tridarma/buku/[id]:", error);
    return NextResponse.json({ message: "Gagal menghapus buku." }, { status: 500 });
  }
}
