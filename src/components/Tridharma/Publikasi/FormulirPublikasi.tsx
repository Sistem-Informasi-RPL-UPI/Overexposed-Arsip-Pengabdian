"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { ubahPublikasi } from "@/app/tridharma/publikasi/actions";
import InputPenulis, { parsePenulis } from "@/components/Tridharma/InputPenulis";

type Payload = {
  judul: string;
  tahun: number;
  jurnal: string;
  jenis: string;
  akreditasi: string;
  doi: string;
  penulis: string[]; // urutan sama dengan yang diketik (nama pertama = penulis pertama)
};

const JENIS = ["Jurnal", "Conference Proceeding", "Prosiding", "Buku Chapter"];
const AKREDITASI = ["Q1", "Q2", "Q3", "Q4", "Sinta 1", "Sinta 2", "Sinta 3", "Sinta 4", "Sinta 5", "Sinta 6", "Belum terakreditasi"];

// TODO(backend): sambungkan ke endpoint penyimpanan (mis. POST /api/tridharma/publikasi).
// Data dari form ini harus tersimpan dengan status "Pending" sampai Kaprodi menyetujui.
// Sampai endpoint itu ada, fungsi ini sengaja TIDAK menyimpan apa pun.
async function kirimPengajuan(payload: Payload): Promise<{ ok: boolean; pesan: string }> {
  void payload;
  return { ok: false, pesan: "Penyimpanan belum tersambung ke backend, jadi data belum dikirim." };
}

const inputClass =
  "h-11 w-full rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-4 text-sm text-[var(--color-text-ink)] outline-none placeholder:text-[var(--color-text-secondary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-strong)]/40";
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

type Awal = {
  id: number;
  judul: string;
  tahun: number | null;
  jurnal: string;
  jenis: string;
  akreditasi: string;
  doi: string;
};

// Nilai lama dari SINTA bisa saja tidak ada di daftar pilihan; tetap ditampilkan supaya tidak hilang
const denganNilai = (opsi: string[], nilai?: string) => (nilai && !opsi.includes(nilai) ? [nilai, ...opsi] : opsi);

