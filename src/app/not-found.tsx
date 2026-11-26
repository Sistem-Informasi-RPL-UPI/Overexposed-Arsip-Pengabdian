import Link from "next/link";

export default function NotFoundPage() {
  return (
    <section className="flex min-h-[calc(100vh-4rem)] w-full flex-col items-center justify-center bg-[#faf8ff] px-4 py-12 font-(family-name:--font-plus-jakarta)">
      <div className="w-full max-w-lg rounded-[18px] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-8 text-center shadow-[0px_4px_20px_rgba(11,42,76,0.06)]">
        <span className="inline-block rounded-[6px] bg-[var(--color-tint-primary)] px-3 py-1 text-[12px] font-bold uppercase tracking-[0.6px] text-[var(--color-primary-strong)]">
          404 Halaman Tidak Ditemukan
        </span>

        <h1 className="mt-4 font-[family-name:var(--font-lexend)] text-[26px] font-bold leading-[32px] text-[var(--color-text-primary)]">
          Halaman yang Anda cari belum tersedia
        </h1>

        <p className="mt-2.5 text-[14px] leading-[22px] text-[var(--color-text-secondary)]">
          Alamat URL yang Anda buka tidak ditemukan atau belum dibuat pada
          portal Sistem Informasi RPL.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/arsip/dashboard"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] bg-[var(--color-primary-strong)] px-5 py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
          >
            Ke Dashboard Arsip
          </Link>
          <Link
            href="/tridharma"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[12px] border border-[var(--color-border-strong)] bg-white px-5 py-2.5 text-[14px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)]"
          >
            Ke Halaman Tridharma
          </Link>
        </div>
      </div>
    </section>
  );
}
