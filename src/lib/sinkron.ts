import type { Prisma, SyncStatus } from "@/generated/prisma/client";

/**
 * Aturan sinkron modul 7 (PRD 5.3 dan 8). Padanannya di sisi Python adalah `perlu_sinkron`
 * di crawler/app/loader.py. Bedanya, di sini IN_PROGRESS berarti "sedang berjalan" dan ditolak,
 * sedangkan Python menerimanya karena baris itu sudah dipesan oleh route Next.js.
 */
export const SINKRON_ULANG_HARI = 7;
const MS_PER_HARI = 24 * 60 * 60 * 1000;

export type KlasifikasiSinkron = "berjalan" | "boleh" | "tunggu";

export interface KandidatSinkron {
  id: number;
  sinta_id: string | null;
  sync_status: SyncStatus | null;
  last_synced_at: Date | null;
}

export const KANDIDAT_SELECT = {
  id: true,
  sinta_id: true,
  sync_status: true,
  last_synced_at: true,
} as const;

/**
 * - `berjalan`: sync_status IN_PROGRESS.
 * - `boleh`: belum pernah sinkron, atau status terakhir FAILED atau PARTIAL (boleh sebelum 7 hari),
 *   atau SUCCESS yang sudah lebih dari 7 hari.
 * - `tunggu`: SUCCESS yang belum lebih dari 7 hari. Tidak ada opsi paksa, untuk peran apa pun.
 */
export function klasifikasiSinkron(
  status: SyncStatus | null,
  lastSyncedAt: Date | null,
  sekarang: Date,
): KlasifikasiSinkron {
  if (status === "IN_PROGRESS") return "berjalan";
  if (status === null || status === "FAILED" || status === "PARTIAL" || lastSyncedAt === null) {
    return "boleh";
  }
  return sekarang.getTime() - lastSyncedAt.getTime() > SINKRON_ULANG_HARI * MS_PER_HARI
    ? "boleh"
    : "tunggu";
}

/** Waktu paling awal sinkron berikutnya, hanya untuk dosen yang sedang menunggu aturan 7 hari. */
export function bisaSinkronLagiPada(
  status: SyncStatus | null,
  lastSyncedAt: Date | null,
  sekarang: Date,
): Date | null {
  if (klasifikasiSinkron(status, lastSyncedAt, sekarang) !== "tunggu" || lastSyncedAt === null) {
    return null;
  }
  return new Date(lastSyncedAt.getTime() + SINKRON_ULANG_HARI * MS_PER_HARI);
}

/**
 * Kondisi `updateMany` yang atomik: bukan IN_PROGRESS dan lolos aturan 7 hari.
 * `sync_status <> 'IN_PROGRESS'` di SQL membuang baris NULL, jadi cabang NULL ditulis eksplisit.
 */
export function kondisiBolehSinkron(sekarang: Date): Prisma.DosenWhereInput {
  const batas = new Date(sekarang.getTime() - SINKRON_ULANG_HARI * MS_PER_HARI);
  return {
    AND: [
      { OR: [{ sync_status: null }, { sync_status: { not: "IN_PROGRESS" } }] },
      {
        OR: [
          { sync_status: null },
          { last_synced_at: null },
          { sync_status: { in: ["FAILED", "PARTIAL"] } },
          { last_synced_at: { lt: batas } },
        ],
      },
    ],
  };
}
