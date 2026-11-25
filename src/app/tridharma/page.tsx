import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import type { BukuTestItem } from "@/components/BukuTestPanel";
import type { IprsTestItem } from "@/components/IprsTestPanel";
import type { KegiatanTestItem } from "@/components/KegiatanTestPanel";
import type {
  BerkasPengajaranTestItem,
  KelasTestItem,
  MatkulTestItem,
} from "@/components/PengajaranTestPanel";
import type { PublikasiTestItem } from "@/components/PublikasiTestPanel";
import { TridharmaTestTabs } from "@/components/TridharmaTestTabs";
import { db } from "@/lib/db";
import { getPengajaranPermissions, getTridharmaPermissions } from "@/lib/rbac";
import { getSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Tridharma | Sistem Informasi RPL",
  description: "Halaman pengujian RBAC modul Tridharma Dosen.",
};

function PermissionItem({
  label,
  allowed,
}: {
  label: string;
  allowed: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--color-border-default)] bg-white px-4 py-3 text-[13px]">
      <span className="font-medium text-[var(--color-text-primary)]">
        {label}
      </span>
      <span
        className={`rounded-[6px] px-2.5 py-1 text-[11px] font-bold tracking-[0.44px] ${
          allowed
            ? "bg-[var(--color-success-bg)] text-[var(--color-success-text)]"
            : "bg-[var(--color-tint-neutral)] text-[var(--color-text-secondary)]"
        }`}
      >
        {allowed ? "Diizinkan" : "Ditolak"}
      </span>
    </li>
  );
}

