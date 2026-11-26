"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { ubahPenelitian } from "@/app/tridharma/penelitian/actions";
import InputPenulis, { parsePenulis } from "@/components/Tridharma/InputPenulis";

type Anggota = { tipe: "Dosen" | "Mahasiswa"; nama: string };

type Awal = {
  id: number;
  judul: string;
  tahun: number | null;
  skema: string | null;
  sumberDana: string | null;
  dana: number;
  anggota: Anggota[];
};

type Payload = {
  id?: number; // ada = ubah data, kosong = data baru
  judul: string;
  tahun: number;
  skema: string;
  sumberDana: string;
  dana: number;
  penulis: string[]; // urutan sama dengan yang diketik (nama pertama = penulis pertama)
};

type Props = {
  ketua: { nama: string; nip: string | null; role: string };
  awal?: Awal; // data yang sudah ada (mode ubah / lihat)
  readOnly: boolean; // true = hanya melihat (Mahasiswa, Umum, bukan anggota tim, atau ?lihat=1)
  opsiSkema: string[];
  backHref: string;
};

// TODO(backend): penelitian BARU belum bisa disimpan (sama seperti Tambah Publikasi).
// Data baru harus tersimpan dengan status "Pending" sampai Kaprodi menyetujui, jadi perlu
// diputuskan dulu tempat menyimpan statusnya dan halaman ACC/Tolak untuk Kaprodi.
// Mode EDIT (awal ada) sudah tersambung ke server action ubahPenelitian.
async function kirimPengajuan(payload: Payload): Promise<{ ok: boolean; pesan: string }> {
  void payload;
  return { ok: false, pesan: "Penyimpanan belum tersambung ke backend, jadi data belum dikirim." };
}

const inputClass =
  "h-11 w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-sm text-[var(--color-text-ink)] outline-none placeholder:text-[var(--color-text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-strong)]/40 disabled:cursor-default disabled:opacity-100 disabled:text-[var(--color-text-ink)]";
const cardClass = "rounded-xl bg-[var(--color-bg-surface)] p-6 border border-[var(--color-border-strong)] shadow-sm";

function Field({
  id,
  label,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-bold leading-5 text-[var(--color-text-ink)]">
        {label} <span className="text-[var(--color-danger-solid)]">*</span>
      </label>
      {children}
      {hint && <p className="text-xs leading-4 text-[var(--color-text-ink)]">{hint}</p>}
    </div>
  );
}

