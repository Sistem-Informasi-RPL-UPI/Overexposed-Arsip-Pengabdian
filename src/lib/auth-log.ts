import { db } from "@/lib/db";

interface AuthLogInput {
  aksi: "login" | "login_gagal";
  userId?: string | null;
  userName?: string | null;
  detail: string;
}

/**
 * Mencatat login sukses dan gagal ke log_aktivitas (PRD 4 dan 6.4).
 * Untuk login gagal, userId dan userName dikosongkan (null).
 * Kegagalan mencatat log tidak membatalkan alur login.
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
        user_id: userId ?? null,
        user_nama: userName ?? null,
        modul: "auth",
        aksi,
        objek: "sso",
        detail,
      },
    });
  } catch (err) {
    console.error("Gagal mencatat log aktivitas auth:", err);
  }
}
