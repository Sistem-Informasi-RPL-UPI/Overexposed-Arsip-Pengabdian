-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('IN_PROGRESS', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "PublikasiSource" AS ENUM ('sinta_scopus', 'sinta_garuda', 'sinta_googlescholar', 'sinta_rama');

-- CreateEnum
CREATE TYPE "JenisKegiatan" AS ENUM ('penelitian', 'pengabdian');

-- CreateEnum
CREATE TYPE "PeranKegiatan" AS ENUM ('ketua', 'anggota');

-- CreateEnum
CREATE TYPE "Semester" AS ENUM ('Ganjil', 'Genap');

-- CreateEnum
CREATE TYPE "JenisBerkas" AS ENUM ('RPS', 'Slide', 'UTS', 'UAS', 'Kuis', 'Presensi', 'Nilai', 'Modul');

-- CreateTable
CREATE TABLE "dosen" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "sinta_id" TEXT NOT NULL,
    "nama" TEXT,
    "nama_normal" TEXT,
    "afiliasi" TEXT,
    "departemen" TEXT,
    "sync_status" "SyncStatus",
    "last_synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dosen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sinta_skor" (
    "dosen_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "nilai" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "sinta_skor_pkey" PRIMARY KEY ("dosen_id","label")
);

-- CreateTable
CREATE TABLE "sinta_metrik" (
    "dosen_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "scopus" INTEGER,
    "gscholar" INTEGER,
    "wos" INTEGER,

    CONSTRAINT "sinta_metrik_pkey" PRIMARY KEY ("dosen_id","label")
);

-- CreateTable
CREATE TABLE "crawl_log" (
    "id" SERIAL NOT NULL,
    "dosen_id" INTEGER NOT NULL,
    "kategori" VARCHAR(50) NOT NULL,
    "jumlah_item" INTEGER NOT NULL DEFAULT 0,
    "terpotong" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crawl_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publikasi" (
    "id" SERIAL NOT NULL,
    "judul_hash" CHAR(32) NOT NULL,
    "judul" TEXT NOT NULL,
    "tahun" SMALLINT,
    "penulis" TEXT,
    "jurnal" TEXT,
    "sitasi" INTEGER NOT NULL DEFAULT 0,
    "link" TEXT,
    "kuartil" VARCHAR(10),
    "jenis" VARCHAR(50),
    "penerbit" VARCHAR(200),
    "doi" VARCHAR(150),
    "akreditasi" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publikasi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publikasi_dosen" (
    "publikasi_id" INTEGER NOT NULL,
    "dosen_id" INTEGER NOT NULL,
    "source" "PublikasiSource" NOT NULL,
    "urutan_penulis" SMALLINT,
    "total_penulis" SMALLINT,
    "sitasi_sumber" INTEGER,
    "link_sumber" TEXT,

    CONSTRAINT "publikasi_dosen_pkey" PRIMARY KEY ("publikasi_id","dosen_id","source")
);

-- CreateTable
CREATE TABLE "kegiatan" (
    "id" SERIAL NOT NULL,
    "kunci" CHAR(32) NOT NULL,
    "jenis" "JenisKegiatan" NOT NULL,
    "judul" TEXT NOT NULL,
    "tahun" SMALLINT,
    "skema" VARCHAR(255),
    "dana_nominal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "status" VARCHAR(30),
    "sumber_dana" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kegiatan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kegiatan_anggota" (
    "kegiatan_id" INTEGER NOT NULL,
    "nama_normal" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "peran" "PeranKegiatan" NOT NULL,
    "dosen_id" INTEGER,

    CONSTRAINT "kegiatan_anggota_pkey" PRIMARY KEY ("kegiatan_id","nama_normal")
);

-- CreateTable
CREATE TABLE "iprs" (
    "id" SERIAL NOT NULL,
    "kunci" CHAR(32) NOT NULL,
    "judul" TEXT NOT NULL,
    "jenis" VARCHAR(100),
    "tahun" SMALLINT,
    "nomor_permohonan" VARCHAR(100),
    "status" VARCHAR(100),
    "pemegang" VARCHAR(255),
    "inventor" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "iprs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iprs_dosen" (
    "iprs_id" INTEGER NOT NULL,
    "dosen_id" INTEGER NOT NULL,

    CONSTRAINT "iprs_dosen_pkey" PRIMARY KEY ("iprs_id","dosen_id")
);

-- CreateTable
CREATE TABLE "buku" (
    "id" SERIAL NOT NULL,
    "kunci" CHAR(32) NOT NULL,
    "judul" TEXT NOT NULL,
    "kategori" VARCHAR(100),
    "penulis" TEXT,
    "penerbit" VARCHAR(200),
    "tahun" SMALLINT,
    "tempat_terbit" VARCHAR(200),
    "isbn" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buku_dosen" (
    "buku_id" INTEGER NOT NULL,
    "dosen_id" INTEGER NOT NULL,

    CONSTRAINT "buku_dosen_pkey" PRIMARY KEY ("buku_id","dosen_id")
);

-- CreateTable
CREATE TABLE "matkul" (
    "id" SERIAL NOT NULL,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "sks" SMALLINT NOT NULL,

    CONSTRAINT "matkul_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kelas" (
    "id" SERIAL NOT NULL,
    "matkul_id" INTEGER NOT NULL,
    "dosen_id" INTEGER NOT NULL,
    "tahun_ajaran" TEXT NOT NULL,
    "semester" "Semester" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kelas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "berkas_pengajaran" (
    "id" SERIAL NOT NULL,
    "kelas_id" INTEGER NOT NULL,
    "jenis" "JenisBerkas" NOT NULL,
    "judul" TEXT,
    "link" TEXT NOT NULL,
    "keterangan" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "berkas_pengajaran_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kategori" (
    "id" SERIAL NOT NULL,
    "kode" VARCHAR(20) NOT NULL,
    "nama" TEXT NOT NULL,
    "retensi_aktif_tahun" SMALLINT NOT NULL,
    "retensi_inaktif_tahun" SMALLINT NOT NULL,
    "keterangan" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kategori_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arsip" (
    "id" SERIAL NOT NULL,
    "nomor_arsip" TEXT NOT NULL,
    "judul" TEXT NOT NULL,
    "kategori_id" INTEGER NOT NULL,
    "tanggal_arsip" DATE NOT NULL,
    "nomor_surat" TEXT,
    "pencipta_unit" TEXT,
    "retensi_aktif_tahun" SMALLINT NOT NULL,
    "retensi_inaktif_tahun" SMALLINT NOT NULL,
    "link_berkas" TEXT NOT NULL,
    "keterangan" TEXT,
    "dibuat_oleh" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arsip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_aktivitas" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "user_nama" TEXT NOT NULL,
    "aksi" VARCHAR(50) NOT NULL,
    "objek" VARCHAR(20) NOT NULL,
    "objek_id" INTEGER,
    "detail" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_aktivitas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dosen_user_id_key" ON "dosen"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dosen_sinta_id_key" ON "dosen"("sinta_id");

-- CreateIndex
CREATE INDEX "dosen_nama_normal_idx" ON "dosen"("nama_normal");

-- CreateIndex
CREATE INDEX "crawl_log_dosen_id_created_at_idx" ON "crawl_log"("dosen_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "publikasi_judul_hash_key" ON "publikasi"("judul_hash");

-- CreateIndex
CREATE INDEX "publikasi_dosen_dosen_id_idx" ON "publikasi_dosen"("dosen_id");

-- CreateIndex
CREATE UNIQUE INDEX "kegiatan_kunci_key" ON "kegiatan"("kunci");

-- CreateIndex
CREATE INDEX "kegiatan_jenis_tahun_idx" ON "kegiatan"("jenis", "tahun");

-- CreateIndex
CREATE INDEX "kegiatan_anggota_dosen_id_idx" ON "kegiatan_anggota"("dosen_id");

-- CreateIndex
CREATE INDEX "kegiatan_anggota_nama_normal_idx" ON "kegiatan_anggota"("nama_normal");

-- CreateIndex
CREATE UNIQUE INDEX "iprs_kunci_key" ON "iprs"("kunci");

-- CreateIndex
CREATE INDEX "iprs_dosen_dosen_id_idx" ON "iprs_dosen"("dosen_id");

-- CreateIndex
CREATE UNIQUE INDEX "buku_kunci_key" ON "buku"("kunci");

-- CreateIndex
CREATE INDEX "buku_dosen_dosen_id_idx" ON "buku_dosen"("dosen_id");

-- CreateIndex
CREATE UNIQUE INDEX "matkul_kode_key" ON "matkul"("kode");

-- CreateIndex
CREATE INDEX "kelas_dosen_id_idx" ON "kelas"("dosen_id");

-- CreateIndex
CREATE UNIQUE INDEX "kelas_matkul_id_dosen_id_tahun_ajaran_semester_key" ON "kelas"("matkul_id", "dosen_id", "tahun_ajaran", "semester");

-- CreateIndex
CREATE INDEX "berkas_pengajaran_kelas_id_idx" ON "berkas_pengajaran"("kelas_id");

-- CreateIndex
CREATE UNIQUE INDEX "kategori_kode_key" ON "kategori"("kode");

-- CreateIndex
CREATE UNIQUE INDEX "arsip_nomor_arsip_key" ON "arsip"("nomor_arsip");

-- CreateIndex
CREATE INDEX "arsip_kategori_id_idx" ON "arsip"("kategori_id");

-- CreateIndex
CREATE INDEX "arsip_tanggal_arsip_idx" ON "arsip"("tanggal_arsip");

-- CreateIndex
CREATE INDEX "log_aktivitas_created_at_idx" ON "log_aktivitas"("created_at");

-- CreateIndex
CREATE INDEX "log_aktivitas_user_id_idx" ON "log_aktivitas"("user_id");

-- AddForeignKey
ALTER TABLE "sinta_skor" ADD CONSTRAINT "sinta_skor_dosen_id_fkey" FOREIGN KEY ("dosen_id") REFERENCES "dosen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sinta_metrik" ADD CONSTRAINT "sinta_metrik_dosen_id_fkey" FOREIGN KEY ("dosen_id") REFERENCES "dosen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crawl_log" ADD CONSTRAINT "crawl_log_dosen_id_fkey" FOREIGN KEY ("dosen_id") REFERENCES "dosen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publikasi_dosen" ADD CONSTRAINT "publikasi_dosen_publikasi_id_fkey" FOREIGN KEY ("publikasi_id") REFERENCES "publikasi"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publikasi_dosen" ADD CONSTRAINT "publikasi_dosen_dosen_id_fkey" FOREIGN KEY ("dosen_id") REFERENCES "dosen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kegiatan_anggota" ADD CONSTRAINT "kegiatan_anggota_kegiatan_id_fkey" FOREIGN KEY ("kegiatan_id") REFERENCES "kegiatan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kegiatan_anggota" ADD CONSTRAINT "kegiatan_anggota_dosen_id_fkey" FOREIGN KEY ("dosen_id") REFERENCES "dosen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iprs_dosen" ADD CONSTRAINT "iprs_dosen_iprs_id_fkey" FOREIGN KEY ("iprs_id") REFERENCES "iprs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iprs_dosen" ADD CONSTRAINT "iprs_dosen_dosen_id_fkey" FOREIGN KEY ("dosen_id") REFERENCES "dosen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buku_dosen" ADD CONSTRAINT "buku_dosen_buku_id_fkey" FOREIGN KEY ("buku_id") REFERENCES "buku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buku_dosen" ADD CONSTRAINT "buku_dosen_dosen_id_fkey" FOREIGN KEY ("dosen_id") REFERENCES "dosen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kelas" ADD CONSTRAINT "kelas_matkul_id_fkey" FOREIGN KEY ("matkul_id") REFERENCES "matkul"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kelas" ADD CONSTRAINT "kelas_dosen_id_fkey" FOREIGN KEY ("dosen_id") REFERENCES "dosen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "berkas_pengajaran" ADD CONSTRAINT "berkas_pengajaran_kelas_id_fkey" FOREIGN KEY ("kelas_id") REFERENCES "kelas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arsip" ADD CONSTRAINT "arsip_kategori_id_fkey" FOREIGN KEY ("kategori_id") REFERENCES "kategori"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
