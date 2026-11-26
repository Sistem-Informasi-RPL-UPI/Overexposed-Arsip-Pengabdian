import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  label: string; // "Penelitian"
  total: string; // "14 Total" (badge kanan atas)
  value: string; // "14"
  unit: string; // "Kegiatan"
  notes?: string[]; // baris kecil di bawah kartu
};

// Ukuran & warna mengikuti halaman Daftar Arsip
export default function StatCard({ icon: Icon, label, total, value, unit, notes }: Props) {
  return (
    <div className="flex min-h-[200px] flex-col rounded-xl bg-[var(--color-bg-surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-tint-primary)] text-[var(--color-primary-strong)]">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="rounded-full bg-[var(--color-tint-secondary)] px-2 py-1 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-primary-strong)]">
          {total}
        </span>
      </div>

      <p className="mt-4 text-xs font-semibold leading-4 tracking-[0.24px] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 font-heading text-[28px] font-bold leading-9 tracking-[-0.7px] text-[var(--color-text-ink)]">
        {value} {unit}
      </p>

      {notes && notes.length > 0 && (
        <ul className="mt-auto pt-4 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-text-muted)]">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
