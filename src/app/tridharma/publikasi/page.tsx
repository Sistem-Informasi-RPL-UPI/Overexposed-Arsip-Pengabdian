import { Suspense } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, Eye, Pencil, Plus, RotateCcw, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { getSession } from "@/lib/session";
import { getTridharmaPermissions } from "@/lib/rbac";
import { resolveTridharmaScope } from "@/lib/tridharma-scope";
import { getPublikasiList, PAGE_SIZE } from "@/lib/publikasi";
import PublikasiChart from "@/components/Tridharma/Publikasi/PublikasiChart";
import SinkronButton from "@/components/Tridharma/Publikasi/SinkronButton";
import HapusPublikasiButton from "@/components/Tridharma/Publikasi/HapusPublikasiButton";
import DaftarDosen from "@/components/Tridharma/DaftarDosen";
import { getDaftarDosen } from "@/lib/tridharma-dashboard";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* ---------- Konfigurasi ---------- */

const BASE_PATH = "/tridharma/publikasi";
const FORM_PATH = "/tridharma/publikasi/formulir";
const FILTER_KEYS = ["q", "tahun", "jenis", "akreditasi", "dosen"] as const;

type SearchParams = Record<string, string | string[] | undefined>;

const cardClass = "overflow-hidden rounded-xl bg-[var(--color-bg-surface)] shadow-sm";
const selectClass =
  "h-10 w-full appearance-none rounded-lg border-0 bg-[var(--color-tint-primary)] pl-3 pr-8 text-sm text-[var(--color-text-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary-strong)]/40";

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
  const set = new Set<number>(
    [1, 2, 3, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total)
  );
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

/* ---------- Bagian yang butuh data (async) ---------- */

