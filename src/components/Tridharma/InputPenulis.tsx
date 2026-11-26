"use client";

import { cn } from "@/lib/utils";

// Ubah teks "Penulis A; Penulis B; Penulis C" menjadi daftar nama (urutan dipertahankan)
export function parsePenulis(teks: string): string[] {
  return teks
    .split(";")
    .map((n) => n.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

// Isian penulis dalam SATU baris, dipisah titik koma (;).
// Dipakai formulir publikasi dan penelitian.
export default function InputPenulis({
  id = "penulis",
  nilai,
  onChange,
  terkunci = false,
  catatan,
  className,
}: {
  id?: string;
  nilai: string;
  onChange: (v: string) => void;
  terkunci?: boolean; // true = hanya menampilkan
  catatan?: string; // kalimat tambahan di bawah contoh
  className: string; // kelas input dari formulir (supaya tampilannya sama)
}) {
  const daftar = parsePenulis(nilai);

  return (
    <div className="mt-5 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-bold leading-5 text-[var(--color-text-ink)]">
        Penulis {!terkunci && <span className="text-[var(--color-danger-solid)]">*</span>}
      </label>
      <input
        id={id}
        name={id}
        value={nilai}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.preventDefault(); // Enter tidak mengirim formulir saat mengetik nama
        }}
        disabled={terkunci}
        maxLength={1000}
        placeholder="Penulis A; Penulis B; Penulis C"
        className={className}
      />
      {!terkunci && (
        <p className="text-xs leading-4 text-[var(--color-text-ink)]">
          Tulis semua penulis dalam satu baris, pisahkan dengan titik koma (;). Urutan penulisan menentukan urutan penulis: nama
          paling kiri adalah penulis pertama. {catatan}
          <span className="block font-semibold">Contoh: Penulis A; Penulis B; Penulis C</span>
        </p>
      )}

      {daftar.length > 0 && (
        <ol className="mt-1 flex flex-wrap gap-2" aria-label="Urutan penulis">
          {daftar.map((nama, i) => (
            <li
              key={`${nama}-${i}`}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-surface)] px-3 py-1.5 text-xs"
            >
              <span className="rounded-full bg-[var(--color-tint-sky)] px-2 py-0.5 text-[11px] font-bold tracking-[0.44px] text-[var(--color-text-ink)] ring-1 ring-inset ring-[var(--color-primary-strong)]/25">
                Penulis {i + 1}
              </span>
              <span className={cn("font-semibold text-[var(--color-text-ink)]")}>{nama}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