export default function FormulirPublikasi({
  ketua,
  awal,
}: {
  ketua: { nama: string; nip: string | null; role: string };
  awal?: Awal; // ada = mode edit
}) {
  const modeEdit = awal !== undefined;
  // Penulis diketik dalam satu baris, dipisah titik koma. Diawali nama pengaju sebagai penulis pertama.
  const [penulisTeks, setPenulisTeks] = React.useState(`${ketua.nama}; `);
  const [status, setStatus] = React.useState<{ ok: boolean; pesan: string } | null>(null);
  const [mengirim, setMengirim] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();
    const tahun = Number.parseInt(get("tahun"), 10);

    if (!Number.isFinite(tahun) || tahun < 1900 || tahun > 2100) {
      setStatus({ ok: false, pesan: "Tahun terbit harus berupa angka tahun yang valid." });
      return;
    }

    const daftarPenulis = parsePenulis(penulisTeks);
    if (!awal && daftarPenulis.length === 0) {
      setStatus({ ok: false, pesan: "Isi minimal satu penulis. Pisahkan beberapa penulis dengan titik koma (;)." });
      return;
    }

    setMengirim(true);
    if (awal) {
      const hasil = await ubahPublikasi(awal.id, {
        judul: get("judul"),
        tahun,
        jurnal: get("jurnal"),
        jenis: get("jenis"),
        akreditasi: get("akreditasi"),
        doi: get("doi"),
      });
      setStatus(hasil);
      setMengirim(false);
      return;
    }
    const hasil = await kirimPengajuan({
      judul: get("judul"),
      tahun,
      jurnal: get("jurnal"),
      jenis: get("jenis"),
      akreditasi: get("akreditasi"),
      doi: get("doi"),
      penulis: daftarPenulis,
    });
    setStatus(hasil);
    setMengirim(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 px-6 pt-4">
      <section className={cardClass}>
        <h1 className="font-heading text-[28px] font-bold leading-9 tracking-[-0.7px] text-[var(--color-text-ink)]">
          {modeEdit ? "Edit Data Publikasi" : "Formulir Data Publikasi"}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-ink)]">
          {modeEdit
            ? "Perubahan langsung tersimpan dan tampil di daftar publikasi."
            : "Data yang kamu ajukan akan tampil di daftar publikasi setelah disetujui Kaprodi."}
        </p>
      </section>

      {/* Informasi utama */}
      <section className={cardClass}>
        <h2 className="font-heading text-xl font-semibold text-[var(--color-text-ink)]">Informasi Utama</h2>
        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2">
          <Field id="judul" label="Judul Publikasi" hint="Gunakan huruf kapital sesuai pedoman EYD standar publikasi ilmiah." className="md:col-span-2">
            <input id="judul" name="judul" defaultValue={awal?.judul} required maxLength={500} placeholder="Judul lengkap publikasi" className={inputClass} />
          </Field>
          <Field id="tahun" label="Tahun Terbit">
            <input id="tahun" name="tahun" defaultValue={awal?.tahun ?? undefined} type="number" inputMode="numeric" min={1900} max={2100} required placeholder="2024" className={inputClass} />
          </Field>
          <Field id="jurnal" label="Nama Jurnal">
            <input id="jurnal" name="jurnal" defaultValue={awal?.jurnal} required maxLength={255} placeholder="Nama jurnal / prosiding" className={inputClass} />
          </Field>
          <Field id="jenis" label="Jenis Paper">
            <select id="jenis" name="jenis" required defaultValue={awal?.jenis ?? ""} className={inputClass}>
              <option value="" disabled>Pilih jenis paper</option>
              {denganNilai(JENIS, awal?.jenis).map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </Field>
          <Field id="akreditasi" label="Akreditasi Jurnal">
            <select id="akreditasi" name="akreditasi" required defaultValue={awal?.akreditasi ?? ""} className={inputClass}>
              <option value="" disabled>Pilih akreditasi</option>
              {denganNilai(AKREDITASI, awal?.akreditasi).map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </Field>
          <Field id="doi" label="Tautan DOI">
            <input id="doi" name="doi" defaultValue={awal?.doi} required maxLength={150} placeholder="10.xxxx/xxxxx" className={inputClass} />
          </Field>
        </div>
      </section>

      {/* Tim pelaksana (hanya saat tambah baru; saat edit, penulis tidak diubah dari sini) */}
      {!modeEdit && (
        <section className={cardClass}>
          <h2 className="font-heading text-xl font-semibold text-[var(--color-text-ink)]">Tim Pelaksana</h2>
          <InputPenulis nilai={penulisTeks} onChange={setPenulisTeks} className={inputClass} />
        </section>
      )}

      {status && (
        <p
          role="status"
          className={cn("rounded-lg px-4 py-3 text-sm", status.ok ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]" : "bg-[var(--color-danger-bg)] text-[var(--color-danger-solid)]")}
        >
          {status.pesan}
        </p>
      )}

      {/* Aksi */}
      <div className="sticky bottom-0 -mx-6 flex items-center justify-between gap-3 border-t border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-6 py-4 shadow-sm">
        <Link href="/tridharma/publikasi" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-text-ink)] hover:text-[var(--color-text-ink)]">
          <ArrowLeft className="size-4" aria-hidden />
          Batal / Kembali ke Direktori
        </Link>
        <button
          type="submit"
          disabled={mengirim}
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-[var(--color-primary-strong)] px-5 text-sm font-semibold text-[var(--color-text-inverse)] hover:bg-[var(--color-primary)] disabled:opacity-60"
        >
          {mengirim ? (modeEdit ? "Menyimpan..." : "Mengirim...") : modeEdit ? "Simpan Perubahan" : "Ajukan Verifikasi"}
          <Send className="size-4" aria-hidden />
        </button>
      </div>
    </form>
  );
}
