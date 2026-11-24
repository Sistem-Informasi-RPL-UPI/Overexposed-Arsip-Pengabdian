"use client";

import { Printer } from "lucide-react";

type PrintRow = {
  judul: string;
  kategori: string;
  noBerkas: string;
  tanggal: string;
};

type Props = {
  rows: PrintRow[];
  page: number;
  total: number;
};

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml({ rows, page, total }: Props) {
  const printedAt = new Date().toLocaleString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const body = rows
    .map(
      (r, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${esc(r.judul)}</td>
        <td>${esc(r.kategori)}</td>
        <td>${esc(r.noBerkas)}</td>
        <td class="c">${esc(r.tanggal)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Daftar Arsip</title>
<style>
  @page { size: A4 landscape; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #131b2e; font-size: 12px; margin: 0; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #444653; margin: 0 0 16px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th, td { border: 1px solid #c4c5d5; padding: 7px 9px; text-align: left; vertical-align: top; }
  th { background: #eaedff; font-size: 11px; text-transform: uppercase; letter-spacing: .4px; }
  tr { page-break-inside: avoid; }
  .c { text-align: center; white-space: nowrap; }
  td:nth-child(1) { width: 36px; }
  td:nth-child(5) { width: 100px; }
</style>
</head>
<body>
  <h1>Daftar Arsip</h1>
  <p class="meta">
    Dicetak pada ${esc(printedAt)}<br />
    Halaman ${page} &middot; ${rows.length} dari ${total} arsip
  </p>
  <table>
    <thead>
      <tr>
        <th class="c">No</th>
        <th>Judul Arsip</th>
        <th>Kategori</th>
        <th>No. Berkas / Surat</th>
        <th class="c">Tanggal Arsip</th>
      </tr>
    </thead>
    <tbody>${body}</tbody>
  </table>
</body>
</html>`;
}

function printHtml(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => iframe.remove();
  win.onafterprint = cleanup;
  setTimeout(cleanup, 60_000); // cadangan jika afterprint tidak terpanggil

  // beri waktu singkat agar dokumen selesai dirender
  setTimeout(() => {
    win.focus();
    win.print();
  }, 150);
}

export default function PrintButton({ rows, page, total }: Props) {
  return (
    <button
      type="button"
      onClick={() => printHtml(buildHtml({ rows, page, total }))}
      disabled={rows.length === 0}
      className="flex items-center gap-1 rounded bg-[#eaedff] px-2.5 py-1 text-[11px] font-bold leading-3.5 tracking-[0.44px] text-[#444653] hover:bg-[#dde1ff] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Printer className="size-3" aria-hidden />
      Cetak
    </button>
  );
}