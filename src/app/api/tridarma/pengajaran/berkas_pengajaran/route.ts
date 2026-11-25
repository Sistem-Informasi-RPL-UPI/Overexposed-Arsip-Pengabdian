import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { catatLog } from "@/lib/log-aktivitas";
import {
  BERKAS_PENGAJARAN_PUBLIC_SELECT,
  JENIS_BERKAS_LIST,
  parseCreateBerkasPengajaranPayload,
  requireDosenPengajaranWriter,
  requirePengajaranViewer,
} from "@/lib/pengajaran";
import { parseTridarmaIdParam, parseTridarmaJsonBody } from "@/lib/tridarma";

// Lihat daftar berkas pengajaran (PRD 5.4):
// Kaprodi dan Staff Kaprodi / Admin boleh melihat semua berkas.
// TODO(PRD 12 #15): Keputusan terbuka apakah Dosen boleh melihat berkas milik dosen lain.
// Sampai dikonfirmasi, Dosen hanya melihat berkas pada kelas miliknya sendiri.
export async function GET(request: NextRequest) {
  const auth = await requirePengajaranViewer("daftar berkas pengajaran");
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const rawKelasId = params.get("kelas_id")?.trim();
  const rawJenis = params.get("jenis")?.trim().toLowerCase();

  let filterKelasId: number | undefined;
  if (rawKelasId) {
    const parsed = parseTridarmaIdParam(rawKelasId);
    if (parsed === null) {
      return NextResponse.json(
        { message: "Parameter kelas_id tidak valid." },
        { status: 400 },
      );
    }
    filterKelasId = parsed;
  }

  const filterJenis = rawJenis
    ? JENIS_BERKAS_LIST.find((j) => j.toLowerCase() === rawJenis)
    : undefined;
  if (rawJenis && !filterJenis) {
    return NextResponse.json(
      {
        message: `Parameter jenis harus salah satu dari: ${JENIS_BERKAS_LIST.join(", ")}.`,
      },
      { status: 400 },
    );
  }

  try {
    // TODO(PRD 12 #15): Sampai keputusan terbuka #15 ditetapkan, Dosen hanya boleh melihat berkas dari kelas miliknya sendiri.
    if (auth.role === "Dosen") {
      if (auth.dosenId === null) {
        return NextResponse.json({ items: [] });
      }
      if (filterKelasId !== undefined) {
        const kelas = await db.kelas.findUnique({
          where: { id: filterKelasId },
          select: { id: true, dosen_id: true },
        });
        if (kelas && kelas.dosen_id !== auth.dosenId) {
          return NextResponse.json(
            {
              message:
                "Anda tidak memiliki izin untuk melihat berkas kelas dosen lain.",
            },
            { status: 403 },
          );
        }
      }
    }

    const where: Prisma.BerkasPengajaranWhereInput = {
      ...(filterKelasId !== undefined ? { kelas_id: filterKelasId } : {}),
      ...(filterJenis ? { jenis: filterJenis } : {}),
      ...(auth.role === "Dosen" && auth.dosenId !== null
        ? { kelas: { dosen_id: auth.dosenId } }
        : {}),
    };

    const items = await db.berkasPengajaran.findMany({
      where,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      select: BERKAS_PENGAJARAN_PUBLIC_SELECT,
    });

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/tridarma/pengajaran/berkas_pengajaran:", error);
    return NextResponse.json(
      { message: "Gagal mengambil daftar berkas pengajaran." },
      { status: 500 },
    );
  }
}

// Tambah berkas pengajaran pada kelas milik sendiri (PRD 5.4): hanya Dosen.
// Satu kelas boleh punya lebih dari satu berkas dengan jenis yang sama (misalnya dua Kuis).
export async function POST(request: NextRequest) {
  const auth = await requireDosenPengajaranWriter("berkas pengajaran");
  if (!auth.ok) return auth.response;

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = parseCreateBerkasPengajaranPayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const kelas = await db.kelas.findUnique({
      where: { id: parsed.data.kelas_id },
      select: { id: true, dosen_id: true },
    });

    if (!kelas) {
      return NextResponse.json(
        { message: "Kelas tidak ditemukan." },
        { status: 404 },
      );
    }

    if (kelas.dosen_id !== auth.dosenId) {
      return NextResponse.json(
        {
          message:
            "Anda tidak memiliki izin untuk menambah berkas pada kelas ini.",
        },
        { status: 403 },
      );
    }

    const created = await db.berkasPengajaran.create({
      data: parsed.data,
      select: BERKAS_PENGAJARAN_PUBLIC_SELECT,
    });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "tambah",
      objek: "berkas_pengajaran",
      detail: `${created.jenis} - ${created.judul ?? created.link}`,
    });

    return NextResponse.json(
      {
        message: "Berkas pengajaran berhasil ditambahkan.",
        data: created,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/tridarma/pengajaran/berkas_pengajaran:", error);
    return NextResponse.json(
      { message: "Gagal menambah berkas pengajaran." },
      { status: 500 },
    );
  }
}
