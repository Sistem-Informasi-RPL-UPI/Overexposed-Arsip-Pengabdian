import { createRemoteJWKSet, jwtVerify, SignJWT } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";

// Mengambil dan menyimpan kunci publik SSO secara otomatis
const jwks = createRemoteJWKSet(new URL("/api/sso/jwks", process.env.SSO_URL));

// Tipe payload JWT yang dikirim oleh SSO SACIBIRU
interface SsoJwtPayload {
  sub: string;
  name: string;
  email: string;
  nip?: string;
  role: "Dosen" | "Kaprodi" | "Admin";
  exp?: number;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tx = JSON.parse(request.cookies.get("sso_tx")?.value ?? "{}");

  // cegah csrf
  if (!tx.state || tx.state !== params.get("state")) {
    return NextResponse.json({ error: "State tidak cocok." }, { status: 400 });
  }

  // error handling role tidak sesuai
  if (params.get("error")) {
    return NextResponse.json({ error: params.get("error_description") ?? "Akses ditolak." }, { status: 403 });
  }

  // Menukar kode sekali pakai dengan access_token dan refresh_token ke server SSO
  const res = await fetch(new URL("/api/sso/token", process.env.SSO_URL), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.SSO_CLIENT_ID!,
      client_secret: process.env.SSO_CLIENT_SECRET!,
      code: params.get("code") ?? "",
      redirect_uri: process.env.SSO_REDIRECT_URI!,
      code_verifier: tx.verifier,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Login SSO gagal." }, { status: 401 });
  }

  const tokens = await res.json();

  // 4. Memverifikasi tanda tangan, penerbit (iss), tujuan (aud), dan masa berlaku JWT secara lokal
  const { payload } = await jwtVerify<SsoJwtPayload>(tokens.access_token, jwks, {
    issuer: process.env.SSO_URL!,
    audience: process.env.SSO_CLIENT_ID!,
    algorithms: ["RS256"],
  });

  let dosenId: number | null = null;

  // 5. Sinkronisasi ke tabel Dosen jika role-nya Dosen atau Kaprodi
  if (payload.role === "Dosen" || payload.role === "Kaprodi") {
    const namaNormal = payload.name.toLowerCase().trim();

    const dosen = await db.dosen.upsert({
      where: {
        user_id: payload.sub,
      },
      update: {
        nama: payload.name,
        nama_normal: namaNormal,
        // Jika kamu menambahkan kolom nip dan email di schema.prisma, buka komentar di bawah ini:
        // nip: payload.nip ?? null,
        // email: payload.email,
      },
      create: {
        user_id: payload.sub,
        nama: payload.name,
        nama_normal: namaNormal,
        // nip: payload.nip ?? null,
        // email: payload.email,
      },
    });

    dosenId = dosen.id;
  }

  // 6. Catat aktivitas login ke tabel LogAktivitas
  await db.logAktivitas.create({
    data: {
      user_id: payload.sub,
      user_nama: payload.name,
      aksi: "LOGIN_SSO",
      objek: "AUTH",
      detail: `Login berhasil dengan role ${payload.role}`,
    },
  });

  // 7. Buat JWT sesi lokal (berlaku 15 menit sesuai masa aktif access_token)
  const session = await new SignJWT({
    sub: payload.sub,
    dosen_id: dosenId, // Akan berisi ID integer tabel dosen jika Dosen/Kaprodi, atau null jika Staff (Admin)
    name: payload.name,
    email: payload.email,
    nip: payload.nip ?? null,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(payload.exp!)
    .sign(new TextEncoder().encode(process.env.SESSION_SECRET!));

  const isProd = process.env.NODE_ENV === "production";

  // 8. Redirect ke halaman utama / dashboard sesuai role
  const redirectPath = payload.role === "Admin" ? "/arsip" : "/tridharma";
  const response = NextResponse.redirect(new URL(redirectPath, request.url));

  response.cookies.set("app_session", session, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  });
  response.cookies.set("sso_refresh", tokens.refresh_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
  });
  response.cookies.delete("sso_tx");

  return response;
}
