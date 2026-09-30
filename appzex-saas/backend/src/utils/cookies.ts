import type { CookieOptions, Response } from 'express';
import { env } from '../config/env';

export const SESSION_COOKIE = 'appzex_session';

function parseDurationMs(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());
  if (!match) return 8 * 60 * 60 * 1000;
  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
}

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.COOKIE_SAMESITE,
    path: '/',
  };
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(), maxAge: parseDurationMs(env.JWT_EXPIRES_IN) });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, baseOptions());
}
