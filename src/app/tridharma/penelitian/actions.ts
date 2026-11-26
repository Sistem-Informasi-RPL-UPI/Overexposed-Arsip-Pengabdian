"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getTridharmaPermissions } from "@/lib/rbac";
import { catatLog } from "@/lib/log-aktivitas";
import { md5, normalJudul, susunPenulis } from "@/lib/tridharma-manual";

export type HasilAksi = { ok: boolean; pesan: string };

export type DataUbahPenelitian = {
  judul: string;
  tahun: number;
  skema: string;
  sumberDana: string;
  dana: number; // rupiah
};

// Cek di SERVER (bukan percaya tombol di layar): harus login, role Dosen/Kaprodi,
// dan dosen_id sesi termasuk anggota tim penelitian tersebut.
async function cekPemilik(kegiatanId: number) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis, silakan login lagi." as const };

  const kegiatan = await db.kegiatan.findFirst({
    where: { id: kegiatanId, jenis: "penelitian" },
    select: { id: true, judul: true, anggota: { select: { dosen_id: true } } },
  });
  if (!kegiatan) return { error: "Penelitian tidak ditemukan." as const };

  const dosenIds = kegiatan.anggota.map((a) => a.dosen_id).filter((x): x is number => x !== null);
  const perms = getTridharmaPermissions(session, dosenIds);
  if (!perms.canUpdate || session.dosen_id == null) {
    return { error: "Kamu hanya bisa mengubah atau menghapus penelitian milikmu sendiri." as const };
  }
  return { session, kegiatan, dosenId: session.dosen_id };
}

function segarkan() {
  revalidatePath("/tridharma/penelitian");
  revalidatePath("/tridharma/dashboard");
}

/**
 * Hapus penelitian milik dosen yang login.
 * Satu penelitian bisa punya beberapa dosen anggota, jadi yang dihapus lebih dulu hanya
 * keterkaitan dosen ini. Barisnya baru ikut terhapus kalau tidak ada dosen lain di timnya.
 */
export async function hapusPenelitian(kegiatanId: number): Promise<HasilAksi> {
  const cek = await cekPemilik(kegiatanId);
  if (cek.error) return { ok: false, pesan: cek.error };

  try {
    await db.$transaction(async (tx) => {
      await tx.kegiatanAnggota.deleteMany({
        where: { kegiatan_id: kegiatanId, dosen_id: cek.dosenId },
      });
      const sisaDosen = await tx.kegiatanAnggota.count({
        where: { kegiatan_id: kegiatanId, dosen_id: { not: null } },
      });
      if (sisaDosen === 0) {
        // anggota non-dosen (mis. mahasiswa) ikut dibersihkan supaya tidak jadi data yatim
        await tx.kegiatanAnggota.deleteMany({ where: { kegiatan_id: kegiatanId } });
        await tx.kegiatan.delete({ where: { id: kegiatanId } });
      }
    });
  } catch (err) {
    console.error("Gagal menghapus penelitian:", err);
    return { ok: false, pesan: "Gagal menghapus penelitian. Coba lagi." };
  }

  await catatLog({
    userId: cek.session.sub,
    userNama: cek.session.name,
    modul: "7",
    aksi: "hapus",
    objek: "dosen",
    detail: `Penelitian: ${cek.kegiatan.judul}`.slice(0, 500),
  });
  // Sengaja TANPA revalidatePath: kalau daftar disegarkan di sini, baris (dan pop-up sukses
  // di dalamnya) langsung hilang. Penyegaran dipanggil dari tombol setelah pop-up sukses ditutup.
  return { ok: true, pesan: "Penelitian dihapus." };
}

/** Ubah data utama penelitian milik dosen yang login (anggota tim tidak diubah di sini). */
export async function ubahPenelitian(kegiatanId: number, d: DataUbahPenelitian): Promise<HasilAksi> {
  const cek = await cekPemilik(kegiatanId);
  if (cek.error) return { ok: false, pesan: cek.error };

  const judul = d.judul.trim();
  const skema = d.skema.trim();
  const sumberDana = d.sumberDana.trim();

  if (!judul || judul.length > 500) return { ok: false, pesan: "Judul wajib diisi (maksimal 500 karakter)." };
  if (!Number.isInteger(d.tahun) || d.tahun < 1900 || d.tahun > 2100) {
    return { ok: false, pesan: "Tahun penelitian harus berupa angka tahun yang valid." };
  }
  if (!skema || skema.length > 255) return { ok: false, pesan: "Skema wajib diisi (maksimal 255 karakter)." };
  if (!sumberDana || sumberDana.length > 100) {
    return { ok: false, pesan: "Sumber pendanaan wajib diisi (maksimal 100 karakter)." };
  }
  if (!Number.isFinite(d.dana) || d.dana < 0 || d.dana > 999_999_999_999) {
    return { ok: false, pesan: "Nilai dana harus berupa angka rupiah yang valid." };
  }

  try {
    await db.kegiatan.update({
      where: { id: kegiatanId },
      data: { judul, tahun: d.tahun, skema, sumber_dana: sumberDana, dana_nominal: d.dana },
    });
  } catch (err) {
    console.error("Gagal mengubah penelitian:", err);
    return { ok: false, pesan: "Gagal menyimpan perubahan. Coba lagi." };
  }

  await catatLog({
    userId: cek.session.sub,
    userNama: cek.session.name,
    modul: "7",
    aksi: "ubah",
    objek: "dosen",
    detail: `Penelitian: ${judul}`.slice(0, 500),
  });
  segarkan();
  return { ok: true, pesan: "Perubahan disimpan." };
}

