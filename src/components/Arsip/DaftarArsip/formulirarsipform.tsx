"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  CloudUpload,
  Eye,
  FileImage,
  FilePlus2,
  FileSpreadsheet,
  FileText,
  Info,
  Lock,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import ConfirmDeleteDialog from "../ConfirmDeletedialog";

/* ---------- Tipe ---------- */

export type KategoriOption = {
  id: number;
  kode: string;
  nama: string;
  retensiAktif: number;
  retensiInaktif: number;
};

export type Values = {
  judul: string;
  kategoriId: string;
  tanggalArsip: string;
  nomorArsip: string;
  nomorSurat: string;
  keterangan: string;
};

/** Berkas yang sudah tersimpan di server (hanya dipakai saat mode edit) */
export type ExistingFile = { name: string; url?: string } | null;

const INITIAL: Values = {
  judul: "",
  kategoriId: "",
  tanggalArsip: "",
  nomorArsip: "",
  nomorSurat: "",
  keterangan: "",
};

const DAFTAR_PATH = "/arsip/daftar";

/* Pengaturan upload berkas */
const ALLOWED_EXT = ["pdf", "docx", "xlsx", "jpg", "jpeg"];
const ACCEPT_ATTR = ".pdf,.docx,.xlsx,.jpg,.jpeg";
const MAX_SIZE_MB = 25;
const PREVIEWABLE_EXT = ["pdf", "jpg", "jpeg"];

/* ---------- Style bersama ---------- */

const inputClass =
  "h-11 w-full rounded-lg bg-white px-4 text-sm text-[#131b2e] shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-black/5 outline-none placeholder:text-[#757684] focus-visible:ring-2 focus-visible:ring-[#1e40af]/40";

const readonlyClass =
  "flex h-11 w-full items-center rounded-lg bg-[#eaedff] pl-4 pr-10 text-sm text-[#131b2e] shadow-[0_1px_2px_rgba(0,0,0,0.05)]";

