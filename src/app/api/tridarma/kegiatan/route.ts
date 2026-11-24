import { NextRequest } from "next/server";
import { jawabDaftar, parseDaftarFilters } from "@/lib/tridarma-baca";
import { daftarKegiatan } from "@/lib/tridarma-data";

// Terbuka untuk semua peran, termasuk Umum tanpa login (PRD 5.9). Parameter: dosen_id, jenis (penelitian atau pengabdian), tahun, skema, q, page, pageSize.
export async function GET(request: NextRequest) {
  return jawabDaftar(parseDaftarFilters(request.nextUrl.searchParams, { untuk: "kegiatan" }), (f, session) => daftarKegiatan(f, session), "kegiatan");
}
