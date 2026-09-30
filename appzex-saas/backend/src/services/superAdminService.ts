import type { AgencyPlan, AgencyStatus, Prisma } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import type { AuthContext } from '../types/auth';
import { conflict, notFound } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/pagination';
import { hashPassword } from '../utils/password';
import { activitySelect, logActivity, userActor } from './activityService';
import { OPEN_FEEDBACK_STATUSES } from './feedbackService';
import { getProgressForProjects } from './progressService';

/** Platform-level events shown on the super admin dashboard. */
const PLATFORM_EVENTS = [
  'agency.created',
  'agency.suspended',
  'agency.activated',
  'support.session_started',
  'support.session_ended',
  'user.created',
  'client.created',
  'project.created',
];

export async function getPlatformDashboard() {
  const [
    totalAgencies,
    activeAgencies,
    suspendedAgencies,
    totalUsers,
    totalClients,
    totalProjects,
    planGroups,
    recentAgencies,
    recentActivity,
  ] = await Promise.all([
    prisma.agency.count(),
    prisma.agency.count({ where: { status: 'ACTIVE' } }),
    prisma.agency.count({ where: { status: 'SUSPENDED' } }),
    prisma.user.count({ where: { role: { not: 'SUPER_ADMIN' } } }),
    prisma.client.count({ where: { deletedAt: null } }),
    prisma.project.count({ where: { deletedAt: null } }),
    prisma.agency.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.agency.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, name: true, status: true, plan: true, createdAt: true },
    }),
    prisma.activityLog.findMany({
      where: { eventType: { in: PLATFORM_EVENTS } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { ...activitySelect, agency: { select: { id: true, name: true } } },
    }),
  ]);

  return {
    stats: { totalAgencies, activeAgencies, suspendedAgencies, totalUsers, totalClients, totalProjects },
    planDistribution: (['STARTER', 'GROWTH', 'ENTERPRISE'] as AgencyPlan[]).map((plan) => ({
      plan,
      count: planGroups.find((group) => group.plan === plan)?._count._all ?? 0,
    })),
    recentAgencies,
    recentActivity,
  };
}

export interface ListAgenciesQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: AgencyStatus;
  plan?: AgencyPlan;
  sort: 'name' | 'createdAt' | 'status' | 'plan';
  order: 'asc' | 'desc';
}

export async function listAgencies(query: ListAgenciesQuery) {
  const where: Prisma.AgencyWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.plan ? { plan: query.plan } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search } },
            { slug: { contains: query.search } },
            { contactEmail: { contains: query.search } },
            { owner: { is: { OR: [{ name: { contains: query.search } }, { email: { contains: query.search } }] } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.agency.findMany({
      where,
      orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
      ...toSkipTake(query.page, query.pageSize),
      select: {
        id: true,
        name: true,
        slug: true,
        contactEmail: true,
        phone: true,
        status: true,
        plan: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            members: true,
            clients: { where: { deletedAt: null } },
            projects: { where: { deletedAt: null } },
          },
        },
      },
    }),
    prisma.agency.count({ where }),
  ]);

  const clientUserCounts = await countClientUsersByAgency(rows.map((row) => row.id));

  const items = rows.map(({ _count, ...row }) => ({
    ...row,
    counts: {
      teamMembers: _count.members,
      clientUsers: clientUserCounts.get(row.id) ?? 0,
      users: _count.members + (clientUserCounts.get(row.id) ?? 0),
      clients: _count.clients,
      projects: _count.projects,
    },
  }));
  return paginate(items, total, query.page, query.pageSize);
}

async function countClientUsersByAgency(agencyIds: string[]) {
  const clients = await prisma.client.findMany({
    where: { agencyId: { in: agencyIds } },
    select: { agencyId: true, _count: { select: { users: true } } },
  });
  const counts = new Map<string, number>();
  for (const client of clients) counts.set(client.agencyId, (counts.get(client.agencyId) ?? 0) + client._count.users);
  return counts;
}

