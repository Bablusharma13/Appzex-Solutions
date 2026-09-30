import type { Priority, Prisma, TaskStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { agencyTasks } from '../repositories/scopes';
import {
  assertMemberOfAgency,
  assertMilestoneInProject,
  findAgencyProjectOrThrow,
  findAgencyTaskOrThrow,
} from '../repositories/tenantRepository';
import type { AgencyContext } from '../types/auth';
import { addDays, startOfTodayUtc } from '../utils/dates';
import { paginate, toSkipTake } from '../utils/pagination';
import { logActivity, userActor } from './activityService';
import { getProjectProgress } from './progressService';

export const taskSelect = {
  id: true,
  projectId: true,
  milestoneId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  clientVisible: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true, client: { select: { id: true, companyName: true } } } },
  milestone: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { comments: true, files: true } },
} satisfies Prisma.TaskSelect;

type TaskRow = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

function toTaskDto({ _count, ...task }: TaskRow) {
  return { ...task, commentCount: _count.comments, fileCount: _count.files };
}

export interface ListTasksQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: TaskStatus;
  priority?: Priority;
  assigneeId?: string;
  projectId?: string;
  milestoneId?: string;
  due?: 'overdue' | 'today' | 'week' | 'completed';
  sort: 'dueDate' | 'createdAt' | 'priority' | 'title';
  order: 'asc' | 'desc';
}

function dueFilter(due: ListTasksQuery['due']): Prisma.TaskWhereInput {
  const today = startOfTodayUtc();
  switch (due) {
    case 'overdue':
      return { status: { not: 'COMPLETED' }, dueDate: { lt: today } };
    case 'today':
      return { status: { not: 'COMPLETED' }, dueDate: today };
    case 'week':
      return { status: { not: 'COMPLETED' }, dueDate: { gte: today, lte: addDays(today, 6) } };
    case 'completed':
      return { status: 'COMPLETED' };
    default:
      return {};
  }
}

function assigneeFilter(ctx: AgencyContext, assigneeId?: string): Prisma.TaskWhereInput {
  if (!assigneeId) return {};
  if (assigneeId === 'unassigned') return { assigneeId: null };
  return { assigneeId: assigneeId === 'me' ? ctx.userId : assigneeId };
}

export async function listTasks(ctx: AgencyContext, query: ListTasksQuery) {
  const where: Prisma.TaskWhereInput = {
    ...agencyTasks(ctx.agencyId),
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...(query.milestoneId ? { milestoneId: query.milestoneId } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.search ? { title: { contains: query.search } } : {}),
    ...assigneeFilter(ctx, query.assigneeId),
    ...dueFilter(query.due),
    // An explicit status filter wins over the status implied by `due`.
    ...(query.status ? { status: query.status } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: taskSelect,
      orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
      ...toSkipTake(query.page, query.pageSize),
    }),
    prisma.task.count({ where }),
  ]);
  return paginate(rows.map(toTaskDto), total, query.page, query.pageSize);
}

export async function listProjectTasks(ctx: AgencyContext, projectId: string, query: ListTasksQuery) {
  await findAgencyProjectOrThrow(ctx.agencyId, projectId);
  return listTasks(ctx, { ...query, projectId });
}

export async function getTaskSummary(ctx: AgencyContext, filters: { assigneeId?: string; projectId?: string }) {
  const base: Prisma.TaskWhereInput = {
    ...agencyTasks(ctx.agencyId),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...assigneeFilter(ctx, filters.assigneeId),
  };
  const [all, overdue, today, week, completed] = await Promise.all([
    prisma.task.count({ where: base }),
    prisma.task.count({ where: { ...base, ...dueFilter('overdue') } }),
    prisma.task.count({ where: { ...base, ...dueFilter('today') } }),
    prisma.task.count({ where: { ...base, ...dueFilter('week') } }),
    prisma.task.count({ where: { ...base, ...dueFilter('completed') } }),
  ]);
  return { all, overdue, today, week, completed };
}

export async function getTask(agencyId: string, taskId: string) {
  await findAgencyTaskOrThrow(agencyId, taskId);
  const task = await prisma.task.findFirstOrThrow({
    where: { id: taskId, ...agencyTasks(agencyId) },
    select: taskSelect,
  });
  return toTaskDto(task);
}

export interface TaskInput {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  milestoneId?: string | null;
  status?: TaskStatus;
  priority?: Priority;
  dueDate?: Date | null;
  clientVisible?: boolean;
}

