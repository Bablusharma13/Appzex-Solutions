import type { NextFunction, Request, Response } from 'express';
import { resolveAuthContext } from '../services/authService';
import { SESSION_COOKIE, clearSessionCookie } from '../utils/cookies';
import { AppError, unauthorized } from '../utils/errors';
import { verifySessionToken } from '../utils/jwt';

/**
 * Verifies the HTTP-only session cookie and attaches `req.auth`.
 * The context (agency, client, role, suspension state) is re-read from the
 * database on every request; the JWT only proves identity.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string' || token.length === 0) throw unauthorized();

  const payload = verifySessionToken(token);
  if (!payload) {
    clearSessionCookie(res);
    throw unauthorized('Your session has expired. Please log in again.');
  }

  try {
    req.auth = await resolveAuthContext(payload);
  } catch (error) {
    if (error instanceof AppError && error.statusCode === 401) clearSessionCookie(res);
    throw error;
  }
  next();
}
