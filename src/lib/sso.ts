import {
  createRemoteJWKSet,
  EncryptJWT,
  jwtDecrypt,
  jwtVerify,
  SignJWT,
} from "jose";

export type SsoRole =
  | "Dosen"
  | "Kaprodi"
  | "Staff_Kaprodi"
  | "Admin"
  | "Mahasiswa"
  | "Umum";

export interface SsoJwtPayload {
  sub: string;
  name: string;
  email: string;
  nip?: string | null;
  role: SsoRole;
  exp?: number;
}

export interface LocalSessionPayload {
  sub: string;
  dosen_id: number | null;
  name: string;
  email: string;
  nip: string | null;
  role: SsoRole;
  exp?: number;
}

export const SSO_SESSION_COOKIE = "app_session";
export const SSO_REFRESH_COOKIE = "sso_refresh";
export const SSO_TX_COOKIE = "sso_tx";
export const SSO_REFRESHED_SESSION_HEADER = "x-app-refreshed-session";
export const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

let jwksCache: {
  url: string;
  resolver: ReturnType<typeof createRemoteJWKSet>;
} | null = null;

export function getSessionSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "Variabel environment SESSION_SECRET belum diatur pada server."
    );
  }
  return new TextEncoder().encode(secret);
}

async function getRefreshEncryptionKey(): Promise<Uint8Array> {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) {
    throw new Error(
      "Variabel environment SESSION_SECRET belum diatur pada server."
    );
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`sacibiru-refresh-jwe:${secret}`)
  );
  return new Uint8Array(digest);
}

