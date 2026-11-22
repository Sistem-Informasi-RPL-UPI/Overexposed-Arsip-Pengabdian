"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  FileText,
  Info,
  Lock,
  Paperclip,
  Send,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

/* ---------- Tipe ---------- */

export type KategoriOption = {
  id: number;
  kode: string;
  nama: string;
  retensiAktif: number;
  retensiInaktif: number;
};

type Values = {
  judul: string;
  kategoriId: string;
  tanggalArsip: string;
  nomorArsip: string;
  nomorSurat: string;
  keterangan: string;
  linkBerkas: string;
};

const INITIAL: Values = {
  judul: "",
  kategoriId: "",
  tanggalArsip: "",
  nomorArsip: "",
  nomorSurat: "",
  keterangan: "",
  linkBerkas: "",
};

const DAFTAR_PATH = "/arsip/daftar";

/* ---------- Style bersama ---------- */

const inputClass =
  "h-11 w-full rounded-lg bg-white px-4 text-sm text-[#131b2e] shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-black/5 outline-none placeholder:text-[#757684] focus-visible:ring-2 focus-visible:ring-[#1e40af]/40";

const readonlyClass =
  "flex h-11 w-full items-center rounded-lg bg-[#eaedff] pl-4 pr-10 text-sm text-[#131b2e] shadow-[0_1px_2px_rgba(0,0,0,0.05)]";

/* ---------- Sub-komponen ---------- */

function Field({
  label,
  required,
  htmlFor,
  hint,
  hintStyle = "note",
  children,
  className,
}: {
  label: string;
  required?: boolean;
  htmlFor: string;
  hint?: string;
  hintStyle?: "info" | "note";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="flex items-center gap-1 text-sm font-semibold leading-5 text-[#131b2e]"
      >
        {label}
        {required && (
          <span aria-hidden className="font-bold text-[#ba1a1a]">
            *
          </span>
        )}
      </label>
      {children}
      {hint &&
        (hintStyle === "info" ? (
          <p className="flex items-center gap-1 text-[13px] leading-[18px] text-[#444653]">
            <Info className="size-[13px] shrink-0" aria-hidden />
            {hint}
          </p>
        ) : (
          <p className="text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[#444653]">
            {hint}
          </p>
        ))}
    </div>
  );
}

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
      <div className="flex items-center gap-2 bg-[#f2f3ff] px-8 py-4 text-[#00288e]">
        {icon}
        <h2 className="text-xl font-semibold leading-7 tracking-[-0.2px] text-[#131b2e]">
          {title}
        </h2>
      </div>
      <div className="flex flex-col gap-6 p-8">{children}</div>
    </section>
  );
}

function RetensiField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-semibold leading-4 tracking-[0.24px] text-[#444653]">
        {label}
      </span>
      <div className="relative">
        <div className={readonlyClass} aria-readonly>
          <span className="truncate">{value}</span>
        </div>
        <Lock
          className="pointer-events-none absolute right-3 top-3.5 size-3 text-[#444653]"
          aria-hidden
        />
      </div>
    </div>
  );
}

/* ---------- Form ---------- */

