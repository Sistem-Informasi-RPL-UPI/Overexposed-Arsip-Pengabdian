// Grafik area "Latest number of activities". SVG murni, tanpa library.
type Titik = { tahun: number; jumlah: number };

export default function AktivitasChart({ data }: { data: Titik[] }) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-[#444653]">Belum ada data untuk grafik.</p>;
  }

  // Tahun yang kosong diisi 0 supaya sumbu X tidak loncat.
  const peta = new Map(data.map((d) => [d.tahun, d.jumlah]));
  const awal = data[0].tahun;
  const akhir = data[data.length - 1].tahun;
  const titik: Titik[] = [];
  for (let t = awal; t <= akhir; t++) titik.push({ tahun: t, jumlah: peta.get(t) ?? 0 });

  const W = 900, H = 170, L = 36, R = 24, T = 34, B = 28;
  const maks = Math.max(...titik.map((p) => p.jumlah), 1);
  const x = (i: number) => (titik.length === 1 ? W / 2 : L + (i * (W - L - R)) / (titik.length - 1));
  const y = (v: number) => T + (1 - v / maks) * (H - T - B);
  const dasar = H - B;

  let garis = `M ${x(0)} ${y(titik[0].jumlah)}`;
  for (let i = 1; i < titik.length; i++) {
    const tengah = (x(i - 1) + x(i)) / 2;
    garis += ` C ${tengah} ${y(titik[i - 1].jumlah)}, ${tengah} ${y(titik[i].jumlah)}, ${x(i)} ${y(titik[i].jumlah)}`;
  }
  const area = `${garis} L ${x(titik.length - 1)} ${dasar} L ${x(0)} ${dasar} Z`;

  return (
    <figure className="rounded-lg bg-[#f6f6fb] px-2 pt-3">
      <figcaption className="text-center text-sm font-semibold text-[#444653]">Latest number of activities</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Jumlah pengabdian per tahun" className="h-auto w-full">
        <line x1={L} x2={W - R} y1={dasar} y2={dasar} stroke="#c4c5d5" />
        <path d={area} fill="#f5d36a" fillOpacity={0.3} />
        <path d={garis} fill="none" stroke="#f2c94c" strokeWidth={2} />
        {titik.map((p, i) => (
          <g key={p.tahun}>
            <circle cx={x(i)} cy={y(p.jumlah)} r={2.5} fill="#fff" stroke="#35c4d6" />
            {p.jumlah > 0 && (
              <text x={x(i)} y={y(p.jumlah) - 8} textAnchor="middle" fontSize={11} fill="#35c4d6">
                {p.jumlah}
              </text>
            )}
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="#00288e">
              {p.tahun}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  );
}
