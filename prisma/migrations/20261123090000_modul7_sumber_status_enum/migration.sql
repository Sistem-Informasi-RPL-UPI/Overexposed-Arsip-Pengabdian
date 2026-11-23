-- Semua perubahan skema modul 7 (PRD 5.3, issue #12) dalam satu migrasi.

-- CreateEnum
CREATE TYPE "SumberData" AS ENUM ('sinta', 'manual');

-- AlterEnum
ALTER TYPE "PublikasiSource" ADD VALUE 'manual';

-- kegiatan tidak lagi punya status. Data status lama ikut terhapus.
ALTER TABLE "kegiatan" DROP COLUMN "status";

-- Baris yang sudah ada berasal dari crawl, jadi otomatis bernilai 'sinta'.
ALTER TABLE "publikasi" ADD COLUMN "sumber" "SumberData" NOT NULL DEFAULT 'sinta';
ALTER TABLE "kegiatan" ADD COLUMN "sumber" "SumberData" NOT NULL DEFAULT 'sinta';
ALTER TABLE "iprs" ADD COLUMN "sumber" "SumberData" NOT NULL DEFAULT 'sinta';
ALTER TABLE "buku" ADD COLUMN "sumber" "SumberData" NOT NULL DEFAULT 'sinta';
