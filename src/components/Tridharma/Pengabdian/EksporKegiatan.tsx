"use client";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type KegiatanItem = {
  judul: string;
  tahun: number | null;
  dana: number;
  ketua: string | null;
};

type Props = {
  items: KegiatanItem[];
  jenis: "penelitian" | "pengabdian";
};

export default function EksporKegiatan({ items, jenis }: Props) {
  const nama = jenis === "pengabdian" ? "Pengabdian" : "Penelitian";

  function eksporExcel() {
    const rows = items.map((k, i) => ({
      "No.": i + 1,
      [`Judul ${nama}`]: k.judul,
      Tahun: k.tahun ?? "-",
      Ketua: k.ketua ?? "-",
      Dana: k.dana,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, nama);
    XLSX.writeFile(workbook, `Data_${nama}.xlsx`);
  }

  function eksporPDF() {
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(16);
    doc.text(`Data ${nama}`, 14, 15);

    autoTable(doc, {
      startY: 22,
      head: [["No.", `Judul ${nama}`, "Tahun", "Ketua", "Dana"]],
      body: items.map((k, i) => [
        i + 1,
        k.judul,
        k.tahun ?? "-",
        k.ketua ?? "-",
        new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(k.dana),
      ]),
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [0, 0, 184],
      },
    });

    doc.save(`Data_${nama}.pdf`);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={eksporPDF}
        disabled={items.length === 0}
        className="text-[#00288e] hover:underline disabled:opacity-40"
      >
        Ekspor PDF
      </button>

      <button
        type="button"
        onClick={eksporExcel}
        disabled={items.length === 0}
        className="text-[#00288e] hover:underline disabled:opacity-40"
      >
        Ekspor Excel
      </button>
    </div>
  );
}
