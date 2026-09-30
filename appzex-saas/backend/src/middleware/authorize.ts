import type { Role } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import type { AgencyContext, AuthContext, ClientContext } from '../types/auth';
import { forbidden, unauthorized } from '../utils/errors';

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function requireAuth(req: Request): AuthContext {
  if (!req.auth) throw unauthorized();
  return req.auth;
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = requireAuth(req);
    if (!roles.includes(auth.role)) throw forbidden();
    next();
  };
}

/** Platform routes. Agency users and clients can never reach these. */
export const requireSuperAdmin = requireRole('SUPER_ADMIN');

/**
 * Agency workspace routes. Allows agency admins/members, and super admins
 * inside an active support session. Support mode is strictly read-only.
 * CLIENT users are rejected with 403.
 */
export function requireAgencyAccess(req: Request, _res: Response, next: NextFunction) {
  const auth = requireAuth(req);

  if ((auth.role === 'AGENCY_ADMIN' || auth.role === 'AGENCY_MEMBER') && auth.agencyId) return next();

  if (auth.role === 'SUPER_ADMIN' && auth.supportSession) {
    if (!READ_METHODS.has(req.method)) {
      throw forbidden(
        'Support mode is read-only. Changes cannot be made while viewing an agency workspace.',
        'SUPPORT_READ_ONLY',
      );
    }
    return next();
  }

  throw forbidden('This area is only available to agency team members.');
}

/** Must run after requireAgencyAccess. */
export function requireAgencyAdmin(req: Request, _res: Response, next: NextFunction) {
  const auth = requireAuth(req);
  if (auth.role !== 'AGENCY_ADMIN') throw forbidden('Only agency admins can perform this action.');
  next();
}

/** Client portal routes. */
export function requireClientAccess(req: Request, _res: Response, next: NextFunction) {
  const auth = requireAuth(req);
  if (auth.role !== 'CLIENT' || !auth.agencyId || !auth.clientId) {
    throw forbidden('This area is only available to client portal users.');
  }
  next();
}

export function getAgencyContext(req: Request): AgencyContext {
  const auth = requireAuth(req);
  if (!auth.agencyId || auth.role === 'CLIENT') throw forbidden();
  return {
    userId: auth.userId,
    role: auth.role,
    agencyId: auth.agencyId,
    isSupportMode: Boolean(auth.supportSession),
  };
}

export function getClientContext(req: Request): ClientContext {
  const auth = requireAuth(req);
  if (auth.role !== 'CLIENT' || !auth.agencyId || !auth.clientId) throw forbidden();
  return { userId: auth.userId, agencyId: auth.agencyId, clientId: auth.clientId };
}

export function getAuth(req: Request): AuthContext {
  return requireAuth(req);
}
