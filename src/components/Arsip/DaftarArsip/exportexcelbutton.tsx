"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, X, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type ExportRow = {
  judul: string;
  kategori: string;
  noBerkas: string;
  tanggal: string;
};

// Excel dengan pengaturan regional Indonesia membaca titik koma (;) sebagai pemisah.
// Ganti ke "," jika CSV akan dibuka di aplikasi lain.
const DELIMITER = ";";

type Toast =
  | { type: "loading" }
  | { type: "success"; fileName: string; total: number }
  | { type: "error"; message: string }
  | null;

function csvCell(value: unknown) {
  let s = String(value ?? "");
  // Cegah formula injection saat dibuka di Excel
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function buildCsv(rows: ExportRow[]) {
  const header = ["No", "Judul Arsip", "Kategori", "No. Berkas / Surat", "Tanggal Arsip"];
  const lines = [
    header.map(csvCell).join(DELIMITER),
    ...rows.map((r, i) =>
      [i + 1, r.judul, r.kategori, r.noBerkas, r.tanggal]
        .map(csvCell)
        .join(DELIMITER),
    ),
  ];
  // BOM agar Excel membaca UTF-8 dengan benar
  return "\uFEFF" + lines.join("\r\n");
}

function download(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportExcelButton({ rows }: { rows: ExportRow[] }) {
  const [toast, setToast] = useState<Toast>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notifikasi hilang otomatis setelah 5 detik
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (toast && toast.type !== "loading") {
      timer.current = setTimeout(() => setToast(null), 5000);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [toast]);

  function onExport() {
    if (rows.length === 0) {
      setToast({ type: "error", message: "Tidak ada data arsip untuk diekspor." });
      return;
    }
    try {
      const fileName = `daftar-arsip-${new Date().toISOString().slice(0, 10)}.csv`;
      download(buildCsv(rows), fileName);
      setToast({ type: "success", fileName, total: rows.length });
    } catch {
      setToast({ type: "error", message: "Gagal membuat berkas CSV." });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onExport}
        className="flex items-center gap-1 rounded bg-[#eaedff] px-2.5 py-1 text-[11px] font-bold leading-3.5acking-[0.44px] text-[#444653] hover:bg-[#dde1ff]"
      >
        <Download className="size-2.5" aria-hidden />
        Ekspor Excel
      </button>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex w-90 max-w-[calc(100vw-3rem)] items-start gap-3 rounded-xl bg-white p-4 shadow-[0_8px_24px_rgba(19,27,46,0.16)] ring-1 ring-black/5"
        >
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              toast.type === "success" && "bg-[#d6f5e0] text-[#0b6b2f]",
              toast.type === "error" && "bg-[#ffdad6] text-[#ba1a1a]",
            )}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="size-5" aria-hidden />
            ) : (
              <XCircle className="size-5" aria-hidden />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#131b2e]">
              {toast.type === "success" ? "Ekspor berhasil" : "Ekspor gagal"}
            </p>
            <p className="mt-0.5 wrap-break-word text-[13px] leading-4.5 text-[#444653]">
              {toast.type === "success"
                ? `${toast.total} arsip dalam ${toast.fileName} telah diunduh ke perangkat Anda.`
                : toast.type === "error"
                  ? toast.message
                  : ""}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Tutup notifikasi"
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#444653] hover:bg-[#eaedff]"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}