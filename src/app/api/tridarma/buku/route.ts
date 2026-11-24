import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import {
  BUKU_PUBLIC_SELECT,
  parseCreateBukuPayload,
  PESAN_BUKU_DITAUTKAN,
  PESAN_BUKU_DUPLIKAT,
} from "@/lib/buku";
import { db } from "@/lib/db";
import { catatLog } from "@/lib/log-aktivitas";
import {
  parseTridarmaJsonBody,
  requireTridarmaWriter,
  SUMBER_MANUAL,
} from "@/lib/tridarma";

export async function POST(request: NextRequest) {
  const auth = await requireTridarmaWriter("data buku");
  if (!auth.ok) return auth.response;

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = parseCreateBukuPayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const existing = await db.buku.findUnique({
      where: { kunci: parsed.kunci },
      select: {
        id: true,
        judul: true,
        sumber: true,
        buku_dosen: {
          where: { dosen_id: auth.dosenId },
          select: { dosen_id: true },
        },
      },
    });

    if (existing) {
      const sudahTertaut = existing.buku_dosen.length > 0;
      if (existing.sumber !== SUMBER_MANUAL || sudahTertaut) {
        return NextResponse.json({ message: PESAN_BUKU_DUPLIKAT }, { status: 409 });
      }

      // Duplikat dengan data manual milik dosen lain: tautkan otomatis tanpa mengubah isi data (PRD 5.7).
      await db.bukuDosen.create({
        data: {
          buku_id: existing.id,
          dosen_id: auth.dosenId,
        },
      });

      await catatLog({
        userId: auth.session.sub,
        userNama: auth.session.name,
        modul: "7",
        aksi: "tambah",
        objek: "buku",
        detail: existing.judul,
      });

      return NextResponse.json({
        message: PESAN_BUKU_DITAUTKAN,
        data: {
          ditautkan: true,
          id: existing.id,
          judul: existing.judul,
        },
      });
    }

    const buku = await db.buku.create({
      data: {
        ...parsed.data,
        kunci: parsed.kunci,
        sumber: SUMBER_MANUAL,
        buku_dosen: {
          create: {
            dosen_id: auth.dosenId,
          },
        },
      },
      select: BUKU_PUBLIC_SELECT,
    });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "tambah",
      objek: "buku",
      detail: buku.judul,
    });

    return NextResponse.json(
      { message: "Buku berhasil ditambahkan.", data: buku },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: PESAN_BUKU_DUPLIKAT }, { status: 409 });
    }
    console.error("POST /api/tridarma/buku:", error);
    return NextResponse.json({ message: "Gagal menambah buku." }, { status: 500 });
  }
}
