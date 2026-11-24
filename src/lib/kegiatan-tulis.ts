import { db } from "@/lib/db";
import {
  hitungKunciKegiatanSetelahUbah,
  PESAN_KEGIATAN_DITAUTKAN,
  PESAN_KEGIATAN_DUPLIKAT,
  PESAN_NAMA_HARUS_ADA,
  PESAN_SINKRON_DULU,
  rencanakanAnggota,
  type AnggotaTim,
  type BarisAnggota,
  type KegiatanWriteData,
} from "@/lib/kegiatan";
import { normNama } from "@/lib/kunci";
import { catatLog, type AksiLog } from "@/lib/log-aktivitas";
import type { LocalSessionPayload } from "@/lib/session";
import { SUMBER_MANUAL } from "@/lib/tridarma";
import { detailKegiatan } from "@/lib/tridarma-data";

/**
 * Operasi tulis kegiatan manual (PRD 5.7). Hak akses (login, peran, dan baris dosen) sudah dicek route lewat
 * `requireTridarmaWriter`. Di sini dicek kepemilikan baris, nama pengguna di tim, dan duplikat.
 */

export interface Pengguna {
  session: LocalSessionPayload;
  dosenId: number;
}

export interface HasilTulis {
  status: number;
  body: Record<string, unknown>;
}

const galat = (status: number, message: string): HasilTulis => ({ status, body: { message } });

function catat(pengguna: Pengguna, aksi: AksiLog, judul: string) {
  return catatLog({
    userId: pengguna.session.sub,
    userNama: pengguna.session.name,
    modul: "7",
    aksi,
    objek: "kegiatan",
    detail: judul,
  });
}

/**
 * Nama dosen dari SINTA. Kosong sampai sinkron pertama, dan pengguna yang belum sinkron ditolak, supaya nama di
 * baris manual sama dengan nama SINTA dan crawl tidak menambah baris kedua untuk orang yang sama.
 */
async function ambilIdentitas(dosenId: number): Promise<{ namaNormal: string } | null> {
  const dosen = await db.dosen.findUnique({ where: { id: dosenId }, select: { nama: true, nama_normal: true } });
  const namaNormal = dosen?.nama_normal?.trim() || (dosen?.nama ? normNama(dosen.nama) : "");
  return dosen?.nama && namaNormal ? { namaNormal } : null;
}

/** nama_normal -> dosen_id, hanya untuk nama yang cocok dengan tepat satu dosen (sama dengan `muat_peta_dosen` di crawler). */
async function petaDosenUntuk(namaNormal: string[]): Promise<Map<string, number>> {
  const baris = await db.dosen.findMany({
    where: { nama_normal: { in: namaNormal } },
    select: { id: true, nama_normal: true },
  });
  const kelompok = new Map<string, number[]>();
  for (const b of baris) {
    if (b.nama_normal) kelompok.set(b.nama_normal, [...(kelompok.get(b.nama_normal) ?? []), b.id]);
  }
  return new Map([...kelompok].filter(([, ids]) => ids.length === 1).map(([nama, ids]) => [nama, ids[0]]));
}

export async function tambahKegiatan(args: {
  pengguna: Pengguna;
  data: KegiatanWriteData;
  tim: AnggotaTim[];
  kunci: string;
}): Promise<HasilTulis> {
  const { pengguna, data, tim, kunci } = args;

  const identitas = await ambilIdentitas(pengguna.dosenId);
  if (!identitas) return galat(400, PESAN_SINKRON_DULU);

  const saya = tim.find((t) => t.nama_normal === identitas.namaNormal);
  if (!saya) return galat(400, PESAN_NAMA_HARUS_ADA);

  const ada = await db.kegiatan.findUnique({
    where: { kunci },
    select: { id: true, judul: true, sumber: true, anggota: { select: { nama_normal: true, dosen_id: true } } },
  });

  if (ada) {
    const sudahTertaut = ada.anggota.some((a) => a.dosen_id === pengguna.dosenId);
    if (ada.sumber !== SUMBER_MANUAL || sudahTertaut) return galat(409, PESAN_KEGIATAN_DUPLIKAT);

    // Duplikat dengan data manual dosen lain: tautkan otomatis tanpa mengubah isi kegiatan.
    const barisSaya = ada.anggota.find((a) => a.nama_normal === identitas.namaNormal);
    if (barisSaya && barisSaya.dosen_id !== null) return galat(409, PESAN_KEGIATAN_DUPLIKAT);

    if (barisSaya) {
      await db.kegiatanAnggota.update({
        where: { kegiatan_id_nama_normal: { kegiatan_id: ada.id, nama_normal: identitas.namaNormal } },
        data: { dosen_id: pengguna.dosenId },
      });
    } else {
      await db.kegiatanAnggota.create({
        data: {
          kegiatan_id: ada.id,
          nama: saya.nama,
          nama_normal: saya.nama_normal,
          peran: saya.peran,
          dosen_id: pengguna.dosenId,
        },
      });
    }

    await catat(pengguna, "tambah", ada.judul);
    return {
      status: 200,
      body: { message: PESAN_KEGIATAN_DITAUTKAN, data: { ditautkan: true, id: ada.id, judul: ada.judul } },
    };
  }

  const peta = await petaDosenUntuk(tim.map((t) => t.nama_normal));
  const dibuat = await db.kegiatan.create({
    data: {
      ...data,
      kunci,
      sumber: SUMBER_MANUAL,
      anggota: {
        create: tim.map((t) => ({
          nama: t.nama,
          nama_normal: t.nama_normal,
          peran: t.peran,
          dosen_id: t.nama_normal === identitas.namaNormal ? pengguna.dosenId : (peta.get(t.nama_normal) ?? null),
        })),
      },
    },
    select: { id: true, judul: true },
  });

  await catat(pengguna, "tambah", dibuat.judul);
  return {
    status: 201,
    body: { message: "Kegiatan berhasil ditambahkan.", data: await detailKegiatan(dibuat.id, pengguna.session) },
  };
}

