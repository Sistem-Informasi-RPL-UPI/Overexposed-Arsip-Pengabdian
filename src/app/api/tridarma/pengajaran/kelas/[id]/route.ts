import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { catatLog } from "@/lib/log-aktivitas";
import {
  KELAS_PUBLIC_SELECT,
  parsePatchKelasPayload,
  PESAN_KELAS_DUPLIKAT,
  requireDosenPengajaranWriter,
  requirePengajaranViewer,
} from "@/lib/pengajaran";
import { parseTridarmaIdParam, parseTridarmaJsonBody } from "@/lib/tridarma";
import type { KonteksRute } from "@/lib/tridarma-baca";

export async function GET(_request: NextRequest, { params }: KonteksRute) {
  const auth = await requirePengajaranViewer("detail kelas");
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam((await params).id);
  if (id === null) {
    return NextResponse.json(
      { message: "ID kelas tidak valid." },
      { status: 400 },
    );
  }

  try {
    const kelas = await db.kelas.findUnique({
      where: { id },
      include: {
        matkul: {
          select: { id: true, kode: true, nama: true, sks: true },
        },
        dosen: {
          select: { id: true, nama: true, sinta_id: true },
        },
        berkas: {
          orderBy: [{ id: "asc" }],
        },
      },
    });

    if (!kelas) {
      return NextResponse.json(
        { message: "Kelas tidak ditemukan." },
        { status: 404 },
      );
    }

    // TODO(PRD 12 #15): Keputusan terbuka apakah Dosen boleh melihat kelas milik dosen lain.
    // Sampai dikonfirmasi, Dosen hanya boleh melihat kelas miliknya sendiri.
    if (auth.role === "Dosen" && kelas.dosen_id !== auth.dosenId) {
      return NextResponse.json(
        { message: "Anda tidak memiliki izin untuk melihat kelas dosen lain." },
        { status: 403 },
      );
    }

    return NextResponse.json({ data: kelas });
  } catch (error) {
    console.error("GET /api/tridarma/pengajaran/kelas/[id]:", error);
    return NextResponse.json(
      { message: "Gagal mengambil detail kelas." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: KonteksRute) {
  const auth = await requireDosenPengajaranWriter("data kelas");
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam((await params).id);
  if (id === null) {
    return NextResponse.json(
      { message: "ID kelas tidak valid." },
      { status: 400 },
    );
  }

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = parsePatchKelasPayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const existing = await db.kelas.findUnique({
      where: { id },
      select: {
        id: true,
        matkul_id: true,
        dosen_id: true,
        tahun_ajaran: true,
        semester: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Kelas tidak ditemukan." },
        { status: 404 },
      );
    }

    if (existing.dosen_id !== auth.dosenId) {
      return NextResponse.json(
        { message: "Anda tidak memiliki izin untuk mengubah kelas ini." },
        { status: 403 },
      );
    }

    const nextMatkulId = parsed.data.matkul_id ?? existing.matkul_id;
    if (nextMatkulId !== existing.matkul_id) {
      const matkul = await db.matkul.findUnique({
        where: { id: nextMatkulId },
        select: { id: true },
      });
      if (!matkul) {
        return NextResponse.json(
          { message: "Mata kuliah tidak ditemukan." },
          { status: 404 },
        );
      }
    }

    const nextTahunAjaran = parsed.data.tahun_ajaran ?? existing.tahun_ajaran;
    const nextSemester = parsed.data.semester ?? existing.semester;

    const duplicate = await db.kelas.findUnique({
      where: {
        matkul_id_dosen_id_tahun_ajaran_semester: {
          matkul_id: nextMatkulId,
          dosen_id: existing.dosen_id,
          tahun_ajaran: nextTahunAjaran,
          semester: nextSemester,
        },
      },
      select: { id: true },
    });

    if (duplicate && duplicate.id !== existing.id) {
      return NextResponse.json(
        { message: PESAN_KELAS_DUPLIKAT },
        { status: 409 },
      );
    }

    const updated = await db.kelas.update({
      where: { id },
      data: parsed.data,
      select: KELAS_PUBLIC_SELECT,
    });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "ubah",
      objek: "kelas",
      detail: `${updated.matkul.kode} (${updated.tahun_ajaran} ${updated.semester})`,
    });

    const { _count, ...kelas } = updated;
    return NextResponse.json({
      message: "Kelas berhasil diperbarui.",
      data: { ...kelas, jumlah_berkas: _count.berkas },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json(
          { message: PESAN_KELAS_DUPLIKAT },
          { status: 409 },
        );
      }
      if (error.code === "P2025") {
        return NextResponse.json(
          { message: "Kelas tidak ditemukan." },
          { status: 404 },
        );
      }
    }
    console.error("PATCH /api/tridarma/pengajaran/kelas/[id]:", error);
    return NextResponse.json(
      { message: "Gagal memperbarui kelas." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: KonteksRute) {
  const auth = await requireDosenPengajaranWriter("data kelas");
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam((await params).id);
  if (id === null) {
    return NextResponse.json(
      { message: "ID kelas tidak valid." },
      { status: 400 },
    );
  }

  try {
    const existing = await db.kelas.findUnique({
      where: { id },
      select: {
        id: true,
        dosen_id: true,
        tahun_ajaran: true,
        semester: true,
        matkul: {
          select: { kode: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Kelas tidak ditemukan." },
        { status: 404 },
      );
    }

    if (existing.dosen_id !== auth.dosenId) {
      return NextResponse.json(
        { message: "Anda tidak memiliki izin untuk menghapus kelas ini." },
        { status: 403 },
      );
    }

    await db.kelas.delete({ where: { id } });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "hapus",
      objek: "kelas",
      detail: `${existing.matkul.kode} (${existing.tahun_ajaran} ${existing.semester})`,
    });

    return NextResponse.json({
      message: "Kelas berhasil dihapus.",
      data: { id: existing.id },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { message: "Kelas tidak ditemukan." },
        { status: 404 },
      );
    }
    console.error("DELETE /api/tridarma/pengajaran/kelas/[id]:", error);
    return NextResponse.json(
      { message: "Gagal menghapus kelas." },
      { status: 500 },
    );
  }
}
