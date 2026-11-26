import type { Metadata } from "next";
import { Suspense } from "react";

import HalamanFormulirKegiatan from "@/components/Tridharma/Pengabdian/HalamanFormulirKegiatan";

export const metadata: Metadata = {
  title: "Formulir Data Pengabdian | Sistem Informasi RPL",
};

export default function Page() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-[#444653]">Memuat formulir...</div>}>
      <HalamanFormulirKegiatan jenis="pengabdian" />
    </Suspense>
  );
}