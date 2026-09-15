import { eq } from 'drizzle-orm';
import { importJWK, jwtVerify, type JWTPayload } from 'jose';
import { getDb } from '../shared/database/client';
import { jwks, user } from '../shared/database/schema/auth';

const JWT_SEGMENTS = 3;

export type ActiveUser = {
  id: string;
  email: string;
  name: string;
};

export function looksLikeJwt(token: string): boolean {
  return token.split('.').length === JWT_SEGMENTS;
}

export function bearerToken(authorization: string | undefined): string | undefined {
  if (!authorization) {
    return undefined;
  }
  const [scheme, token] = authorization.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return undefined;
  }
  return token;
}

export async function verifyAccessJwt(token: string): Promise<JWTPayload | null> {
  try {
    const [headerSegment] = token.split('.');
    if (!headerSegment) {
      return null;
    }
    const header = JSON.parse(Buffer.from(headerSegment, 'base64url').toString('utf8')) as {
      kid?: string;
      alg?: string;
    };
    if (!header.kid) {
      return null;
    }

    const db = getDb();
    const [key] = await db.select().from(jwks).where(eq(jwks.id, header.kid)).limit(1);
    if (!key) {
      return null;
    }
    if (key.expiresAt && key.expiresAt.getTime() <= Date.now()) {
      return null;
    }

    const publicJwk = JSON.parse(key.publicKey) as Parameters<typeof importJWK>[0];
    const cryptoKey = await importJWK(publicJwk, key.alg ?? header.alg ?? 'EdDSA');
    const issuer = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
    const { payload } = await jwtVerify(token, cryptoKey, {
      issuer,
      audience: issuer,
    });
    return payload;
  } catch {
    return null;
  }
}

export async function loadActiveUser(userId: string): Promise<ActiveUser | null> {
  const db = getDb();
  const [found] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  if (!found || found.deletedAt) {
    return null;
  }
  if (found.banned && (!found.banExpires || found.banExpires.getTime() > Date.now())) {
    return null;
  }
  return { id: found.id, email: found.email, name: found.name };
}
