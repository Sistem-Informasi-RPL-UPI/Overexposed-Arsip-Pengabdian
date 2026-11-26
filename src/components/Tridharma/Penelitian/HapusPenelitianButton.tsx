"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, CircleCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapusPenelitian } from "@/app/tridharma/penelitian/actions";

type Tahap = "tutup" | "tanya" | "proses" | "sukses";

const SUKSES_MS = 1600;

// Tombol hapus + pop-up konfirmasi dan pop-up sukses (sama dengan HapusPublikasiButton)
export default function HapusPenelitianButton({ id, judul }: { id: number; judul: string }) {
  const router = useRouter();
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [tahap, setTahap] = React.useState<Tahap>("tutup");
  const [galat, setGalat] = React.useState<string | null>(null);

  // <dialog> bawaan HTML: otomatis ada backdrop, fokus terkunci di dalam, dan bisa ditutup dengan Esc
  React.useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (tahap === "tutup") {
      if (d.open) d.close();
    } else if (!d.open) {
      d.showModal();
    }
  }, [tahap]);

  // Pop-up sukses menutup sendiri, lalu daftar disegarkan (baris yang dihapus hilang)
  React.useEffect(() => {
    if (tahap !== "sukses") return;
    const t = window.setTimeout(selesai, SUKSES_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahap]);

  function selesai() {
    setTahap("tutup");
    router.refresh();
  }

  function buka() {
    setGalat(null);
    setTahap("tanya");
  }

  async function konfirmasi() {
    setTahap("proses");
    const hasil = await hapusPenelitian(id);
    if (hasil.ok) {
      setTahap("sukses");
    } else {
      setGalat(hasil.pesan);
      setTahap("tanya");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={buka}
        aria-label={`Hapus penelitian: ${judul}`}
        title="Hapus"
        className="flex size-8 items-center justify-center rounded-lg text-[var(--color-danger-solid)] hover:bg-[var(--color-danger-bg)]"
      >
        <Trash2 className="size-5" aria-hidden />
      </button>

      {/* whitespace-normal: <dialog> mewarisi `whitespace-nowrap` dari sel tabel, tanpa ini teksnya meluber */}
      <dialog
        ref={dialogRef}
        aria-labelledby={`hapus-judul-${id}`}
        onCancel={(e) => {
          // Esc: tidak boleh menutup saat sedang menghapus
          e.preventDefault();
          if (tahap === "tanya") setTahap("tutup");
          else if (tahap === "sukses") selesai();
        }}
        onClick={(e) => {
          // klik area gelap di luar kartu
          if (e.target === dialogRef.current) {
            if (tahap === "tanya") setTahap("tutup");
            else if (tahap === "sukses") selesai();
          }
        }}
        className="m-auto w-[min(92vw,360px)] overflow-hidden whitespace-normal break-words rounded-2xl border-0 bg-[var(--color-bg-surface)] p-0 text-left text-[var(--color-text-ink)] shadow-xl backdrop:bg-black/40"
      >
        {tahap === "sukses" ? (
          <div className="flex flex-col items-center gap-3 px-6 py-7 text-center">
            <CircleCheck className="size-12 text-[var(--color-success-text)]" strokeWidth={1.5} aria-hidden />
            <p id={`hapus-judul-${id}`} role="status" className="text-base font-semibold leading-6">
              Penelitian berhasil dihapus!
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 px-6 py-6 text-center">
            <CircleAlert className="size-12 text-[var(--color-danger-solid)]" strokeWidth={1.5} aria-hidden />
            <div className="w-full">
              <p id={`hapus-judul-${id}`} className="text-base font-semibold leading-6">
                Apakah Anda yakin untuk menghapus penelitian ini?
              </p>
              <p className="mt-1.5 line-clamp-2 text-xs leading-4 text-[var(--color-text-secondary)]">{judul}</p>
              {galat && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-xs leading-4 text-[var(--color-danger-solid)]"
                >
                  {galat}
                </p>
              )}
            </div>
            <div className="grid w-full grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTahap("tutup")}
                disabled={tahap === "proses"}
                className="h-10 rounded-lg bg-[var(--color-bg-surface)] text-sm font-semibold text-[var(--color-text-ink)] shadow-[0_1px_3px_rgba(11,42,76,0.25)] hover:bg-[var(--color-tint-neutral)] disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={konfirmasi}
                disabled={tahap === "proses"}
                className={cn(
                  "h-10 rounded-lg bg-[var(--color-danger-solid)] text-sm font-semibold text-[var(--color-text-inverse)] shadow-[0_1px_3px_rgba(11,42,76,0.25)] hover:opacity-90 disabled:opacity-60"
                )}
              >
                {tahap === "proses" ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
