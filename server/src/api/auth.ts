import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

/**
 * Web authentication (D2): Supabase Auth issues the session; this server trusts
 * a request only after verifying its access token against Supabase's JWKS
 * endpoint (asymmetric keys, key rotation without redeploy). We verify the
 * signature plus `iss`/`aud`/`exp`, then use the `sub` claim as the caller's
 * identity. No signing secret lives in this server's env.
 */

export interface AuthConfig {
  /** JWKS endpoint, e.g. https://<ref>.supabase.co/auth/v1/.well-known/jwks.json */
  jwksUrl: string;
  /** Expected token issuer, e.g. https://<ref>.supabase.co/auth/v1 */
  issuer: string;
  /** Expected audience — Supabase uses "authenticated" for signed-in users. */
  audience: string;
}

/** Raised when a request cannot be authenticated. The API maps it to HTTP 401. */
export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Derives the auth config from env. Prefers an explicit `SUPABASE_URL`; falls
 * back to composing it from `SUPABASE_PROJECT_REF`. Returns null when neither is
 * set so the API can refuse to start auth-gated routes with a clear error.
 */
export function getAuthConfigFromEnv(): AuthConfig | null {
  const explicit = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const ref = process.env.SUPABASE_PROJECT_REF;
  const base = explicit ?? (ref ? `https://${ref}.supabase.co` : undefined);
  if (!base) return null;
  return {
    jwksUrl: process.env.SUPABASE_JWKS_URL ?? `${base}/auth/v1/.well-known/jwks.json`,
    issuer: `${base}/auth/v1`,
    audience: process.env.SUPABASE_JWT_AUD ?? 'authenticated',
  };
}

let cachedKeySet: JWTVerifyGetKey | null = null;

/** Lazily builds (and caches) the remote JWKS key resolver for the given URL. */
export function getRemoteKeySet(jwksUrl: string): JWTVerifyGetKey {
  if (!cachedKeySet) {
    cachedKeySet = createRemoteJWKSet(new URL(jwksUrl));
  }
  return cachedKeySet;
}

/**
 * Verifies a Supabase access token and returns its `sub` (the auth identity).
 * The key resolver is injected so production uses the remote JWKS while tests
 * can supply a local key set. Throws {@link UnauthorizedError} on any failure —
 * bad signature, wrong issuer/audience, expired, or missing `sub`.
 */
export async function verifyAccessToken(
  token: string,
  getKey: JWTVerifyGetKey,
  opts: { issuer: string; audience: string },
): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, getKey, {
      issuer: opts.issuer,
      audience: opts.audience,
    });
    if (!payload.sub) throw new UnauthorizedError('Token has no subject');
    return payload.sub;
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError('Invalid or expired token');
  }
}

/** Extracts the bearer token from an `Authorization` header, or null. */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
