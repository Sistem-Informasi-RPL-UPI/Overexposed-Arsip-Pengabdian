import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";

type Dosen = { id: number; nama: string | null; departemen: string | null };

function inisial(nama: string) {
  return nama
    .replace(/^(dr|prof|ir)\.?\s*/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

// Daftar dosen yang bisa diklik (dipakai Mahasiswa/Staff/Umum untuk memilih dosen)
export default function DaftarDosen({
  dosen,
  hrefBase,
  desc,
}: {
  dosen: Dosen[];
  hrefBase: string; // contoh: "/tridharma/publikasi?dosen=" (id ditambahkan di belakangnya)
  desc?: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-[var(--color-bg-surface)] shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--color-tint-primary)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Users className="size-[14px] text-[var(--color-primary-strong)]" aria-hidden />
          <h2 className="text-base font-bold leading-6 text-[var(--color-text-ink)]">Pilih Dosen</h2>
        </div>
        <p className="text-[13px] leading-[18px] text-[var(--color-text-secondary)]">{desc ?? `${dosen.length} dosen`}</p>
      </div>

      {dosen.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-text-secondary)]">Belum ada data dosen.</p>
      ) : (
        <ul className="grid max-h-[264px] grid-cols-1 gap-2 overflow-y-auto p-4 sm:grid-cols-2 xl:grid-cols-3">
          {dosen.map((d) => (
            <li key={d.id}>
              <Link
                href={`${hrefBase}${d.id}`}
                className="flex items-center gap-3 rounded-lg bg-[var(--color-tint-primary)] p-3 hover:bg-[var(--color-tint-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-strong)]/40"
              >
                <span
                  aria-hidden
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-tint-secondary)] text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-primary-strong)]"
                >
                  {inisial(d.nama ?? "?")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold leading-5 text-[var(--color-text-ink)]">{d.nama}</span>
                  <span className="block truncate text-xs leading-4 tracking-[0.24px] text-[var(--color-text-secondary)]">
                    {d.departemen ?? "Rekayasa Perangkat Lunak"}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
