import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { forbidden } from '../utils/errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
export const CSRF_HEADER = 'x-requested-with';

/**
 * CSRF defence for cookie-based sessions:
 *  1. The session cookie is SameSite (lax by default).
 *  2. State-changing requests must send a custom header. Browsers only allow
 *     cross-origin custom headers after a CORS preflight, and CORS only
 *     allows our configured origins, so a malicious site cannot forge one.
 *  3. If the browser sends an Origin header it must be an allowed origin.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();

  if (!req.get(CSRF_HEADER)) {
    throw forbidden('Missing CSRF protection header.', 'CSRF_REJECTED');
  }

  const origin = req.get('origin');
  if (origin && !env.corsOrigins.includes(origin)) {
    throw forbidden('Request origin is not allowed.', 'CSRF_REJECTED');
  }

  next();
}
