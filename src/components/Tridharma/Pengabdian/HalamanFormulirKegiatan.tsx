import { redirect } from "next/navigation";

import FormulirKegiatan from "@/components/Tridharma/Pengabdian/FormulirKegiatan";
import { getTridharmaPermissions } from "@/lib/rbac";
import { getSession } from "@/lib/session";
import { getDosenProfil } from "@/lib/tridharma-dashboard";

/**
 * Isi halaman /tridharma/{penelitian|pengabdian}/tambah.
 * Harus dirender di dalam <Suspense> karena membaca cookie sesi.
 */
export default async function HalamanFormulirKegiatan({ jenis }: { jenis: "penelitian" | "pengabdian" }) {
  const session = await getSession();

  // proxy.ts sudah memblokir peran lain (segmen "tambah" = aksi tulis); ini lapisan kedua.
  if (!session || !getTridharmaPermissions(session).canCreate) {
    redirect("/akses-ditolak");
  }

  if (session.dosen_id === null) {
    return (
      <div className="mx-auto w-full max-w-[1280px] p-8">
        <section className="rounded-xl bg-white p-6 text-sm text-[#444653] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          Akun ini belum terhubung ke data dosen. Isi SINTA ID terlebih dahulu agar data {jenis} bisa ditambahkan.
        </section>
      </div>
    );
  }

  const profil = await getDosenProfil(session.dosen_id);

  return <FormulirKegiatan jenis={jenis} namaPenulisUtama={profil?.nama ?? session.name} draftKey={`draf-${jenis}:${session.sub}`} />;
}
