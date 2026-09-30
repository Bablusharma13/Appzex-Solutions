import { prisma } from '../config/prisma';
import { agencyClients, agencyFeedback, agencyMilestones, agencyProjects, agencyTasks } from '../repositories/scopes';
import type { AgencyContext } from '../types/auth';
import { addDays, startOfTodayUtc } from '../utils/dates';
import { conflict, notFound } from '../utils/errors';
import { hashPassword } from '../utils/password';
import { activitySelect, logActivity, userActor } from './activityService';
import { OPEN_FEEDBACK_STATUSES } from './feedbackService';
import { getProgressForProjects } from './progressService';

/** All dashboard numbers are calculated from the database on request. */
export async function getAgencyDashboard(agencyId: string) {
  const today = startOfTodayUtc();
  const soon = addDays(today, 14);
  const week = addDays(today, 7);
  const projects = agencyProjects(agencyId);
  const tasks = agencyTasks(agencyId);

  const [
    totalClients,
    projectGroups,
    dueSoon,
    overdueProjects,
    pendingFeedback,
    taskGroups,
    overdueTasks,
    activeProjects,
    upcomingTasks,
    upcomingMilestones,
    recentActivity,
  ] = await Promise.all([
    prisma.client.count({ where: agencyClients(agencyId) }),
    prisma.project.groupBy({ by: ['status'], where: projects, _count: { _all: true } }),
    prisma.project.count({ where: { ...projects, status: { not: 'COMPLETED' }, dueDate: { gte: today, lte: soon } } }),
    prisma.project.count({ where: { ...projects, status: { not: 'COMPLETED' }, dueDate: { lt: today } } }),
    prisma.feedback.count({ where: { ...agencyFeedback(agencyId), status: { in: OPEN_FEEDBACK_STATUSES } } }),
    prisma.task.groupBy({ by: ['status'], where: tasks, _count: { _all: true } }),
    prisma.task.count({ where: { ...tasks, status: { not: 'COMPLETED' }, dueDate: { lt: today } } }),
    prisma.project.findMany({
      where: { ...projects, status: { not: 'COMPLETED' } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 8,
      select: { id: true, name: true, status: true, dueDate: true, client: { select: { companyName: true } } },
    }),
    prisma.task.findMany({
      where: { ...tasks, status: { not: 'COMPLETED' }, dueDate: { not: null, lte: week } },
      orderBy: { dueDate: 'asc' },
      take: 8,
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
      },
    }),
    prisma.milestone.findMany({
      where: { ...agencyMilestones(agencyId), status: { not: 'COMPLETED' }, dueDate: { gte: today, lte: soon } },
      orderBy: { dueDate: 'asc' },
      take: 6,
      select: { id: true, name: true, dueDate: true, status: true, project: { select: { id: true, name: true } } },
    }),
    prisma.activityLog.findMany({
      where: { agencyId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: activitySelect,
    }),
  ]);

  const projectCount = (status: string) => projectGroups.find((g) => g.status === status)?._count._all ?? 0;
  const taskCount = (status: string) => taskGroups.find((g) => g.status === status)?._count._all ?? 0;
  const progress = await getProgressForProjects(
    agencyId,
    activeProjects.map((project) => project.id),
  );

  return {
    stats: {
      totalClients,
      activeProjects: projectCount('ACTIVE'),
      onHoldProjects: projectCount('ON_HOLD'),
      completedProjects: projectCount('COMPLETED'),
      projectsDueSoon: dueSoon,
      overdueProjects,
      pendingFeedback,
      totalTasks: taskGroups.reduce((sum, g) => sum + g._count._all, 0),
      overdueTasks,
    },
    charts: {
      projectStatus: [
        { status: 'ACTIVE', count: projectCount('ACTIVE') },
        { status: 'ON_HOLD', count: projectCount('ON_HOLD') },
        { status: 'COMPLETED', count: projectCount('COMPLETED') },
      ],
      taskStatus: [
        { status: 'TODO', count: taskCount('TODO') },
        { status: 'IN_PROGRESS', count: taskCount('IN_PROGRESS') },
        { status: 'COMPLETED', count: taskCount('COMPLETED') },
      ],
      projectProgress: activeProjects.map((project) => ({
        id: project.id,
        name: project.name,
        clientName: project.client.companyName,
        dueDate: project.dueDate,
        status: project.status,
        percent: progress.get(project.id)?.percent ?? 0,
        completedTasks: progress.get(project.id)?.completedTasks ?? 0,
        totalTasks: progress.get(project.id)?.totalTasks ?? 0,
      })),
    },
    upcomingTasks,
    upcomingMilestones,
    recentActivity,
  };
}

// ----- Settings -----------------------------------------------------------------

const agencySettingsSelect = {
  id: true,
  name: true,
  slug: true,
  contactEmail: true,
  phone: true,
  website: true,
  status: true,
  plan: true,
  createdAt: true,
  owner: { select: { id: true, name: true, email: true } },
} as const;

export async function getAgencySettings(agencyId: string) {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId }, select: agencySettingsSelect });
  if (!agency) throw notFound('Agency not found');
  return agency;
}

