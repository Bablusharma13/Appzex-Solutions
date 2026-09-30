import type { Role } from '@prisma/client';

export interface SupportSessionContext {
  id: string;
  agencyId: string;
  agencyName: string;
  expiresAt: Date;
}

/**
 * Built by `authenticate` from the DATABASE on every request (not from the
 * JWT payload), so revoked users, suspended agencies and role changes take
 * effect immediately.
 */
export interface AuthContext {
  userId: string;
  name: string;
  email: string;
  role: Role;
  /** Agency the request operates in. For super admins only set in support mode. */
  agencyId: string | null;
  /** Client company for CLIENT users. */
  clientId: string | null;
  supportSession: SupportSessionContext | null;
}

/** Guaranteed shape for agency-workspace handlers (agency user or support mode). */
export interface AgencyContext {
  userId: string;
  role: Role;
  agencyId: string;
  isSupportMode: boolean;
}

/** Guaranteed shape for client-portal handlers. */
export interface ClientContext {
  userId: string;
  agencyId: string;
  clientId: string;
}

export interface JwtPayload {
  sub: string;
  role: Role;
  agencyId?: string | null;
  /** Token version; must match users.tokenVersion or the token is revoked. */
  tv: number;
  /** Active support session id (super admin only). */
  sid?: string;
}
