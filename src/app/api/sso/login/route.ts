import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export async function GET() {
  // cegah csrf
  const state = randomBytes(24).toString("base64url");

  // keamanan pcke
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");

  const url = new URL("/api/sso/authorize", process.env.SSO_URL);
  url.search = new URLSearchParams({
    client_id: process.env.SSO_CLIENT_ID!,
    redirect_uri: process.env.SSO_REDIRECT_URI!,
    response_type: "code",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const response = NextResponse.redirect(url);
  response.cookies.set("sso_tx", JSON.stringify({ state, verifier }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Gunakan true saat HTTPS di production, false saat localhost HTTP
    sameSite: "lax",
    path: "/",
    maxAge: 600, // Berlaku 10 menit
  });

  return response;
}