export async function getAgencyDetail(agencyId: string) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: {
      id: true,
      name: true,
      slug: true,
      contactEmail: true,
      phone: true,
      website: true,
      status: true,
      plan: true,
      suspendedAt: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });
  if (!agency) throw notFound('Agency not found');

  const [members, clients, projects, taskGroups, openFeedback, fileCount, recentActivity, supportSessions] =
    await Promise.all([
      prisma.agencyMember.findMany({
        where: { agencyId },
        orderBy: { createdAt: 'asc' },
        select: {
          jobTitle: true,
          user: { select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true } },
        },
      }),
      prisma.client.findMany({
        where: { agencyId, deletedAt: null },
        orderBy: { companyName: 'asc' },
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
          portalEnabled: true,
          createdAt: true,
          _count: { select: { projects: { where: { deletedAt: null } }, users: true } },
        },
      }),
      prisma.project.findMany({
        where: { agencyId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          status: true,
          priority: true,
          dueDate: true,
          createdAt: true,
          client: { select: { id: true, companyName: true } },
          manager: { select: { id: true, name: true } },
        },
      }),
      prisma.task.groupBy({
        by: ['status'],
        where: { agencyId, project: { deletedAt: null } },
        _count: { _all: true },
      }),
      prisma.feedback.count({ where: { agencyId, status: { in: OPEN_FEEDBACK_STATUSES } } }),
      prisma.projectFile.count({ where: { agencyId } }),
      prisma.activityLog.findMany({
        where: { agencyId },
        orderBy: { createdAt: 'desc' },
        take: 15,
        select: activitySelect,
      }),
      prisma.supportSession.findMany({
        where: { agencyId },
        orderBy: { startedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          reason: true,
          startedAt: true,
          endedAt: true,
          expiresAt: true,
          superAdmin: { select: { id: true, name: true } },
        },
      }),
    ]);

  const progress = await getProgressForProjects(
    agencyId,
    projects.map((project) => project.id),
  );
  const totalTasks = taskGroups.reduce((sum, group) => sum + group._count._all, 0);
  const completedTasks = taskGroups.find((group) => group.status === 'COMPLETED')?._count._all ?? 0;

  return {
    ...agency,
    stats: {
      teamMembers: members.length,
      clients: clients.length,
      projects: projects.length,
      activeProjects: projects.filter((project) => project.status === 'ACTIVE').length,
      totalTasks,
      completedTasks,
      openFeedback,
      files: fileCount,
    },
    members: members.map((member) => ({ ...member.user, jobTitle: member.jobTitle })),
    clients: clients.map(({ _count, ...client }) => ({
      ...client,
      projectCount: _count.projects,
      portalUserCount: _count.users,
    })),
    projects: projects.map((project) => ({ ...project, progress: progress.get(project.id)! })),
    recentActivity,
    supportSessions,
  };
}

export async function updateAgencyStatus(ctx: AuthContext, agencyId: string, status: AgencyStatus, reason?: string) {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw notFound('Agency not found');
  if (agency.status === status) return agency;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.agency.update({
      where: { id: agency.id },
      data: { status, suspendedAt: status === 'SUSPENDED' ? new Date() : null },
    });
    await logActivity(tx, {
      agencyId: agency.id,
      actor: userActor(ctx.userId, true),
      eventType: status === 'SUSPENDED' ? 'agency.suspended' : 'agency.activated',
      entityType: 'agency',
      entityId: agency.id,
      metadata: { agencyName: agency.name, ...(reason ? { reason } : {}) },
    });
    return updated;
  });
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'agency'
  );
}

