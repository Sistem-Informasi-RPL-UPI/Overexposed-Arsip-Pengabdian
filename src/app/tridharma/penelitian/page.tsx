import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, Eye, Pencil, Plus, RotateCcw, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { getSession } from "@/lib/session";
import { getTridharmaPermissions } from "@/lib/rbac";
import { resolveTridharmaScope } from "@/lib/tridharma-scope";
import { getKegiatanList, PAGE_SIZE, rupiah } from "@/lib/penelitian";
import { getDaftarDosen } from "@/lib/tridharma-dashboard";
import KegiatanChart from "@/components/Tridharma/Penelitian/PenelitianCharts";
import SinkronButton from "@/components/Tridharma/Publikasi/SinkronButton";
import DaftarDosen from "@/components/Tridharma/DaftarDosen";
import HapusPenelitianButton from "@/components/Tridharma/Penelitian/HapusPenelitianButton";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/* ---------- Konfigurasi ---------- */

const BASE_PATH = "/tridharma/penelitian";
const FORM_PATH = "/tridharma/penelitian/formulir";
const FILTER_KEYS = ["q", "tahun", "skema", "dosen"] as const;
// Profil penulis di SINTA; ?view=researches membuka tab Researches
const SINTA_PROFIL = "https://sinta.kemdiktisaintek.go.id/authors/profile/";

type SearchParams = Record<string, string | string[] | undefined>;

const cardClass = "overflow-hidden rounded-xl bg-[var(--color-bg-surface)] shadow-sm";
const selectClass =
  "h-10 w-full appearance-none rounded-lg border-0 bg-[var(--color-tint-primary)] pl-3 pr-8 text-sm text-[var(--color-text-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-strong)]/40";
const pageBtn =
  "rounded-lg bg-[var(--color-tint-primary)] px-3 py-1.5 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-text-ink)]";

/* ---------- Helper ---------- */

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const toInt = (v: string | undefined) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

function buildHref(sp: SearchParams, page: number) {
  const query = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const v = first(sp[key])?.trim();
    if (v) query.set(key, v);
  }
  if (page > 1) query.set("page", String(page));
  const qs = query.toString();
  return qs ? `${BASE_PATH}?${qs}` : BASE_PATH;
}