export default function FormulirPenelitian({ ketua, awal, readOnly, opsiSkema, backHref }: Props) {
  const modeEdit = awal !== undefined && !readOnly;
  // Saat edit/lihat, anggota tim hanya ditampilkan (perubahan tim belum didukung)
  const timTerkunci = readOnly || modeEdit;
  // Penulis diketik dalam satu baris, dipisah titik koma. Data baru diawali nama pengaju sebagai penulis pertama.
  const [penulisTeks, setPenulisTeks] = React.useState(
    awal ? [ketua.nama, ...awal.anggota.map((a) => a.nama)].join("; ") : `${ketua.nama}; `
  );
  const [status, setStatus] = React.useState<{ ok: boolean; pesan: string } | null>(null);
  const [mengirim, setMengirim] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly) return;
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const tahun = Number.parseInt(get("tahun"), 10);
    const dana = Number(get("dana"));

    if (!Number.isFinite(tahun) || tahun < 1900 || tahun > 2100) {
      setStatus({ ok: false, pesan: "Tahun penelitian harus berupa angka tahun yang valid." });
      return;
    }
    if (!Number.isFinite(dana) || dana < 0) {
      setStatus({ ok: false, pesan: "Nilai dana harus berupa angka (rupiah), tidak boleh negatif." });
      return;
    }

    const daftarPenulis = parsePenulis(penulisTeks);
    if (!awal && daftarPenulis.length === 0) {
      setStatus({ ok: false, pesan: "Isi minimal satu penulis. Pisahkan beberapa penulis dengan titik koma (;)." });
      return;
    }

    setMengirim(true);
    if (awal) {
      const hasil = await ubahPenelitian(awal.id, {
        judul: get("judul"),
        tahun,
        skema: get("skema"),
        sumberDana: get("sumberDana"),
        dana,
      });
      setStatus(hasil);
      setMengirim(false);
      return;
    }
    const hasil = await kirimPengajuan({
      judul: get("judul"),
      tahun,
      skema: get("skema"),
      sumberDana: get("sumberDana"),
      dana,
      penulis: daftarPenulis,
    });
    setStatus(hasil);
    setMengirim(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 px-6 pt-4">
      <section className={cardClass}>
        <h1 className="font-heading text-[28px] font-bold leading-9 tracking-[-0.7px] text-[var(--color-text-ink)]">
          {readOnly ? "Detail Data Penelitian" : modeEdit ? "Edit Data Penelitian" : "Formulir Data Penelitian"}
        </h1>
        {!readOnly && (
          <p className="mt-1 text-sm text-[var(--color-text-ink)]">
            {modeEdit
              ? "Perubahan langsung tersimpan dan tampil di daftar penelitian."
              : "Data yang kamu ajukan akan tampil di daftar penelitian setelah disetujui Kaprodi."}
          </p>
        )}
      </section>

      {/* Informasi utama */}
      <section className={cardClass}>
        <h2 className="font-heading text-xl font-semibold text-[var(--color-text-ink)]">Informasi Utama</h2>
        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
          <Field
            id="judul"
            label="Judul Penelitian"
            hint={readOnly ? undefined : "Gunakan huruf kapital sesuai pedoman EYD standar publikasi ilmiah."}
            className="md:col-span-2"
          >
            <input
              id="judul"
              name="judul"
              required
              maxLength={500}
              defaultValue={awal?.judul}
              disabled={readOnly}
              placeholder="Judul lengkap penelitian"
              className={inputClass}
            />
          </Field>
          <Field id="tahun" label="Tahun Penelitian">
            <input
              id="tahun"
              name="tahun"
              type="number"
              inputMode="numeric"
              min={1900}
              max={2100}
              required
              defaultValue={awal?.tahun ?? undefined}
              disabled={readOnly}
              placeholder="2024"
              className={inputClass}
            />
          </Field>
          <Field id="skema" label="Skema/Jenis Penelitian">
            <input
              id="skema"
              name="skema"
              list="opsi-skema"
              required
              maxLength={255}
              defaultValue={awal?.skema ?? ""}
              disabled={readOnly}
              placeholder="Contoh: Penelitian Terapan Kompetitif"
              className={inputClass}
            />
            <datalist id="opsi-skema">
              {opsiSkema.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          <Field id="sumberDana" label="Sumber Pendanaan">
            <input
              id="sumberDana"
              name="sumberDana"
              required
              maxLength={100}
              defaultValue={awal?.sumberDana ?? ""}
              disabled={readOnly}
              placeholder="Contoh: Hibah Riset Internal UPI"
              className={inputClass}
            />
          </Field>
          <Field id="dana" label="Nilai Dana Disetujui (Rp)">
            <input
              id="dana"
              name="dana"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              required
              defaultValue={awal?.dana ?? undefined}
              disabled={readOnly}
              placeholder="45000000"
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      {/* Tim pelaksana: penulis dalam satu baris, dipisah titik koma */}
      <section className={cardClass}>
        <h2 className="font-heading text-xl font-semibold text-[var(--color-text-ink)]">Tim Pelaksana</h2>
        <InputPenulis
          nilai={penulisTeks}
          onChange={setPenulisTeks}
          terkunci={timTerkunci}
          className={inputClass}
          catatan="Nama pertama dicatat sebagai ketua."
        />
        {timTerkunci && (
          <p className="mt-2 text-xs leading-4 text-[var(--color-text-ink)]">
            Susunan tim hanya ditampilkan di sini; perubahan tim belum didukung.
          </p>
        )}
      </section>

      {status && (
        <p
          role="status"
          className={cn(
            "rounded-lg px-4 py-3 text-sm",
            status.ok
              ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
              : "bg-[var(--color-danger-bg)] text-[var(--color-danger-solid)]"
          )}
        >
          {status.pesan}
        </p>
      )}

      {/* Aksi */}
      <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-6 py-4 shadow-sm">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text-ink)] hover:text-[var(--color-text-ink)]"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {readOnly ? "Kembali ke Direktori" : "Batal / Kembali ke Direktori"}
        </Link>
        {!readOnly && (
          <button
            type="submit"
            disabled={mengirim}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--color-primary-strong)] px-5 text-sm font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-primary)] disabled:opacity-60"
          >
            {mengirim ? (modeEdit ? "Menyimpan..." : "Mengirim...") : modeEdit ? "Simpan Perubahan" : "Ajukan Verifikasi"}
            <Send className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </form>
  );
}
