import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtPayload } from '../types/auth';

const ISSUER = 'appzex-api';

export function signSessionToken(payload: JwtPayload): string {
  const { sub, ...claims } = payload;
  return jwt.sign(claims, env.JWT_SECRET, {
    subject: sub,
    issuer: ISSUER,
    algorithm: 'HS256',
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  });
}

/** Returns the payload, or null for any invalid/expired/tampered token. */
export function verifySessionToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { issuer: ISSUER, algorithms: ['HS256'] });
    if (typeof decoded === 'string' || !decoded.sub || typeof decoded.tv !== 'number') return null;
    return {
      sub: decoded.sub,
      role: decoded.role,
      agencyId: decoded.agencyId ?? null,
      tv: decoded.tv,
      sid: typeof decoded.sid === 'string' ? decoded.sid : undefined,
    };
  } catch {
    return null;
  }
}
