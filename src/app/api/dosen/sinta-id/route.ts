import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { normalizeRole } from "@/lib/rbac";
import {
  getSessionCookieOptions,
  signLocalSession,
  SSO_SESSION_COOKIE,
} from "@/lib/sso";
import { getSession } from "@/lib/session";

const ROLE_BOLEH_ISI_SINTA_ID = ["Dosen", "Kaprodi", "Staff Kaprodi", "Admin"];
const SINTA_ID_PATTERN = /^\d{1,20}$/;

const DOSEN_SELECT = {
  id: true,
  user_id: true,
  sinta_id: true,
} as const;

type Sesi = NonNullable<Awaited<ReturnType<typeof getSession>>>;

type BarisDosen = {
  id: number;
  user_id: string;
  sinta_id: string | null;
};

function jawab(kode: string, pesan: string, status: number) {
  return NextResponse.json({ kode, error: pesan }, { status });
}

// Menyimpan sinta_id akun yang sedang login. Tidak memicu crawl.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return jawab("belum_login", "Silakan login terlebih dahulu.", 401);
  }

  const role = normalizeRole(session.role);
  if (!ROLE_BOLEH_ISI_SINTA_ID.includes(role)) {
    return jawab("peran_tidak_diizinkan", "Peran Anda tidak memakai data dosen.", 403);
  }

  let body: { sinta_id?: unknown };
  try {
    body = await request.json();
  } catch {
    return jawab("body_tidak_valid", "Body harus berupa JSON.", 400);
  }

  const sintaId = typeof body.sinta_id === "string" ? body.sinta_id.trim() : "";
  if (!SINTA_ID_PATTERN.test(sintaId)) {
    return jawab("sinta_id_tidak_valid", "sinta_id harus berupa angka, 1 sampai 20 digit.", 400);
  }

  const sudahAda = await db.dosen.findUnique({
    where: { user_id: session.sub },
    select: DOSEN_SELECT,
  });
  if (sudahAda) {
    if (sudahAda.sinta_id !== sintaId) {
      return jawab(
        "sinta_id_berbeda",
        `Akun ini sudah terhubung dengan sinta_id ${sudahAda.sinta_id ?? "(kosong)"}.`,
        409,
      );
    }
    return simpanSesi(
      session,
      sudahAda,
      200,
      "Data dosen sudah ada. Sesi diperbarui dengan dosen_id.",
    );
  }

  const dipakaiAkunLain = await db.dosen.findUnique({
    where: { sinta_id: sintaId },
    select: { id: true },
  });
  if (dipakaiAkunLain) {
    return jawab("sinta_id_dipakai", "sinta_id ini sudah dipakai akun lain.", 409);
  }

  try {
    const dosen = await db.dosen.create({
      data: { user_id: session.sub, sinta_id: sintaId },
      select: DOSEN_SELECT,
    });
    return simpanSesi(
      session,
      dosen,
      201,
      "Data dosen dibuat. Data SINTA belum diambil, tekan tombol sinkron untuk mengisinya.",
    );
  } catch (err) {
    // Unique violation: dua permintaan masuk bersamaan.
    if ((err as { code?: string }).code === "P2002") {
      return jawab("sinta_id_dipakai", "sinta_id ini sudah dipakai akun lain.", 409);
    }
    throw err;
  }
}

async function simpanSesi(
  session: Sesi,
  dosen: BarisDosen,
  status: number,
  pesan: string,
) {
  const expTime = session.exp ?? Math.floor(Date.now() / 1000) + 900;
  const token = await signLocalSession(
    {
      sub: session.sub,
      dosen_id: dosen.id,
      name: session.name,
      email: session.email,
      nip: session.nip,
      role: session.role,
    },
    expTime,
  );

  const response = NextResponse.json(
    {
      message: pesan,
      nama: session.name,
      dosen_id: dosen.id,
      sinta_id: dosen.sinta_id,
      dosen: {
        id: dosen.id,
        user_id: dosen.user_id,
        sinta_id: dosen.sinta_id,
      },
      sesi: {
        dosen_id_diperbarui: true,
        berakhir_pada: new Date(expTime * 1000).toISOString(),
      },
    },
    { status },
  );
  response.cookies.set(SSO_SESSION_COOKIE, token, getSessionCookieOptions());
  return response;
}
