import { NextRequest } from "next/server";
import { jawabDaftar, parseDaftarFilters } from "@/lib/tridarma-baca";
import { daftarIprs } from "@/lib/tridarma-data";

// Terbuka untuk semua peran, termasuk Umum tanpa login (PRD 5.9). Nama endpoint iprs, label tampilan HKI. Parameter: dosen_id, tahun, status, jenis, q, page, pageSize.
export async function GET(request: NextRequest) {
  return jawabDaftar(parseDaftarFilters(request.nextUrl.searchParams, { untuk: "iprs" }), (f, session) => daftarIprs(f, session), "IPRS");
}
