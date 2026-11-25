import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  IPRS_PUBLIC_SELECT,
  parseCreateIprsPayload,
  PESAN_IPRS_DITAUTKAN,
  PESAN_IPRS_DUPLIKAT,
} from "@/lib/iprs";
import {
  handleTridarmaPost,
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
  return handleTridarmaPost(request, {
    namaObjekPenulis: "data IPRS",
    objekLog: "iprs",
    pesanDuplikat: PESAN_IPRS_DUPLIKAT,
    pesanDitautkan: PESAN_IPRS_DITAUTKAN,
    pesanBerhasilTambah: "IPRS berhasil ditambahkan.",
    pesanGagalTambah: "Gagal menambah IPRS.",
    logLabel: "POST /api/tridarma/iprs",
    parsePayload: parseCreateIprsPayload,
    findByKunci: async (kunci, dosenId) => {
      const existing = await db.iprs.findUnique({
        where: { kunci },
        select: {
          id: true,
          judul: true,
          sumber: true,
          iprs_dosen: {
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
        sudahTertaut: existing.iprs_dosen.length > 0,
      };
    },
    createTautan: (iprsId, dosenId) =>
      db.iprsDosen.create({
        data: { iprs_id: iprsId, dosen_id: dosenId },
      }),
    createData: (data, kunci, dosenId) =>
      db.iprs.create({
        data: {
          ...data,
          kunci,
          status: STATUS_IPRS_MANUAL,
          sumber: SUMBER_MANUAL,
          iprs_dosen: {
            create: { dosen_id: dosenId },
          },
        },
        select: IPRS_PUBLIC_SELECT,
      }),
  });
}
