import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { catatLog } from "@/lib/log-aktivitas";
import {
  KELAS_PUBLIC_SELECT,
  parseCreateKelasPayload,
  PESAN_KELAS_DUPLIKAT,
  requireDosenPengajaranWriter,
  requirePengajaranViewer,
  SEMESTER_LIST,
} from "@/lib/pengajaran";
import { parseTridarmaIdParam, parseTridarmaJsonBody } from "@/lib/tridarma";

// Lihat daftar kelas (PRD 5.4):
// Kaprodi dan Staff Kaprodi / Admin boleh melihat semua kelas.
// TODO(PRD 12 #15): Keputusan terbuka apakah Dosen boleh melihat kelas milik dosen lain.
// Sampai dikonfirmasi, Dosen hanya melihat kelas miliknya sendiri.
export async function GET(request: NextRequest) {
  const auth = await requirePengajaranViewer("daftar kelas");
  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const rawDosenId = params.get("dosen_id")?.trim();
  const rawMatkulId = params.get("matkul_id")?.trim();
  const rawTahunAjaran = params.get("tahun_ajaran")?.trim();
  const rawSemester = params.get("semester")?.trim().toLowerCase();

  let filterDosenId: number | undefined;
  if (rawDosenId) {
    const parsed = parseTridarmaIdParam(rawDosenId);
    if (parsed === null) {
      return NextResponse.json(
        { message: "Parameter dosen_id tidak valid." },
        { status: 400 },
      );
    }
    filterDosenId = parsed;
  }

  let filterMatkulId: number | undefined;
  if (rawMatkulId) {
    const parsed = parseTridarmaIdParam(rawMatkulId);
    if (parsed === null) {
      return NextResponse.json(
        { message: "Parameter matkul_id tidak valid." },
        { status: 400 },
      );
    }
    filterMatkulId = parsed;
  }

  const filterSemester = rawSemester
    ? SEMESTER_LIST.find((s) => s.toLowerCase() === rawSemester)
    : undefined;
  if (rawSemester && !filterSemester) {
    return NextResponse.json(
      { message: "Parameter semester harus Ganjil atau Genap." },
      { status: 400 },
    );
  }

  // TODO(PRD 12 #15): Sampai keputusan terbuka #15 ditetapkan, Dosen dibatasi hanya melihat kelas miliknya sendiri.
  if (auth.role === "Dosen") {
    if (
      filterDosenId !== undefined &&
      auth.dosenId !== null &&
      filterDosenId !== auth.dosenId
    ) {
      return NextResponse.json(
        { message: "Anda tidak memiliki izin untuk melihat kelas dosen lain." },
        { status: 403 },
      );
    }
    if (auth.dosenId === null) {
      return NextResponse.json({ items: [] });
    }
    filterDosenId = auth.dosenId;
  }

  const where: Prisma.KelasWhereInput = {
    ...(filterDosenId !== undefined ? { dosen_id: filterDosenId } : {}),
    ...(filterMatkulId !== undefined ? { matkul_id: filterMatkulId } : {}),
    ...(rawTahunAjaran ? { tahun_ajaran: rawTahunAjaran } : {}),
    ...(filterSemester ? { semester: filterSemester } : {}),
  };

  try {
    const rows = await db.kelas.findMany({
      where,
      orderBy: [{ tahun_ajaran: "desc" }, { id: "desc" }],
      select: KELAS_PUBLIC_SELECT,
    });

    const items = rows.map(({ _count, ...kelas }) => ({
      ...kelas,
      jumlah_berkas: _count.berkas,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("GET /api/tridarma/pengajaran/kelas:", error);
    return NextResponse.json(
      { message: "Gagal mengambil daftar kelas." },
      { status: 500 },
    );
  }
}

// Tambah kelas milik sendiri (PRD 5.4): hanya Dosen (wajib sudah mengisi sinta_id). Kaprodi & Staff Kaprodi ditolak 403.
export async function POST(request: NextRequest) {
  const auth = await requireDosenPengajaranWriter("data kelas");
  if (!auth.ok) return auth.response;

  const jsonBody = await parseTridarmaJsonBody(request);
  if (!jsonBody.ok) return jsonBody.response;

  const parsed = parseCreateKelasPayload(jsonBody.data);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }

  try {
    const matkul = await db.matkul.findUnique({
      where: { id: parsed.data.matkul_id },
      select: { id: true, kode: true, nama: true },
    });

    if (!matkul) {
      return NextResponse.json(
        { message: "Mata kuliah tidak ditemukan." },
        { status: 404 },
      );
    }

    const duplicate = await db.kelas.findUnique({
      where: {
        matkul_id_dosen_id_tahun_ajaran_semester: {
          matkul_id: parsed.data.matkul_id,
          dosen_id: auth.dosenId,
          tahun_ajaran: parsed.data.tahun_ajaran,
          semester: parsed.data.semester,
        },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json(
        { message: PESAN_KELAS_DUPLIKAT },
        { status: 409 },
      );
    }

    const created = await db.kelas.create({
      data: {
        ...parsed.data,
        dosen_id: auth.dosenId,
      },
      select: KELAS_PUBLIC_SELECT,
    });

    await catatLog({
      userId: auth.session.sub,
      userNama: auth.session.name,
      modul: "7",
      aksi: "tambah",
      objek: "kelas",
      detail: `${created.matkul.kode} (${created.tahun_ajaran} ${created.semester})`,
    });

    const { _count, ...kelas } = created;
    return NextResponse.json(
      {
        message: "Kelas berhasil ditambahkan.",
        data: { ...kelas, jumlah_berkas: _count.berkas },
      },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: PESAN_KELAS_DUPLIKAT },
        { status: 409 },
      );
    }
    console.error("POST /api/tridarma/pengajaran/kelas:", error);
    return NextResponse.json(
      { message: "Gagal menambah kelas." },
      { status: 500 },
    );
  }
}
