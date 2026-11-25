import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  parseCreatePublikasiPayload,
  PESAN_PUBLIKASI_DITAUTKAN,
  PESAN_PUBLIKASI_DUPLIKAT,
  PUBLIKASI_PUBLIC_SELECT,
} from "@/lib/publikasi";
import { handleTridarmaPost, SUMBER_MANUAL } from "@/lib/tridarma";
import { jawabDaftar, parseDaftarFilters } from "@/lib/tridarma-baca";
import { daftarPublikasi } from "@/lib/tridarma-data";

// Terbuka untuk semua peran, termasuk Umum tanpa login (PRD 5.9). Parameter: dosen_id, tahun, akreditasi (kuartil atau akreditasi), sumber_artikel (scopus, garuda, googlescholar, rama, manual), q, page, pageSize.
export async function GET(request: NextRequest) {
  return jawabDaftar(
    parseDaftarFilters(request.nextUrl.searchParams, { untuk: "publikasi" }),
    (f, session) => daftarPublikasi(f, session),
    "publikasi",
  );
}

// Tambah publikasi manual (PRD 5.7). Baris publikasi_dosen memakai source=manual, urutan_penulis & total_penulis kosong.
export async function POST(request: NextRequest) {
  return handleTridarmaPost(request, {
    namaObjekPenulis: "data publikasi",
    objekLog: "publikasi",
    pesanDuplikat: PESAN_PUBLIKASI_DUPLIKAT,
    pesanDitautkan: PESAN_PUBLIKASI_DITAUTKAN,
    pesanBerhasilTambah: "Publikasi berhasil ditambahkan.",
    pesanGagalTambah: "Gagal menambah publikasi.",
    logLabel: "POST /api/tridarma/publikasi",
    parsePayload: parseCreatePublikasiPayload,
    findByKunci: async (kunci, dosenId) => {
      const existing = await db.publikasi.findUnique({
        where: { judul_hash: kunci },
        select: {
          id: true,
          judul: true,
          sumber: true,
          publikasi_dosen: {
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
        sudahTertaut: existing.publikasi_dosen.length > 0,
      };
    },
    createTautan: (publikasiId, dosenId) =>
      db.publikasiDosen.create({
        data: {
          publikasi_id: publikasiId,
          dosen_id: dosenId,
          source: "manual",
        },
      }),
    createData: (data, kunci, dosenId) =>
      db.publikasi.create({
        data: {
          ...data,
          judul_hash: kunci,
          sumber: SUMBER_MANUAL,
          publikasi_dosen: {
            create: {
              dosen_id: dosenId,
              source: "manual",
            },
          },
        },
        select: PUBLIKASI_PUBLIC_SELECT,
      }),
  });
}
