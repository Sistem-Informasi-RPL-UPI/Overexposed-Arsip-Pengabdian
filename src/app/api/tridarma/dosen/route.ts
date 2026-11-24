import { NextRequest } from "next/server";
import { jawabDaftar, parseDaftarDosenFilters } from "@/lib/tridarma-baca";
import { daftarDosen } from "@/lib/tridarma-data";

// Terbuka untuk semua peran, termasuk Umum tanpa login (PRD 5.9). Dipakai untuk dropdown filter dosen.
export async function GET(request: NextRequest) {
  return jawabDaftar(parseDaftarDosenFilters(request.nextUrl.searchParams), (f) => daftarDosen(f), "dosen");
}
