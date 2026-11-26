"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getTridharmaPermissions } from "@/lib/rbac";
import { catatLog } from "@/lib/log-aktivitas";
import { md5, normalJudul, susunPenulis } from "@/lib/tridharma-manual";

export type HasilAksi = { ok: boolean; pesan: string };

export type DataUbah = {
  judul: string;
  tahun: number;
  jurnal: string;
  jenis: string;
  akreditasi: string;
  doi: string;
};

// Cek di SERVER (bukan percaya tombol di layar): harus login, role Dosen/Kaprodi,
// dan dosen_id sesi termasuk pemilik publikasi tersebut.
async function cekPemilik(publikasiId: number) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis, silakan login lagi." as const };

  const pub = await db.publikasi.findUnique({
    where: { id: publikasiId },
    select: { id: true, judul: true, publikasi_dosen: { select: { dosen_id: true } } },
  });
  if (!pub) return { error: "Publikasi tidak ditemukan." as const };

  const perms = getTridharmaPermissions(
    session,
    pub.publikasi_dosen.map((x) => x.dosen_id),
  );
  if (!perms.canUpdate || session.dosen_id == null) {
    return { error: "Kamu hanya bisa mengubah atau menghapus publikasi milikmu sendiri." as const };
  }
  return { session, pub, dosenId: session.dosen_id };
}

function segarkan() {
  revalidatePath("/tridharma/publikasi");
  revalidatePath("/tridharma/dashboard");
}

/**
 * Hapus publikasi milik dosen yang login.
 * Satu publikasi bisa dimiliki beberapa dosen (penulis bersama), jadi yang dihapus
 * lebih dulu hanya keterkaitan dosen ini. Barisnya baru ikut terhapus kalau tidak ada pemilik lain.
 */
export async function hapusPublikasi(publikasiId: number): Promise<HasilAksi> {
  const cek = await cekPemilik(publikasiId);
  if (cek.error) return { ok: false, pesan: cek.error };

  try {
    await db.$transaction(async (tx) => {
      await tx.publikasiDosen.deleteMany({
        where: { publikasi_id: publikasiId, dosen_id: cek.dosenId },
      });
      const sisa = await tx.publikasiDosen.count({ where: { publikasi_id: publikasiId } });
      if (sisa === 0) await tx.publikasi.delete({ where: { id: publikasiId } });
    });
  } catch (err) {
    console.error("Gagal menghapus publikasi:", err);
    return { ok: false, pesan: "Gagal menghapus publikasi. Coba lagi." };
  }

  await catatLog({
    userId: cek.session.sub,
    userNama: cek.session.name,
    modul: "7",
    aksi: "hapus",
    objek: "dosen",
    detail: `Publikasi: ${cek.pub.judul}`.slice(0, 500),
  });
  // Sengaja TANPA revalidatePath: kalau daftar disegarkan di sini, baris (dan pop-up sukses
  // di dalamnya) langsung hilang. Penyegaran dipanggil dari tombol setelah pop-up sukses ditutup.
  return { ok: true, pesan: "Publikasi dihapus." };
}

/** Ubah data publikasi milik dosen yang login. */
export async function ubahPublikasi(publikasiId: number, d: DataUbah): Promise<HasilAksi> {
  const cek = await cekPemilik(publikasiId);
  if (cek.error) return { ok: false, pesan: cek.error };

  const judul = d.judul.trim();
  const jurnal = d.jurnal.trim();
  const jenis = d.jenis.trim();
  const akreditasi = d.akreditasi.trim();
  const doi = d.doi.trim();

  if (!judul || judul.length > 500) return { ok: false, pesan: "Judul wajib diisi (maksimal 500 karakter)." };
  if (!Number.isInteger(d.tahun) || d.tahun < 1900 || d.tahun > 2100) {
    return { ok: false, pesan: "Tahun terbit harus berupa angka tahun yang valid." };
  }
  if (jurnal.length > 255) return { ok: false, pesan: "Nama jurnal maksimal 255 karakter." };
  if (jenis.length > 50) return { ok: false, pesan: "Jenis paper maksimal 50 karakter." };
  if (doi.length > 150) return { ok: false, pesan: "DOI maksimal 150 karakter." };

  // Kuartil (Q1-Q4) dan akreditasi (Sinta dll.) disimpan di kolom berbeda
  const adaKuartil = /^Q[1-4]$/.test(akreditasi);

  try {
    await db.publikasi.update({
      where: { id: publikasiId },
      data: {
        judul,
        tahun: d.tahun,
        jurnal: jurnal || null,
        jenis: jenis || null,
        doi: doi || null,
        ...(akreditasi ? (adaKuartil ? { kuartil: akreditasi } : { akreditasi }) : {}),
      },
    });
  } catch (err) {
    console.error("Gagal mengubah publikasi:", err);
    return { ok: false, pesan: "Gagal menyimpan perubahan. Coba lagi." };
  }

  await catatLog({
    userId: cek.session.sub,
    userNama: cek.session.name,
    modul: "7",
    aksi: "ubah",
    objek: "dosen",
    detail: `Publikasi: ${judul}`.slice(0, 500),
  });
  segarkan();
  return { ok: true, pesan: "Perubahan disimpan." };
}

