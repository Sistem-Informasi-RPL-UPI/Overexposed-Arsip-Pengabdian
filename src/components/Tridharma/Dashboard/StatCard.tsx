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
    <div className="flex min-h-[200px] flex-col rounded-xl bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-10 items-center justify-center rounded-lg bg-[#eaedff] text-[#00288e]">
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="rounded-full bg-[#e2e7ff] px-2 py-1 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[#00288e]">
          {total}
        </span>
      </div>

      <p className="mt-4 text-xs font-semibold leading-4 tracking-[0.24px] text-[#444653]">{label}</p>
      <p className="mt-1 font-[family-name:var(--font-lexend)] text-[28px] font-bold leading-9 tracking-[-0.7px] text-[#131b2e]">
        {value} {unit}
      </p>

      {notes && notes.length > 0 && (
        <ul className="mt-auto pt-4 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[#757684]">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
