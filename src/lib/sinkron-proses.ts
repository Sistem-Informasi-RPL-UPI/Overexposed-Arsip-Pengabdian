import type { SyncStatus } from "@/generated/prisma/client";
import { bacaKonfigurasiCrawler, mintaSinkronCrawler } from "@/lib/crawler-client";
import { db } from "@/lib/db";
import { catatLog } from "@/lib/log-aktivitas";
import {
  bisaSinkronLagiPada,
  kondisiBolehSinkron,
  klasifikasiSinkron,
  type KandidatSinkron,
} from "@/lib/sinkron";

export interface PemicuSinkron {
  id: string;
  nama: string;
}

export interface HasilProsesSinkron {
  status: number;
  body: Record<string, unknown>;
}

const PESAN_BERJALAN = "Sinkron sedang berjalan";
const PESAN_TIDAK_ADA = "Tidak ada dosen yang perlu disinkron (aturan 7 hari)";

function sintaIdDari(k: KandidatSinkron): string {
  return k.sinta_id ?? "";
}

function infoDilewati(k: KandidatSinkron, sekarang: Date) {
  return {
    sinta_id: sintaIdDari(k),
    sync_status: k.sync_status,
    last_synced_at: k.last_synced_at?.toISOString() ?? null,
    bisa_sinkron_lagi_pada: bisaSinkronLagiPada(k.sync_status, k.last_synced_at, sekarang)?.toISOString() ?? null,
  };
}

function ringkasanLog(
  pemicu: PemicuSinkron,
  sintaId: string | null,
  diproses: string[],
  dilewati: string[],
  hasil: string,
): string {
  const bagian = [
    `Pemicu: ${pemicu.nama}`,
    `Target: ${sintaId ? `sinta_id ${sintaId}` : "semua dosen"}`,
    hasil,
    diproses.length ? `Diproses: ${diproses.join(", ")}` : "Tidak ada dosen yang diproses",
  ];
  if (dilewati.length) bagian.push(`Dilewati (aturan 7 hari): ${dilewati.join(", ")}`);
  return bagian.join(". ");
}

/** Mengembalikan status lama untuk baris yang tadi dipesan IN_PROGRESS tetapi crawl-nya tidak jadi berjalan. */
async function kembalikanStatus(dipesan: KandidatSinkron[]): Promise<void> {
  const perStatus = new Map<SyncStatus | null, number[]>();
  for (const k of dipesan) perStatus.set(k.sync_status, [...(perStatus.get(k.sync_status) ?? []), k.id]);

  try {
    for (const [status, ids] of perStatus) {
      await db.dosen.updateMany({
        where: { id: { in: ids }, sync_status: "IN_PROGRESS" },
        data: { sync_status: status },
      });
    }
  } catch (err) {
    // Sisa IN_PROGRESS yang lama ditandai FAILED oleh layanan crawler saat menyala (PRD 8).
    console.error("Gagal mengembalikan sync_status setelah sinkron tidak jadi berjalan:", err);
  }
}

/**
 * Urutan sesuai PRD 8: terapkan aturan 7 hari, pesan IN_PROGRESS secara atomik, lalu panggil layanan crawler.
 * Pemeriksaan sesi dan hak dilakukan route sebelum fungsi ini. `kandidat` adalah baris dosen yang diminta
 * (satu dosen, atau semua dosen yang punya sinta_id). `sintaId` null berarti permintaan "semua dosen".
 */
export async function prosesSinkron(args: {
  kandidat: KandidatSinkron[];
  sintaId: string | null;
  pemicu: PemicuSinkron;
}): Promise<HasilProsesSinkron> {
  const { kandidat, sintaId, pemicu } = args;

  // Dicek sebelum ada perubahan di database, supaya tidak perlu dikembalikan.
  if (!bacaKonfigurasiCrawler()) {
    console.error("CRAWLER_URL atau INTERNAL_KEY belum diisi di environment server.");
    return { status: 500, body: { message: "Layanan crawler belum dikonfigurasi di server." } };
  }

  const sekarang = new Date();
  const boleh: KandidatSinkron[] = [];
  const dilewati: KandidatSinkron[] = [];
  let berjalan = 0;
  for (const k of kandidat) {
    const kelas = klasifikasiSinkron(k.sync_status, k.last_synced_at, sekarang);
    if (kelas === "boleh") boleh.push(k);
    else if (kelas === "tunggu") dilewati.push(k);
    else berjalan += 1;
  }
  const idDilewati = dilewati.map(sintaIdDari);
  const logAktivitas = (detail: string) =>
    catatLog({ userId: pemicu.id, userNama: pemicu.nama, modul: "7", aksi: "sinkron", objek: "dosen", detail });

  if (boleh.length === 0) {
    // Crawl lain sedang memegang baris ini, termasuk dosen yang memicu saat Staff Kaprodi sinkron semua.
    if (berjalan > 0) return { status: 409, body: { message: PESAN_BERJALAN } };

    await logAktivitas(ringkasanLog(pemicu, sintaId, [], idDilewati, "Permintaan tidak diteruskan ke layanan crawler"));
    return {
      status: 200,
      body: {
        message: PESAN_TIDAK_ADA,
        data: { diproses: [], dilewati: dilewati.map((k) => infoDilewati(k, sekarang)) },
      },
    };
  }

  // Atomik: hanya baris yang bukan IN_PROGRESS dan masih lolos aturan 7 hari yang berubah.
  const dipesan = await db.dosen.updateMany({
    where: { id: { in: boleh.map((k) => k.id) }, ...kondisiBolehSinkron(sekarang) },
    data: { sync_status: "IN_PROGRESS" },
  });
  if (dipesan.count === 0) return { status: 409, body: { message: PESAN_BERJALAN } };

  const hasil = await mintaSinkronCrawler({
    sinta_id: sintaId,
    pemicu_id: pemicu.id,
    pemicu_nama: pemicu.nama,
  });

  if (hasil.jenis === "diterima") {
    const diproses = hasil.data.diproses.length ? hasil.data.diproses : boleh.map(sintaIdDari);
    await logAktivitas(ringkasanLog(pemicu, sintaId, diproses, idDilewati, "Permintaan diteruskan ke layanan crawler"));
    return {
      status: 202,
      body: {
        message: "Sinkron dimulai",
        data: { diproses, dilewati: dilewati.map((k) => infoDilewati(k, sekarang)) },
      },
    };
  }

  // Dari sini crawl tidak berjalan, jadi pesanan IN_PROGRESS dibatalkan.
  await kembalikanStatus(boleh);

  switch (hasil.jenis) {
    case "sedang_berjalan":
      return { status: 409, body: { message: PESAN_BERJALAN } };
    case "tidak_terdaftar":
      return { status: 404, body: { message: "sinta_id belum terdaftar." } };
    case "tidak_ada_yang_diproses":
      return {
        status: 200,
        body: {
          message: hasil.message || PESAN_TIDAK_ADA,
          data: { diproses: [], dilewati: dilewati.map((k) => infoDilewati(k, sekarang)) },
        },
      };
    default:
      return {
        status: 503,
        body: { message: "Layanan crawler belum bisa dihubungi. Coba lagi sebentar." },
      };
  }
}
