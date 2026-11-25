import { NextRequest } from "next/server";
import {
  BUKU_PUBLIC_SELECT,
  parseCreateBukuPayload,
  PESAN_BUKU_DITAUTKAN,
  PESAN_BUKU_DUPLIKAT,
} from "@/lib/buku";
import { db } from "@/lib/db";
import { handleTridarmaPost, SUMBER_MANUAL } from "@/lib/tridarma";
import { jawabDaftar, parseDaftarFilters } from "@/lib/tridarma-baca";
import { daftarBuku } from "@/lib/tridarma-data";

// Terbuka untuk semua peran, termasuk Umum tanpa login (PRD 5.9). Parameter: dosen_id, tahun, kategori, q, page, pageSize.
export async function GET(request: NextRequest) {
  return jawabDaftar(
    parseDaftarFilters(request.nextUrl.searchParams, { untuk: "buku" }),
    (f, session) => daftarBuku(f, session),
    "buku",
  );
}

export async function POST(request: NextRequest) {
  return handleTridarmaPost(request, {
    namaObjekPenulis: "data buku",
    objekLog: "buku",
    pesanDuplikat: PESAN_BUKU_DUPLIKAT,
    pesanDitautkan: PESAN_BUKU_DITAUTKAN,
    pesanBerhasilTambah: "Buku berhasil ditambahkan.",
    pesanGagalTambah: "Gagal menambah buku.",
    logLabel: "POST /api/tridarma/buku",
    parsePayload: parseCreateBukuPayload,
    findByKunci: async (kunci, dosenId) => {
      const existing = await db.buku.findUnique({
        where: { kunci },
        select: {
          id: true,
          judul: true,
          sumber: true,
          buku_dosen: {
            where: { dosen_id: dosenId },
            select: { dosen_id: true },
          },
        },
      });
      if (!existing) return null;
      return {
        id: existing.id,
        judul: existing.judul,
        sumber: existing.sumber,
        sudahTertaut: existing.buku_dosen.length > 0,
      };
    },
    createTautan: (bukuId, dosenId) =>
      db.bukuDosen.create({
        data: { buku_id: bukuId, dosen_id: dosenId },
      }),
    createData: (data, kunci, dosenId) =>
      db.buku.create({
        data: {
          ...data,
          kunci,
          sumber: SUMBER_MANUAL,
          buku_dosen: {
            create: { dosen_id: dosenId },
          },
        },
        select: BUKU_PUBLIC_SELECT,
      }),
  });
}
