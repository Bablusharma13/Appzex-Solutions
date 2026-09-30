import type { Prisma, ProjectStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { agencyProjects } from '../repositories/scopes';
import { assertClientInAgency, assertMemberOfAgency, findAgencyProjectOrThrow } from '../repositories/tenantRepository';
import type { AgencyContext } from '../types/auth';
import { addDays, daysBetween, startOfTodayUtc } from '../utils/dates';
import { validationFailed } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/pagination';
import { logActivity, userActor } from './activityService';
import { getProgressForProjects, getProjectProgress } from './progressService';

const DEFAULT_MILESTONES = ['Planning', 'Design', 'Development', 'Testing', 'Client Review', 'Launch'];

const projectListSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  priority: true,
  startDate: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, companyName: true } },
  manager: { select: { id: true, name: true } },
  _count: {
    select: {
      milestones: true,
      feedback: { where: { status: { in: ['OPEN', 'IN_REVIEW', 'IN_PROGRESS'] as const } } },
    },
  },
} satisfies Prisma.ProjectSelect;

export interface ListProjectsQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: ProjectStatus;
  priority?: Prisma.ProjectWhereInput['priority'];
  clientId?: string;
  managerId?: string;
  sort: 'createdAt' | 'dueDate' | 'name' | 'priority';
  order: 'asc' | 'desc';
}

export async function listProjects(agencyId: string, query: ListProjectsQuery) {
  const where: Prisma.ProjectWhereInput = {
    ...agencyProjects(agencyId),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.managerId ? { managerId: query.managerId } : {}),
    ...(query.search
      ? {
          OR: [{ name: { contains: query.search } }, { client: { companyName: { contains: query.search } } }],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.project.findMany({
      where,
      select: projectListSelect,
      orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
      ...toSkipTake(query.page, query.pageSize),
    }),
    prisma.project.count({ where }),
  ]);

  const progress = await getProgressForProjects(
    agencyId,
    rows.map((row) => row.id),
  );
  const items = rows.map(({ _count, ...row }) => ({
    ...row,
    milestoneCount: _count.milestones,
    openFeedbackCount: _count.feedback,
    progress: progress.get(row.id)!,
  }));
  return paginate(items, total, query.page, query.pageSize);
}

export async function getProject(agencyId: string, projectId: string) {
  await findAgencyProjectOrThrow(agencyId, projectId);

  const [project, progress, taskGroups, milestoneGroups, openFeedback, nextMilestone] = await Promise.all([
    prisma.project.findFirstOrThrow({
      where: { id: projectId, ...agencyProjects(agencyId) },
      select: {
        ...projectListSelect,
        client: { select: { id: true, companyName: true, contactName: true, email: true } },
        manager: { select: { id: true, name: true, email: true } },
      },
    }),
    getProjectProgress(agencyId, projectId),
    prisma.task.groupBy({ by: ['status'], where: { agencyId, projectId }, _count: { _all: true } }),
    prisma.milestone.groupBy({ by: ['status'], where: { agencyId, projectId }, _count: { _all: true } }),
    prisma.feedback.count({ where: { agencyId, projectId, status: { in: ['OPEN', 'IN_REVIEW', 'IN_PROGRESS'] } } }),
    prisma.milestone.findFirst({
      where: { agencyId, projectId, status: { not: 'COMPLETED' } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true, dueDate: true, status: true },
    }),
  ]);

  const today = startOfTodayUtc();
  const overdueTasks = await prisma.task.count({
    where: { agencyId, projectId, status: { not: 'COMPLETED' }, dueDate: { lt: today } },
  });

  const countBy = <T extends string>(groups: { status: T; _count: { _all: number } }[], status: T) =>
    groups.find((group) => group.status === status)?._count._all ?? 0;

  const { _count, ...rest } = project;
  return {
    ...rest,
    milestoneCount: _count.milestones,
    openFeedbackCount: openFeedback,
    progress,
    taskCounts: {
      todo: countBy(taskGroups, 'TODO'),
      inProgress: countBy(taskGroups, 'IN_PROGRESS'),
      completed: countBy(taskGroups, 'COMPLETED'),
      overdue: overdueTasks,
    },
    milestoneCounts: {
      pending: countBy(milestoneGroups, 'PENDING'),
      inProgress: countBy(milestoneGroups, 'IN_PROGRESS'),
      completed: countBy(milestoneGroups, 'COMPLETED'),
    },
    nextMilestone,
    daysUntilDue: project.dueDate ? daysBetween(today, project.dueDate) : null,
  };
}

