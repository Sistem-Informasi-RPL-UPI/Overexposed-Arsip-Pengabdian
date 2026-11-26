"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RefreshCw, RotateCcw, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { PAGE_SIZES } from "@/lib/kegiatan-config";

const selectClass =
  "h-10 rounded-lg bg-[#f2f3ff] px-3 text-sm font-semibold text-[#131b2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00288e]/40";

// Semua filter disimpan di URL (?q=&tahun=&status=&page=&pageSize=), jadi halaman
// tetap server component dan hasilnya bisa di-bookmark.
function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const push = useCallback(
    (ubah: (p: URLSearchParams) => void, resetPage = true) => {
      const p = new URLSearchParams(sp.toString());
      ubah(p);
      if (resetPage) p.delete("page");
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [sp, router, pathname],
  );

  return { sp, push, router, pathname };
}

export function FilterBar({
  tahunOptions,
  statusOptions,
  syncEndpoint,
}: {
  tahunOptions: number[];
  statusOptions: string[];
  syncEndpoint: string | null; // null = role ini tidak boleh menarik data
}) {
  const { sp, push, router, pathname } = useUrlParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [syncing, setSyncing] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);

  // Debounce pencarian supaya tidak query tiap ketukan.
  useEffect(() => {
    const t = setTimeout(() => {
      if (q !== (sp.get("q") ?? "")) push((p) => (q ? p.set("q", q) : p.delete("q")));
    }, 400);
    return () => clearTimeout(t);
  }, [q, sp, push]);

  const setParam = (key: string, value: string) => push((p) => (value ? p.set(key, value) : p.delete(key)));

  async function tarikSinta() {
    if (!syncEndpoint) return;
    setSyncing(true);
    setPesan(null);
    try {
      const res = await fetch(syncEndpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setPesan({
        ok: res.ok,
        teks: body?.message ?? (res.ok ? "Sinkronisasi dimulai." : `Gagal menarik data (HTTP ${res.status}).`),
      });
      if (res.ok) router.refresh();
    } catch {
      setPesan({ ok: false, teks: "Tidak bisa menghubungi server." });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-lg bg-[#f2f3ff] px-3">
          <Search className="size-4 shrink-0 text-[#757684]" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari judul pengabdian..."
            aria-label="Cari judul pengabdian"
            className="w-full bg-transparent text-sm text-[#131b2e] placeholder:text-[#757684] focus:outline-none"
          />
        </label>

        <select aria-label="Filter tahun" className={selectClass} value={sp.get("tahun") ?? ""} onChange={(e) => setParam("tahun", e.target.value)}>
          <option value="">Semua Tahun</option>
          {tahunOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select aria-label="Filter status" className={selectClass} value={sp.get("status") ?? ""} onChange={(e) => setParam("status", e.target.value)}>
          <option value="">Semua Status</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => {
            setQ("");
            router.replace(pathname);
          }}
          className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-[#444653] hover:bg-[#f2f3ff]"
        >
          <RotateCcw className="size-4" aria-hidden /> Reset
        </button>

        {syncEndpoint && (
          <button
            type="button"
            onClick={tarikSinta}
            disabled={syncing}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#e2e7ff] px-3 text-sm font-semibold text-[#00288e] hover:bg-[#d3dafc] disabled:opacity-60"
          >
            <RefreshCw className={cn("size-4", syncing && "animate-spin")} aria-hidden />
            {syncing ? "Menarik..." : "Tarik Data SINTA"}
          </button>
        )}
      </div>

      {pesan && (
        <p role="status" className={cn("mt-3 text-sm", pesan.ok ? "text-[#1b6d3a]" : "text-[#ba1a1a]")}>
          {pesan.teks}
        </p>
      )}
    </div>
  );
}

export function PageSizeSelect({ value }: { value: number }) {
  const { push } = useUrlParams();
  return (
    <select
      aria-label="Baris per halaman"
      value={value}
      onChange={(e) => push((p) => p.set("pageSize", e.target.value))}
      className="h-8 rounded-md bg-[#f2f3ff] px-2 text-sm font-semibold text-[#131b2e]"
    >
      {PAGE_SIZES.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}
