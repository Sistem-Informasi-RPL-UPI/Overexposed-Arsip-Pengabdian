import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { catatLog } from "@/lib/log-aktivitas";
import {
  isMatkulKodeTaken,
  MATKUL_PUBLIC_SELECT,
  parseCreateMatkulPayload,
  PESAN_MATKUL_DUPLIKAT,
  requireMatkulManager,
  requirePengajaranViewer,
} from "@/lib/pengajaran";
import { parseTridarmaJsonBody } from "@/lib/tridarma";

// Lihat daftar matkul (PRD 5.4): Dosen, Kaprodi, dan Staff Kaprodi / Admin. Mahasiswa dan Umum ditolak.
export async function GET(request: NextRequest) {
  const auth = await requirePengajaranViewer("daftar mata kuliah");
  if (!auth.ok) return auth.response;

  const search = (
    request.nextUrl.searchParams.get("search") ??
    request.nextUrl.searchParams.get("q") ??
    ""
  )
    .trim()
    .slice(0, 100);

  const where: Prisma.MatkulWhereInput = search
    ? {
        OR: [
          { kode: { contains: search, mode: "insensitive" } },
          { nama: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  try {
    const rows = await db.matkul.findMany({
      where,
      orderBy: [{ kode: "asc" }, { id: "asc" }],
      select: MATKUL_PUBLIC_SELECT,
    });

    const items = rows.map(({ _count, ...matkul }) => ({
      ...matkul,
      jumlah_kelas: _count.kelas,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/tridarma/pengajaran/matkul:", error);
    return NextResponse.json(
      { message: "Gagal mengambil daftar mata kuliah." },
      { status: 500 },
    );
  }
}

// Tambah matkul (PRD 5.4): hanya Kaprodi dan Staff Kaprodi / Admin. Dosen ditolak 403.
export async function POST(request: NextRequest) {
  const auth = await requireMatkulManager();
  if (!auth.ok) return auth.response;

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = parseCreateMatkulPayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    if (await isMatkulKodeTaken(parsed.data.kode)) {
      return NextResponse.json(
        { message: PESAN_MATKUL_DUPLIKAT },
        { status: 409 },
      );
    }

    const created = await db.matkul.create({
      data: parsed.data,
      select: MATKUL_PUBLIC_SELECT,
    });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "tambah",
      objek: "matkul",
      detail: `${created.kode} - ${created.nama}`,
    });

    const { _count, ...matkul } = created;
    return NextResponse.json(
      {
        message: "Mata kuliah berhasil ditambahkan.",
        data: { ...matkul, jumlah_kelas: _count.kelas },
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: PESAN_MATKUL_DUPLIKAT },
        { status: 409 },
      );
    }
    console.error("POST /api/tridarma/pengajaran/matkul:", error);
    return NextResponse.json(
      { message: "Gagal menambah mata kuliah." },
      { status: 500 },
    );
  }
}