export function normalizeSsoUrl(rawUrl: string | undefined): string {
  return (rawUrl ?? "").trim().replace(/\/+$/, "");
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function getSsoConfig() {
  const ssoUrl = normalizeSsoUrl(process.env.SSO_URL);
  const clientId = process.env.SSO_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.SSO_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.SSO_REDIRECT_URI?.trim() ?? "";
  const postLogoutUri = process.env.SSO_POST_LOGOUT_URI?.trim() ?? "";

  return {
    ssoUrl,
    clientId,
    clientSecret,
    redirectUri,
    postLogoutUri,
  };
}

export function getJwks(ssoUrl: string): ReturnType<typeof createRemoteJWKSet> {
  const normalized = normalizeSsoUrl(ssoUrl);
  if (!normalized) {
    throw new Error("Variabel environment SSO_URL belum diatur.");
  }
  if (!jwksCache || jwksCache.url !== normalized) {
    jwksCache = {
      url: normalized,
      resolver: createRemoteJWKSet(new URL("/api/sso/jwks", normalized)),
    };
  }
  return jwksCache.resolver;
}

export async function verifySsoAccessToken(
  accessToken: string,
  ssoUrl: string,
  clientId: string
): Promise<SsoJwtPayload> {
  const normalized = normalizeSsoUrl(ssoUrl);
  const { payload } = await jwtVerify<SsoJwtPayload>(
    accessToken,
    getJwks(normalized),
    {
      issuer: normalized,
      audience: clientId,
      algorithms: ["RS256"],
    }
  );
  return payload;
}

export async function signLocalSession(
  claims: Omit<LocalSessionPayload, "exp">,
  expirationTime: number
): Promise<string> {
  return new SignJWT({
    sub: claims.sub,
    dosen_id: claims.dosen_id,
    name: claims.name,
    email: claims.email,
    nip: claims.nip ?? null,
    role: claims.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expirationTime)
    .sign(getSessionSecretKey());
}

export async function verifyLocalSession(
  token: string,
  options?: { allowExpired?: boolean }
): Promise<LocalSessionPayload | null> {
  // Pastikan SESSION_SECRET tersedia sebelum verifikasi token
  const secretKey = getSessionSecretKey();
  try {
    const { payload } = await jwtVerify<LocalSessionPayload>(token, secretKey, {
      algorithms: ["HS256"],
      ...(options?.allowExpired ? { currentDate: new Date(0) } : {}),
    });
    return payload;
  } catch {
    return null;
  }
}

export async function encryptRefreshToken(
  refreshToken: string
): Promise<string> {
  const key = await getRefreshEncryptionKey();
  return new EncryptJWT({ rt: refreshToken })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .encrypt(key);
}

export async function decryptRefreshToken(
  encryptedToken: string
): Promise<string | null> {
  try {
    const key = await getRefreshEncryptionKey();
    const { payload } = await jwtDecrypt<{ rt?: unknown }>(
      encryptedToken,
      key,
      {
        keyManagementAlgorithms: ["dir"],
        contentEncryptionAlgorithms: ["A256GCM"],
      }
    );
    return typeof payload.rt === "string" && payload.rt.length > 0
      ? payload.rt
      : null;
  } catch {
    return null;
  }
}

export function getSessionCookieOptions(maxAge = REFRESH_COOKIE_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  };
}

export type RefreshResult =
  | {
      ok: true;
      accessToken: string;
      refreshToken: string;
      payload: SsoJwtPayload;
    }
  | {
      ok: false;
      reason: "revoked" | "transient";
      errorCode?: string;
    };

type SuccessfulRefreshResult = Extract<RefreshResult, { ok: true }>;

interface RecentRefreshEntry {
  result: SuccessfulRefreshResult;
  expiresAt: number;
}

const RECENT_REFRESH_TTL_MS = 15_000;

const globalForSsoRefresh = globalThis as typeof globalThis & {
  __sacibiruInFlightRefreshes?: Map<string, Promise<RefreshResult>>;
  __sacibiruRecentRefreshes?: Map<string, RecentRefreshEntry>;
};

const inFlightRefreshes =
  globalForSsoRefresh.__sacibiruInFlightRefreshes ??
  (globalForSsoRefresh.__sacibiruInFlightRefreshes = new Map<
    string,
    Promise<RefreshResult>
  >());

const recentRefreshes =
  globalForSsoRefresh.__sacibiruRecentRefreshes ??
  (globalForSsoRefresh.__sacibiruRecentRefreshes = new Map<
    string,
    RecentRefreshEntry
  >());

function pruneExpiredRecentRefreshes(now: number) {
  for (const [token, entry] of recentRefreshes) {
    if (entry.expiresAt <= now) {
      recentRefreshes.delete(token);
    }
  }
}

export function resetRefreshSingleFlightCache() {
  inFlightRefreshes.clear();
  recentRefreshes.clear();
}

async function executeRefresh(refreshToken: string): Promise<RefreshResult> {
  const { ssoUrl, clientId, clientSecret } = getSsoConfig();
  if (!ssoUrl || !isValidHttpUrl(ssoUrl) || !clientId || !clientSecret) {
    return { ok: false, reason: "transient" };
  }

  try {
    const res = await fetch(new URL("/api/sso/token", ssoUrl), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      let errorCode: string | undefined;
      try {
        const body = (await res.json()) as { error?: string };
        errorCode = body.error;
      } catch {
        errorCode = undefined;
      }

      const isRevoked =
        errorCode === "invalid_grant" ||
        errorCode === "invalid_client" ||
        res.status === 400 ||
        res.status === 401;

      return {
        ok: false,
        reason: isRevoked ? "revoked" : "transient",
        errorCode,
      };
    }

    const tokens = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
    };

    if (!tokens.access_token || !tokens.refresh_token) {
      return { ok: false, reason: "transient" };
    }

    const payload = await verifySsoAccessToken(
      tokens.access_token,
      ssoUrl,
      clientId
    );

    return {
      ok: true,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      payload,
    };
  } catch {
    return { ok: false, reason: "transient" };
  }
}

/**
 * Menjalankan refresh token dengan single-flight deduplication per token
 * dan cache singkat (15 detik) untuk hasil sukses, agar request paralel
 * atau yang sedikit terlambat tidak memakai ulang refresh token yang sudah
 * dirotasi dan memicu invalid_grant.
 */
export function refreshWithSsoSingleFlight(
  refreshToken: string
): Promise<RefreshResult> {
  const now = Date.now();
  pruneExpiredRecentRefreshes(now);

  const cached = recentRefreshes.get(refreshToken);
  if (cached && cached.expiresAt > now) {
    return Promise.resolve(cached.result);
  }

  const existing = inFlightRefreshes.get(refreshToken);
  if (existing) {
    return existing;
  }

  const promise = executeRefresh(refreshToken)
    .then((result) => {
      if (result.ok) {
        recentRefreshes.set(refreshToken, {
          result,
          expiresAt: Date.now() + RECENT_REFRESH_TTL_MS,
        });
      }
      return result;
    })
    .finally(() => {
      inFlightRefreshes.delete(refreshToken);
    });

  inFlightRefreshes.set(refreshToken, promise);
  return promise;
}
