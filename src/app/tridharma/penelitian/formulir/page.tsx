import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getTridharmaPermissions } from "@/lib/rbac";
import { getKegiatanDetail, getOpsiSkema } from "@/lib/kegiatan";
import FormulirPenelitian from "@/components/Tridharma/Penelitian/FormulirPenelitian";

type SearchParams = Record<string, string | string[] | undefined>;

const BASE_PATH = "/tridharma/penelitian";
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// Penjaga akses di sisi server (proxy.ts belum menganggap "formulir" sebagai halaman tulis):
//  - Tambah baru (tanpa ?id)  → hanya Dosen & Kaprodi
//  - Ubah (?id=)              → hanya Dosen/Kaprodi yang menjadi anggota tim penelitian itu
//  - Lihat (?id=&lihat=1)     → semua role; formulir tampil tanpa tombol ubah
async function FormGuard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const session = await getSession();

  const idNum = Number.parseInt(first(sp.id) ?? "", 10);
  const id = Number.isFinite(idNum) && idNum > 0 ? idNum : undefined;
  const lihat = first(sp.lihat) === "1";

  const opsiSkema = await getOpsiSkema("penelitian");

  // --- Data baru ---
  if (id === undefined) {
    const perms = getTridharmaPermissions(session);
    if (!perms.isAuthenticated) redirect("/login");
    if (!perms.canCreate) redirect("/akses-ditolak");

    return (
      <FormulirPenelitian
        ketua={{ nama: session?.name ?? "-", nip: session?.nip ?? null, role: perms.role }}
        readOnly={false}
        opsiSkema={opsiSkema}
        backHref={BASE_PATH}
      />
    );
  }

  // --- Data yang sudah ada ---
  const detail = await getKegiatanDetail(id, "penelitian");
  if (!detail) notFound();

  const perms = getTridharmaPermissions(session, detail.dosenIds);
  const readOnly = lihat || !perms.canUpdate;
  // Kalau yang sedang membuka adalah ketuanya sendiri, pakai NIP dari sesi
  const ketuaSendiri = detail.ketua?.nama === session?.name;

  return (
    <FormulirPenelitian
      ketua={{
        nama: detail.ketua?.nama ?? "-",
        nip: ketuaSendiri ? (session?.nip ?? null) : null,
        role: "Ketua Peneliti",
      }}
      awal={{
        id: detail.id,
        judul: detail.judul,
        tahun: detail.tahun,
        skema: detail.skema,
        sumberDana: detail.sumberDana,
        dana: detail.dana,
        anggota: detail.anggota,
      }}
      readOnly={readOnly}
      opsiSkema={opsiSkema}
      backHref={BASE_PATH}
    />
  );
}

export default function FormulirPenelitianPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <Suspense fallback={<div className="mx-6 mt-4 h-[600px] animate-pulse rounded-xl bg-[var(--color-bg-surface)]" />}>
        <FormGuard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
