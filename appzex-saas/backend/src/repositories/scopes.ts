import type { Prisma } from '@prisma/client';
import type { ClientContext } from '../types/auth';

/*
 * Tenant scope builders.
 *
 * Every query for tenant data is built from one of these functions. The
 * agencyId / clientId arguments always come from the authenticated request
 * context (req.auth), never from params, query strings or request bodies.
 * Soft-deleted projects and clients are excluded here so no caller can
 * forget to do it.
 */

// ----- Agency workspace -----------------------------------------------------

export const agencyClients = (agencyId: string): Prisma.ClientWhereInput => ({ agencyId, deletedAt: null });

export const agencyProjects = (agencyId: string): Prisma.ProjectWhereInput => ({ agencyId, deletedAt: null });

export const agencyMilestones = (agencyId: string): Prisma.MilestoneWhereInput => ({
  agencyId,
  project: { deletedAt: null },
});

export const agencyTasks = (agencyId: string): Prisma.TaskWhereInput => ({
  agencyId,
  project: { deletedAt: null },
});

export const agencyMeetings = (agencyId: string): Prisma.MeetingWhereInput => ({
  agencyId,
  project: { deletedAt: null },
});

export const agencyFeedback = (agencyId: string): Prisma.FeedbackWhereInput => ({
  agencyId,
  project: { deletedAt: null },
});

export const agencyFiles = (agencyId: string): Prisma.ProjectFileWhereInput => ({
  agencyId,
  project: { deletedAt: null },
});

/**
 * Activity for one client company inside an agency workspace.
 *
 * Derived from the caller's agency plus the client's own projects, so a client
 * id from another tenant can never widen the result set: it only ever narrows
 * it. Client-level events (the client record itself, its portal users) carry no
 * projectId, so they are matched explicitly rather than dropped.
 */
export const clientScopedActivity = (agencyId: string, clientId: string): Prisma.ActivityLogWhereInput => ({
  agencyId,
  OR: [{ project: { clientId, deletedAt: null } }, { entityType: 'client', entityId: clientId }],
});

// ----- Client portal ----------------------------------------------------------
// Clients are scoped by agency AND by their own client company, and only see
// records the agency explicitly marked as client-visible.

export const clientProjects = (ctx: ClientContext): Prisma.ProjectWhereInput => ({
  agencyId: ctx.agencyId,
  clientId: ctx.clientId,
  deletedAt: null,
});

export const clientMilestones = (ctx: ClientContext): Prisma.MilestoneWhereInput => ({
  agencyId: ctx.agencyId,
  project: clientProjects(ctx),
});

export const clientTasks = (ctx: ClientContext): Prisma.TaskWhereInput => ({
  agencyId: ctx.agencyId,
  clientVisible: true,
  project: clientProjects(ctx),
});

export const clientMeetings = (ctx: ClientContext): Prisma.MeetingWhereInput => ({
  agencyId: ctx.agencyId,
  clientVisible: true,
  project: clientProjects(ctx),
});

export const clientFiles = (ctx: ClientContext): Prisma.ProjectFileWhereInput => ({
  agencyId: ctx.agencyId,
  clientVisible: true,
  project: clientProjects(ctx),
});

export const clientFeedback = (ctx: ClientContext): Prisma.FeedbackWhereInput => ({
  agencyId: ctx.agencyId,
  project: clientProjects(ctx),
});

export const clientActivity = (ctx: ClientContext): Prisma.ActivityLogWhereInput => ({
  agencyId: ctx.agencyId,
  visibility: 'CLIENT',
  project: clientProjects(ctx),
});