export async function ubahKegiatan(args: {
  pengguna: Pengguna;
  id: number;
  patch: Partial<KegiatanWriteData>;
  tim?: AnggotaTim[];
}): Promise<HasilTulis> {
  const { pengguna, id, patch, tim } = args;

  const ada = await db.kegiatan.findUnique({
    where: { id },
    select: {
      id: true,
      kunci: true,
      jenis: true,
      judul: true,
      tahun: true,
      anggota: { select: { nama: true, nama_normal: true, peran: true, dosen_id: true } },
    },
  });
  if (!ada) return galat(404, "Kegiatan tidak ditemukan.");

  if (!ada.anggota.some((a) => a.dosen_id === pengguna.dosenId)) {
    return galat(403, "Anda tidak memiliki izin untuk mengubah kegiatan ini.");
  }

  let namaNormalSaya = "";
  if (tim) {
    const identitas = await ambilIdentitas(pengguna.dosenId);
    if (!identitas) return galat(400, PESAN_SINKRON_DULU);
    if (!tim.some((t) => t.nama_normal === identitas.namaNormal)) return galat(400, PESAN_NAMA_HARUS_ADA);
    namaNormalSaya = identitas.namaNormal;
  }

  const kunciBaru = hitungKunciKegiatanSetelahUbah(ada, patch);
  if (kunciBaru !== ada.kunci) {
    const bentrok = await db.kegiatan.findUnique({ where: { kunci: kunciBaru }, select: { id: true } });
    if (bentrok && bentrok.id !== ada.id) return galat(409, PESAN_KEGIATAN_DUPLIKAT);
  }

  const rencana = tim
    ? rencanakanAnggota({
        existing: ada.anggota as BarisAnggota[],
        tim,
        petaDosen: await petaDosenUntuk(tim.map((t) => t.nama_normal)),
        pengguna: { dosenId: pengguna.dosenId, namaNormal: namaNormalSaya },
      })
    : null;

  await db.$transaction(async (tx) => {
    // Data SINTA yang diubah menjadi manual, supaya crawl berikutnya hanya mengisi kolom kosong (PRD 12 nomor 19 dan 21).
    await tx.kegiatan.update({ where: { id }, data: { ...patch, kunci: kunciBaru, sumber: SUMBER_MANUAL } });
    if (!rencana) return;

    if (rencana.hapus.length) {
      await tx.kegiatanAnggota.deleteMany({ where: { kegiatan_id: id, nama_normal: { in: rencana.hapus } } });
    }
    for (const b of rencana.ubah) {
      await tx.kegiatanAnggota.update({
        where: { kegiatan_id_nama_normal: { kegiatan_id: id, nama_normal: b.nama_normal } },
        data: { nama: b.nama, peran: b.peran, dosen_id: b.dosen_id },
      });
    }
    if (rencana.buat.length) {
      await tx.kegiatanAnggota.createMany({ data: rencana.buat.map((b) => ({ ...b, kegiatan_id: id })) });
    }
    if (rencana.turunkan.length) {
      await tx.kegiatanAnggota.updateMany({
        where: { kegiatan_id: id, nama_normal: { in: rencana.turunkan } },
        data: { peran: "anggota" },
      });
    }
  });

  const diperbarui = await detailKegiatan(id, pengguna.session);
  await catat(pengguna, "ubah", diperbarui?.judul ?? ada.judul);
  return { status: 200, body: { message: "Kegiatan berhasil diperbarui.", data: diperbarui } };
}

export async function hapusKegiatan(args: { pengguna: Pengguna; id: number }): Promise<HasilTulis> {
  const { pengguna, id } = args;

  const ada = await db.kegiatan.findUnique({
    where: { id },
    select: { id: true, judul: true, anggota: { select: { dosen_id: true } } },
  });
  if (!ada) return galat(404, "Kegiatan tidak ditemukan.");

  if (!ada.anggota.some((a) => a.dosen_id === pengguna.dosenId)) {
    return galat(403, "Anda tidak memiliki izin untuk menghapus kegiatan ini.");
  }

  // Lepas tautan pengguna dulu. Kegiatan ikut terhapus hanya bila tidak ada lagi anggota yang berupa dosen terdaftar.
  const dataDihapus = await db.$transaction(async (tx) => {
    await tx.kegiatanAnggota.deleteMany({ where: { kegiatan_id: id, dosen_id: pengguna.dosenId } });
    const sisa = await tx.kegiatanAnggota.count({ where: { kegiatan_id: id, dosen_id: { not: null } } });
    if (sisa === 0) {
      await tx.kegiatan.delete({ where: { id } });
      return true;
    }
    return false;
  });

  await catat(pengguna, "hapus", ada.judul);
  return {
    status: 200,
    body: {
      message: dataDihapus ? "Kegiatan berhasil dihapus." : "Tautan kegiatan dari akun Anda berhasil dihapus.",
      data: { id: ada.id, judul: ada.judul, data_dihapus: dataDihapus },
    },
  };
}
