import { normalizeRole, type AppRole } from "@/lib/rbac";
import type { LocalSessionPayload } from "@/lib/sso";

// Aturan "pilih dosen dulu" untuk SEMUA halaman data Tridharma
// (publikasi, penelitian, pengabdian, HKI, buku):
//  - Dosen & Kaprodi  → langsung melihat data miliknya sendiri
//  - Role lain (Mahasiswa, Umum, Staff, Admin) → memilih dosen dulu lewat daftar dosen;
//    setelah dipilih, URL memuat ?dosen=ID
//  - ?dosen=ID juga boleh dipakai Dosen/Kaprodi untuk melihat dosen lain
export type TridharmaScope = {
  role: AppRole;
  personal: boolean;
  dosenParam?: number; // nilai ?dosen=
  dosenId?: number; // dosen yang datanya ditampilkan
  belumTerhubung: boolean; // Dosen/Kaprodi yang akunnya belum terhubung ke tabel dosen
  milikSendiri: boolean;
  perluPilih: boolean; // true = tampilkan <DaftarDosen /> dulu, belum ada data
};

export function resolveTridharmaScope(
  session: LocalSessionPayload | null,
  dosenParamRaw: string | undefined
): TridharmaScope {
  const role = normalizeRole(session?.role);
  const personal = role === "Dosen" || role === "Kaprodi";

  const n = Number.parseInt(dosenParamRaw ?? "", 10);
  const dosenParam = Number.isFinite(n) && n > 0 ? n : undefined;

  const dosenSendiri = session?.dosen_id ?? undefined;
  const dosenId = dosenParam ?? (personal ? dosenSendiri : undefined);

  const belumTerhubung = personal && dosenParam === undefined && dosenSendiri === undefined;
  const milikSendiri = dosenId !== undefined && dosenId === dosenSendiri;
  const perluPilih = dosenId === undefined && !belumTerhubung;

  return { role, personal, dosenParam, dosenId, belumTerhubung, milikSendiri, perluPilih };
}
