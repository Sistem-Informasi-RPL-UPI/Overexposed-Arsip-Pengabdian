/**
 * Klien HTTP ke layanan crawler Python (PRD 8). Hanya dipanggil dari server, karena INTERNAL_KEY
 * tidak boleh sampai ke browser. Nilai kunci tidak pernah ditulis ke log atau ke respons.
 */

export interface KonfigurasiCrawler {
  url: string;
  kunci: string;
}

export function bacaKonfigurasiCrawler(): KonfigurasiCrawler | null {
  const url = process.env.CRAWLER_URL?.trim().replace(/\/+$/, "");
  const kunci = process.env.INTERNAL_KEY?.trim();
  return url && kunci ? { url, kunci } : null;
}

// Render paket gratis bisa butuh sekitar satu menit untuk bangun. Ping diulang oleh front-end,
// jadi satu panggilan cukup menunggu sebentar. Batas ini juga di bawah maxDuration route.
export const TIMEOUT_HEALTH_MS = 8_000;
export const TIMEOUT_SYNC_MS = 20_000;

export type HasilHealth = { ok: true } | { ok: false; alasan: "tidak_dikonfigurasi" | "tidak_tersedia" };

export async function cekHealthCrawler(timeoutMs = TIMEOUT_HEALTH_MS): Promise<HasilHealth> {
  const konfigurasi = bacaKonfigurasiCrawler();
  if (!konfigurasi) return { ok: false, alasan: "tidak_dikonfigurasi" };

  try {
    const res = await fetch(`${konfigurasi.url}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return res.ok ? { ok: true } : { ok: false, alasan: "tidak_tersedia" };
  } catch {
    return { ok: false, alasan: "tidak_tersedia" };
  }
}

export interface PermintaanSinkron {
  // Kosong berarti semua dosen yang lolos aturan 7 hari.
  sinta_id?: string | null;
  pemicu_id: string;
  pemicu_nama: string;
}

export interface DataSinkronCrawler {
  diproses: string[];
  dilewati: string[];
}

export type HasilSinkronCrawler =
  | { jenis: "diterima"; message: string; data: DataSinkronCrawler }
  | { jenis: "tidak_ada_yang_diproses"; message: string; data: DataSinkronCrawler }
  | { jenis: "sedang_berjalan" }
  | { jenis: "tidak_terdaftar" }
  // Jaringan, timeout, 5xx, kunci ditolak, atau bentuk respons yang tidak dikenal.
  | { jenis: "tidak_tersedia" };

function bacaData(json: unknown): { message: string; data: DataSinkronCrawler } {
  const j = (json ?? {}) as { message?: unknown; data?: { diproses?: unknown; dilewati?: unknown } };
  const daftar = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  return {
    message: typeof j.message === "string" ? j.message : "",
    data: { diproses: daftar(j.data?.diproses), dilewati: daftar(j.data?.dilewati) },
  };
}

export async function mintaSinkronCrawler(
  permintaan: PermintaanSinkron,
  timeoutMs = TIMEOUT_SYNC_MS,
): Promise<HasilSinkronCrawler> {
  const konfigurasi = bacaKonfigurasiCrawler();
  if (!konfigurasi) return { jenis: "tidak_tersedia" };

  const body: Record<string, string> = {
    pemicu_id: permintaan.pemicu_id,
    pemicu_nama: permintaan.pemicu_nama,
  };
  if (permintaan.sinta_id) body.sinta_id = permintaan.sinta_id;

  let res: Response;
  try {
    res = await fetch(`${konfigurasi.url}/sync`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json", "X-Internal-Key": konfigurasi.kunci },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    console.error("Layanan crawler tidak dapat dihubungi:", err instanceof Error ? err.name : "error");
    return { jenis: "tidak_tersedia" };
  }

  if (res.status === 202) return { jenis: "diterima", ...bacaData(await res.json().catch(() => null)) };
  if (res.status === 200) return { jenis: "tidak_ada_yang_diproses", ...bacaData(await res.json().catch(() => null)) };
  if (res.status === 409) return { jenis: "sedang_berjalan" };
  if (res.status === 404) return { jenis: "tidak_terdaftar" };

  // 401 berarti INTERNAL_KEY di Vercel dan Render berbeda. Status saja yang dicatat, tanpa nilai kunci.
  console.error(`Layanan crawler membalas status tak terduga pada /sync: ${res.status}`);
  return { jenis: "tidak_tersedia" };
}
