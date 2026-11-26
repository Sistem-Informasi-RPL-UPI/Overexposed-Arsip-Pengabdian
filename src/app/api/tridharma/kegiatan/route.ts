import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { getKegiatanPage, isJenisKegiatan, parseKegiatanFilters, resolveKegiatanScope } from "@/lib/kegiatan";
import { normalisasiNama, parseKegiatanPayload, STATUS_DIAJUKAN } from "@/lib/kegiatan-form";
import { catatLog } from "@/lib/log-aktivitas";
import { getTridharmaPermissions } from "@/lib/rbac";
import { getSession } from "@/lib/session";

/**
 * GET /api/tridarma/kegiatan?jenis=penelitian|pengabdian
 * Opsional: q, tahun, status, page, pageSize.
 * Penelitian dan pengabdian satu tabel (`kegiatan`), dibedakan kolom `jenis`.
 * Hasil mengikuti peran: Dosen/Kaprodi hanya data miliknya, role lain semua data.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const jenis = params.get("jenis");

  if (!isJenisKegiatan(jenis)) {
    return NextResponse.json({ message: 'Parameter "jenis" wajib diisi: "penelitian" atau "pengabdian".' }, { status: 400 });
  }

  const filters = parseKegiatanFilters(Object.fromEntries(params));
  const scope = resolveKegiatanScope(await getSession());

  // Dosen/Kaprodi yang belum mengisi SINTA ID belum punya baris dosen: tidak ada data pribadi.
  if (scope.belumTerhubung) {
    return NextResponse.json({
      message: "Akun belum terhubung ke data dosen. Isi SINTA ID terlebih dahulu.",
      items: [],
      pagination: { page: 1, pageSize: filters.pageSize, total: 0, totalPages: 1 },
    });
  }

  try {
    const data = await getKegiatanPage(jenis, filters, scope.personal ? (scope.dosenId as number) : undefined);

    return NextResponse.json(
      {
        items: data.items.map((k) => ({
          id: k.id,
          judul: k.judul,
          tahun: k.tahun,
          dana: k.dana,
          ketua: k.ketua,
        })),
        pagination: { page: data.page, pageSize: filters.pageSize, total: data.total, totalPages: data.totalPages },
        meta: {
          totalAll: data.totalAll,
          perTahun: data.perTahun,
          tahunOptions: data.tahunOptions,
          lastSyncedAt: data.lastSync?.toISOString() ?? null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("GET Kegiatan:", error);
    return NextResponse.json({ message: "Gagal mengambil data kegiatan." }, { status: 500 });
  }
}

/**
 * POST /api/tridharma/kegiatan
 * Body: { jenis, judul, tahun, skema, sumberDana, dana, penulis }
 * `penulis` berupa satu string dipisah titik koma ("Penulis A; Penulis B"); nama pertama menjadi ketua.
 * Hanya Dosen/Kaprodi (RBAC route di proxy.ts, dicek ulang di sini).
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  if (!getTridharmaPermissions(session).canCreate) {
    return NextResponse.json({ message: "Anda tidak memiliki izin untuk menambah data kegiatan." }, { status: 403 });
  }

  if (session.dosen_id === null) {
    return NextResponse.json({ message: "Akun belum terhubung ke data dosen. Isi SINTA ID terlebih dahulu." }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Body request harus berupa JSON yang valid." }, { status: 400 });
  }

  const parsed = parseKegiatanPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.message }, { status: 400 });
  }
  const data = parsed.data;
  const label = data.jenis === "penelitian" ? "Penelitian" : "Pengabdian";

  try {
    // Cocokkan tiap penulis ke tabel dosen supaya kegiatan muncul di halaman dosen itu.
    const kandidat = await db.dosen.findMany({
      where: {
        OR: [
          { id: session.dosen_id },
          { nama_normal: { in: data.penulis.map((p) => p.normal) } },
          { nama: { in: data.penulis.map((p) => p.nama), mode: "insensitive" } },
        ],
      },
      select: { id: true, nama: true, nama_normal: true },
    });

    const petaDosen = new Map<string, number>();
    for (const d of kandidat) {
      for (const kunci of [d.nama_normal, d.nama ? normalisasiNama(d.nama) : null]) {
        if (kunci && !petaDosen.has(kunci)) petaDosen.set(kunci, d.id);
      }
    }

    const anggota = data.penulis.map((p, urutan) => ({
      nama: p.nama,
      nama_normal: p.normal,
      peran: urutan === 0 ? ("ketua" as const) : ("anggota" as const),
      dosen_id: petaDosen.get(p.normal) ?? null,
    }));

    // Pengaju harus ada di daftar penulis, kalau tidak ia tidak bisa melihat data yang baru dibuatnya.
    if (!anggota.some((a) => a.dosen_id === session.dosen_id)) {
      const sendiri = kandidat.find((d) => d.id === session.dosen_id);
      return NextResponse.json(
        {
          message: `Nama Anda belum ada di daftar penulis. Tambahkan nama Anda${sendiri?.nama ? ` sesuai profil dosen ("${sendiri.nama}")` : ""}.`,
        },
        { status: 400 },
      );
    }

    const kembar = await db.kegiatan.findFirst({
      where: { jenis: data.jenis, tahun: data.tahun, judul: { equals: data.judul, mode: "insensitive" } },
      select: { id: true },
    });
    if (kembar) {
      return NextResponse.json({ message: `${label} dengan judul dan tahun yang sama sudah ada.` }, { status: 409 });
    }

    const kegiatan = await db.kegiatan.create({
      data: {
        // 32 karakter heksadesimal, tidak bentrok dengan kunci hasil sinkronisasi.
        kunci: randomUUID().replaceAll("-", ""),
        jenis: data.jenis,
        judul: data.judul,
        tahun: data.tahun,
        skema: data.skema,
        sumber_dana: data.sumberDana,
        dana_nominal: data.dana,
        status: STATUS_DIAJUKAN,
        anggota: { create: anggota },
      },
      select: { id: true, judul: true },
    });

    await catatLog({
      userId: session.sub,
      userNama: session.name,
      modul: "7",
      aksi: "tambah",
      objek: "kegiatan",
      detail: `${data.jenis}: ${kegiatan.judul}`,
    });

    return NextResponse.json(
      { message: `${label} berhasil diajukan dan menunggu verifikasi.`, data: { id: kegiatan.id, judul: kegiatan.judul } },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: `${label} ini sudah tersimpan. Muat ulang halaman lalu coba lagi.` }, { status: 409 });
    }
    console.error("POST Kegiatan:", error);
    return NextResponse.json({ message: `Gagal menyimpan data ${label.toLowerCase()}.` }, { status: 500 });
  }
}