/* ---------- Helper ---------- */

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fileVisual(ext: string) {
  switch (ext) {
    case "pdf":
      return { Icon: FileText, box: "bg-[#ffdad6] text-[#ba1a1a]" };
    case "docx":
      return { Icon: FileText, box: "bg-[#dde1ff] text-[#1e40af]" };
    case "xlsx":
      return { Icon: FileSpreadsheet, box: "bg-[#d6f5e0] text-[#1b7a3d]" };
    default:
      return { Icon: FileImage, box: "bg-[#ffe8c2] text-[#9a5b00]" };
  }
}

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
          <p className="flex items-center gap-1 text-[13px] leading-4.5 text-[#444653]">
            <Info className="size-3.25 shrink-0" aria-hidden />
            {hint}
          </p>
        ) : (
          <p className="text-[11px] font-bold leading-3.5 tracking-[0.44px] text-[#444653]">
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

function FileUploader({
  id,
  name,
  file,
  onChange,
  existingFile = null,
}: {
  id: string;
  name: string;
  file: File | null;
  onChange: (file: File | null) => void;
  existingFile?: ExistingFile;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function openPicker() {
    inputRef.current?.click();
  }

  function handleFile(f?: File | null) {
    if (!f) return;
    if (!ALLOWED_EXT.includes(getExt(f.name))) {
      setFileError(
        "Format berkas tidak didukung. Gunakan PDF, DOCX, XLSX, atau JPG.",
      );
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setFileError(`Ukuran berkas melebihi ${MAX_SIZE_MB} MB.`);
      return;
    }
    setFileError(null);
    onChange(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  function onDragLeave(e: DragEvent<HTMLDivElement>) {
    // abaikan event saat kursor berpindah ke elemen anak
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    setDragging(false);
  }

  function onPreview() {
    if (!file) return;
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener,noreferrer");
    // beri waktu tab baru memuat berkas sebelum URL dilepas
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  const ext = file ? getExt(file.name) : "";
  const canPreview = PREVIEWABLE_EXT.includes(ext);
  const { Icon: FileIcon, box } = fileVisual(ext);

  const existingExt = existingFile ? getExt(existingFile.name) : "";
  const { Icon: ExistingIcon, box: existingBox } = fileVisual(existingExt);

  return (
    <div className="flex flex-col gap-6">
      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging
            ? "border-[#1e40af] bg-[#dde1ff]"
            : "border-transparent bg-[#f2f3ff]",
        )}
      >
        <div className="flex size-16 items-center justify-center rounded-full bg-white text-[#1e40af] shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
          <CloudUpload className="size-8" aria-hidden />
        </div>

        <div className="flex max-w-md flex-col gap-1">
          <p className="text-base font-semibold text-[#131b2e]">
            Tarik dan lepas dokumen ke sini, atau klik tombol di bawah
          </p>
          <p className="text-[13px] leading-4.5 text-[#444653]">
            Pastikan naskah telah dipindai (scan) dalam resolusi yang memadai
            dengan cap dinas yang terbaca jelas.
          </p>
        </div>

        <button
          type="button"
          onClick={openPicker}
          className="flex h-11 items-center gap-2 rounded-md bg-[#1e40af] px-6 text-sm font-semibold text-white shadow-md hover:bg-[#1e3a9f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]/40 focus-visible:ring-offset-2"
        >
          <FilePlus2 className="size-4" aria-hidden />
          {existingFile ? "Pilih Berkas Pengganti" : "Pilih File dari Perangkat"}
        </button>

        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-[#444653]">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3" aria-hidden />
            Format: PDF, DOCX, XLSX, JPG
          </span>
          <span aria-hidden>•</span>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="size-3" aria-hidden />
            Maksimal {MAX_SIZE_MB} MB per dokumen
          </span>
        </p>

        <input
          ref={inputRef}
          id={id}
          name={name}
          type="file"
          aria-label="Pilih berkas arsip"
          accept={ACCEPT_ATTR}
          className="sr-only"
          tabIndex={-1}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            handleFile(e.target.files?.[0]);
            e.target.value = ""; // supaya berkas yang sama bisa dipilih ulang
          }}
        />
      </div>

      {fileError && (
        <p
          role="alert"
          className="-mt-3 flex items-center gap-1 text-[13px] font-semibold text-[#ba1a1a]"
        >
          <Info className="size-3.25 shrink-0" aria-hidden />
          {fileError}
        </p>
      )}

      {/* Berkas lama (mode edit, selama belum dipilih berkas baru) */}
      {!file && existingFile && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase leading-4 tracking-[0.48px] text-[#444653]">
            Berkas Saat Ini
          </h3>

          <div className="flex flex-col gap-4 rounded-xl bg-[#eaedff] p-4 sm:flex-row sm:items-center">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                existingBox,
              )}
            >
              <ExistingIcon className="size-5" aria-hidden />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#131b2e]">
                {existingFile.name}
              </p>
              <p className="text-xs text-[#444653]">
                Pilih berkas baru di atas jika ingin menggantinya.
              </p>
            </div>

            {existingFile.url && (
              <a
                href={existingFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 shrink-0 items-center gap-2 rounded-md bg-white px-3 text-[13px] font-semibold text-[#131b2e] shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-[#f2f3ff]"
              >
                <Eye className="size-4" aria-hidden />
                Lihat Berkas
              </a>
            )}
          </div>
        </div>
      )}

      {/* Berkas baru yang dipilih */}
      {file && (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase leading-4 tracking-[0.48px] text-[#444653]">
            {existingFile ? "Berkas Pengganti (1 File)" : "Berkas Terlampir (1 File)"}
          </h3>

          <div className="flex flex-col gap-4 rounded-xl bg-[#eaedff] p-4 sm:flex-row sm:items-center">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-lg",
                box,
              )}
            >
              <FileIcon className="size-5" aria-hidden />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#131b2e]">
                {file.name}
              </p>
              <p className="flex items-center gap-2 text-xs text-[#444653]">
                <span className="font-semibold">{formatSize(file.size)}</span>
                <span aria-hidden>•</span>
                <span className="flex items-center gap-1 font-semibold text-[#0b6b2f]">
                  <CheckCircle2 className="size-3" aria-hidden />
                  Siap Diunggah
                </span>
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onPreview}
                disabled={!canPreview}
                title={
                  canPreview
                    ? undefined
                    : "Pratinjau hanya tersedia untuk PDF dan JPG"
                }
                className="flex h-9 items-center gap-2 rounded-md bg-white px-3 text-[13px] font-semibold text-[#131b2e] shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-[#f2f3ff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Eye className="size-4" aria-hidden />
                Lihat Pratinjau
              </button>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="flex h-9 items-center gap-2 rounded-md bg-white px-3 text-[13px] font-semibold text-[#ba1a1a] shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-[#ffdad6]"
              >
                <Trash2 className="size-4" aria-hidden />
                Hapus / Ganti
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          onChange(null);
          setFileError(null);
          setConfirmOpen(false);
        }}
      />
    </div>
  );
}

