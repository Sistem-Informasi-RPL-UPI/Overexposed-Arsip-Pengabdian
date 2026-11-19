import { db } from "@/lib/db";

const ANONYMOUS_USER_UUID = "00000000-0000-0000-0000-000000000000";

interface AuthLogInput {
  aksi: "login" | "login_gagal";
  userId?: string | null;
  userName?: string | null;
  detail: string;
}

/**
 * Mencatat aktivitas login sukses/gagal ke tabel log_aktivitas sesuai PRD 4 & 6.4.
 * Catatan: selama kolom user_id/user_nama di schema.prisma masih NOT NULL dan kolom
 * `modul` belum ditambahkan, kegagalan login memakai UUID nol & "Anonim" sebagai fallback.
 */
export async function recordAuthLog({
  aksi,
  userId,
  userName,
  detail,
}: AuthLogInput): Promise<void> {
  try {
    await db.logAktivitas.create({
      data: {
        user_id: userId ?? ANONYMOUS_USER_UUID,
        user_nama: userName ?? "Anonim",
        aksi,
        objek: "sso",
        detail,
      },
    });
  } catch (err) {
    console.error("Gagal mencatat log aktivitas auth:", err);
  }
}
