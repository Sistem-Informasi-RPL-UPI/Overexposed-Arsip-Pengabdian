import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { catatLog } from "@/lib/log-aktivitas";
import {
  isMatkulKodeTaken,
  MATKUL_PUBLIC_SELECT,
  parsePatchMatkulPayload,
  PESAN_MATKUL_DIPAKAI,
  PESAN_MATKUL_DUPLIKAT,
  requireMatkulManager,
  requirePengajaranViewer,
} from "@/lib/pengajaran";
import { parseTridarmaIdParam, parseTridarmaJsonBody } from "@/lib/tridarma";
import type { KonteksRute } from "@/lib/tridarma-baca";

export async function GET(_request: NextRequest, { params }: KonteksRute) {
  const auth = await requirePengajaranViewer("detail mata kuliah");
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam((await params).id);
  if (id === null) {
    return NextResponse.json(
      { message: "ID mata kuliah tidak valid." },
      { status: 400 },
    );
  }

  try {
    const row = await db.matkul.findUnique({
      where: { id },
      select: MATKUL_PUBLIC_SELECT,
    });

    if (!row) {
      return NextResponse.json(
        { message: "Mata kuliah tidak ditemukan." },
        { status: 404 },
      );
    }

    const { _count, ...matkul } = row;
    return NextResponse.json({
      data: { ...matkul, jumlah_kelas: _count.kelas },
    });
  } catch (error) {
    console.error("GET /api/tridarma/pengajaran/matkul/[id]:", error);
    return NextResponse.json(
      { message: "Gagal mengambil detail mata kuliah." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: KonteksRute) {
  const auth = await requireMatkulManager();
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam((await params).id);
  if (id === null) {
    return NextResponse.json(
      { message: "ID mata kuliah tidak valid." },
      { status: 400 },
    );
  }

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = parsePatchMatkulPayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const existing = await db.matkul.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Mata kuliah tidak ditemukan." },
        { status: 404 },
      );
    }

    if (
      parsed.data.kode &&
      (await isMatkulKodeTaken(parsed.data.kode, id))
    ) {
      return NextResponse.json(
        { message: PESAN_MATKUL_DUPLIKAT },
        { status: 409 },
      );
    }

    const updated = await db.matkul.update({
      where: { id },
      data: parsed.data,
      select: MATKUL_PUBLIC_SELECT,
    });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "ubah",
      objek: "matkul",
      detail: `${updated.kode} - ${updated.nama}`,
    });

    const { _count, ...matkul } = updated;
    return NextResponse.json({
      message: "Mata kuliah berhasil diperbarui.",
      data: { ...matkul, jumlah_kelas: _count.kelas },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { message: PESAN_MATKUL_DUPLIKAT },
          { status: 409 },
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json(
          { message: "Mata kuliah tidak ditemukan." },
          { status: 404 },
        );
      }
    }
    console.error("PATCH /api/tridarma/pengajaran/matkul/[id]:", error);
    return NextResponse.json(
      { message: "Gagal memperbarui mata kuliah." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: KonteksRute) {
  const auth = await requireMatkulManager();
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam((await params).id);
  if (id === null) {
    return NextResponse.json(
      { message: "ID mata kuliah tidak valid." },
      { status: 400 },
    );
  }

  try {
    const existing = await db.matkul.findUnique({
      where: { id },
      select: MATKUL_PUBLIC_SELECT,
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Mata kuliah tidak ditemukan." },
        { status: 404 },
      );
    }

    if (existing._count.kelas > 0) {
      return NextResponse.json(
        { message: PESAN_MATKUL_DIPAKAI },
        { status: 409 },
      );
    }

    await db.matkul.delete({ where: { id } });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "hapus",
      objek: "matkul",
      detail: `${existing.kode} - ${existing.nama}`,
    });

    return NextResponse.json({
      message: "Mata kuliah berhasil dihapus.",
      data: {
        id: existing.id,
        kode: existing.kode,
        nama: existing.nama,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003") {
        return NextResponse.json(
          { message: PESAN_MATKUL_DIPAKAI },
          { status: 409 },
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json(
          { message: "Mata kuliah tidak ditemukan." },
          { status: 404 },
        );
      }
    }
    console.error("DELETE /api/tridarma/pengajaran/matkul/[id]:", error);
    return NextResponse.json(
      { message: "Gagal menghapus mata kuliah." },
      { status: 500 },
    );
  }
}
