import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { catatLog } from "@/lib/log-aktivitas";
import {
  BERKAS_PENGAJARAN_PUBLIC_SELECT,
  parsePatchBerkasPengajaranPayload,
  requireDosenPengajaranWriter,
  requirePengajaranViewer,
} from "@/lib/pengajaran";
import { parseTridarmaIdParam, parseTridarmaJsonBody } from "@/lib/tridarma";
import type { KonteksRute } from "@/lib/tridarma-baca";

export async function GET(_request: NextRequest, { params }: KonteksRute) {
  const auth = await requirePengajaranViewer("detail berkas pengajaran");
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam((await params).id);
  if (id === null) {
    return NextResponse.json(
      { message: "ID berkas pengajaran tidak valid." },
      { status: 400 },
    );
  }

  try {
    const berkas = await db.berkasPengajaran.findUnique({
      where: { id },
      select: BERKAS_PENGAJARAN_PUBLIC_SELECT,
    });

    if (!berkas) {
      return NextResponse.json(
        { message: "Berkas pengajaran tidak ditemukan." },
        { status: 404 },
      );
    }

    // TODO(PRD 12 #15): Keputusan terbuka apakah Dosen boleh melihat berkas milik dosen lain.
    // Sampai dikonfirmasi, Dosen hanya boleh melihat berkas pada kelas miliknya sendiri.
    if (auth.role === "Dosen" && berkas.kelas.dosen_id !== auth.dosenId) {
      return NextResponse.json(
        {
          message:
            "Anda tidak memiliki izin untuk melihat berkas pengajaran dosen lain.",
        },
        { status: 403 },
      );
    }

    return NextResponse.json({ data: berkas });
  } catch (error) {
    console.error("GET /api/tridarma/pengajaran/berkas_pengajaran/[id]:", error);
    return NextResponse.json(
      { message: "Gagal mengambil detail berkas pengajaran." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: KonteksRute) {
  const auth = await requireDosenPengajaranWriter("berkas pengajaran");
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam((await params).id);
  if (id === null) {
    return NextResponse.json(
      { message: "ID berkas pengajaran tidak valid." },
      { status: 400 },
    );
  }

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = parsePatchBerkasPengajaranPayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const existing = await db.berkasPengajaran.findUnique({
      where: { id },
      select: {
        id: true,
        kelas_id: true,
        kelas: {
          select: { dosen_id: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Berkas pengajaran tidak ditemukan." },
        { status: 404 },
      );
    }

    if (existing.kelas.dosen_id !== auth.dosenId) {
      return NextResponse.json(
        {
          message:
            "Anda tidak memiliki izin untuk mengubah berkas pengajaran ini.",
        },
        { status: 403 },
      );
    }

    if (
      parsed.data.kelas_id !== undefined &&
      parsed.data.kelas_id !== existing.kelas_id
    ) {
      const targetKelas = await db.kelas.findUnique({
        where: { id: parsed.data.kelas_id },
        select: { id: true, dosen_id: true },
      });
      if (!targetKelas) {
        return NextResponse.json(
          { message: "Kelas tujuan tidak ditemukan." },
          { status: 404 },
        );
      }
      if (targetKelas.dosen_id !== auth.dosenId) {
        return NextResponse.json(
          {
            message:
              "Anda tidak memiliki izin untuk memindahkan berkas ke kelas dosen lain.",
          },
          { status: 403 },
        );
      }
    }

    const updated = await db.berkasPengajaran.update({
      where: { id },
      data: parsed.data,
      select: BERKAS_PENGAJARAN_PUBLIC_SELECT,
    });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "ubah",
      objek: "berkas_pengajaran",
      detail: `${updated.jenis} - ${updated.judul ?? updated.link}`,
    });

    return NextResponse.json({
      message: "Berkas pengajaran berhasil diperbarui.",
      data: updated,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { message: "Berkas pengajaran tidak ditemukan." },
        { status: 404 },
      );
    }
    console.error(
      "PATCH /api/tridarma/pengajaran/berkas_pengajaran/[id]:",
      error,
    );
    return NextResponse.json(
      { message: "Gagal memperbarui berkas pengajaran." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: KonteksRute) {
  const auth = await requireDosenPengajaranWriter("berkas pengajaran");
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam((await params).id);
  if (id === null) {
    return NextResponse.json(
      { message: "ID berkas pengajaran tidak valid." },
      { status: 400 },
    );
  }

  try {
    const existing = await db.berkasPengajaran.findUnique({
      where: { id },
      select: {
        id: true,
        jenis: true,
        judul: true,
        link: true,
        kelas: {
          select: { dosen_id: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Berkas pengajaran tidak ditemukan." },
        { status: 404 },
      );
    }

    if (existing.kelas.dosen_id !== auth.dosenId) {
      return NextResponse.json(
        {
          message:
            "Anda tidak memiliki izin untuk menghapus berkas pengajaran ini.",
        },
        { status: 403 },
      );
    }

    await db.berkasPengajaran.delete({ where: { id } });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "hapus",
      objek: "berkas_pengajaran",
      detail: `${existing.jenis} - ${existing.judul ?? existing.link}`,
    });

    return NextResponse.json({
      message: "Berkas pengajaran berhasil dihapus.",
      data: { id: existing.id },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { message: "Berkas pengajaran tidak ditemukan." },
        { status: 404 },
      );
    }
    console.error(
      "DELETE /api/tridarma/pengajaran/berkas_pengajaran/[id]:",
      error,
    );
    return NextResponse.json(
      { message: "Gagal menghapus berkas pengajaran." },
      { status: 500 },
    );
  }
}
