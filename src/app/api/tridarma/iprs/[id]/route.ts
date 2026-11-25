import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  hitungKunciIprsSetelahUbah,
  IPRS_PUBLIC_SELECT,
  parsePatchIprsPayload,
  PESAN_IPRS_DUPLIKAT,
} from "@/lib/iprs";
import {
  handleTridarmaDelete,
  handleTridarmaPatch,
  SUMBER_MANUAL,
} from "@/lib/tridarma";
import { jawabDetail, type KonteksRute } from "@/lib/tridarma-baca";
import { detailIprs } from "@/lib/tridarma-data";

export async function GET(_request: Request, { params }: KonteksRute) {
  const { id } = await params;
  return jawabDetail(
    id,
    (itemId, session) => detailIprs(itemId, session),
    "IPRS",
  );
}

// Ubah IPRS milik sendiri (tertaut lewat iprs_dosen), baik sumber=manual maupun sumber=sinta (PRD 5.7).
// Data sinta yang diubah menjadi sumber=manual, sementara status-nya tidak berubah (tetap nilai SINTA/sebelumnya).
export async function PATCH(request: NextRequest, { params }: KonteksRute) {
  return handleTridarmaPatch(request, (await params).id, {
    namaObjekPenulis: "data IPRS",
    labelId: "ID IPRS",
    objekLog: "iprs",
    pesanTidakDitemukan: "IPRS tidak ditemukan.",
    pesanTidakDiizinkan: "Anda tidak memiliki izin untuk mengubah IPRS ini.",
    pesanDuplikat: PESAN_IPRS_DUPLIKAT,
    pesanBerhasilUbah: "IPRS berhasil diperbarui.",
    pesanGagalUbah: "Gagal memperbarui IPRS.",
    logLabel: "PATCH /api/tridarma/iprs/[id]",
    parsePayload: parsePatchIprsPayload,
    findExisting: async (id, dosenId) => {
      const existing = await db.iprs.findUnique({
        where: { id },
        select: {
          id: true,
          kunci: true,
          judul: true,
          tahun: true,
          nomor_permohonan: true,
          sumber: true,
          iprs_dosen: { select: { dosen_id: true } },
        },
      });
      if (!existing) return null;
      return {
        id: existing.id,
        judul: existing.judul,
        currentKunci: existing.kunci,
        tertautKePengguna: existing.iprs_dosen.some(
          (row) => row.dosen_id === dosenId,
        ),
        hitungKunciBaru: (patch) => hitungKunciIprsSetelahUbah(existing, patch),
      };
    },
    findConflictByKunci: (kunci) =>
      db.iprs.findUnique({ where: { kunci }, select: { id: true } }),
    updateData: (id, patch, nextKunci) =>
      db.iprs.update({
        where: { id },
        data: {
          ...patch,
          kunci: nextKunci,
          sumber: SUMBER_MANUAL,
        },
        select: IPRS_PUBLIC_SELECT,
      }),
  });
}

// Hapus: melepas tautan pengguna. Baris IPRS ikut dihapus hanya bila tidak ada dosen lain yang tertaut (PRD 5.7).
export async function DELETE(_request: NextRequest, { params }: KonteksRute) {
  return handleTridarmaDelete((await params).id, {
    namaObjekPenulis: "data IPRS",
    labelId: "ID IPRS",
    objekLog: "iprs",
    pesanTidakDitemukan: "IPRS tidak ditemukan.",
    pesanTidakDiizinkan: "Anda tidak memiliki izin untuk menghapus IPRS ini.",
    pesanTerhapus: "IPRS berhasil dihapus.",
    pesanTautanTerhapus: "Tautan IPRS dari akun Anda berhasil dihapus.",
    pesanGagalHapus: "Gagal menghapus IPRS.",
    logLabel: "DELETE /api/tridarma/iprs/[id]",
    findExisting: async (id, dosenId) => {
      const existing = await db.iprs.findUnique({
        where: { id },
        select: {
          id: true,
          judul: true,
          iprs_dosen: { select: { dosen_id: true } },
        },
      });
      if (!existing) return null;
      return {
        id: existing.id,
        judul: existing.judul,
        tertautKePengguna: existing.iprs_dosen.some(
          (row) => row.dosen_id === dosenId,
        ),
      };
    },
    hapusTautanAtauData: (id, dosenId) =>
      db.$transaction(async (tx) => {
        await tx.iprsDosen.delete({
          where: {
            iprs_id_dosen_id: {
              iprs_id: id,
              dosen_id: dosenId,
            },
          },
        });
        const sisaTautan = await tx.iprsDosen.count({ where: { iprs_id: id } });
        if (sisaTautan === 0) {
          await tx.iprs.delete({ where: { id } });
          return true;
        }
        return false;
      }),
  });
}
