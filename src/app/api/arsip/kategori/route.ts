import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/session";
import { getArsipPermissions } from "@/lib/rbac";
import { db } from "@/lib/db";

const SMALLINT_MAX = 32767;

type ParseResult = { ok: true; value: number | undefined } | { ok: false };

function parseOptionalSmallInt(raw: string | null): ParseResult {
  if (raw === null) return { ok: true, value: undefined };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: undefined };
  if (!/^\d+$/.test(trimmed)) return { ok: false };

  const value = Number.parseInt(trimmed, 10);
  if (value > SMALLINT_MAX) return { ok: false };
  return { ok: true, value };
}

function buildKategoriWhere(
  params: URLSearchParams,
): { ok: true; where: Prisma.KategoriWhereInput } | { ok: false; message: string } {
  const andConditions: Prisma.KategoriWhereInput[] = [];

  const search = (params.get("search") ?? "").trim().slice(0, 100);
  if (search) {
    andConditions.push({
      OR: [
        { kode: { contains: search, mode: "insensitive" } },
        { nama: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  const retentionFilters = [
    { field: "retensi_aktif_tahun", keys: ["retensi_aktif_tahun", "retensi_aktif"] },
    { field: "retensi_inaktif_tahun", keys: ["retensi_inaktif_tahun", "retensi_inaktif"] },
  ] as const;

  for (const { field, keys } of retentionFilters) {
    const raw = params.get(keys[0]) ?? params.get(keys[1]);
    const parsed = parseOptionalSmallInt(raw);
    if (!parsed.ok) {
      return { ok: false, message: `Parameter ${field} tidak valid.` };
    }
    if (parsed.value !== undefined) {
      andConditions.push({ [field]: parsed.value });
    }
  }

  const rawRetensi = (params.get("retensi") ?? params.get("masa_retensi") ?? "").trim();
  if (rawRetensi) {
    if (rawRetensi.includes("/")) {
      const parts = rawRetensi.split("/");
      const aktifPart = parts.length === 2 ? parseOptionalSmallInt(parts[0]) : { ok: false as const };
      const inaktifPart = parts.length === 2 ? parseOptionalSmallInt(parts[1]) : { ok: false as const };
      if (!aktifPart.ok || !inaktifPart.ok || aktifPart.value === undefined || inaktifPart.value === undefined) {
        return { ok: false, message: "Parameter retensi harus berupa angka atau format aktif/inaktif." };
      }
      andConditions.push({
        retensi_aktif_tahun: aktifPart.value,
        retensi_inaktif_tahun: inaktifPart.value,
      });
    } else {
      const single = parseOptionalSmallInt(rawRetensi);
      if (!single.ok || single.value === undefined) {
        return { ok: false, message: "Parameter retensi tidak valid." };
      }
      andConditions.push({
        OR: [
          { retensi_aktif_tahun: single.value },
          { retensi_inaktif_tahun: single.value },
        ],
      });
    }
  }

  return {
    ok: true,
    where: andConditions.length > 0 ? { AND: andConditions } : {},
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { message: "Silakan login terlebih dahulu." },
        { status: 401 },
      );
    }

    const permissions = getArsipPermissions(session);
    if (!permissions.canViewKategori) {
      return NextResponse.json(
        { message: "Anda tidak memiliki izin untuk mengakses kategori arsip." },
        { status: 403 },
      );
    }

    const params = request.nextUrl.searchParams;
    const whereResult = buildKategoriWhere(params);
    if (!whereResult.ok) {
      return NextResponse.json({ message: whereResult.message }, { status: 400 });
    }

    const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
    const pageSize = 6;

    const [rawItems, matchedTotal] = await Promise.all([
      db.kategori.findMany({
        where: whereResult.where,
        orderBy: { kode: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          kode: true,
          nama: true,
          retensi_aktif_tahun: true,
          retensi_inaktif_tahun: true,
          keterangan: true,
          _count: {
            select: { arsip: true },
          },
        },
      }),
      db.kategori.count({ where: whereResult.where }),
    ]);

    const items = rawItems.map(({ _count, ...kategori }) => ({
      ...kategori,
      jumlah_arsip: _count.arsip,
    }));

    return NextResponse.json(
      {
        items,
        pagination: {
          page,
          pageSize,
          total: matchedTotal,
          totalPages: Math.max(1, Math.ceil(matchedTotal / pageSize)),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("GET /api/arsip/kategori:", error);
    return NextResponse.json({ message: "Gagal mengambil kategori." }, { status: 500 });
  }
}
