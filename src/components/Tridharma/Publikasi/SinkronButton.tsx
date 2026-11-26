"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

// Alur mengikuti PRD bagian 8:
// 1) cek server crawler (GET /api/crawler/health), tombol nonaktif sampai siap
// 2) POST /api/dosen/sinkron  → server membalas 202, crawl jalan di background
// 3) polling GET /api/dosen/sinkron/status sampai status bukan IN_PROGRESS
// CATATAN: bentuk JSON balasan belum kuketahui pasti. Kode ini membaca kunci
// "sync_status" atau "status", dan pesan dari "message" / "pesan" / "error".

type Fase = "cek" | "siap" | "berjalan";

function ambilTeks(d: unknown, ...keys: string[]): string | undefined {
  if (typeof d !== "object" || d === null) return undefined;
  const o = d as Record<string, unknown>;
  for (const k of keys) if (typeof o[k] === "string") return o[k] as string;
  return undefined;
}

const tunggu = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function SinkronButton() {
  const router = useRouter();
  const [fase, setFase] = React.useState<Fase>("cek");
  const [pesan, setPesan] = React.useState<{ ok: boolean; teks: string } | null>(null);
  const aktif = React.useRef(true);

  React.useEffect(() => {
    aktif.current = true;
    return () => {
      aktif.current = false;
    };
  }, []);

  // 1) Cek kesiapan server crawler (maks ~1 menit, lalu tombol tetap diaktifkan)
  React.useEffect(() => {
    (async () => {
      for (let i = 0; i < 12 && aktif.current; i++) {
        try {
          const res = await fetch("/api/crawler/health", { cache: "no-store" });
          if (res.ok || res.status === 404) break; // 404 = route health tidak ada, anggap siap
        } catch {
          /* coba lagi */
        }
        await tunggu(5000);
      }
      if (aktif.current) setFase("siap");
    })();
  }, []);

  async function mulai() {
    setPesan(null);
    setFase("berjalan");
    try {
      const res = await fetch("/api/dosen/sinkron", { method: "POST" });
      const d: unknown = await res.json().catch(() => null);

      if (res.status === 404) {
        setPesan({ ok: false, teks: "Endpoint sinkron (/api/dosen/sinkron) belum tersedia di project ini." });
        setFase("siap");
        return;
      }
      if (!res.ok) {
        setPesan({ ok: false, teks: ambilTeks(d, "message", "pesan", "error") ?? `Sinkron ditolak (${res.status}).` });
        setFase("siap");
        return;
      }
      const info = ambilTeks(d, "message", "pesan");
      if (info) setPesan({ ok: true, teks: info });

      // 3) Polling status (tiap 6 detik, maks ~10 menit)
      for (let i = 0; i < 100 && aktif.current; i++) {
        await tunggu(6000);
        const r = await fetch("/api/dosen/sinkron/status", { cache: "no-store" });
        if (r.status === 404) {
          setPesan({ ok: true, teks: "Sinkron dimulai. Muat ulang halaman beberapa saat lagi untuk melihat hasilnya." });
          break;
        }
        const st = ambilTeks(await r.json().catch(() => null), "sync_status", "status");
        if (st && st !== "IN_PROGRESS") {
          setPesan({
            ok: st === "SUCCESS",
            teks:
              st === "SUCCESS" ? "Sinkronisasi selesai." : st === "PARTIAL" ? "Sinkronisasi selesai sebagian." : "Sinkronisasi gagal.",
          });
          router.refresh(); // muat ulang data di halaman
          break;
        }
      }
    } catch {
      setPesan({ ok: false, teks: "Tidak bisa menghubungi server. Periksa koneksi lalu coba lagi." });
    } finally {
      if (aktif.current) setFase("siap");
    }
  }

  const label = fase === "cek" ? "Server sedang bersiap..." : fase === "berjalan" ? "Menyinkronkan..." : "Tarik Data SINTA";

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={mulai}
        disabled={fase !== "siap"}
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-tint-secondary)] px-4 text-xs font-semibold tracking-[0.24px] text-[var(--color-primary-strong)] hover:bg-[var(--color-tint-sky)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={cn("size-3.5", fase !== "siap" && "animate-spin")} aria-hidden />
        {label}
      </button>
      {pesan && (
        <p role="status" className={cn("text-xs", pesan.ok ? "text-[var(--color-success-text)]" : "text-[var(--color-danger-solid)]")}>
          {pesan.teks}
        </p>
      )}
    </div>
  );
}
