import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireArsipViewer } from "@/lib/arsip";
import FormulirArsipForm, {
  type KategoriOption,
  type Values,
} from "@/components/Arsip/DaftarArsip/formulirarsipform";

async function EditContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const auth = await requireArsipViewer();
  if (!auth.ok) redirect(auth.response.status === 401 ? "/login" : "/");

  const arsipId = Number(id);
  if (!Number.isInteger(arsipId)) notFound();

  const [arsip, kategoriRows] = await Promise.all([
    db.arsip.findUnique({ where: { id: arsipId } }),
    db.kategori.findMany({
      orderBy: { kode: "asc" },
      select: {
        id: true,
        kode: true,
        nama: true,
        retensi_aktif_tahun: true,
        retensi_inaktif_tahun: true,
      },
    }),
  ]);

  if (!arsip) notFound();

  const kategori: KategoriOption[] = kategoriRows.map((k) => ({
    id: k.id,
    kode: k.kode,
    nama: k.nama,
    retensiAktif: k.retensi_aktif_tahun,
    retensiInaktif: k.retensi_inaktif_tahun,
  }));

  const initialValues: Values = {
    judul: arsip.judul,
    kategoriId: String(arsip.kategori_id),
    tanggalArsip: new Date(arsip.tanggal_arsip).toISOString().slice(0, 10),
    nomorArsip: arsip.nomor_arsip ?? "",
    nomorSurat: arsip.nomor_surat ?? "",
    linkBerkas: arsip.link_berkas ?? "",
    keterangan: arsip.keterangan ?? "",
  };

  return (
    <FormulirArsipForm
      mode="edit"
      arsipId={String(arsip.id)}
      kategori={kategori}
      penciptaUnit={arsip.pencipta_unit ?? ""}
      initialValues={initialValues}
    />
  );
}

export default function EditArsipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Memuat data arsip...</p>}>
      <EditContent params={params} />
    </Suspense>
  );
}
