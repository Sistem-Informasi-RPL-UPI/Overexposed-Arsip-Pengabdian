import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  label: string; // "Penelitian"
  total: string; // "14 Total" (badge kanan atas)
  value: string; // "14"
  unit: string; // "Kegiatan"
  notes?: string[]; // baris kecil di bawah kartu
};

export default function StatCard({ icon: Icon, label, total, value, unit, notes }: Props) {
  return (
    <div className="flex min-h-[200px] flex-col rounded-[18px] bg-[var(--color-bg-surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[var(--color-tint-primary)] text-[var(--color-primary)]">
          <Icon size={20} aria-hidden="true" />
        </span>
        <span className="rounded-full bg-[var(--color-tint-sky)] px-2 py-0.5 text-[13px] font-bold text-[var(--color-primary-strong)]">
          {total}
        </span>
      </div>

      <p className="mt-4 text-[13px] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-lexend)] text-[24px] font-bold leading-[1.1] text-[var(--color-text-primary)]">
        {value} {unit}
      </p>

      {notes && notes.length > 0 && (
        <ul className="mt-auto pt-4 text-[13px] text-[var(--color-text-muted)]">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
