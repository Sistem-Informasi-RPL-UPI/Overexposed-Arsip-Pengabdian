import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getTridharmaPermissions } from "@/lib/rbac";
import { getPublikasiUntukEdit } from "@/lib/publikasi";
import FormulirPublikasi from "@/components/Tridharma/Publikasi/FormulirPublikasi";

type SearchParams = Record<string, string | string[] | undefined>;

// Penjaga akses di sisi server. Hanya Dosen & Kaprodi yang boleh menambah data.
// Mode edit (?id=...): hanya pemilik publikasi tersebut.
async function FormGuard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const session = await getSession();
  const perms = getTridharmaPermissions(session);
  if (!perms.isAuthenticated) redirect("/login");
  if (!perms.canCreate) redirect("/akses-ditolak");

  const ketua = { nama: session?.name ?? "-", nip: session?.nip ?? null, role: perms.role };

  const idRaw = Array.isArray(sp.id) ? sp.id[0] : sp.id;
  if (idRaw === undefined) return <FormulirPublikasi ketua={ketua} />;

  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id) || id <= 0) notFound();

  const awal = await getPublikasiUntukEdit(id);
  if (!awal) notFound();
  if (!getTridharmaPermissions(session, awal.dosenIds).canUpdate) redirect("/akses-ditolak");

  return (
    <FormulirPublikasi
      ketua={ketua}
      awal={{
        id: awal.id,
        judul: awal.judul,
        tahun: awal.tahun,
        jurnal: awal.jurnal,
        jenis: awal.jenis,
        akreditasi: awal.akreditasi,
        doi: awal.doi,
      }}
    />
  );
}

export default function FormulirPublikasiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="flex flex-col gap-4 pb-6">
      <Suspense fallback={<div className="mx-6 mt-4 h-[600px] animate-pulse rounded-xl bg-[var(--color-bg-surface)]" />}>
        <FormGuard searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
