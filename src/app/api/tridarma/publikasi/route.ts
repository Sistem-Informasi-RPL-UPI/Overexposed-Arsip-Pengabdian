import { NextRequest } from "next/server";
import { jawabDaftar, parseDaftarFilters } from "@/lib/tridarma-baca";
import { daftarPublikasi } from "@/lib/tridarma-data";

// Terbuka untuk semua peran, termasuk Umum tanpa login (PRD 5.9). Parameter: dosen_id, tahun, akreditasi (kuartil atau akreditasi), sumber_artikel (scopus, garuda, googlescholar, rama, manual), q, page, pageSize.
export async function GET(request: NextRequest) {
  return jawabDaftar(parseDaftarFilters(request.nextUrl.searchParams, { untuk: "publikasi" }), (f, session) => daftarPublikasi(f, session), "publikasi");
}
