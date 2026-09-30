import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import type { AuthContext, SupportSessionContext } from '../types/auth';
import { forbidden, unauthorized } from '../utils/errors';
import { signSessionToken } from '../utils/jwt';
import { verifyAgainstDummy, verifyPassword } from '../utils/password';
import { logActivity, userActor } from './activityService';

export const SUSPENDED_MESSAGE = 'Your agency account is currently suspended. Please contact support.';
const INVALID_CREDENTIALS = 'Invalid email or password';

const agencySummarySelect = { id: true, name: true, slug: true, status: true, plan: true } as const;

const authUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  tokenVersion: true,
  passwordHash: true,
  membership: { select: { agencyId: true, jobTitle: true, agency: { select: agencySummarySelect } } },
  client: {
    select: {
      id: true,
      companyName: true,
      agencyId: true,
      deletedAt: true,
      portalEnabled: true,
      agency: { select: agencySummarySelect },
    },
  },
} satisfies Prisma.UserSelect;

type AuthUserRecord = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;
type AgencySummary = NonNullable<AuthUserRecord['membership']>['agency'];

interface ResolvedTenant {
  agency: AgencySummary | null;
  client: { id: string; companyName: string } | null;
}

/**
 * Single place that decides whether an account may use the product right now.
 * Runs on login AND on every authenticated request, so suspending an agency
 * locks out its users immediately rather than at token expiry.
 */
function resolveTenant(user: AuthUserRecord): ResolvedTenant {
  if (!user.isActive) throw forbidden('Your account has been deactivated. Please contact your administrator.');

  switch (user.role) {
    case 'SUPER_ADMIN':
      return { agency: null, client: null };

    case 'AGENCY_ADMIN':
    case 'AGENCY_MEMBER': {
      if (!user.membership) throw forbidden('Your account is not linked to an agency.');
      if (user.membership.agency.status === 'SUSPENDED') throw forbidden(SUSPENDED_MESSAGE, 'AGENCY_SUSPENDED');
      return { agency: user.membership.agency, client: null };
    }

    case 'CLIENT': {
      const client = user.client;
      if (!client || client.deletedAt) throw forbidden('Your client account is no longer active.');
      if (client.agency.status === 'SUSPENDED') throw forbidden(SUSPENDED_MESSAGE, 'AGENCY_SUSPENDED');
      if (!client.portalEnabled) {
        throw forbidden('Client portal access is disabled for your company. Please contact your agency.');
      }
      return { agency: client.agency, client: { id: client.id, companyName: client.companyName } };
    }

    default:
      throw forbidden();
  }
}

export function homePathFor(role: AuthContext['role'], supportMode = false): string {
  if (role === 'SUPER_ADMIN') return supportMode ? '/app/dashboard' : '/super-admin/dashboard';
  if (role === 'CLIENT') return '/client/dashboard';
  return '/app/dashboard';
}

export function issueToken(
  user: { id: string; role: AuthContext['role']; tokenVersion: number },
  agencyId: string | null,
  supportSessionId?: string,
) {
  return signSessionToken({ sub: user.id, role: user.role, agencyId, tv: user.tokenVersion, sid: supportSessionId });
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email }, select: authUserSelect });

  if (!user) {
    await verifyAgainstDummy(password);
    throw unauthorized(INVALID_CREDENTIALS);
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    throw unauthorized(INVALID_CREDENTIALS);
  }

  // Credentials are valid; only now reveal account-state problems.
  const tenant = resolveTenant(user);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    if (user.role === 'SUPER_ADMIN') {
      // A fresh login never resumes an old support session.
      await tx.supportSession.updateMany({
        where: { superAdminId: user.id, endedAt: null },
        data: { endedAt: new Date() },
      });
    }
  });

  const token = issueToken(user, tenant.agency?.id ?? null);
  return { token, userId: user.id };
}

async function findActiveSupportSession(
  superAdminId: string,
  sessionId: string,
): Promise<SupportSessionContext | null> {
  const session = await prisma.supportSession.findFirst({
    where: { id: sessionId, superAdminId, endedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, agencyId: true, expiresAt: true, agency: { select: { name: true } } },
  });
  if (!session) return null;
  return { id: session.id, agencyId: session.agencyId, agencyName: session.agency.name, expiresAt: session.expiresAt };
}

/** Rebuilds the request context from the database for a verified JWT. */
export async function resolveAuthContext(payload: {
  sub: string;
  tv: number;
  agencyId?: string | null;
  sid?: string;
}): Promise<AuthContext> {
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: authUserSelect });
  if (!user || user.tokenVersion !== payload.tv) {
    throw unauthorized('Your session has expired. Please log in again.');
  }

  const tenant = resolveTenant(user);
  if ((payload.agencyId ?? null) !== (tenant.agency?.id ?? null)) {
    throw unauthorized('Your session is no longer valid. Please log in again.');
  }

  const supportSession =
    user.role === 'SUPER_ADMIN' && payload.sid ? await findActiveSupportSession(user.id, payload.sid) : null;

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    agencyId: supportSession?.agencyId ?? tenant.agency?.id ?? null,
    clientId: tenant.client?.id ?? null,
    supportSession,
  };
}

/** Payload for GET /auth/me and the login response. */
export async function getSessionProfile(userId: string, supportSession: SupportSessionContext | null = null) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: authUserSelect });
  const tenant = resolveTenant(user);
  const supportAgency = supportSession
    ? await prisma.agency.findUnique({ where: { id: supportSession.agencyId }, select: agencySummarySelect })
    : null;

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      jobTitle: user.membership?.jobTitle ?? null,
    },
    agency: supportAgency ?? tenant.agency,
    client: tenant.client,
    supportSession: supportSession
      ? {
          id: supportSession.id,
          agencyId: supportSession.agencyId,
          agencyName: supportSession.agencyName,
          expiresAt: supportSession.expiresAt,
          readOnly: true,
        }
      : null,
    home: homePathFor(user.role, Boolean(supportSession)),
  };
}

/** Revokes every token for the user and closes any open support session. */
export async function logout(ctx: AuthContext) {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: ctx.userId }, data: { tokenVersion: { increment: 1 } } });
    if (ctx.supportSession) {
      await tx.supportSession.update({ where: { id: ctx.supportSession.id }, data: { endedAt: new Date() } });
      await logActivity(tx, {
        agencyId: ctx.supportSession.agencyId,
        actor: userActor(ctx.userId, true),
        eventType: 'support.session_ended',
        entityType: 'support_session',
        entityId: ctx.supportSession.id,
        metadata: { agencyName: ctx.supportSession.agencyName, reason: 'logout' },
      });
    }
  });
}