async function PublikasiContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const session = await getSession();
  const perms = getTridharmaPermissions(session);

  // Aturan "pilih dosen dulu" dipakai bersama semua halaman Tridharma (lib/tridharma-scope.ts)
  const { personal, dosenParam, dosenId, belumTerhubung, milikSendiri, perluPilih } = resolveTridharmaScope(
    session,
    first(sp.dosen)
  );
  // Tombol tarik data SINTA hanya untuk dosen yang melihat datanya sendiri
  const bisaSinkron = personal && milikSendiri;

  const page = toInt(first(sp.page)) ?? 1;
  // Mode "pilih dosen" (Mahasiswa/Staff/Umum): tanpa filter, gabungan SEMUA dosen
  // → dipakai untuk grafik + publikasi terbaru. Mode lain: sesuai filter di URL.
  const dataPromise = belumTerhubung
    ? Promise.resolve(null)
    : perluPilih
      ? getPublikasiList({ page: 1 })
      : getPublikasiList({
          q: first(sp.q)?.trim().slice(0, 100) || undefined,
          tahun: toInt(first(sp.tahun)),
          jenis: first(sp.jenis)?.trim() || undefined,
          akreditasi: first(sp.akreditasi)?.trim() || undefined,
          dosenId,
          page,
        });
  // Daftar dosen tampil untuk SEMUA role (Dosen/Kaprodi juga bisa melihat dosen lain)
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
            Data Publikasi
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {perluPilih
              ? "Publikasi seluruh dosen · pilih dosen di bawah untuk melihat per dosen"
              : milikSendiri
                ? "Publikasi milik kamu"
                : data?.dosen?.nama
                  ? `Publikasi ${data.dosen.nama}`
                  : "Publikasi dosen"}
            {personal && dosenParam !== undefined && !milikSendiri && (
              <>
                {" · "}
                <Link href={BASE_PATH} className="font-semibold text-[var(--color-primary-strong)] underline">
                  Kembali ke publikasi saya
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
                Total Publikasi
              </p>
              <p className="text-base font-semibold leading-6 text-[var(--color-text-ink)]">{data.totalScope} Artikel</p>
            </div>
          </div>
          )}

          {/* Hanya Dosen & Kaprodi (rbac: canCreate). Mahasiswa/Staff hanya melihat. */}
          {perms.canCreate && (
            <Link
              href={FORM_PATH}
              className={cn(
                buttonVariants(),
                "h-auto gap-2 rounded-lg bg-[var(--color-primary-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--color-text-inverse)] shadow-sm hover:bg-[var(--color-primary)]"
              )}
            >
              <Plus className="size-3" aria-hidden />
              Tambah Publikasi
            </Link>
          )}
        </div>
      </section>

      {perluPilih ? (
        <>
          {/* Grafik gabungan semua dosen */}
          <section className={cn(cardClass, "p-4")}>
            <h2 className="mb-2 text-center text-sm font-semibold text-[var(--color-text-secondary)]">
              Jumlah publikasi per tahun (seluruh dosen)
            </h2>
            <PublikasiChart data={data?.grafik ?? []} />
          </section>

          <DaftarDosen
            dosen={daftarDosen}
            hrefBase={`${BASE_PATH}?dosen=`}
            desc={`${daftarDosen.length} dosen`}
          />

          {/* Publikasi terbaru dari semua dosen */}
          <section className={cardClass}>
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--color-tint-primary)] px-4 py-3">
              <div className="flex items-center gap-2">
                <BookOpen className="size-[14px] text-[var(--color-primary-strong)]" aria-hidden />
                <h2 className="text-base font-bold leading-6 text-[var(--color-text-ink)]">Publikasi Terbaru</h2>
              </div>
              <p className="text-[13px] leading-[18px] text-[var(--color-text-secondary)]">
                5 terbaru dari {data?.totalScope ?? 0} publikasi
              </p>
            </div>
            <Table className="min-w-[860px]">
              <TableHeader className="bg-[var(--color-tint-primary)] [&_tr]:border-0">
                <TableRow className="border-0 hover:bg-transparent">
                  {["No", "Judul Publikasi", "Tahun", "Jurnal", "Akreditasi", "Aksi"].map((h, i) => (
                    <TableHead
                      key={h}
                      className={cn(
                        "h-auto px-4 py-4 text-xs font-semibold uppercase leading-4 tracking-[0.6px] text-[var(--color-text-secondary)]",
                        i === 0 && "w-14",
                        i === 1 && "pr-6",
                        i === 2 && "w-[90px]",
                        i === 5 && "w-[140px]"
                      )}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.rows.length ?? 0) === 0 && (
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={6} className="py-12 text-center text-sm text-[var(--color-text-secondary)]">
                      Belum ada data publikasi.
                    </TableCell>
                  </TableRow>
                )}
                {data?.rows.slice(0, 5).map((r, i) => (
                  <TableRow key={r.id} className="border-0">
                    <TableCell className="px-4 text-xs font-semibold text-[var(--color-text-ink)]">{i + 1}</TableCell>
                    <TableCell className="whitespace-normal py-4 pr-6 text-sm font-semibold leading-5 text-[var(--color-text-ink)]">
                      {r.judul}
                      <span className="block text-xs font-normal leading-4 tracking-[0.24px] text-[var(--color-text-secondary)]">
                        Dosen: {r.dosen.join(", ") || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 text-xs font-semibold tracking-[0.24px] text-[var(--color-text-ink)]">
                      {r.tahun ?? "-"}
                    </TableCell>
                    <TableCell className="whitespace-normal px-4 text-xs leading-4 tracking-[0.24px] text-[var(--color-text-ink)]">
                      {r.jurnal ?? "-"}
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex flex-wrap gap-1">
                        {[r.kuartil, r.akreditasi].filter(Boolean).map((a) => (
                          <span
                            key={a}
                            className="rounded-full bg-[var(--color-tint-sky)] px-2.5 py-1 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-text-ink)]"
                          >
                            {a}
                          </span>
                        ))}
                        {!r.kuartil && !r.akreditasi && <span className="text-xs text-[var(--color-text-muted)]">-</span>}
                      </div>
                    </TableCell>
                    <TableCell className="px-6">
                      <div className="flex items-center justify-end">
                        {r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Buka publikasi: ${r.judul}`}
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </>
      ) : belumTerhubung || !data ? (
        <>
        <section className={cn(cardClass, "p-6 text-sm text-[var(--color-text-secondary)]")}>
          Akun ini belum terhubung ke data dosen, jadi publikasi pribadi belum bisa ditampilkan.
        </section>

        <DaftarDosen
          dosen={daftarDosen}
          hrefBase={`${BASE_PATH}?dosen=`}
          desc={`${daftarDosen.length} dosen`}
        />
        </>
      ) : (
        <>
          {/* Grafik + filter */}
          <section className={cn(cardClass, "p-4")}>
            <h2 className="mb-2 text-center text-sm font-semibold text-[var(--color-text-secondary)]">Jumlah publikasi per tahun</h2>
            <PublikasiChart data={data.grafik} />
          </section>

          <DaftarDosen
            dosen={daftarDosen}
            hrefBase={`${BASE_PATH}?dosen=`}
            desc={`${daftarDosen.length} dosen`}
          />

          {/* Filter */}
          <section className={cn(cardClass, "p-4")}>
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
                    placeholder="Cari judul publikasi..."
                    aria-label="Cari publikasi"
                    className="h-10 w-full rounded-lg border-0 bg-[var(--color-tint-primary)] pl-10 pr-4 text-sm text-[var(--color-text-ink)] outline-none placeholder:text-[var(--color-text-muted)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary-strong)]/40"
                  />
                </div>

                {(
                  [
                    ["tahun", "Semua Tahun", data.opsi.tahun.map(String)],
                    ["jenis", "Semua Jenis", data.opsi.jenis],
                    ["akreditasi", "Semua Akreditasi", data.opsi.akreditasi],
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
                Menampilkan {from}–{to} dari {data.total} data publikasi
              </p>
              {data.dosen && (
                <p className="font-normal text-[var(--color-text-secondary)]">
                  Terakhir sinkronisasi:{" "}
                  {data.dosen.last_synced_at ? tanggalWib(data.dosen.last_synced_at) : "belum pernah"}
                </p>
              )}
            </div>
          </section>

          {/* Tabel */}
          <section className={cardClass}>
            <Table className="min-w-[860px]">
              <TableHeader className="bg-[var(--color-tint-primary)] [&_tr]:border-0">
                <TableRow className="border-0 hover:bg-transparent">
                  {["No", "Judul Publikasi", "Tahun", "Jurnal", "Akreditasi", "Aksi"].map((h, i) => (
                    <TableHead
                      key={h}
                      className={cn(
                        "h-auto px-4 py-[22px] text-xs font-semibold uppercase leading-4 tracking-[0.6px] text-[var(--color-text-secondary)]",
                        i === 0 && "w-14",
                        i === 1 && "pr-6",
                        i === 2 && "w-[90px]",
                        i === 5 && "w-[140px]"
                      )}
                    >
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.length === 0 && (
                  <TableRow className="border-0 hover:bg-transparent">
                    <TableCell colSpan={6} className="py-12 text-center text-sm text-[var(--color-text-secondary)]">
                      Belum ada publikasi yang cocok dengan filter ini.
                    </TableCell>
                  </TableRow>
                )}
                {data.rows.map((r, i) => (
                  <TableRow key={r.id} className="h-[60px] border-0">
                    <TableCell className="px-4 text-xs font-semibold text-[var(--color-text-ink)]">
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </TableCell>
                    <TableCell className="whitespace-normal py-5 pr-6 text-sm font-semibold leading-5 text-[var(--color-text-ink)]">
                      {r.judul}
                      <span className="block text-xs font-normal leading-4 tracking-[0.24px] text-[var(--color-text-secondary)]">
                        Dosen: {r.dosen.join(", ") || "-"}{r.jenis ? ` · ${r.jenis}` : ""}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 text-xs font-semibold tracking-[0.24px] text-[var(--color-text-ink)]">
                      {r.tahun ?? "-"}
                    </TableCell>
                    <TableCell className="whitespace-normal px-4 text-xs leading-4 tracking-[0.24px] text-[var(--color-text-ink)]">
                      {r.jurnal ?? "-"}
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex flex-wrap gap-1">
                        {[r.kuartil, r.akreditasi].filter(Boolean).map((a) => (
                          <span
                            key={a}
                            className="rounded-full bg-[var(--color-tint-sky)] px-2.5 py-1 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-text-ink)]"
                          >
                            {a}
                          </span>
                        ))}
                        {!r.kuartil && !r.akreditasi && <span className="text-xs text-[var(--color-text-muted)]">-</span>}
                      </div>
                    </TableCell>
                    <TableCell className="px-6">
                      <div className="flex items-center justify-end gap-1">
                        {r.url ? (
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Buka publikasi: ${r.judul}`}
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
                        {/* Edit & hapus: hanya pemilik (Dosen/Kaprodi atas publikasinya sendiri) */}
                        {getTridharmaPermissions(session, r.dosenIds).canUpdate && (
                          <Link
                            href={`${FORM_PATH}?id=${r.id}`}
                            aria-label={`Edit publikasi: ${r.judul}`}
                            title="Edit"
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "icon" }),
                              "size-8 text-[var(--color-text-secondary)] hover:bg-[var(--color-tint-secondary)]"
                            )}
                          >
                            <Pencil className="size-5" />
                          </Link>
                        )}
                        {getTridharmaPermissions(session, r.dosenIds).canDelete && (
                          <HapusPublikasiButton id={r.id} judul={r.judul} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--color-tint-primary)]/70 px-4 py-3.5">
              <p className="text-[13px] leading-[18px] text-[var(--color-text-secondary)]">
                Halaman {Math.min(page, totalPages)} dari {totalPages}
              </p>
              <nav aria-label="Halaman" className="flex items-center gap-1">
                {page > 1 ? (
                  <Link
                    href={buildHref(sp, page - 1)}
                    className="rounded-lg bg-[var(--color-tint-primary)] px-3 py-1.5 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-text-ink)] hover:bg-[var(--color-tint-secondary)]"
                  >
                    ‹ Sebelumnya
                  </Link>
                ) : (
                  <span className="rounded-lg bg-[var(--color-tint-primary)] px-3 py-1.5 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-text-muted)] opacity-50">
                    ‹ Sebelumnya
                  </span>
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
                          n === page ? "bg-[var(--color-primary-strong)] text-[var(--color-text-inverse)]" : "bg-[var(--color-tint-primary)] text-[var(--color-text-ink)] hover:bg-[var(--color-tint-secondary)]"
                        )}
                      >
                        {n}
                      </Link>
                    )
                  )}
                </div>
                {page < totalPages ? (
                  <Link
                    href={buildHref(sp, page + 1)}
                    className="rounded-lg bg-[var(--color-tint-primary)] px-3 py-1.5 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-text-ink)] hover:bg-[var(--color-tint-secondary)]"
                  >
                    Selanjutnya ›
                  </Link>
                ) : (
                  <span className="rounded-lg bg-[var(--color-tint-primary)] px-3 py-1.5 text-[11px] font-bold leading-[14px] tracking-[0.44px] text-[var(--color-text-muted)] opacity-50">
                    Selanjutnya ›
                  </span>
                )}
              </nav>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function PublikasiSkeleton() {
  return (
    <>
      <div className="h-[100px] animate-pulse rounded-xl bg-[var(--color-bg-surface)]" />
      <div className="h-[420px] animate-pulse rounded-xl bg-[var(--color-bg-surface)]" />
      <div className="h-[400px] animate-pulse rounded-xl bg-[var(--color-bg-surface)]" />
    </>
  );
}

/* ---------- Halaman ---------- */

export default function PublikasiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex flex-col gap-6 px-6 pt-4">
        <Suspense fallback={<PublikasiSkeleton />}>
          <PublikasiContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