export type DataTambah = DataUbah & { penulis: string[] };

/**
 * Tambah publikasi secara manual. LANGSUNG tersimpan dan tampil di daftar (tanpa persetujuan Kaprodi).
 * Pengaju otomatis tercatat sebagai pemilik; penulis lain yang namanya cocok dengan data dosen
 * juga dihubungkan, jadi publikasinya ikut tampil di halaman mereka.
 */
export async function tambahPublikasi(d: DataTambah): Promise<HasilAksi> {
  const session = await getSession();
  if (!session) return { ok: false, pesan: "Sesi habis, silakan login lagi." };
  const perms = getTridharmaPermissions(session);
  if (!perms.canCreate || session.dosen_id == null) {
    return { ok: false, pesan: "Hanya Dosen dan Kaprodi yang terhubung ke data dosen yang bisa menambah publikasi." };
  }

  const judul = d.judul.trim();
  const jurnal = d.jurnal.trim();
  const jenis = d.jenis.trim();
  const akreditasi = d.akreditasi.trim();
  const doi = d.doi.trim();

  if (!judul || judul.length > 500) return { ok: false, pesan: "Judul wajib diisi (maksimal 500 karakter)." };
  if (!Number.isInteger(d.tahun) || d.tahun < 1900 || d.tahun > 2100) {
    return { ok: false, pesan: "Tahun terbit harus berupa angka tahun yang valid." };
  }
  if (jurnal.length > 255) return { ok: false, pesan: "Nama jurnal maksimal 255 karakter." };
  if (jenis.length > 50) return { ok: false, pesan: "Jenis paper maksimal 50 karakter." };
  if (doi.length > 150) return { ok: false, pesan: "DOI maksimal 150 karakter." };

  const judulHash = md5(normalJudul(judul));
  const adaKuartil = /^Q[1-4]$/.test(akreditasi);

  try {
    const [semuaDosen, pengaju] = await Promise.all([
      db.dosen.findMany({ select: { id: true, nama: true, nama_normal: true } }),
      db.dosen.findUnique({ where: { id: session.dosen_id }, select: { id: true, nama: true, nama_normal: true } }),
    ]);
    if (!pengaju) return { ok: false, pesan: "Akun kamu belum terhubung ke data dosen." };

    const penulis = susunPenulis(d.penulis, semuaDosen, pengaju, session.name);
    const idDosen = [...new Set(penulis.flatMap((p) => (p.dosen ? [p.dosen.id] : [])))];

    const hasil = await db.$transaction(async (tx) => {
      const ada = await tx.publikasi.findUnique({
        where: { judul_hash: judulHash },
        select: { id: true, publikasi_dosen: { select: { dosen_id: true } } },
      });

      // Judul yang sama sudah ada
      if (ada && ada.publikasi_dosen.some((x) => x.dosen_id === pengaju.id)) {
        return { status: "sudah-ada" as const };
      }

      const publikasiId =
        ada?.id ??
        (
          await tx.publikasi.create({
            data: {
              judul_hash: judulHash,
              judul,
              tahun: d.tahun,
              penulis: penulis.map((p) => p.nama).join("; "),
              jurnal: jurnal || null,
              jenis: jenis || null,
              doi: doi || null,
              ...(akreditasi ? (adaKuartil ? { kuartil: akreditasi } : { akreditasi }) : {}),
            },
            select: { id: true },
          })
        ).id;

      await tx.publikasiDosen.createMany({
        data: idDosen.map((dosenId) => {
          const urutan = penulis.findIndex((p) => p.dosen?.id === dosenId) + 1;
          return {
            publikasi_id: publikasiId,
            dosen_id: dosenId,
            // Tanpa mengubah database: memakai nilai source yang sudah ada di enum PublikasiSource.
            source: "sinta_googlescholar" as const,
            urutan_penulis: urutan || null,
            total_penulis: penulis.length,
          };
        }),
        skipDuplicates: true,
      });
      return { status: ada ? ("digabung" as const) : ("baru" as const) };
    });

    if (hasil.status === "sudah-ada") {
      return { ok: false, pesan: "Publikasi dengan judul ini sudah ada di daftarmu." };
    }

    await catatLog({
      userId: session.sub,
      userNama: session.name,
      modul: "7",
      aksi: "tambah",
      objek: "dosen",
      detail: `Publikasi: ${judul}`.slice(0, 500),
    });
    segarkan();
    return {
      ok: true,
      pesan:
        hasil.status === "digabung"
          ? "Publikasi ini sudah ada di data dosen lain, kamu ditambahkan sebagai penulis."
          : "Publikasi tersimpan dan langsung tampil di daftar.",
    };
  } catch (err) {
    console.error("Gagal menambah publikasi:", err);
    return { ok: false, pesan: "Gagal menyimpan publikasi. Coba lagi." };
  }
}