async function TridharmaContent() {
  const session = await getSession();
  const ownPerms = getTridharmaPermissions(session);
  const otherPerms = getTridharmaPermissions(session, -1);
  const pengajaranPerms = getPengajaranPermissions(session);

  const dosenRow = session
    ? await db.dosen.findUnique({
        where: { user_id: session.sub },
        select: { id: true, nama: true },
      })
    : null;

  // TODO(PRD 12 #15): Sampai keputusan terbuka #15 ditetapkan, Dosen hanya melihat kelas & berkas miliknya sendiri.
  const kelasWhere =
    pengajaranPerms.role === "Dosen"
      ? { dosen_id: dosenRow?.id ?? -1 }
      : {};
  const berkasWhere =
    pengajaranPerms.role === "Dosen"
      ? { kelas: { dosen_id: dosenRow?.id ?? -1 } }
      : {};

  const [
    rawPublikasi,
    rawKegiatan,
    rawIprs,
    rawBuku,
    rawMatkul,
    rawKelas,
    rawBerkas,
  ] = await Promise.all([
    db.publikasi.findMany({
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        judul_hash: true,
        judul: true,
        tahun: true,
        penulis: true,
        jurnal: true,
        sitasi: true,
        link: true,
        kuartil: true,
        jenis: true,
        penerbit: true,
        doi: true,
        akreditasi: true,
        sumber: true,
        publikasi_dosen: {
          select: { dosen_id: true, source: true },
        },
      },
    }),
    db.kegiatan.findMany({
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        kunci: true,
        jenis: true,
        judul: true,
        tahun: true,
        skema: true,
        dana_nominal: true,
        sumber_dana: true,
        sumber: true,
        anggota: {
          orderBy: [{ peran: "asc" }, { nama: "asc" }],
          select: { nama: true, peran: true, dosen_id: true },
        },
      },
    }),
    db.iprs.findMany({
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        kunci: true,
        judul: true,
        jenis: true,
        tahun: true,
        nomor_permohonan: true,
        status: true,
        pemegang: true,
        inventor: true,
        sumber: true,
        iprs_dosen: {
          select: { dosen_id: true },
        },
      },
    }),
    db.buku.findMany({
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        kunci: true,
        judul: true,
        kategori: true,
        penulis: true,
        penerbit: true,
        tahun: true,
        tempat_terbit: true,
        isbn: true,
        sumber: true,
        buku_dosen: {
          select: { dosen_id: true },
        },
      },
    }),
    pengajaranPerms.canViewPengajaran
      ? db.matkul.findMany({
          orderBy: [{ kode: "asc" }, { id: "asc" }],
          take: 50,
          select: {
            id: true,
            kode: true,
            nama: true,
            sks: true,
            _count: { select: { kelas: true } },
          },
        })
      : Promise.resolve([]),
    pengajaranPerms.canViewPengajaran
      ? db.kelas.findMany({
          where: kelasWhere,
          orderBy: [{ tahun_ajaran: "desc" }, { id: "desc" }],
          take: 50,
          select: {
            id: true,
            matkul_id: true,
            dosen_id: true,
            tahun_ajaran: true,
            semester: true,
            matkul: { select: { kode: true, nama: true } },
            dosen: { select: { nama: true } },
            _count: { select: { berkas: true } },
          },
        })
      : Promise.resolve([]),
    pengajaranPerms.canViewPengajaran
      ? db.berkasPengajaran.findMany({
          where: berkasWhere,
          orderBy: [{ updated_at: "desc" }, { id: "desc" }],
          take: 50,
          select: {
            id: true,
            kelas_id: true,
            jenis: true,
            judul: true,
            link: true,
            keterangan: true,
            kelas: {
              select: {
                dosen_id: true,
                tahun_ajaran: true,
                semester: true,
                matkul: { select: { kode: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
  ]);

  const publikasiItems: PublikasiTestItem[] = rawPublikasi.map(
    ({ publikasi_dosen, ...publikasi }) => ({
      ...publikasi,
      sources: [...new Set(publikasi_dosen.map((row) => row.source))],
      dosenIds: [...new Set(publikasi_dosen.map((row) => row.dosen_id))],
    }),
  );

  const kegiatanItems: KegiatanTestItem[] = rawKegiatan.map(
    ({ anggota, dana_nominal, ...kegiatan }) => ({
      ...kegiatan,
      dana_nominal: Number(dana_nominal),
      anggota,
      dosenIds: anggota.flatMap((row) =>
        row.dosen_id !== null ? [row.dosen_id] : [],
      ),
    }),
  );

  const iprsItems: IprsTestItem[] = rawIprs.map(({ iprs_dosen, ...iprs }) => ({
    ...iprs,
    dosenIds: iprs_dosen.map((row) => row.dosen_id),
  }));

  const bukuItems: BukuTestItem[] = rawBuku.map(({ buku_dosen, ...buku }) => ({
    ...buku,
    dosenIds: buku_dosen.map((row) => row.dosen_id),
  }));

  const matkulItems: MatkulTestItem[] = rawMatkul.map(
    ({ _count, ...matkul }) => ({
      ...matkul,
      jumlah_kelas: _count.kelas,
    }),
  );

  const kelasItems: KelasTestItem[] = rawKelas.map(
    ({ _count, matkul, dosen, ...kelas }) => ({
      ...kelas,
      matkul_kode: matkul.kode,
      matkul_nama: matkul.nama,
      dosen_nama: dosen.nama,
      jumlah_berkas: _count.berkas,
    }),
  );

  const berkasItems: BerkasPengajaranTestItem[] = rawBerkas.map(
    ({ kelas, ...berkas }) => ({
      ...berkas,
      dosen_id: kelas.dosen_id,
      kelas_label: `#${berkas.kelas_id} ${kelas.matkul.kode} (${kelas.tahun_ajaran} ${kelas.semester})`,
    }),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[12px] border border-[var(--color-border-default)] bg-[var(--color-bg-page)] p-4">
        <p className="text-[12px] font-semibold uppercase tracking-[0.6px] text-[var(--color-text-secondary)]">
          Status Akses Anda
        </p>
        <p className="mt-1 font-[family-name:var(--font-lexend)] text-[18px] font-bold text-[var(--color-text-primary)]">
          Role: {ownPerms.role}
        </p>
        <p className="mt-1 text-[13px] text-[var(--color-text-secondary)]">
          {session
            ? `Masuk sebagai ${session.name} (${session.email})`
            : "Belum login (dianggap pengunjung Umum, mode lihat saja)."}
        </p>
      </div>

      <div>
        <h2 className="mb-2.5 font-[family-name:var(--font-lexend)] text-[15px] font-bold text-[var(--color-text-primary)]">
          Izin RBAC Modul Tridharma
        </h2>
        <ul className="flex flex-col gap-2">
          <PermissionItem
            label="Lihat data Tridharma publik (Publikasi, Kegiatan, HKI, Buku)"
            allowed={ownPerms.canView}
          />
          <PermissionItem
            label="CRUD data Tridharma milik sendiri (Publikasi, Kegiatan, HKI, Buku)"
            allowed={ownPerms.canManageOwn}
          />
          <PermissionItem
            label="Edit & Hapus data Tridharma milik dosen lain"
            allowed={otherPerms.canUpdate || otherPerms.canDelete}
          />
          <PermissionItem
            label="Pengajaran: Lihat Matkul, Kelas, & Berkas"
            allowed={pengajaranPerms.canViewPengajaran}
          />
          <PermissionItem
            label="Pengajaran: CRUD Mata Kuliah (Kaprodi & Staff Kaprodi)"
            allowed={pengajaranPerms.canManageMatkul}
          />
          <PermissionItem
            label="Pengajaran: CRUD Kelas & Berkas milik sendiri (khusus Dosen)"
            allowed={pengajaranPerms.canManageOwnKelasBerkas}
          />
        </ul>
      </div>

      <TridharmaTestTabs
        publikasiItems={publikasiItems}
        kegiatanItems={kegiatanItems}
        iprsItems={iprsItems}
        bukuItems={bukuItems}
        matkulItems={matkulItems}
        kelasItems={kelasItems}
        berkasItems={berkasItems}
        canManage={ownPerms.canManageOwn}
        canViewPengajaran={pengajaranPerms.canViewPengajaran}
        canManageMatkul={pengajaranPerms.canManageMatkul}
        canManageOwnKelasBerkas={pengajaranPerms.canManageOwnKelasBerkas}
        role={ownPerms.role}
        currentDosenId={dosenRow?.id ?? null}
        currentDosenNama={dosenRow?.nama ?? null}
      />

      <nav
        aria-label="Navigasi pengujian"
        className="flex flex-wrap gap-3 border-t border-[var(--color-border-default)] pt-4"
      >
        <a
          href="/arsip"
          className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] bg-[var(--color-primary-strong)] px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-primary)]"
        >
          Uji Akses /arsip
        </a>
        <Link
          href="/login"
          prefetch={false}
          className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-tint-neutral)]"
        >
          Ganti Role (/login)
        </Link>
        {session ? (
          <a
            href="/sso/logout"
            className="inline-flex min-h-[44px] items-center justify-center rounded-[10px] border border-[var(--color-border-strong)] bg-white px-4 py-2 text-[13px] font-semibold text-[var(--color-danger-solid)] transition-colors hover:bg-[var(--color-danger-bg)]"
          >
            Keluar
          </a>
        ) : null}
      </nav>
    </div>
  );
}

export default function TridharmaPage() {
  return (
    <main className="flex min-h-screen flex-col items-center bg-[var(--color-bg-page)] px-4 py-10">
      <div className="my-auto w-full max-w-[920px] rounded-[18px] bg-[var(--color-bg-surface)] p-5 shadow-[0px_4px_20px_rgba(11,42,76,0.06)] sm:p-8">
        <header className="mb-5">
          <p className="text-[12px] font-bold uppercase tracking-[0.6px] text-[var(--color-primary-strong)]">
            Modul 7
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-lexend)] text-[28px] font-bold leading-[32px] text-[var(--color-text-primary)]">
            Tridharma
          </h1>
        </header>

        <Suspense
          fallback={
            <p role="status" className="text-[13px] text-[var(--color-text-muted)]">
              Memeriksa sesi dan izin RBAC...
            </p>
          }
        >
          <TridharmaContent />
        </Suspense>
      </div>
    </main>
  );
}