export async function updateAgencySettings(
  ctx: AgencyContext,
  input: { name?: string; contactEmail?: string; phone?: string | null; website?: string | null },
) {
  return prisma.$transaction(async (tx) => {
    const agency = await tx.agency.update({
      where: { id: ctx.agencyId },
      data: { name: input.name, contactEmail: input.contactEmail, phone: input.phone, website: input.website },
      select: agencySettingsSelect,
    });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      actor: userActor(ctx.userId),
      eventType: 'agency.updated',
      entityType: 'agency',
      entityId: ctx.agencyId,
      metadata: { fields: Object.keys(input).filter((key) => input[key as keyof typeof input] !== undefined) },
    });
    return agency;
  });
}

// ----- Team ---------------------------------------------------------------------

export async function listTeam(agencyId: string) {
  const members = await prisma.agencyMember.findMany({
    where: { agencyId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      jobTitle: true,
      createdAt: true,
      user: { select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true } },
    },
  });

  const userIds = members.map((member) => member.user.id);
  const [openTaskGroups, managedGroups] = await Promise.all([
    prisma.task.groupBy({
      by: ['assigneeId'],
      where: { ...agencyTasks(agencyId), assigneeId: { in: userIds }, status: { not: 'COMPLETED' } },
      _count: { _all: true },
    }),
    prisma.project.groupBy({
      by: ['managerId'],
      where: { ...agencyProjects(agencyId), managerId: { in: userIds }, status: { not: 'COMPLETED' } },
      _count: { _all: true },
    }),
  ]);

  return members.map((member) => ({
    id: member.user.id,
    membershipId: member.id,
    name: member.user.name,
    email: member.user.email,
    role: member.user.role,
    jobTitle: member.jobTitle,
    isActive: member.user.isActive,
    lastLoginAt: member.user.lastLoginAt,
    joinedAt: member.createdAt,
    openTasks: openTaskGroups.find((g) => g.assigneeId === member.user.id)?._count._all ?? 0,
    activeProjects: managedGroups.find((g) => g.managerId === member.user.id)?._count._all ?? 0,
  }));
}

export async function createTeamMember(
  ctx: AgencyContext,
  input: {
    name: string;
    email: string;
    role: 'AGENCY_ADMIN' | 'AGENCY_MEMBER';
    jobTitle?: string | null;
    password: string;
  },
) {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) throw conflict('A user with this email already exists.');

  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role,
        // agencyId comes from the session, never from the request body.
        membership: { create: { agencyId: ctx.agencyId, jobTitle: input.jobTitle ?? null } },
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      actor: userActor(ctx.userId),
      eventType: 'user.created',
      entityType: 'user',
      entityId: user.id,
      metadata: { name: user.name, role: user.role },
    });
    return user;
  });
}