export type DataTambahPenelitian = DataUbahPenelitian & { penulis: string[] };

/**
 * Tambah penelitian secara manual. LANGSUNG tersimpan dan tampil di daftar (tanpa persetujuan Kaprodi).
 * Nama pertama di daftar penulis dicatat sebagai ketua; pengaju selalu ikut tercatat.
 * Anggota yang namanya cocok dengan data dosen dihubungkan ke akun dosennya.
 */
export async function tambahPenelitian(d: DataTambahPenelitian): Promise<HasilAksi> {
  const session = await getSession();
  if (!session) return { ok: false, pesan: "Sesi habis, silakan login lagi." };
  const perms = getTridharmaPermissions(session);
  if (!perms.canCreate || session.dosen_id == null) {
    return { ok: false, pesan: "Hanya Dosen dan Kaprodi yang terhubung ke data dosen yang bisa menambah penelitian." };
  }

  const judul = d.judul.trim();
  const skema = d.skema.trim();
  const sumberDana = d.sumberDana.trim();

  if (!judul || judul.length > 500) return { ok: false, pesan: "Judul wajib diisi (maksimal 500 karakter)." };
  if (!Number.isInteger(d.tahun) || d.tahun < 1900 || d.tahun > 2100) {
    return { ok: false, pesan: "Tahun penelitian harus berupa angka tahun yang valid." };
  }
  if (!skema || skema.length > 255) return { ok: false, pesan: "Skema wajib diisi (maksimal 255 karakter)." };
  if (!sumberDana || sumberDana.length > 100) {
    return { ok: false, pesan: "Sumber pendanaan wajib diisi (maksimal 100 karakter)." };
  }
  if (!Number.isFinite(d.dana) || d.dana < 0 || d.dana >= 1e15) {
    return { ok: false, pesan: "Nilai dana harus berupa angka rupiah 0 atau lebih." };
  }

  const kunci = md5(`manual|penelitian|${normalJudul(judul)}|${d.tahun}`);

  try {
    const [semuaDosen, pengaju] = await Promise.all([
      db.dosen.findMany({ select: { id: true, nama: true, nama_normal: true } }),
      db.dosen.findUnique({ where: { id: session.dosen_id }, select: { id: true, nama: true, nama_normal: true } }),
    ]);
    if (!pengaju) return { ok: false, pesan: "Akun kamu belum terhubung ke data dosen." };

    const tim = susunPenulis(d.penulis, semuaDosen, pengaju, session.name);

    const hasil = await db.$transaction(async (tx) => {
      const ada = await tx.kegiatan.findUnique({
        where: { kunci },
        select: { id: true, anggota: { select: { nama_normal: true, dosen_id: true } } },
      });

      if (ada && ada.anggota.some((a) => a.dosen_id === pengaju.id)) {
        return { status: "sudah-ada" as const };
      }

      const kegiatanId =
        ada?.id ??
        (
          await tx.kegiatan.create({
            data: {
              kunci,
              jenis: "penelitian",
              judul,
              tahun: d.tahun,
              skema,
              sumber_dana: sumberDana,
              dana_nominal: d.dana,
              status: null, // tanpa alur persetujuan
            },
            select: { id: true },
          })
        ).id;

      // Penelitian yang sudah ada (dibuat pihak lain): hanya anggota baru yang ditambahkan
      const sudahAda = new Set((ada?.anggota ?? []).map((a) => a.nama_normal));
      const baris = tim
        .map((p, i) => ({
          kegiatan_id: kegiatanId,
          nama_normal: p.dosen?.nama_normal || p.kunci,
          nama: p.nama,
          peran: i === 0 && !ada ? ("ketua" as const) : ("anggota" as const),
          dosen_id: p.dosen?.id ?? null,
        }))
        .filter((r) => !sudahAda.has(r.nama_normal));

      await tx.kegiatanAnggota.createMany({ data: baris, skipDuplicates: true });
      return { status: ada ? ("digabung" as const) : ("baru" as const) };
    });

    if (hasil.status === "sudah-ada") {
      return { ok: false, pesan: "Penelitian dengan judul dan tahun ini sudah ada di daftarmu." };
    }

    await catatLog({
      userId: session.sub,
      userNama: session.name,
      modul: "7",
      aksi: "tambah",
      objek: "dosen",
      detail: `Penelitian: ${judul}`.slice(0, 500),
    });
    segarkan();
    return {
      ok: true,
      pesan:
        hasil.status === "digabung"
          ? "Penelitian ini sudah ada di data dosen lain, kamu ditambahkan sebagai anggota."
          : "Penelitian tersimpan dan langsung tampil di daftar.",
    };
  } catch (err) {
    console.error("Gagal menambah penelitian:", err);
    return { ok: false, pesan: "Gagal menyimpan penelitian. Coba lagi." };
  }
}