export interface ProjectInput {
  name?: string;
  description?: string | null;
  clientId?: string;
  startDate?: Date | null;
  dueDate?: Date | null;
  status?: ProjectStatus;
  priority?: Prisma.ProjectCreateInput['priority'];
  managerId?: string | null;
  createDefaultMilestones?: boolean;
}

/** Spreads default milestone due dates across the project timeline. */
function defaultMilestoneDates(startDate: Date | null | undefined, dueDate: Date | null | undefined) {
  if (!dueDate) return DEFAULT_MILESTONES.map(() => null);
  const start = startDate ?? startOfTodayUtc();
  const span = Math.max(daysBetween(start, dueDate), DEFAULT_MILESTONES.length);
  return DEFAULT_MILESTONES.map((_, index) =>
    addDays(start, Math.round((span * (index + 1)) / DEFAULT_MILESTONES.length)),
  );
}

export async function createProject(ctx: AgencyContext, input: ProjectInput & { name: string; clientId: string }) {
  // Never trust ids from the browser: both must belong to the caller's agency.
  await assertClientInAgency(ctx.agencyId, input.clientId);
  if (input.managerId) await assertMemberOfAgency(ctx.agencyId, input.managerId, 'managerId');

  const status = input.status ?? 'ACTIVE';

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        agencyId: ctx.agencyId,
        clientId: input.clientId,
        name: input.name,
        description: input.description ?? null,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        status,
        priority: input.priority ?? 'MEDIUM',
        managerId: input.managerId ?? null,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
      select: { id: true, name: true, clientId: true },
    });

    if (input.createDefaultMilestones) {
      const dates = defaultMilestoneDates(input.startDate, input.dueDate);
      await tx.milestone.createMany({
        data: DEFAULT_MILESTONES.map((name, index) => ({
          agencyId: ctx.agencyId,
          projectId: project.id,
          name,
          order: index + 1,
          dueDate: dates[index],
        })),
      });
    }

    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: project.id,
      actor: userActor(ctx.userId),
      eventType: 'project.created',
      entityType: 'project',
      entityId: project.id,
      visibility: 'CLIENT',
      metadata: { projectName: project.name },
    });

    return project;
  });
}

export async function updateProject(ctx: AgencyContext, projectId: string, input: ProjectInput) {
  const existing = await findAgencyProjectOrThrow(ctx.agencyId, projectId);
  if (input.clientId && input.clientId !== existing.clientId) await assertClientInAgency(ctx.agencyId, input.clientId);
  if (input.managerId) await assertMemberOfAgency(ctx.agencyId, input.managerId, 'managerId');

  const startDate = input.startDate === undefined ? existing.startDate : input.startDate;
  const dueDate = input.dueDate === undefined ? existing.dueDate : input.dueDate;
  if (startDate && dueDate && dueDate < startDate) {
    throw validationFailed([{ path: 'dueDate', message: 'Expected completion must be on or after the start date' }]);
  }

  const statusChanged = input.status !== undefined && input.status !== existing.status;
  const changedFields = Object.entries(input)
    .filter(([key, value]) => value !== undefined && key !== 'createDefaultMilestones')
    .map(([key]) => key);

  return prisma.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description,
        clientId: input.clientId,
        startDate: input.startDate,
        dueDate: input.dueDate,
        priority: input.priority,
        managerId: input.managerId,
        status: input.status,
        ...(statusChanged ? { completedAt: input.status === 'COMPLETED' ? new Date() : null } : {}),
      },
      select: { id: true, name: true, status: true },
    });

    if (statusChanged) {
      await logActivity(tx, {
        agencyId: ctx.agencyId,
        projectId: project.id,
        actor: userActor(ctx.userId),
        eventType: 'project.status_changed',
        entityType: 'project',
        entityId: project.id,
        visibility: 'CLIENT',
        metadata: { projectName: project.name, from: existing.status, to: project.status },
      });
    }
    const otherChanges = changedFields.filter((field) => field !== 'status');
    if (otherChanges.length > 0) {
      await logActivity(tx, {
        agencyId: ctx.agencyId,
        projectId: project.id,
        actor: userActor(ctx.userId),
        eventType: 'project.updated',
        entityType: 'project',
        entityId: project.id,
        metadata: { projectName: project.name, fields: otherChanges },
      });
    }
    return project;
  });
}

/** Soft delete: project data is retained for audit and can be restored by support. */
export async function deleteProject(ctx: AgencyContext, projectId: string) {
  const existing = await findAgencyProjectOrThrow(ctx.agencyId, projectId);
  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: existing.id,
      actor: userActor(ctx.userId),
      eventType: 'project.deleted',
      entityType: 'project',
      entityId: existing.id,
      metadata: { projectName: existing.name },
    });
  });
}
