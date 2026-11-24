import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  IPRS_PUBLIC_SELECT,
  parseCreateIprsPayload,
  PESAN_IPRS_DITAUTKAN,
  PESAN_IPRS_DUPLIKAT,
} from "@/lib/iprs";
import { catatLog } from "@/lib/log-aktivitas";
import {
  parseTridarmaJsonBody,
  requireTridarmaWriter,
  STATUS_IPRS_MANUAL,
  SUMBER_MANUAL,
} from "@/lib/tridarma";
import { jawabDaftar, parseDaftarFilters } from "@/lib/tridarma-baca";
import { daftarIprs } from "@/lib/tridarma-data";

// Terbuka untuk semua peran, termasuk Umum tanpa login (PRD 5.9). Nama endpoint iprs, label tampilan HKI. Parameter: dosen_id, tahun, status, jenis, q, page, pageSize.
export async function GET(request: NextRequest) {
  return jawabDaftar(
    parseDaftarFilters(request.nextUrl.searchParams, { untuk: "iprs" }),
    (f, session) => daftarIprs(f, session),
    "IPRS",
  );
}

// Tambah IPRS manual (PRD 5.7). Status selalu diisi `Diterima` oleh server; duplikat manual milik dosen lain ditautkan otomatis.
export async function POST(request: NextRequest) {
  const auth = await requireTridarmaWriter("data IPRS");
  if (!auth.ok) return auth.response;

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = parseCreateIprsPayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const existing = await db.iprs.findUnique({
      where: { kunci: parsed.kunci },
      select: {
        id: true,
        judul: true,
        sumber: true,
        iprs_dosen: {
          where: { dosen_id: auth.dosenId },
          select: { dosen_id: true },
        },
      },
    });

    if (existing) {
      const sudahTertaut = existing.iprs_dosen.length > 0;
      if (existing.sumber !== SUMBER_MANUAL || sudahTertaut) {
        return NextResponse.json({ message: PESAN_IPRS_DUPLIKAT }, { status: 409 });
      }

      // Duplikat dengan data manual milik dosen lain: tautkan otomatis tanpa mengubah isi data (PRD 5.7).
      await db.iprsDosen.create({
        data: {
          iprs_id: existing.id,
          dosen_id: auth.dosenId,
        },
      });

      await catatLog({
        userId: auth.session.sub,
        userNama: auth.session.name,
        modul: "7",
        aksi: "tambah",
        objek: "iprs",
        detail: existing.judul,
      });

      return NextResponse.json({
        message: PESAN_IPRS_DITAUTKAN,
        data: {
          ditautkan: true,
          id: existing.id,
          judul: existing.judul,
        },
      });
    }

    const iprs = await db.iprs.create({
      data: {
        ...parsed.data,
        kunci: parsed.kunci,
        status: STATUS_IPRS_MANUAL,
        sumber: SUMBER_MANUAL,
        iprs_dosen: {
          create: {
            dosen_id: auth.dosenId,
          },
        },
      },
      select: IPRS_PUBLIC_SELECT,
    });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "tambah",
      objek: "iprs",
      detail: iprs.judul,
    });

    return NextResponse.json(
      { message: "IPRS berhasil ditambahkan.", data: iprs },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: PESAN_IPRS_DUPLIKAT }, { status: 409 });
    }
    console.error("POST /api/tridarma/iprs:", error);
    return NextResponse.json({ message: "Gagal menambah IPRS." }, { status: 500 });
  }
}
