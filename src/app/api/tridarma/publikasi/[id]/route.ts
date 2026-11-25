import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  hitungKunciPublikasiSetelahUbah,
  parsePatchPublikasiPayload,
  PESAN_PUBLIKASI_DUPLIKAT,
  PUBLIKASI_PUBLIC_SELECT,
} from "@/lib/publikasi";
import {
  handleTridarmaDelete,
  handleTridarmaPatch,
  SUMBER_MANUAL,
} from "@/lib/tridarma";
import { jawabDetail, type KonteksRute } from "@/lib/tridarma-baca";
import { detailPublikasi } from "@/lib/tridarma-data";

export async function GET(_request: Request, { params }: KonteksRute) {
  const { id } = await params;
  return jawabDetail(
    id,
    (itemId, session) => detailPublikasi(itemId, session),
    "publikasi",
  );
}

// Ubah publikasi milik sendiri (tertaut lewat publikasi_dosen), baik sumber=manual maupun sumber=sinta (PRD 5.7).
// Data sinta yang diubah menjadi sumber=manual agar crawl berikutnya hanya mengisi kolom yang kosong.
export async function PATCH(request: NextRequest, { params }: KonteksRute) {
  return handleTridarmaPatch(request, (await params).id, {
    namaObjekPenulis: "data publikasi",
    labelId: "ID publikasi",
    objekLog: "publikasi",
    pesanTidakDitemukan: "Publikasi tidak ditemukan.",
    pesanTidakDiizinkan:
      "Anda tidak memiliki izin untuk mengubah publikasi ini.",
    pesanDuplikat: PESAN_PUBLIKASI_DUPLIKAT,
    pesanBerhasilUbah: "Publikasi berhasil diperbarui.",
    pesanGagalUbah: "Gagal memperbarui publikasi.",
    logLabel: "PATCH /api/tridarma/publikasi/[id]",
    parsePayload: parsePatchPublikasiPayload,
    findExisting: async (id, dosenId) => {
      const existing = await db.publikasi.findUnique({
        where: { id },
        select: {
          id: true,
          judul_hash: true,
          judul: true,
          sumber: true,
          publikasi_dosen: { select: { dosen_id: true } },
        },
      });
      if (!existing) return null;
      return {
        id: existing.id,
        judul: existing.judul,
        currentKunci: existing.judul_hash,
        tertautKePengguna: existing.publikasi_dosen.some(
          (row) => row.dosen_id === dosenId,
        ),
        hitungKunciBaru: (patch) =>
          hitungKunciPublikasiSetelahUbah(existing, patch),
      };
    },
    findConflictByKunci: (kunci) =>
      db.publikasi.findUnique({
        where: { judul_hash: kunci },
        select: { id: true },
      }),
    updateData: (id, patch, nextKunci) =>
      db.publikasi.update({
        where: { id },
        data: {
          ...patch,
          judul_hash: nextKunci,
          sumber: SUMBER_MANUAL,
        },
        select: PUBLIKASI_PUBLIC_SELECT,
      }),
  });
}

// Hapus: melepas semua baris publikasi_dosen milik pengguna untuk paper itu (semua nilai source: sinta_* dan manual).
// Baris publikasi ikut dihapus hanya bila tidak ada lagi dosen yang tertaut (PRD 5.7).
export async function DELETE(_request: NextRequest, { params }: KonteksRute) {
  return handleTridarmaDelete((await params).id, {
    namaObjekPenulis: "data publikasi",
    labelId: "ID publikasi",
    objekLog: "publikasi",
    pesanTidakDitemukan: "Publikasi tidak ditemukan.",
    pesanTidakDiizinkan:
      "Anda tidak memiliki izin untuk menghapus publikasi ini.",
    pesanTerhapus: "Publikasi berhasil dihapus.",
    pesanTautanTerhapus: "Tautan publikasi dari akun Anda berhasil dihapus.",
    pesanGagalHapus: "Gagal menghapus publikasi.",
    logLabel: "DELETE /api/tridarma/publikasi/[id]",
    findExisting: async (id, dosenId) => {
      const existing = await db.publikasi.findUnique({
        where: { id },
        select: {
          id: true,
          judul: true,
          publikasi_dosen: { select: { dosen_id: true } },
        },
      });
      if (!existing) return null;
      return {
        id: existing.id,
        judul: existing.judul,
        tertautKePengguna: existing.publikasi_dosen.some(
          (row) => row.dosen_id === dosenId,
        ),
      };
    },
    hapusTautanAtauData: (id, dosenId) =>
      db.$transaction(async (tx) => {
        await tx.publikasiDosen.deleteMany({
          where: {
            publikasi_id: id,
            dosen_id: dosenId,
          },
        });
        const sisaTautan = await tx.publikasiDosen.count({
          where: { publikasi_id: id },
        });
        if (sisaTautan === 0) {
          await tx.publikasi.delete({ where: { id } });
          return true;
        }
        return false;
      }),
  });
}
