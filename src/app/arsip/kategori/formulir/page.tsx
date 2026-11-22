// app/(dashboard)/arsip/kategori/formulir/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import FormulirKategoriArsip, {
  type FormKategoriArsipValues,
} from "@/components/Arsip/Kategori/FormulirKategoriArsip";

export default function Page() {
  const [success, setSuccess] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0); // untuk mengosongkan form setelah sukses

  async function handleSubmit(values: FormKategoriArsipValues) {
    setSuccess(false);

    const res = await fetch("/api/arsip/kategori", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kode: values.kode,
        nama: values.nama,
        retensi_aktif_tahun: values.retensiAktif,
        retensi_inaktif_tahun: values.retensiInaktif,
      }),
    });

    const text = await res.text();
    console.log("POST /api/arsip/kategori ->", res.status, text);

    let data: { message?: string } | null = null;
    try {
      data = JSON.parse(text);
    } catch {
      // response bukan JSON
    }

    if (!res.ok) {
      throw new Error(data?.message ?? `Gagal menyimpan (status ${res.status}).`);
    }

    setSuccess(true);
    setFormKey((k) => k + 1); // reset isi form
  }

  return (
    <div className="flex min-h-full flex-col">
      {success && (
        <div className="mx-auto w-full max-w-[1280px] px-8 pt-8">
          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="size-4" />
              Kategori berhasil disimpan.
            </span>
            <Link
              href="/arsip/kategori"
              className="font-semibold underline underline-offset-2"
            >
              Lihat daftar kategori
            </Link>
          </div>
        </div>
      )}

      <FormulirKategoriArsip
        key={formKey}
        onSubmit={handleSubmit}
        onCancel={() => {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = "/arsip/kategori";
        }}
      />
    </div>
  );
}