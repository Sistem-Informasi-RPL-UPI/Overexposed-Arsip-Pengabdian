import { NextRequest, NextResponse } from "next/server";
import { parseOpsiFilters } from "@/lib/tridarma-baca";
import { ambilOpsi } from "@/lib/tridarma-opsi";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Pilihan untuk dropdown filter (PRD 5.9). Terbuka untuk semua peran, termasuk Umum tanpa login.
 * Parameter: `untuk` (publikasi, kegiatan, iprs, atau buku, wajib), `dosen_id` (membatasi ke data satu dosen),
 * dan `jenis` (penelitian atau pengabdian, hanya untuk kegiatan).
 * Respons `{ data: { <field>: [{ value, label }] } }`. Akreditasi dan sumber_artikel tetap, sisanya dari data.
 */
export async function GET(request: NextRequest) {
  const parsed = parseOpsiFilters(request.nextUrl.searchParams);
  if (!parsed.ok) return NextResponse.json({ message: parsed.message }, { status: 400 });

  try {
    return NextResponse.json({ data: await ambilOpsi(parsed.value) }, { headers: NO_STORE });
  } catch (error) {
    console.error("GET Opsi filter tridarma:", error);
    return NextResponse.json({ message: "Gagal mengambil pilihan filter." }, { status: 500 });
  }
}
