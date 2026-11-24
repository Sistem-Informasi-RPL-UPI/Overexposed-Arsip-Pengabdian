import { jawabDetail, type KonteksRute } from "@/lib/tridarma-baca";
import { profilDosen } from "@/lib/tridarma-data";

// Profil satu dosen beserta skor SINTA dan metrik. Terbuka untuk semua peran (PRD 5.9).
export async function GET(_request: Request, { params }: KonteksRute) {
  const { id } = await params;
  return jawabDetail(id, (dosenId) => profilDosen(dosenId), "dosen");
}