export async function createAgency(
  ctx: AuthContext,
  input: {
    name: string;
    contactEmail: string;
    phone?: string | null;
    plan: AgencyPlan;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
  },
) {
  const emailTaken = await prisma.user.findUnique({ where: { email: input.adminEmail }, select: { id: true } });
  if (emailTaken) throw conflict('A user with the admin email already exists.');

  const baseSlug = slugify(input.name);
  let slug = baseSlug;
  for (let attempt = 2; await prisma.agency.findUnique({ where: { slug }, select: { id: true } }); attempt += 1) {
    slug = `${baseSlug}-${attempt}`;
  }

  const passwordHash = await hashPassword(input.adminPassword);

  return prisma.$transaction(async (tx) => {
    const admin = await tx.user.create({
      data: { name: input.adminName, email: input.adminEmail, passwordHash, role: 'AGENCY_ADMIN' },
    });
    const agency = await tx.agency.create({
      data: {
        name: input.name,
        slug,
        contactEmail: input.contactEmail,
        phone: input.phone ?? null,
        plan: input.plan,
        ownerId: admin.id,
        members: { create: { userId: admin.id, jobTitle: 'Agency Owner' } },
      },
      select: { id: true, name: true, slug: true, status: true, plan: true, createdAt: true },
    });
    const actor = userActor(ctx.userId, true);
    await logActivity(tx, {
      agencyId: agency.id,
      actor,
      eventType: 'agency.created',
      entityType: 'agency',
      entityId: agency.id,
      metadata: { agencyName: agency.name, plan: agency.plan },
    });
    await logActivity(tx, {
      agencyId: agency.id,
      actor,
      eventType: 'user.created',
      entityType: 'user',
      entityId: admin.id,
      metadata: { name: admin.name, role: admin.role },
    });
    return agency;
  });
}

// ----- Support mode ---------------------------------------------------------------

export async function startSupportSession(ctx: AuthContext, agencyId: string, reason?: string) {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { id: true, name: true, status: true },
  });
  if (!agency) throw notFound('Agency not found');

  return prisma.$transaction(async (tx) => {
    // Only one open session per super admin.
    const open = await tx.supportSession.findMany({
      where: { superAdminId: ctx.userId, endedAt: null },
      select: { id: true, agencyId: true },
    });
    if (open.length > 0) {
      await tx.supportSession.updateMany({
        where: { id: { in: open.map((session) => session.id) } },
        data: { endedAt: new Date() },
      });
    }

    const session = await tx.supportSession.create({
      data: {
        superAdminId: ctx.userId,
        agencyId: agency.id,
        reason: reason || null,
        expiresAt: new Date(Date.now() + env.SUPPORT_SESSION_MINUTES * 60 * 1000),
      },
      select: { id: true, agencyId: true, startedAt: true, expiresAt: true },
    });

    await logActivity(tx, {
      agencyId: agency.id,
      actor: userActor(ctx.userId, true),
      eventType: 'support.session_started',
      entityType: 'support_session',
      entityId: session.id,
      metadata: { agencyName: agency.name, readOnly: true, ...(reason ? { reason } : {}) },
    });

    return { ...session, agencyName: agency.name, readOnly: true };
  });
}

export async function endSupportSession(ctx: AuthContext, sessionId: string) {
  const session = await prisma.supportSession.findFirst({
    where: { id: sessionId, superAdminId: ctx.userId },
    select: { id: true, agencyId: true, endedAt: true, startedAt: true, agency: { select: { name: true } } },
  });
  if (!session) throw notFound('Support session not found');
  if (session.endedAt) return { id: session.id, endedAt: session.endedAt };

  return prisma.$transaction(async (tx) => {
    const ended = await tx.supportSession.update({
      where: { id: session.id },
      data: { endedAt: new Date() },
      select: { id: true, endedAt: true },
    });
    await logActivity(tx, {
      agencyId: session.agencyId,
      actor: userActor(ctx.userId, true),
      eventType: 'support.session_ended',
      entityType: 'support_session',
      entityId: session.id,
      metadata: {
        agencyName: session.agency.name,
        durationMinutes: Math.max(1, Math.round((Date.now() - session.startedAt.getTime()) / 60000)),
      },
    });
    return ended;
  });
}
