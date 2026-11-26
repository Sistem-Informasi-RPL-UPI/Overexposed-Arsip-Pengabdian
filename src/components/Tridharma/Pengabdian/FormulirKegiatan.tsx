"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, CheckCircle2, Info, Loader2, Send, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  JUDUL_MAKS,
  PENULIS_MAKS,
  SKEMA_MAKS,
  SUMBER_DANA_MAKS,
  TAHUN_MIN,
  digitDana,
  parsePenulis,
  tampilDana,
} from "@/lib/kegiatan-form";

type Jenis = "penelitian" | "pengabdian";

type Nilai = {
  judul: string;
  tahun: string;
  skema: string; // hanya penelitian
  sumberDana: string;
  dana: string; // hanya digit, misalnya "45000000"
  penulis: string; // "Penulis A; Penulis B; Penulis C"
};

const KUNCI_NILAI: (keyof Nilai)[] = ["judul", "tahun", "skema", "sumberDana", "dana", "penulis"];

const LABEL: Record<Jenis, string> = {
  penelitian: "Penelitian",
  pengabdian: "Pengabdian",
};

export interface FormulirKegiatanProps {
  jenis: Jenis;
  /** Nama dosen yang login. Dipakai sebagai penulis pertama (ketua) di isian awal. */
  namaPenulisUtama?: string;
  /** Kunci localStorage untuk draf, sebaiknya memuat jenis dan id pengguna. */
  draftKey: string;
  /** Tujuan tombol "Batal / Kembali ke Direktori" dan tautan setelah berhasil. */
  kembaliHref?: string;
}

function RequiredLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="gap-1 text-sm font-semibold leading-5 text-[#131b2e]">
      {children}
      <span className="font-bold text-[#ba1a1a]">*</span>
    </Label>
  );
}