export async function createTask(ctx: AgencyContext, projectId: string, input: TaskInput & { title: string }) {
  const project = await findAgencyProjectOrThrow(ctx.agencyId, projectId);
  if (input.milestoneId) await assertMilestoneInProject(ctx.agencyId, project.id, input.milestoneId);
  if (input.assigneeId) await assertMemberOfAgency(ctx.agencyId, input.assigneeId, 'assigneeId');

  const status = input.status ?? 'TODO';
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({
      data: {
        agencyId: ctx.agencyId,
        projectId: project.id,
        milestoneId: input.milestoneId ?? null,
        title: input.title,
        description: input.description ?? null,
        assigneeId: input.assigneeId ?? null,
        createdById: ctx.userId,
        status,
        priority: input.priority ?? 'MEDIUM',
        dueDate: input.dueDate ?? null,
        clientVisible: input.clientVisible ?? false,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
      select: taskSelect,
    });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: project.id,
      actor: userActor(ctx.userId),
      eventType: 'task.created',
      entityType: 'task',
      entityId: created.id,
      visibility: created.clientVisible ? 'CLIENT' : 'INTERNAL',
      metadata: { title: created.title, projectName: project.name },
    });
    return created;
  });

  return { task: toTaskDto(task), projectProgress: await getProjectProgress(ctx.agencyId, project.id) };
}

export async function updateTask(ctx: AgencyContext, taskId: string, input: TaskInput) {
  const existing = await findAgencyTaskOrThrow(ctx.agencyId, taskId);
  if (input.milestoneId) await assertMilestoneInProject(ctx.agencyId, existing.projectId, input.milestoneId);
  if (input.assigneeId) await assertMemberOfAgency(ctx.agencyId, input.assigneeId, 'assigneeId');

  const statusChanged = input.status !== undefined && input.status !== existing.status;

  const task = await prisma.$transaction(async (tx) => {
    const updated = await tx.task.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        description: input.description,
        assigneeId: input.assigneeId,
        milestoneId: input.milestoneId,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate,
        clientVisible: input.clientVisible,
        ...(statusChanged ? { completedAt: input.status === 'COMPLETED' ? new Date() : null } : {}),
      },
      select: taskSelect,
    });

    let eventType = 'task.updated';
    if (statusChanged && updated.status === 'COMPLETED') eventType = 'task.completed';
    else if (statusChanged && existing.status === 'COMPLETED') eventType = 'task.reopened';
    else if (statusChanged) eventType = 'task.status_changed';

    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: updated.projectId,
      actor: userActor(ctx.userId),
      eventType,
      entityType: 'task',
      entityId: updated.id,
      visibility: updated.clientVisible && eventType === 'task.completed' ? 'CLIENT' : 'INTERNAL',
      metadata: {
        title: updated.title,
        projectName: updated.project.name,
        ...(statusChanged ? { from: existing.status, to: updated.status } : {}),
      },
    });
    return updated;
  });

  // Progress is recalculated from tasks after every change.
  return { task: toTaskDto(task), projectProgress: await getProjectProgress(ctx.agencyId, task.projectId) };
}

export async function deleteTask(ctx: AgencyContext, taskId: string) {
  const existing = await findAgencyTaskOrThrow(ctx.agencyId, taskId);
  await prisma.$transaction(async (tx) => {
    await tx.task.delete({ where: { id: existing.id } });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: existing.projectId,
      actor: userActor(ctx.userId),
      eventType: 'task.deleted',
      entityType: 'task',
      entityId: existing.id,
      metadata: { title: existing.title },
    });
  });
  return { projectProgress: await getProjectProgress(ctx.agencyId, existing.projectId) };
}

// ----- Comments -----------------------------------------------------------------

const commentSelect = {
  id: true,
  content: true,
  createdAt: true,
  user: { select: { id: true, name: true, role: true } },
} satisfies Prisma.TaskCommentSelect;

export async function listTaskComments(agencyId: string, taskId: string) {
  const task = await findAgencyTaskOrThrow(agencyId, taskId);
  return prisma.taskComment.findMany({
    where: { agencyId, taskId: task.id },
    orderBy: { createdAt: 'asc' },
    select: commentSelect,
  });
}

export async function addTaskComment(ctx: AgencyContext, taskId: string, content: string) {
  const task = await findAgencyTaskOrThrow(ctx.agencyId, taskId);
  return prisma.$transaction(async (tx) => {
    const comment = await tx.taskComment.create({
      data: { agencyId: ctx.agencyId, taskId: task.id, userId: ctx.userId, content },
      select: commentSelect,
    });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: task.projectId,
      actor: userActor(ctx.userId),
      eventType: 'task.comment_added',
      entityType: 'task',
      entityId: task.id,
      metadata: { title: task.title },
    });
    return comment;
  });
}
