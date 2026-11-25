import { NextRequest } from "next/server";
import {
  BUKU_PUBLIC_SELECT,
  hitungKunciBukuSetelahUbah,
  parsePatchBukuPayload,
  PESAN_BUKU_DUPLIKAT,
} from "@/lib/buku";
import { db } from "@/lib/db";
import {
  handleTridarmaDelete,
  handleTridarmaPatch,
  SUMBER_MANUAL,
} from "@/lib/tridarma";
import { jawabDetail, type KonteksRute } from "@/lib/tridarma-baca";
import { detailBuku } from "@/lib/tridarma-data";

export async function GET(_request: Request, { params }: KonteksRute) {
  const { id } = await params;
  return jawabDetail(
    id,
    (itemId, session) => detailBuku(itemId, session),
    "buku",
  );
}

export async function PATCH(request: NextRequest, { params }: KonteksRute) {
  return handleTridarmaPatch(request, (await params).id, {
    namaObjekPenulis: "data buku",
    labelId: "ID buku",
    objekLog: "buku",
    pesanTidakDitemukan: "Buku tidak ditemukan.",
    pesanTidakDiizinkan: "Anda tidak memiliki izin untuk mengubah buku ini.",
    pesanDuplikat: PESAN_BUKU_DUPLIKAT,
    pesanBerhasilUbah: "Buku berhasil diperbarui.",
    pesanGagalUbah: "Gagal memperbarui buku.",
    logLabel: "PATCH /api/tridarma/buku/[id]",
    parsePayload: parsePatchBukuPayload,
    findExisting: async (id, dosenId) => {
      const existing = await db.buku.findUnique({
        where: { id },
        select: {
          id: true,
          kunci: true,
          judul: true,
          tahun: true,
          isbn: true,
          sumber: true,
          buku_dosen: { select: { dosen_id: true } },
        },
      });
      if (!existing) return null;
      return {
        id: existing.id,
        judul: existing.judul,
        currentKunci: existing.kunci,
        tertautKePengguna: existing.buku_dosen.some(
          (row) => row.dosen_id === dosenId,
        ),
        hitungKunciBaru: (patch) => hitungKunciBukuSetelahUbah(existing, patch),
      };
    },
    findConflictByKunci: (kunci) =>
      db.buku.findUnique({ where: { kunci }, select: { id: true } }),
    updateData: (id, patch, nextKunci) =>
      db.buku.update({
        where: { id },
        data: {
          ...patch,
          kunci: nextKunci,
          sumber: SUMBER_MANUAL,
        },
        select: BUKU_PUBLIC_SELECT,
      }),
  });
}

export async function DELETE(_request: NextRequest, { params }: KonteksRute) {
  return handleTridarmaDelete((await params).id, {
    namaObjekPenulis: "data buku",
    labelId: "ID buku",
    objekLog: "buku",
    pesanTidakDitemukan: "Buku tidak ditemukan.",
    pesanTidakDiizinkan: "Anda tidak memiliki izin untuk menghapus buku ini.",
    pesanTerhapus: "Buku berhasil dihapus.",
    pesanTautanTerhapus: "Tautan buku dari akun Anda berhasil dihapus.",
    pesanGagalHapus: "Gagal menghapus buku.",
    logLabel: "DELETE /api/tridarma/buku/[id]",
    findExisting: async (id, dosenId) => {
      const existing = await db.buku.findUnique({
        where: { id },
        select: {
          id: true,
          judul: true,
          buku_dosen: { select: { dosen_id: true } },
        },
      });
      if (!existing) return null;
      return {
        id: existing.id,
        judul: existing.judul,
        tertautKePengguna: existing.buku_dosen.some(
          (row) => row.dosen_id === dosenId,
        ),
      };
    },
    hapusTautanAtauData: (id, dosenId) =>
      db.$transaction(async (tx) => {
        await tx.bukuDosen.delete({
          where: {
            buku_id_dosen_id: {
              buku_id: id,
              dosen_id: dosenId,
            },
          },
        });
        const sisaTautan = await tx.bukuDosen.count({ where: { buku_id: id } });
        if (sisaTautan === 0) {
          await tx.buku.delete({ where: { id } });
          return true;
        }
        return false;
      }),
  });
}
