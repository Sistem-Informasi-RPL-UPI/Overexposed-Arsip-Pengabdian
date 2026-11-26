import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  FolderOpen,
  Link2,
  Pencil,
  ShieldAlert,
  User,
  XCircle,
} from "lucide-react";

import { db } from "@/lib/db";
import {
  ARSIP_DETAIL_SELECT,
  formatArsipDetail,
  parseArsipIdParam,
  requireArsipViewer,
} from "@/lib/arsip";
import { getArsipPermissions } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import DeleteArsipButton from "@/components/Arsip/DeleteArsipButton";

function formatDateId(date: Date) {
  return new Date(date).toLocaleDateString("id-ID", {
    timeZone: "UTC",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const RETENSI_BADGE: Record<
  "Aktif" | "Inaktif" | "Dimusnahkan",
  { bg: string; text: string; dot: string }
> = {
  Aktif: {
    bg: "bg-[#6ffbbe]",
    text: "text-[#00563a]",
    dot: "bg-[#00563a]",
  },
  Inaktif: {
    bg: "bg-[#fff1c2]",
    text: "text-[#8a6100]",
    dot: "bg-[#8a6100]",
  },
  Dimusnahkan: {
    bg: "bg-[#ffdad6]",
    text: "text-[#ba1a1a]",
    dot: "bg-[#ba1a1a]",
  },
};

const VALIDASI_BADGE: Record<
  "Pending" | "Diterima" | "Ditolak",
  { bg: string; text: string; label: string; icon: typeof Clock }
> = {
  Pending: {
    bg: "bg-[#fff1c2]",
    text: "text-[#8a6100]",
    label: "Menunggu Validasi",
    icon: Clock,
  },
  Diterima: {
    bg: "bg-[#6ffbbe]",
    text: "text-[#00563a]",
    label: "Diterima Kaprodi",
    icon: CheckCircle2,
  },
  Ditolak: {
    bg: "bg-[#ffdad6]",
    text: "text-[#ba1a1a]",
    label: "Ditolak Kaprodi",
    icon: XCircle,
  },
};

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-semibold uppercase tracking-[0.5px] text-[#444653]">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm font-semibold leading-6 text-[#131b2e]",
          mono && "font-mono",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

async function DetailArsipContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;

  const auth = await requireArsipViewer();
  if (!auth.ok) {
    redirect(auth.response.status === 401 ? "/login" : "/");
  }
  const { canManageArsip } = getArsipPermissions(auth.session);

  const arsipId = parseArsipIdParam(rawId);
  if (arsipId === null) notFound();

  const row = await db.arsip.findUnique({
    where: { id: arsipId },
    select: ARSIP_DETAIL_SELECT,
  });

  if (!row) notFound();

  const arsip = formatArsipDetail(row);
  const retensiStyle = RETENSI_BADGE[arsip.status_retensi];
  const validasiStyle = VALIDASI_BADGE[arsip.status_validasi];
  const ValidasiIcon = validasiStyle.icon;

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 p-6 font-(family-name:--font-plus-jakarta)">
      {/* Baris navigasi atas & tombol aksi */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/arsip/daftar"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#131b2e] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-colors hover:bg-[#eaedff]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Kembali ke Daftar Arsip
        </Link>

        {canManageArsip && (
          <div className="flex items-center gap-2">
            <Link
              href={`/arsip/daftar/${arsip.id}/edit`}
              className={cn(
                buttonVariants(),
                "h-auto gap-2 rounded-lg bg-[#1e40af] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#1e3a9f]",
              )}
            >
              <Pencil className="size-3.5" aria-hidden />
              Ubah Arsip
            </Link>
            <div className="flex items-center rounded-lg bg-white px-2 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
              <DeleteArsipButton id={String(arsip.id)} judul={arsip.judul} />
            </div>
          </div>
        )}
      </div>

      {/* Header Kartu Judul & Status */}
      <section className="rounded-xl bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e2e7ff] px-3 py-1 font-mono text-xs font-bold text-[#00288e]">
            {arsip.nomor_arsip}
          </span>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
              retensiStyle.bg,
              retensiStyle.text,
            )}
          >
            <span className={cn("size-1.5 rounded-full", retensiStyle.dot)} />
            Status Retensi: {arsip.status_retensi}
          </span>

          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
              validasiStyle.bg,
              validasiStyle.text,
            )}
          >
            <ValidasiIcon className="size-3.5" aria-hidden />
            {validasiStyle.label}
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-bold leading-8 text-[#131b2e]">
          {arsip.judul}
        </h1>

        {arsip.status_validasi === "Ditolak" && arsip.catatan_validasi && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#ba1a1a]/25 bg-[#ffdad6]/50 px-4 py-3 text-sm text-[#93000a]">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-bold">Catatan Penolakan Validasi:</p>
              <p className="mt-0.5">{arsip.catatan_validasi}</p>
            </div>
          </div>
        )}
      </section>

      {/* Grid Informasi Utama & Jadwal Retensi */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Informasi Utama */}
        <section className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] lg:col-span-7">
          <div className="flex items-center gap-2 bg-[#f2f3ff] px-6 py-4 text-[#00288e]">
            <FileText className="size-4.5" aria-hidden />
            <h2 className="text-base font-bold text-[#131b2e]">
              Informasi Utama Arsip
            </h2>
          </div>

          <dl className="grid grid-cols-1 gap-6 p-6 sm:grid-cols-2">
            <DetailItem
              label="Nomor Arsip"
              value={arsip.nomor_arsip}
              mono
            />
            <DetailItem
              label="No. Berkas / Naskah Dinas"
              value={arsip.nomor_surat}
              mono
            />
            <DetailItem
              label="Kategori Klasifikasi"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <FolderOpen className="size-4 text-[#00288e]" aria-hidden />
                  <span>
                    {arsip.kategori.nama}{" "}
                    <span className="font-mono text-xs text-[#00288e]">
                      ({arsip.kategori.kode})
                    </span>
                  </span>
                </span>
              }
            />
            <DetailItem
              label="Tanggal Arsip"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-4 text-[#00288e]" aria-hidden />
                  {formatDateId(arsip.tanggal_arsip)}
                </span>
              }
            />
            <DetailItem
              label="Pencipta / Unit Pengolah"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <User className="size-4 text-[#00288e]" aria-hidden />
                  {arsip.pencipta_unit || "-"}
                </span>
              }
            />
            <DetailItem
              label="Terakhir Diperbarui"
              value={formatDateId(arsip.updated_at)}
            />

            <div className="sm:col-span-2">
              <DetailItem
                label="Keterangan"
                value={
                  <p className="whitespace-pre-wrap font-normal text-[#444653]">
                    {arsip.keterangan || "Tidak ada keterangan tambahan."}
                  </p>
                }
              />
            </div>
          </dl>
        </section>

        {/* Jadwal Retensi & Tautan Berkas */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <section className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2 bg-[#f2f3ff] px-6 py-4 text-[#00288e]">
              <Clock className="size-4.5" aria-hidden />
              <h2 className="text-base font-bold text-[#131b2e]">
                Jadwal Retensi Arsip (JRA)
              </h2>
            </div>

            <dl className="flex flex-col gap-4 p-6">
              <div className="rounded-lg bg-[#f2f3ff]/70 p-4">
                <DetailItem
                  label="Masa Retensi Aktif"
                  value={`${arsip.retensi_aktif_tahun} Tahun (Hingga ${formatDateId(
                    arsip.tanggal_habis_aktif,
                  )})`}
                />
              </div>

              <div className="rounded-lg bg-[#f2f3ff]/70 p-4">
                <DetailItem
                  label="Masa Retensi Inaktif"
                  value={`${arsip.retensi_inaktif_tahun} Tahun (Hingga ${formatDateId(
                    arsip.tanggal_habis_inaktif,
                  )})`}
                />
              </div>
            </dl>
          </section>

          <section className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2 bg-[#f2f3ff] px-6 py-4 text-[#00288e]">
              <Link2 className="size-4.5" aria-hidden />
              <h2 className="text-base font-bold text-[#131b2e]">
                Berkas Digital Arsip
              </h2>
            </div>

            <div className="flex flex-col gap-4 p-6">
              <p className="break-all rounded-lg bg-[#f2f3ff] px-3.5 py-2.5 font-mono text-xs text-[#444653]">
                {arsip.link_berkas}
              </p>

              <a
                href={arsip.link_berkas}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#00288e] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#001f6f]"
              >
                <ExternalLink className="size-4" aria-hidden />
                Buka Berkas Digital
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function DetailArsipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[#444653]">
          Memuat detail berkas arsip...
        </div>
      }
    >
      <DetailArsipContent params={params} />
    </Suspense>
  );
}
