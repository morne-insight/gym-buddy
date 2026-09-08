import { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet, type JWK } from 'jose';
import { verifyAccessToken, extractBearerToken, UnauthorizedError } from './auth.js';
import { beforeAll, describe, it, expect } from '@jest/globals';

const ISSUER = 'https://proj.supabase.co/auth/v1';
const AUDIENCE = 'authenticated';

let getKey: ReturnType<typeof createLocalJWKSet>;
let sign: (payload: Record<string, unknown>, opts?: { expSecondsFromNow?: number }) => Promise<string>;
let privateKey: CryptoKey;

beforeAll(async () => {
  const { publicKey, privateKey: priv } = await generateKeyPair('ES256');
  privateKey = priv;
  const pubJwk: JWK = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'ES256', use: 'sig' };
  getKey = createLocalJWKSet({ keys: [pubJwk] });

  sign = (payload, opts) => {
    const jwt = new SignJWT(payload)
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE);
    jwt.setExpirationTime(`${opts?.expSecondsFromNow ?? 3600}s`);
    return jwt.sign(privateKey);
  };
});

describe('extractBearerToken', () => {
  it('extracts the token from a Bearer header', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });
  it('returns null for missing or malformed headers', () => {
    expect(extractBearerToken(undefined)).toBeNull();
    expect(extractBearerToken('Token abc')).toBeNull();
    expect(extractBearerToken('')).toBeNull();
  });
});

describe('verifyAccessToken', () => {
  it('returns the sub for a valid token', async () => {
    const token = await sign({ sub: 'user-uuid-123' });
    const sub = await verifyAccessToken(token, getKey, { issuer: ISSUER, audience: AUDIENCE });
    expect(sub).toBe('user-uuid-123');
  });

  it('rejects a token with the wrong issuer', async () => {
    const token = await new SignJWT({ sub: 'x' })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuedAt()
      .setIssuer('https://evil.example/auth/v1')
      .setAudience(AUDIENCE)
      .setExpirationTime('1h')
      .sign(privateKey);
    await expect(
      verifyAccessToken(token, getKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a token with the wrong audience', async () => {
    const token = await new SignJWT({ sub: 'x' })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuedAt()
      .setIssuer(ISSUER)
      .setAudience('some-other-aud')
      .setExpirationTime('1h')
      .sign(privateKey);
    await expect(
      verifyAccessToken(token, getKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an expired token', async () => {
    const token = await sign({ sub: 'x' }, { expSecondsFromNow: -10 });
    await expect(
      verifyAccessToken(token, getKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a token with no subject', async () => {
    const token = await sign({});
    await expect(
      verifyAccessToken(token, getKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a garbage token', async () => {
    await expect(
      verifyAccessToken('not-a-jwt', getKey, { issuer: ISSUER, audience: AUDIENCE }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
