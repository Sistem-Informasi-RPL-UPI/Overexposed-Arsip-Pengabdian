import { NextRequest } from "next/server";
import { jawabDaftar, parseDaftarFilters } from "@/lib/tridarma-baca";
import { daftarBuku } from "@/lib/tridarma-data";

// Terbuka untuk semua peran, termasuk Umum tanpa login (PRD 5.9). Parameter: dosen_id, tahun, kategori, q, page, pageSize.
export async function GET(request: NextRequest) {
  return jawabDaftar(parseDaftarFilters(request.nextUrl.searchParams, { untuk: "buku" }), (f, session) => daftarBuku(f, session), "buku");
}
