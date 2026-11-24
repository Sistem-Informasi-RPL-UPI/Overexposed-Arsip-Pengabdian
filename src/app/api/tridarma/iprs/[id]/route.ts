import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  hitungKunciIprsSetelahUbah,
  IPRS_PUBLIC_SELECT,
  parsePatchIprsPayload,
  PESAN_IPRS_DUPLIKAT,
} from "@/lib/iprs";
import { catatLog } from "@/lib/log-aktivitas";
import {
  parseTridarmaIdParam,
  parseTridarmaJsonBody,
  requireTridarmaWriter,
  SUMBER_MANUAL,
} from "@/lib/tridarma";
import { jawabDetail, type KonteksRute } from "@/lib/tridarma-baca";
import { detailIprs } from "@/lib/tridarma-data";

export async function GET(_request: Request, { params }: KonteksRute) {
  const { id } = await params;
  return jawabDetail(id, (itemId, session) => detailIprs(itemId, session), "IPRS");
}

// Ubah IPRS milik sendiri (tertaut lewat iprs_dosen), baik sumber=manual maupun sumber=sinta (PRD 5.7).
// Data sinta yang diubah menjadi sumber=manual, sementara status-nya tidak berubah (tetap nilai SINTA/sebelumnya).
export async function PATCH(request: NextRequest, { params }: KonteksRute) {
  const auth = await requireTridarmaWriter("data IPRS");
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam((await params).id);
  if (id === null) {
    return NextResponse.json({ message: "ID IPRS tidak valid." }, { status: 400 });
  }

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = parsePatchIprsPayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const existing = await db.iprs.findUnique({
      where: { id },
      select: {
        id: true,
        kunci: true,
        judul: true,
        tahun: true,
        nomor_permohonan: true,
        sumber: true,
        iprs_dosen: {
          select: { dosen_id: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ message: "IPRS tidak ditemukan." }, { status: 404 });
    }

    const tertautKePengguna = existing.iprs_dosen.some((row) => row.dosen_id === auth.dosenId);
    if (!tertautKePengguna) {
      return NextResponse.json(
        { message: "Anda tidak memiliki izin untuk mengubah IPRS ini." },
        { status: 403 },
      );
    }

    const nextKunci = hitungKunciIprsSetelahUbah(existing, parsed.data);
    if (nextKunci !== existing.kunci) {
      const bentrok = await db.iprs.findUnique({
        where: { kunci: nextKunci },
        select: { id: true },
      });
      if (bentrok && bentrok.id !== existing.id) {
        return NextResponse.json({ message: PESAN_IPRS_DUPLIKAT }, { status: 409 });
      }
    }

    // PRD 5.7 & 12 #19/#21: data SINTA yang diubah menjadi sumber=manual agar crawl tidak menimpa, tanpa mengubah status.
    const iprs = await db.iprs.update({
      where: { id },
      data: {
        ...parsed.data,
        kunci: nextKunci,
        sumber: SUMBER_MANUAL,
      },
      select: IPRS_PUBLIC_SELECT,
    });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "ubah",
      objek: "iprs",
      detail: iprs.judul,
    });

    return NextResponse.json({ message: "IPRS berhasil diperbarui.", data: iprs });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ message: PESAN_IPRS_DUPLIKAT }, { status: 409 });
      }
      if (error.code === "P2025") {
        return NextResponse.json({ message: "IPRS tidak ditemukan." }, { status: 404 });
      }
    }
    console.error("PATCH /api/tridarma/iprs/[id]:", error);
    return NextResponse.json({ message: "Gagal memperbarui IPRS." }, { status: 500 });
  }
}

// Hapus: melepas tautan pengguna. Baris IPRS ikut dihapus hanya bila tidak ada dosen lain yang tertaut (PRD 5.7).
export async function DELETE(_request: NextRequest, { params }: KonteksRute) {
  const auth = await requireTridarmaWriter("data IPRS");
  if (!auth.ok) return auth.response;

  const id = parseTridarmaIdParam((await params).id);
  if (id === null) {
    return NextResponse.json({ message: "ID IPRS tidak valid." }, { status: 400 });
  }

  try {
    const existing = await db.iprs.findUnique({
      where: { id },
      select: {
        id: true,
        judul: true,
        iprs_dosen: {
          select: { dosen_id: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ message: "IPRS tidak ditemukan." }, { status: 404 });
    }

    const tertautKePengguna = existing.iprs_dosen.some((row) => row.dosen_id === auth.dosenId);
    if (!tertautKePengguna) {
      return NextResponse.json(
        { message: "Anda tidak memiliki izin untuk menghapus IPRS ini." },
        { status: 403 },
      );
    }

    const dataDihapus = await db.$transaction(async (tx) => {
      await tx.iprsDosen.delete({
        where: {
          iprs_id_dosen_id: {
            iprs_id: id,
            dosen_id: auth.dosenId,
          },
        },
      });
      const sisaTautan = await tx.iprsDosen.count({ where: { iprs_id: id } });
      if (sisaTautan === 0) {
        await tx.iprs.delete({ where: { id } });
        return true;
      }
      return false;
    });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "hapus",
      objek: "iprs",
      detail: existing.judul,
    });

    return NextResponse.json({
      message: dataDihapus
        ? "IPRS berhasil dihapus."
        : "Tautan IPRS dari akun Anda berhasil dihapus.",
      data: {
        id: existing.id,
        judul: existing.judul,
        data_dihapus: dataDihapus,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return NextResponse.json({ message: "IPRS tidak ditemukan." }, { status: 404 });
    }
    console.error("DELETE /api/tridarma/iprs/[id]:", error);
    return NextResponse.json({ message: "Gagal menghapus IPRS." }, { status: 500 });
  }
}
