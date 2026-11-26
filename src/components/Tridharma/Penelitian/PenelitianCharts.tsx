type Point = { tahun: number; jumlah: number };

// Grafik area sederhana (SVG murni, tanpa library): jumlah kegiatan per tahun (penelitian / pengabdian).
// Ukuran & gaya disamakan dengan PublikasiChart.
export default function KegiatanChart({ data, label = "kegiatan" }: { data: Point[]; label?: string }) {
  const pts = data.slice(-6);
  if (pts.length === 0) {
    return <p className="py-8 text-center text-sm text-[var(--color-text-secondary)]">Belum ada data untuk grafik.</p>;
  }

  const W = 1000, H = 170, L = 32, R = 24, T = 24, B = 28;
  const max = Math.max(...pts.map((p) => p.jumlah), 1);
  const step = Math.ceil(max / 4);
  const yMax = step * 4;
  const x = (i: number) => (pts.length === 1 ? L + (W - L - R) / 2 : L + (i * (W - L - R)) / (pts.length - 1));
  const y = (v: number) => T + (H - T - B) * (1 - v / yMax);

  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.jumlah)}`).join(" ");
  const area = `${line} L${x(pts.length - 1)},${y(0)} L${x(0)},${y(0)} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Jumlah ${label} per tahun: ${pts.map((p) => `${p.tahun} ada ${p.jumlah}`).join(", ")}`}
      className="h-auto w-full"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(i * step)} y2={y(i * step)} style={{ stroke: "var(--color-tint-secondary)" }} />
          <text x={L - 6} y={y(i * step) + 4} textAnchor="end" fontSize="11" style={{ fill: "var(--color-text-muted)" }}>
            {i * step}
          </text>
        </g>
      ))}
      <path d={area} style={{ fill: "var(--color-tint-sky)" }} />
      <path d={line} fill="none" strokeWidth="2" strokeLinejoin="round" style={{ stroke: "var(--color-primary-strong)" }} />
      {pts.map((p, i) => (
        <g key={p.tahun}>
          <circle cx={x(i)} cy={y(p.jumlah)} r="3.5" style={{ fill: "var(--color-primary-strong)" }} />
          <text x={x(i)} y={y(p.jumlah) - 10} textAnchor="middle" fontSize="12" fontWeight="600" style={{ fill: "var(--color-text-ink)" }}>
            {p.jumlah}
          </text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" style={{ fill: "var(--color-text-secondary)" }}>
            {p.tahun}
          </text>
        </g>
      ))}
    </svg>
  );
}
