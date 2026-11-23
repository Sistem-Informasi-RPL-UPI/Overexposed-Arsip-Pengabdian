"use client";

import * as React from "react";
import { AlertCircle, ArrowLeft, Info, Loader2, Send, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FormKategoriArsipValues = {
  kode: string;
  nama: string;
  retensiAktif: number;
  retensiInaktif: number;
};

export interface FormulirKategoriArsipProps {
  /** Nilai awal (berguna untuk mode edit) */
  defaultValues?: Partial<FormKategoriArsipValues>;
  /**
   * Dipanggil saat form valid & disubmit.
   * Kalau gagal, LEMPAR error (throw new Error("pesan")) supaya pesannya tampil di form.
   */
  onSubmit?: (values: FormKategoriArsipValues) => void | Promise<void>;
  /** Dipanggil saat klik "Batal / Kembali ke Direktori" */
  onCancel?: () => void;
  /** Opsional: paksa status loading dari luar */
  isSubmitting?: boolean;
  className?: string;
}

function RequiredLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <Label
      htmlFor={htmlFor}
      className="gap-1 text-xs font-semibold leading-4 tracking-[0.24px] text-[#131b2e]"
    >
      {children}
      <span className="font-bold text-[#ba1a1a]">*</span>
    </Label>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1 pt-0.5 text-[13px] leading-[18px] text-[#444653]">
      <Info className="size-[13px] shrink-0" />
      {children}
    </p>
  );
}

const inputClass =
  "h-11 rounded-lg border border-[#eaedff] bg-white px-3.5 py-3 text-sm text-[#131b2e] shadow-none placeholder:text-[#757684] focus-visible:border-[#1e40af] focus-visible:ring-1 focus-visible:ring-[#1e40af] disabled:cursor-not-allowed disabled:opacity-60";

const numberInputClass =
  "pr-[84px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export function FormulirKategoriArsip({
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting,
  className,
}: FormulirKategoriArsipProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const errorRef = React.useRef<HTMLDivElement>(null);

  const isLoading = isSubmitting ?? submitting;

  // Scroll ke notifikasi error saat muncul
  React.useEffect(() => {
    if (error) {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isLoading) return;

    const fd = new FormData(e.currentTarget);
    const values: FormKategoriArsipValues = {
      kode: String(fd.get("kode") ?? "").trim(),
      nama: String(fd.get("nama") ?? "").trim(),
      retensiAktif: Number(fd.get("retensiAktif")),
      retensiInaktif: Number(fd.get("retensiInaktif")),
    };

    try {
      setError(null);
      setSubmitting(true);
      await onSubmit?.(values);
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Terjadi kesalahan saat menyimpan kategori. Silakan coba lagi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isLoading}
      className={cn("flex min-h-full w-full flex-col bg-[#faf8ff]", className)}
    >
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 p-8">
        {/* Page title */}
        <div className="flex items-center rounded-xl bg-white px-6 shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
          <h1 className="text-[28px] font-bold leading-9 tracking-[-0.7px] text-[#131b2e]">
            Formulir Kategori Arsip
          </h1>
        </div>

        {/* Notifikasi error */}
        {error && (
          <div ref={errorRef}>
            <Alert
              variant="destructive"
              className="relative border-[#ba1a1a]/30 bg-[#ba1a1a]/5 pr-12 text-[#ba1a1a]"
            >
              <AlertCircle className="size-4" />
              <AlertTitle className="font-semibold">Gagal menyimpan</AlertTitle>
              <AlertDescription className="text-[#ba1a1a]/90">
                {error}
              </AlertDescription>
              <button
                type="button"
                aria-label="Tutup notifikasi"
                onClick={() => setError(null)}
                className="absolute right-3 top-3 rounded-md p-1 text-[#ba1a1a] hover:bg-[#ba1a1a]/10"
              >
                <X className="size-4" />
              </button>
            </Alert>
          </div>
        )}

        {/* Card: Informasi Kategori */}
        <section className="overflow-hidden rounded-xl bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <div className="bg-[#f2f3ff] px-6 py-4">
            <h2 className="text-base font-bold leading-6 text-[#131b2e]">
              Informasi Kategori
            </h2>
          </div>

          {/* fieldset disabled -> semua input ikut nonaktif saat loading */}
          <fieldset
            disabled={isLoading}
            className="m-0 flex min-w-0 flex-col gap-6 border-0 p-6"
          >
            {/* Kode Klasifikasi */}
            <div className="flex flex-col gap-1.5">
              <RequiredLabel htmlFor="kode">Kode Klasifikasi</RequiredLabel>
              <Input
                id="kode"
                name="kode"
                required
                defaultValue={defaultValues?.kode}
                placeholder="Contoh: DL.01 atau KU.02"
                className={inputClass}
              />
              <FieldHint>
                Gunakan standar format kode unit pengolah dan sub-kode
                klasifikasi UPI.
              </FieldHint>
            </div>

            {/* Nama Kategori */}
            <div className="flex flex-col gap-1.5">
              <RequiredLabel htmlFor="nama">Nama Kategori</RequiredLabel>
              <Input
                id="nama"
                name="nama"
                required
                defaultValue={defaultValues?.nama}
                placeholder="Masukkan nama kategori arsip (misal: Kurikulum & Pembelajaran)"
                className={inputClass}
              />
              <FieldHint>
                Nama kelompok berkas arsip yang jelas dan representatif.
              </FieldHint>
            </div>

            {/* Retensi (2 kolom) */}
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <RequiredLabel htmlFor="retensiAktif">
                  Retensi Aktif (Tahun)
                </RequiredLabel>
                <div className="relative">
                  <Input
                    id="retensiAktif"
                    name="retensiAktif"
                    type="number"
                    min={0}
                    required
                    defaultValue={defaultValues?.retensiAktif}
                    placeholder="2"
                    className={cn(inputClass, numberInputClass)}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded bg-[#f2f3ff] px-2 py-0.5 text-xs font-semibold leading-4 tracking-[0.24px] text-[#444653]">
                    Tahun
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <RequiredLabel htmlFor="retensiInaktif">
                  Retensi Inaktif (Tahun)
                </RequiredLabel>
                <div className="relative">
                  <Input
                    id="retensiInaktif"
                    name="retensiInaktif"
                    type="number"
                    min={0}
                    required
                    defaultValue={defaultValues?.retensiInaktif}
                    placeholder="5"
                    className={cn(inputClass, numberInputClass)}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded bg-[#f2f3ff] px-2 py-0.5 text-xs font-semibold leading-4 tracking-[0.24px] text-[#444653]">
                    Tahun
                  </span>
                </div>
              </div>
            </div>
          </fieldset>
        </section>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 flex h-20 items-center justify-between bg-white/95 px-8 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-[6px]">
        <Button
          type="button"
          variant="ghost"
          disabled={isLoading}
          onClick={onCancel}
          className="h-auto gap-3 rounded-md py-2.5 pr-4 text-sm font-semibold text-[#444653] hover:bg-[#f2f3ff] hover:text-[#444653]"
        >
          <ArrowLeft className="size-3" />
          Batal / Kembali ke Direktori
        </Button>

        <Button
          type="submit"
          disabled={isLoading}
          className="h-10 min-w-[144px] gap-1.5 rounded-md bg-[#1e40af] px-4 text-sm font-semibold text-white shadow-md hover:bg-[#1e40af]/90 disabled:opacity-80"
        >
          {isLoading ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Menyimpan...
            </>
          ) : (
            <>
              Simpan Arsip
              <Send className="size-3.5" />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export default FormulirKategoriArsip;