function getPageList(current: number, total: number): (number | "...")[] {
  const set = new Set<number>([1, 2, 3, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "...")[] = [];
  sorted.forEach((n, i) => {
    if (i > 0 && n - sorted[i - 1] > 1) out.push("...");
    out.push(n);
  });
  return out;
}

const tanggalWib = (d: Date) =>
  d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " WIB";

/* ---------- Tabel (dipakai di mode "semua dosen" dan mode per dosen) ---------- */

type Rows = Awaited<ReturnType<typeof getKegiatanList>>["rows"];
type Session = Awaited<ReturnType<typeof getSession>>;

function TabelPenelitian({
  rows,
  startNo,
  session,
  kosong,
  headPy = "py-[22px]",
}: {
  rows: Rows;
  startNo: number;
  session: Session;
  kosong: string;
  headPy?: string;
}) {
  return (
    <Table className="min-w-[860px]">
      <TableHeader className="bg-[var(--color-tint-primary)] [&_tr]:border-0">
        <TableRow className="border-0 hover:bg-transparent">
          {["No", "Judul Penelitian", "Tahun", "Skema", "Dana", "Aksi"].map((h, i) => (
            <TableHead
              key={h}
              className={cn(
                "h-auto px-4 text-xs font-semibold uppercase leading-4 tracking-[0.6px] text-[var(--color-text-secondary)]",
                headPy,
                i === 0 && "w-14",
                i === 1 && "pr-6",
                i === 2 && "w-[90px]",
                i === 5 && "w-[130px] pr-6 text-right"
              )}
            >
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow className="border-0 hover:bg-transparent">
            <TableCell colSpan={6} className="py-12 text-center text-sm text-[var(--color-text-secondary)]">
              {kosong}
            </TableCell>
          </TableRow>
        )}
        {rows.map((r, i) => {
          // Izin per baris: edit/hapus hanya untuk Dosen/Kaprodi yang menjadi anggota tim kegiatan ini
          const rowPerms = getTridharmaPermissions(session, r.dosenIds);
          return (
            <TableRow key={r.id} className="h-[60px] border-0">
              <TableCell className="px-4 text-xs font-semibold text-[var(--color-text-ink)]">{startNo + i}</TableCell>
              <TableCell className="whitespace-normal py-5 pr-6 text-sm font-semibold leading-5 text-[var(--color-text-ink)]">
                {r.judul}
                {r.ketua && (
                  <span className="block text-xs font-normal leading-4 tracking-[0.24px] text-[var(--color-text-secondary)]">
                    Ketua: <span className="font-semibold text-[var(--color-text-ink)]">{r.ketua}</span>
                  </span>
                )}
              </TableCell>
              <TableCell className="px-4 text-xs font-semibold tracking-[0.24px] text-[var(--color-text-ink)]">
                {r.tahun ?? "-"}
              </TableCell>
              <TableCell className="px-4">
                {r.skema ? (
                  <span className="inline-block rounded-md bg-[var(--color-tint-secondary)] px-2.5 py-1 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-primary-strong)]">
                    {r.skema}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-text-muted)]">-</span>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap px-4 text-xs font-semibold tracking-[0.24px] text-[var(--color-text-secondary)]">
                {rupiah(r.dana)}
              </TableCell>
              <TableCell className="px-6">
                <div className="flex items-center justify-end gap-1">
                  {/* Lihat di SINTA (semua role). Tanpa ID SINTA, ikonnya dinonaktifkan seperti di Publikasi */}
                  {r.sintaId ? (
                    <a
                      href={`${SINTA_PROFIL}${encodeURIComponent(r.sintaId)}?view=researches`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Buka di SINTA: ${r.judul}`}
                      title="Buka di SINTA"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon" }),
                        "size-8 text-[var(--color-primary-strong)] hover:bg-[var(--color-tint-secondary)]"
                      )}
                    >
                      <Eye className="size-5" />
                    </a>
                  ) : (
                    <span className="flex size-8 items-center justify-center text-[var(--color-border-strong)]" aria-hidden>
                      <Eye className="size-5" />
                    </span>
                  )}
                  {rowPerms.canUpdate && (
                    <Link
                      href={`${FORM_PATH}?id=${r.id}`}
                      aria-label={`Edit penelitian: ${r.judul}`}
                      title="Edit"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "icon" }),
                        "size-8 text-[var(--color-text-secondary)] hover:bg-[var(--color-tint-secondary)]"
                      )}
                    >
                      <Pencil className="size-[18px]" />
                    </Link>
                  )}
                  {rowPerms.canDelete && <HapusPenelitianButton id={r.id} judul={r.judul} />}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ---------- Bagian yang butuh data (async) ---------- */

async function PenelitianContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const session = await getSession();

  // Aturan sama dengan Publikasi:
  // Dosen & Kaprodi → data sendiri. Role lain → pilih dosen dulu (?dosen=ID).
  const { personal, dosenParam, dosenId, belumTerhubung, milikSendiri, perluPilih } = resolveTridharmaScope(
    session,
    first(sp.dosen)
  );
  const perms = getTridharmaPermissions(session);
  // Tombol tarik data SINTA hanya untuk dosen yang melihat datanya sendiri
  const bisaSinkron = personal && milikSendiri;

  const page = toInt(first(sp.page)) ?? 1;
  // Mode "pilih dosen" (Mahasiswa/Staff/Umum): tanpa filter, gabungan SEMUA dosen
  // → dipakai untuk grafik + penelitian terbaru. Mode lain: sesuai filter di URL.
  const dataPromise = belumTerhubung
    ? Promise.resolve(null)
    : perluPilih
      ? getKegiatanList({ jenis: "penelitian", page: 1 })
      : getKegiatanList({
          jenis: "penelitian",
          q: first(sp.q)?.trim().slice(0, 100) || undefined,
          tahun: toInt(first(sp.tahun)),
          skema: first(sp.skema)?.trim() || undefined,
          dosenId,
          page,
        });
  // Daftar dosen tampil untuk SEMUA role (sama seperti Publikasi dan Dashboard)
  const [daftarSemua, data] = await Promise.all([getDaftarDosen(), dataPromise]);
  // Dosen yang login tidak perlu muncul di daftar (datanya sudah tampil sebagai miliknya)
  const daftarDosen = daftarSemua.filter((d) => d.id !== session?.dosen_id);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const from = !data || data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = data ? (page - 1) * PAGE_SIZE + data.rows.length : 0;

  return (
    <>
      {/* Header */}
      <section className={cn(cardClass, "flex flex-wrap items-center justify-between gap-4 p-6")}>
        <div>
          <h1 className="font-heading text-[28px] font-bold leading-9 tracking-[-0.7px] text-[var(--color-text-ink)]">
            Data Penelitian
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {perluPilih
              ? "Pilih dosen untuk melihat penelitiannya"
              : milikSendiri
                ? "Penelitian milik kamu"
                : data?.dosen?.nama
                  ? `Penelitian ${data.dosen.nama}`
                  : "Penelitian dosen"}
            {personal && dosenParam !== undefined && !milikSendiri && (
              <>
                {" · "}
                <Link href={BASE_PATH} className="font-semibold text-[var(--color-primary-strong)] underline">
                  Kembali ke penelitian saya
                </Link>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {data && (
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--color-tint-secondary)] text-[var(--color-primary-strong)]">
                <BookOpen className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase leading-[14px] tracking-[0.44px] text-[var(--color-text-secondary)]">
                  Total Penelitian
                </p>
                <p className="text-base font-semibold leading-6 text-[var(--color-text-ink)]">
                  {data.totalScope} Proposal &amp; Laporan
                </p>
              </div>
            </div>
          )}

          {/* Hanya Dosen & Kaprodi (rbac: canCreate). Mahasiswa/Staff/Umum hanya melihat. */}
          {perms.canCreate && (
            <Link
              href={FORM_PATH}
              className={cn(
                buttonVariants(),
                "h-auto gap-2 rounded-lg bg-[var(--color-primary-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--color-text-inverse)] shadow-sm hover:bg-[var(--color-primary)]"
              )}
            >
              <Plus className="size-3" aria-hidden />
              Tambah Penelitian
            </Link>
          )}
        </div>
      </section>

      {perluPilih ? (
        <>
          {/* Grafik gabungan semua dosen */}
          <section className={cn(cardClass, "p-4")}>
            <h2 className="mb-2 text-center text-sm font-semibold text-[var(--color-text-secondary)]">
              Jumlah penelitian per tahun (seluruh dosen)
            </h2>
            <KegiatanChart data={data?.grafik ?? []} label="penelitian" />
          </section>

          <DaftarDosen dosen={daftarDosen} hrefBase={`${BASE_PATH}?dosen=`} desc={`${daftarDosen.length} dosen`} />

          {/* Penelitian terbaru dari semua dosen */}
          <section className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--color-tint-primary)] px-4 py-3">
              <div className="flex items-center gap-2">
                <BookOpen className="size-[14px] text-[var(--color-primary-strong)]" aria-hidden />
                <h2 className="text-base font-bold leading-6 text-[var(--color-text-ink)]">Penelitian Terbaru</h2>
              </div>
              <p className="text-[13px] leading-[18px] text-[var(--color-text-secondary)]">
                {PAGE_SIZE} terbaru dari {data?.totalScope ?? 0} penelitian
              </p>
            </div>
            <TabelPenelitian
              rows={data?.rows ?? []}
              startNo={1}
              session={session}
              kosong="Belum ada data penelitian."
              headPy="py-4"
            />
          </section>
        </>
      ) : belumTerhubung || !data ? (
        <>
          <section className={cn(cardClass, "p-6 text-sm text-[var(--color-text-secondary)]")}>
            Akun ini belum terhubung ke data dosen, jadi penelitian pribadi belum bisa ditampilkan.
          </section>

          <DaftarDosen dosen={daftarDosen} hrefBase={`${BASE_PATH}?dosen=`} desc={`${daftarDosen.length} dosen`} />
        </>
      ) : (
        <>
          {/* Grafik */}
          <section className={cn(cardClass, "p-4")}>
            <h2 className="mb-2 text-center text-sm font-semibold text-[var(--color-text-secondary)]">
              Jumlah penelitian per tahun
            </h2>
            <KegiatanChart data={data.grafik} label="penelitian" />
          </section>

          <DaftarDosen dosen={daftarDosen} hrefBase={`${BASE_PATH}?dosen=`} desc={`${daftarDosen.length} dosen`} />

          {/* Tabel (filter ada di bagian atas kartu tabel: grafik → daftar dosen → tabel) */}
          <section className={cardClass}>
            <div className="p-4">
            <div className="flex flex-wrap items-start gap-3">
              <form method="get" action={BASE_PATH} className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                {dosenParam !== undefined && <input type="hidden" name="dosen" value={dosenParam} />}

                <div className="relative min-w-[220px] flex-1">
                  <Search
                    className="pointer-events-none absolute left-[14px] top-1/2 size-[15px] -translate-y-1/2 text-[var(--color-text-muted)]"
                    aria-hidden
                  />
                  <input
                    type="search"
                    name="q"
                    defaultValue={first(sp.q) ?? ""}
                    placeholder="Cari judul penelitian..."
                    aria-label="Cari penelitian"
                    className="h-10 w-full rounded-lg border-0 bg-[var(--color-tint-primary)] pl-10 pr-4 text-sm text-[var(--color-text-ink)] outline-none placeholder:text-[var(--color-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-strong)]/40"
                  />
                </div>

                {(
                  [
                    ["tahun", "Semua Tahun", data.opsi.tahun.map(String)],
                    ["skema", "Semua Skema", data.opsi.skema],
                  ] as const
                ).map(([name, label, options]) => (
                  <div key={name} className="relative w-full sm:w-[165px]">
                    <select name={name} defaultValue={first(sp[name]) ?? ""} aria-label={label} className={selectClass}>
                      <option value="">{label}</option>
                      {options.map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-[10px] top-1/2 size-[9px] -translate-y-1/2 text-[var(--color-text-secondary)]"
                      aria-hidden
                    />
                  </div>
                ))}

                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-primary-strong)] px-4 text-xs font-semibold tracking-[0.24px] text-[var(--color-text-inverse)] hover:bg-[var(--color-primary)]"
                >
                  <Search className="size-3.5" aria-hidden />
                  Cari
                </button>
                <Link
                  href={dosenParam !== undefined ? `${BASE_PATH}?dosen=${dosenParam}` : BASE_PATH}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[var(--color-tint-primary)] px-4 text-xs font-semibold tracking-[0.24px] text-[var(--color-text-secondary)] hover:bg-[var(--color-tint-secondary)]"
                >
                  <RotateCcw className="size-3" aria-hidden />
                  Reset
                </Link>
              </form>

              {bisaSinkron && <SinkronButton />}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--color-tint-primary)] px-4 py-2.5 text-xs font-semibold leading-4 tracking-[0.24px] text-[var(--color-text-ink)]">
              <p>
                Menampilkan {from}–{to} dari {data.total} data penelitian
              </p>
              {data.dosen && (
                <p className="font-normal text-[var(--color-text-secondary)]">
                  Terakhir sinkronisasi:{" "}
                  {data.dosen.last_synced_at ? tanggalWib(data.dosen.last_synced_at) : "belum pernah"}
                </p>
              )}
            </div>
            </div>

            <TabelPenelitian
              rows={data.rows}
              startNo={(page - 1) * PAGE_SIZE + 1}
              session={session}
              kosong="Belum ada penelitian yang cocok dengan filter ini."
            />

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--color-tint-primary)]/70 px-4 py-3.5">
              <p className="text-[13px] leading-[18px] text-[var(--color-text-secondary)]">
                Halaman {Math.min(page, totalPages)} dari {totalPages}
              </p>
              <nav aria-label="Halaman" className="flex items-center gap-1">
                {page > 1 ? (
                  <Link href={buildHref(sp, page - 1)} className={cn(pageBtn, "hover:bg-[var(--color-tint-secondary)]")}>
                    ‹ Sebelumnya
                  </Link>
                ) : (
                  <span className={cn(pageBtn, "opacity-50")}>‹ Sebelumnya</span>
                )}
                <div className="flex items-center gap-1 px-1">
                  {getPageList(page, totalPages).map((n, i) =>
                    n === "..." ? (
                      <span key={`gap-${i}`} className="w-6 text-center text-[13px] text-[var(--color-text-muted)]">
                        ...
                      </span>
                    ) : (
                      <Link
                        key={n}
                        href={buildHref(sp, n)}
                        aria-current={n === page ? "page" : undefined}
                        className={cn(
                          "flex size-8 items-center justify-center rounded-lg text-xs font-semibold tracking-[0.24px]",
                          n === page
                            ? "bg-[var(--color-primary-strong)] text-[var(--color-text-inverse)]"
                            : "bg-[var(--color-tint-primary)] text-[var(--color-text-ink)] hover:bg-[var(--color-tint-secondary)]"
                        )}
                      >
                        {n}
                      </Link>
                    )
                  )}
                </div>
                {page < totalPages ? (
                  <Link href={buildHref(sp, page + 1)} className={cn(pageBtn, "hover:bg-[var(--color-tint-secondary)]")}>
                    Selanjutnya ›
                  </Link>
                ) : (
                  <span className={cn(pageBtn, "opacity-50")}>Selanjutnya ›</span>
                )}
              </nav>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function PenelitianSkeleton() {
  return (
    <>
      <div className="h-[100px] animate-pulse rounded-xl bg-[var(--color-bg-surface)]" />
      <div className="h-[420px] animate-pulse rounded-xl bg-[var(--color-bg-surface)]" />
      <div className="h-[400px] animate-pulse rounded-xl bg-[var(--color-bg-surface)]" />
    </>
  );
}

/* ---------- Halaman ---------- */

export default function PenelitianPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex flex-col gap-6 px-6 pt-4">
        <Suspense fallback={<PenelitianSkeleton />}>
          <PenelitianContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