export default function FormulirArsipForm({
  kategori,
  penciptaUnit,
}: {
  kategori: KategoriOption[];
  penciptaUnit: string;
}) {
  const router = useRouter();
  const [v, setV] = useState<Values>(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ block: "center" });
  }, [error]);

  const set =
    (key: keyof Values) =>
    (
      e: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >
    ) =>
      setV((prev) => ({ ...prev, [key]: e.target.value }));

  const selected = kategori.find((k) => String(k.id) === v.kategoriId);
  const tahun = v.tanggalArsip ? Number(v.tanggalArsip.slice(0, 4)) : null;

  const retensiAktifText = !selected
    ? "Pilih kategori terlebih dahulu"
    : tahun
      ? `${selected.retensiAktif} Tahun (Aktif hingga ${tahun + selected.retensiAktif})`
      : `${selected.retensiAktif} Tahun`;

  const retensiInaktifText = !selected
    ? "Pilih kategori terlebih dahulu"
    : tahun
      ? `${selected.retensiInaktif} Tahun (Inaktif hingga ${
          tahun + selected.retensiAktif + selected.retensiInaktif
        })`
      : `${selected.retensiInaktif} Tahun`;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/arsip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomorArsip: v.nomorArsip,
          nomorSurat: v.nomorSurat,
          judul: v.judul,
          kategoriId: Number(v.kategoriId),
          tanggalArsip: v.tanggalArsip,
          linkBerkas: v.linkBerkas,
          keterangan: v.keterangan,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        message?: string;
      } | null;

      if (!res.ok) {
        setError(data?.message ?? "Gagal menyimpan arsip.");
        setSubmitting(false);
        return;
      }

      router.push(DAFTAR_PATH);
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      {error && (
        <div
          ref={errorRef}
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-[#ffdad6] px-5 py-3 text-sm font-semibold text-[#93000a]"
        >
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      {/* Card 1: Informasi utama */}
      <SectionCard
        icon={<FileText className="size-[18px]" aria-hidden />}
        title="Informasi Utama Arsip"
      >
        <Field
          label="Judul Arsip"
          required
          htmlFor="judul"
          hint="Gunakan nama dokumen lengkap dan jelas sesuai naskah dinas resmi UPI."
          hintStyle="info"
        >
          <input
            id="judul"
            name="judul"
            type="text"
            required
            value={v.judul}
            onChange={set("judul")}
            placeholder="Contoh: Surat Keputusan Dekan tentang Penetapan Beban Tugas Mengajar"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field
            label="Kategori Arsip"
            required
            htmlFor="kategoriId"
            hint="Klasifikasi menentukan masa jadwal retensi arsip (JRA)."
          >
            <div className="relative">
              <select
                id="kategoriId"
                name="kategoriId"
                required
                value={v.kategoriId}
                onChange={set("kategoriId")}
                className={cn(inputClass, "appearance-none pr-10")}
              >
                <option value="" disabled>
                  Pilih kategori arsip
                </option>
                {kategori.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.nama} ({k.kode})
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-3 top-1/2 size-[10px] -translate-y-1/2 text-[#444653]"
                aria-hidden
              />
            </div>
          </Field>

          <Field
            label="Tanggal Arsip"
            required
            htmlFor="tanggalArsip"
            hint="Tanggal penerbitan dokumen asli."
          >
            <input
              id="tanggalArsip"
              name="tanggalArsip"
              type="date"
              required
              value={v.tanggalArsip}
              onChange={set("tanggalArsip")}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field
            label="No. Arsip"
            required
            htmlFor="nomorArsip"
            hint="Nomor unik arsip, tidak boleh sama dengan arsip lain."
          >
            <input
              id="nomorArsip"
              name="nomorArsip"
              type="text"
              required
              value={v.nomorArsip}
              onChange={set("nomorArsip")}
              placeholder="Contoh: ARS-2026-001"
              className={inputClass}
            />
          </Field>

          <Field
            label="No. Berkas / Naskah Dinas"
            required
            htmlFor="nomorSurat"
          >
            <input
              id="nomorSurat"
              name="nomorSurat"
              type="text"
              required
              value={v.nomorSurat}
              onChange={set("nomorSurat")}
              placeholder="Contoh: 042/UN40.FPMIPA/LL/2024"
              className={inputClass}
            />
          </Field>
        </div>

        <Field
          label="Pencipta / Unit Pengolah"
          htmlFor="penciptaUnit"
          hint="Diisi otomatis dari akun yang sedang login."
        >
          <div className="relative">
            <input
              id="penciptaUnit"
              type="text"
              readOnly
              value={penciptaUnit}
              className={cn(readonlyClass, "outline-none")}
            />
            <Lock
              className="pointer-events-none absolute right-3 top-3.5 size-3 text-[#444653]"
              aria-hidden
            />
          </div>
        </Field>

        <Field label="Keterangan (opsional)" htmlFor="keterangan">
          <textarea
            id="keterangan"
            name="keterangan"
            rows={3}
            value={v.keterangan}
            onChange={set("keterangan")}
            placeholder="Catatan tambahan tentang arsip ini"
            className={cn(inputClass, "h-auto resize-y py-3")}
          />
        </Field>

        {/* Retensi otomatis */}
        <div className="flex flex-col gap-4 rounded-xl bg-[#f2f3ff] p-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <RetensiField label="Retensi Aktif" value={retensiAktifText} />
            <RetensiField label="Retensi Inaktif" value={retensiInaktifText} />
          </div>
          <p className="flex items-center gap-1 text-[13px] leading-[18px] text-[#444653]">
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            Informasi retensi aktif dan inaktif otomatis disesuaikan secara
            dinamis berdasarkan kategori klasifikasi yang dipilih.
          </p>
        </div>
      </SectionCard>

      {/* Card 2: Berkas digital */}
      <SectionCard
        icon={<Paperclip className="size-[18px]" aria-hidden />}
        title="Berkas Digital Arsip"
      >
        <Field
          label="Link Berkas"
          required
          htmlFor="linkBerkas"
          hint="Tempel tautan berkas hasil pindai (Google Drive, OneDrive, dsb.) yang dapat dibuka, berawalan https://"
          hintStyle="info"
        >
          <input
            id="linkBerkas"
            name="linkBerkas"
            type="url"
            required
            value={v.linkBerkas}
            onChange={set("linkBerkas")}
            placeholder="https://drive.google.com/..."
            className={inputClass}
          />
        </Field>
      </SectionCard>

      {/* Action bar */}
      <div className="sticky bottom-0 z-20 -mx-6 mt-2 flex h-20 items-center justify-between bg-white/95 px-8 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-[6px]">
        <Link
          href={DAFTAR_PATH}
          className="flex items-center gap-3 rounded-md py-2.5 pr-4 text-sm font-semibold leading-5 text-[#444653] hover:text-[#131b2e]"
        >
          <ArrowLeft className="size-3" aria-hidden />
          Batal / Kembali ke Direktori
        </Link>

        <button
          type="submit"
          disabled={submitting}
          className="flex h-10 items-center gap-2 rounded-md bg-[#1e40af] px-5 text-sm font-semibold text-white shadow-md hover:bg-[#1e3a9f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Menyimpan..." : "Simpan Arsip"}
          <Send className="size-3.5" aria-hidden />
        </button>
      </div>
    </form>
  );
}