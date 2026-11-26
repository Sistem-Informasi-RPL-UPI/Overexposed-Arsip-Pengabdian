
import { db } from "@/lib/db";
import FormulirArsipPage from "@/components/Arsip/DaftarArsip/formulirarsipform";

export const instant = false;

export default async function Page() {
  const rawKategori = await db.kategori.findMany({
    orderBy: {
      kode: "asc",
    },
    select: {
      id: true,
      kode: true,
      nama: true,
      retensi_aktif_tahun: true,
      retensi_inaktif_tahun: true,
    },
  });

  const kategori = rawKategori.map((k) => ({
    id: k.id,
    kode: k.kode,
    nama: k.nama,
    retensiAktif: k.retensi_aktif_tahun,
    retensiInaktif: k.retensi_inaktif_tahun,
  }));

  return (
    <FormulirArsipPage
      kategori={kategori}
      penciptaUnit=""
    />
  );
}
