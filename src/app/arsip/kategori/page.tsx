import { Suspense } from "react";
import KategoriArsipPage from "@/components/Arsip/Kategori/Kategoripage";
import { getArsipPermissions } from "@/lib/rbac";
import { getSession } from "@/lib/session";

async function KategoriContent() {
  const session = await getSession();
  const { canManageKategori } = getArsipPermissions(session);

  return <KategoriArsipPage canManage={canManageKategori} />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-[#444653]">
          Memuat halaman kategori arsip...
        </div>
      }
    >
      <KategoriContent />
    </Suspense>
  );
}