/* ---------- Form ---------- */

export default function FormulirArsipForm({
  kategori,
  penciptaUnit,
  mode = "create",
  arsipId,
  initialValues,
  existingFile = null,
}: {
  kategori: KategoriOption[];
  penciptaUnit: string;
  mode?: "create" | "edit";
  arsipId?: string;
  initialValues?: Values;
  existingFile?: ExistingFile;
}) {
  const isEdit = mode === "edit";
  const router = useRouter();
  const [v, setV] = useState<Values>(initialValues ?? INITIAL);
  const [berkas, setBerkas] = useState<File | null>(null);
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
      >,
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

    // Tambah: berkas wajib. Edit: wajib hanya jika belum ada berkas lama.
    if (!berkas && !(isEdit && existingFile)) {
      setError("Berkas arsip wajib diunggah.");
      return;
    }

    if (isEdit && !arsipId) {
      setError("ID arsip tidak ditemukan.");
      return;
    }

    setSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("nomorArsip", v.nomorArsip);
      fd.append("nomorSurat", v.nomorSurat);
      fd.append("judul", v.judul);
      fd.append("kategoriId", v.kategoriId);
      fd.append("tanggalArsip", v.tanggalArsip);
      fd.append("keterangan", v.keterangan);
      if (berkas) fd.append("berkas", berkas); // saat edit, berkas opsional

      // Jangan set Content-Type manual; browser akan mengisi boundary multipart
      const res = await fetch(isEdit ? `/api/arsip/${arsipId}` : "/api/arsip", {
        method: isEdit ? "PATCH" : "POST",
        body: fd,
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
      setError(
        "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 px-6 py-6">
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
        icon={<FileText className="size-4.5" aria-hidden />}
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
                className="pointer-events-none absolute right-3 top-1/2 size-2.5 -translate-y-1/2 text-[#444653]"
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
              className={cn(
                readonlyClass,
                "outline-none pointer-events-none cursor-not-allowed",
              )}
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
          <p className="flex items-center gap-1 text-[13px] leading-4.5 text-[#444653]">
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            Informasi retensi aktif dan inaktif otomatis disesuaikan secara
            dinamis berdasarkan kategori klasifikasi yang dipilih.
          </p>
        </div>
      </SectionCard>

      {/* Card 2: Berkas digital */}
      <SectionCard
        icon={<Paperclip className="size-4.5" aria-hidden />}
        title="Berkas Digital Arsip"
      >
        <FileUploader
          id="berkas"
          name="berkas"
          file={berkas}
          onChange={setBerkas}
          existingFile={isEdit ? existingFile : null}
        />
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
          {submitting
            ? "Menyimpan..."
            : isEdit
              ? "Simpan Perubahan"
              : "Simpan Arsip"}
          <Send className="size-3.5" aria-hidden />
        </button>
      </div>
    </form>
  );
}