function FieldHint({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 pt-0.5 text-[13px] leading-[18px] text-[#444653]">
      <Info className="mt-px size-[13px] shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

const inputClass =
  "h-11 rounded-lg border border-[#eaedff] bg-white px-3.5 py-3 text-sm text-[#131b2e] shadow-none placeholder:text-[#757684] focus-visible:border-[#1e40af] focus-visible:ring-1 focus-visible:ring-[#1e40af] disabled:cursor-not-allowed disabled:opacity-60";

const noSpinner = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

const cardClass = "rounded-xl bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.05)]";
const headingFont = "font-[family-name:var(--font-lexend)]";

function jamWib(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(d)
    .replace(".", ":");
}

export function FormulirKegiatan({ jenis, namaPenulisUtama, draftKey, kembaliHref }: FormulirKegiatanProps) {
  const label = LABEL[jenis];
  const kembali = kembaliHref ?? `/tridharma/${jenis}`;

  const awal = React.useMemo<Nilai>(
    () => ({
      judul: "",
      tahun: "",
      skema: "",
      sumberDana: "",
      dana: "",
      penulis: namaPenulisUtama ? `${namaPenulisUtama}; ` : "",
    }),
    [namaPenulisUtama],
  );

  const [nilai, setNilai] = React.useState<Nilai>(awal);
  const [siap, setSiap] = React.useState(false); // true setelah draf dibaca dari localStorage
  const [pesanDraf, setPesanDraf] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sukses, setSukses] = React.useState(false);
  const errorRef = React.useRef<HTMLDivElement>(null);
  const suksesRef = React.useRef<HTMLDivElement>(null);

  const ubah = (kunci: keyof Nilai, v: string) => setNilai((s) => ({ ...s, [kunci]: v }));

  // Pulihkan draf yang tersimpan di perangkat ini.
  React.useEffect(() => {
    try {
      const mentah = localStorage.getItem(draftKey);
      if (mentah) {
        const draf = JSON.parse(mentah) as Partial<Record<keyof Nilai, unknown>>;
        const pulih: Partial<Nilai> = {};
        for (const k of KUNCI_NILAI) {
          if (typeof draf[k] === "string") pulih[k] = draf[k] as string;
        }
        if (Object.keys(pulih).length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setNilai((s) => ({ ...s, ...pulih }));
          setPesanDraf("Draf sebelumnya dipulihkan dari perangkat ini.");
        }
      }
    } catch {
      // draf rusak atau storage tidak tersedia: abaikan
    }
    setSiap(true);
  }, [draftKey]);

  // Simpan draf otomatis 0,8 detik setelah pengguna berhenti mengetik.
  React.useEffect(() => {
    if (!siap) return;
    const timer = window.setTimeout(() => {
      try {
        const tidakBerubah = KUNCI_NILAI.every((k) => nilai[k] === awal[k]);
        if (tidakBerubah) {
          localStorage.removeItem(draftKey);
          return;
        }
        localStorage.setItem(draftKey, JSON.stringify(nilai));
        setPesanDraf(`Draf disimpan di perangkat ini pukul ${jamWib(new Date())} WIB.`);
      } catch {
        // storage penuh atau diblokir: draf tidak tersimpan, form tetap bisa dipakai
      }
    }, 800);
    return () => window.clearTimeout(timer);
  }, [nilai, siap, awal, draftKey]);

  React.useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [error]);

  React.useEffect(() => {
    if (sukses) suksesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [sukses]);

  const { penulis, duplikat } = React.useMemo(() => parsePenulis(nilai.penulis), [nilai.penulis]);
  const kebanyakan = penulis.length > PENULIS_MAKS;
  const penulisBermasalah = duplikat.length > 0 || kebanyakan;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;

    setError(null);
    setSukses(false);

    if (penulis.length === 0) {
      setError("Isi minimal satu nama penulis.");
      return;
    }
    if (duplikat.length > 0) {
      setError(`Nama penulis ganda: ${duplikat.join(", ")}. Tulis setiap nama satu kali.`);
      return;
    }
    if (kebanyakan) {
      setError(`Penulis maksimal ${PENULIS_MAKS} orang.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tridharma/kegiatan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jenis,
          judul: nilai.judul,
          tahun: Number(nilai.tahun),
          sumberDana: nilai.sumberDana,
          dana: nilai.dana,
          penulis: nilai.penulis,
          ...(jenis === "penelitian" ? { skema: nilai.skema } : {}),
        }),
      });

      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        throw new Error(data?.message ?? `Gagal mengajukan ${label.toLowerCase()} (status ${res.status}).`);
      }

      try {
        localStorage.removeItem(draftKey);
      } catch {
        // abaikan
      }
      setPesanDraf(null);
      setNilai(awal);
      setSukses(true);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : `Terjadi kesalahan saat mengajukan ${label.toLowerCase()}. Silakan coba lagi.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-busy={submitting} className="flex min-h-full w-full flex-col bg-[#faf8ff]">
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 p-8">
        {/* Banner draf */}
        {pesanDraf && !sukses && (
          <div role="status" aria-live="polite" className="flex items-center gap-2.5 rounded-xl bg-[#d6f6e8] px-4 py-3 text-sm font-medium text-[#131b2e]">
            <CheckCircle2 className="size-[18px] shrink-0 text-[#176f41]" aria-hidden />
            {pesanDraf}
          </div>
        )}

        {/* Banner sukses */}
        {sukses && (
          <div ref={suksesRef} role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4" aria-hidden />
              {label} berhasil diajukan dan menunggu verifikasi.
            </span>
            <Link href={kembali} className="font-semibold underline underline-offset-2">
              Lihat daftar {label.toLowerCase()}
            </Link>
          </div>
        )}

        {/* Judul halaman */}
        <div className="flex items-center rounded-xl bg-white px-8 py-7 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <h1 className={cn(headingFont, "text-[28px] font-bold leading-9 tracking-[-0.7px] text-[#131b2e]")}>Formulir Data {label}</h1>
        </div>

        {/* Notifikasi error */}
        {error && (
          <div ref={errorRef}>
            <Alert variant="destructive" className="relative border-[#ba1a1a]/30 bg-[#ba1a1a]/5 pr-12 text-[#ba1a1a]">
              <AlertCircle className="size-4" />
              <AlertTitle className="font-semibold">Gagal mengajukan</AlertTitle>
              <AlertDescription className="text-[#ba1a1a]/90">{error}</AlertDescription>
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

        {/* Informasi Utama */}
        <section className={cardClass}>
          <h2 className={cn(headingFont, "mb-6 text-xl font-bold leading-7 text-[#131b2e]")}>Informasi Utama</h2>

          <fieldset disabled={submitting} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">
            <div className="flex flex-col gap-1.5">
              <RequiredLabel htmlFor="judul">Judul {label}</RequiredLabel>
              <Input
                id="judul"
                name="judul"
                required
                maxLength={JUDUL_MAKS}
                value={nilai.judul}
                onChange={(e) => ubah("judul", e.target.value)}
                aria-describedby="judul-bantuan"
                placeholder={`Masukkan judul ${label.toLowerCase()}`}
                className={inputClass}
              />
              <FieldHint id="judul-bantuan">Gunakan huruf kapital sesuai pedoman EYD standar publikasi ilmiah.</FieldHint>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <RequiredLabel htmlFor="tahun">Tahun {label}</RequiredLabel>
                <Input
                  id="tahun"
                  name="tahun"
                  type="number"
                  inputMode="numeric"
                  required
                  min={TAHUN_MIN}
                  max={new Date().getFullYear() + 1}
                  value={nilai.tahun}
                  onChange={(e) => ubah("tahun", e.target.value.slice(0, 4))}
                  placeholder={String(new Date().getFullYear())}
                  className={cn(inputClass, noSpinner)}
                />
              </div>

              {jenis === "penelitian" && (
                <div className="flex flex-col gap-1.5">
                  <RequiredLabel htmlFor="skema">Skema/Jenis Penelitian</RequiredLabel>
                  <Input
                    id="skema"
                    name="skema"
                    required
                    maxLength={SKEMA_MAKS}
                    value={nilai.skema}
                    onChange={(e) => ubah("skema", e.target.value)}
                    placeholder="Contoh: Penelitian Terapan Unggulan Perguruan Tinggi (PTUPT)"
                    className={inputClass}
                  />
                </div>
              )}

              {/* Pada pengabdian, kolom di samping Tahun sengaja kosong (sesuai mockup). */}
              {jenis === "pengabdian" && <div className="hidden sm:block" aria-hidden />}

              <div className="flex flex-col gap-1.5">
                <RequiredLabel htmlFor="sumberDana">Sumber Pendanaan</RequiredLabel>
                <Input
                  id="sumberDana"
                  name="sumberDana"
                  required
                  maxLength={SUMBER_DANA_MAKS}
                  value={nilai.sumberDana}
                  onChange={(e) => ubah("sumberDana", e.target.value)}
                  placeholder="Contoh: Hibah Riset Internal UPI"
                  className={inputClass}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <RequiredLabel htmlFor="dana">Nilai Dana Disetujui</RequiredLabel>
                <Input
                  id="dana"
                  name="dana"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  value={tampilDana(nilai.dana)}
                  onChange={(e) => ubah("dana", digitDana(e.target.value))}
                  placeholder="Rp 45.000.000"
                  className={inputClass}
                />
              </div>
            </div>
          </fieldset>
        </section>

        {/* Tim Pelaksana */}
        <section className={cardClass}>
          <h2 className={cn(headingFont, "mb-6 text-xl font-bold leading-7 text-[#131b2e]")}>Tim Pelaksana</h2>

          <fieldset disabled={submitting} className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
            <RequiredLabel htmlFor="penulis">Penulis</RequiredLabel>
            <Input
              id="penulis"
              name="penulis"
              required
              value={nilai.penulis}
              onChange={(e) => ubah("penulis", e.target.value)}
              aria-describedby="penulis-bantuan"
              aria-invalid={penulisBermasalah || undefined}
              placeholder="Penulis A; Penulis B; Penulis C"
              className={inputClass}
            />

            <div id="penulis-bantuan" className="flex flex-col gap-1">
              <FieldHint>
                Urutan nama menentukan urutan penulis. Nama yang ditulis paling awal menjadi Penulis 1 (ketua), nama berikutnya Penulis 2, Penulis 3, dan seterusnya.
              </FieldHint>
              <FieldHint>Pisahkan setiap nama dengan titik koma (;). Contoh: Penulis A; Penulis B; Penulis C</FieldHint>
            </div>

            {duplikat.length > 0 && (
              <p role="alert" className="pt-1 text-[13px] font-medium text-[#ba1a1a]">
                Nama ganda: {duplikat.join(", ")}. Tulis setiap nama satu kali.
              </p>
            )}
            {kebanyakan && (
              <p role="alert" className="pt-1 text-[13px] font-medium text-[#ba1a1a]">
                Penulis maksimal {PENULIS_MAKS} orang.
              </p>
            )}

            {penulis.length > 0 && (
              <ol aria-label="Urutan penulis" className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
                {penulis.map((p, i) => (
                  <li key={p.normal} className="flex items-center justify-between gap-3 rounded-lg bg-[#ececf3] px-4 py-3">
                    <span className="min-w-0 break-words text-sm font-semibold text-[#131b2e]">{p.nama}</span>
                    <span className="shrink-0 rounded-md bg-[#8dccf1]/60 px-2.5 py-0.5 text-xs font-bold text-[#00288e]">Penulis {i + 1}</span>
                  </li>
                ))}
              </ol>
            )}
          </fieldset>
        </section>
      </div>

      {/* Action bar */}
      <div className="sticky bottom-0 flex h-20 items-center justify-between gap-4 bg-white/95 px-8 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-[6px]">
        <Link
          href={kembali}
          aria-disabled={submitting}
          className="inline-flex items-center gap-3 rounded-md px-4 py-2.5 text-sm font-semibold text-[#444653] hover:bg-[#f2f3ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e40af]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Batal / Kembali ke Direktori
        </Link>

        <Button
          type="submit"
          disabled={submitting}
          className="h-10 min-w-[160px] gap-1.5 rounded-md bg-[#1e40af] px-4 text-sm font-semibold text-white shadow-md hover:bg-[#1e40af]/90 disabled:opacity-80"
        >
          {submitting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Mengajukan...
            </>
          ) : (
            <>
              Ajukan Verifikasi
              <Send className="size-3.5" aria-hidden />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export default FormulirKegiatan;
