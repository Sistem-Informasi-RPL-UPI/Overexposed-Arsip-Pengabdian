import { cookies, headers } from "next/headers";
import {
  SSO_REFRESHED_SESSION_HEADER,
  SSO_SESSION_COOKIE,
  verifyLocalSession,
  type LocalSessionPayload,
} from "@/lib/sso";

export type { LocalSessionPayload };

export async function getSession(): Promise<LocalSessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SSO_SESSION_COOKIE)?.value;
  if (sessionCookie) {
    const verified = await verifyLocalSession(sessionCookie);
    if (verified) return verified;
  }

  // Fallback untuk request yang sesinya baru saja diperbarui oleh src/proxy.ts
  // (mis. saat cookie request lama masih terbaca di RSC/Vercel pada render pertama).
  const headerStore = await headers();
  const refreshedSession = headerStore.get(SSO_REFRESHED_SESSION_HEADER);
  if (!refreshedSession) return null;

  return verifyLocalSession(refreshedSession);
}
