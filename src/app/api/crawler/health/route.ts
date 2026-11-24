import { NextResponse } from "next/server";
import { cekHealthCrawler } from "@/lib/crawler-client";
import { getSinkronPermissions } from "@/lib/rbac";
import { getSession } from "@/lib/session";

export const maxDuration = 15;

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Ping warm-up ke layanan crawler di Render (PRD 8.2), diteruskan dari server. Browser tidak pernah
 * memanggil Render langsung.
 *
 * Aturan untuk front-end: panggil route ini HANYA dari halaman tombol sinkron modul 7, di background,
 * dan jangan dari halaman modul 4 atau halaman modul 7 lainnya. Layanan paket gratis tidur setelah
 * 15 menit, dan tiap ping yang masuk membangunkannya (memakai kuota jam Render).
 * Sampai route ini membalas 200, tombol sinkron nonaktif dan teks "Server sedang bersiap..." tampil.
 * Satu panggilan hanya menunggu sebentar, jadi front-end mengulanginya sampai 200.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Silakan login terlebih dahulu." }, { status: 401 });
  }

  if (!getSinkronPermissions(session).canSyncSelf) {
    return NextResponse.json({ message: "Anda tidak memiliki izin untuk menjalankan sinkron." }, { status: 403 });
  }

  const hasil = await cekHealthCrawler();
  if (hasil.ok) {
    return NextResponse.json({ status: "ok" }, { headers: NO_STORE });
  }

  if (hasil.alasan === "tidak_dikonfigurasi") {
    console.error("CRAWLER_URL atau INTERNAL_KEY belum diisi di environment server.");
    return NextResponse.json({ message: "Layanan crawler belum dikonfigurasi di server." }, { status: 500 });
  }
  return NextResponse.json(
    { message: "Server belum merespons, coba lagi sebentar." },
    { status: 503, headers: NO_STORE },
  );
}
