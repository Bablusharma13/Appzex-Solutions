import type { MilestoneStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { findAgencyMilestoneOrThrow, findAgencyProjectOrThrow } from '../repositories/tenantRepository';
import type { AgencyContext } from '../types/auth';
import { logActivity, userActor } from './activityService';
import { computeProgress } from './progressService';

export interface MilestoneInput {
  name?: string;
  description?: string | null;
  dueDate?: Date | null;
  status?: MilestoneStatus;
  order?: number;
}

export async function listMilestones(agencyId: string, projectId: string) {
  await findAgencyProjectOrThrow(agencyId, projectId);

  const [milestones, taskGroups] = await Promise.all([
    prisma.milestone.findMany({
      where: { agencyId, projectId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.task.groupBy({
      by: ['milestoneId', 'status'],
      where: { agencyId, projectId, milestoneId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  return milestones.map((milestone) => {
    const groups = taskGroups.filter((group) => group.milestoneId === milestone.id);
    const total = groups.reduce((sum, group) => sum + group._count._all, 0);
    const completed = groups.find((group) => group.status === 'COMPLETED')?._count._all ?? 0;
    return { ...milestone, progress: computeProgress(total, completed) };
  });
}

export async function createMilestone(ctx: AgencyContext, projectId: string, input: MilestoneInput & { name: string }) {
  const project = await findAgencyProjectOrThrow(ctx.agencyId, projectId);

  return prisma.$transaction(async (tx) => {
    const last = await tx.milestone.findFirst({
      where: { agencyId: ctx.agencyId, projectId: project.id },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const status = input.status ?? 'PENDING';
    const milestone = await tx.milestone.create({
      data: {
        agencyId: ctx.agencyId,
        projectId: project.id,
        name: input.name,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        status,
        order: input.order ?? (last?.order ?? 0) + 1,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: project.id,
      actor: userActor(ctx.userId),
      eventType: 'milestone.created',
      entityType: 'milestone',
      entityId: milestone.id,
      visibility: 'CLIENT',
      metadata: { title: milestone.name, projectName: project.name },
    });
    return milestone;
  });
}

export async function updateMilestone(ctx: AgencyContext, milestoneId: string, input: MilestoneInput) {
  const existing = await findAgencyMilestoneOrThrow(ctx.agencyId, milestoneId);
  const statusChanged = input.status !== undefined && input.status !== existing.status;

  return prisma.$transaction(async (tx) => {
    const milestone = await tx.milestone.update({
      where: { id: existing.id },
      data: {
        name: input.name,
        description: input.description,
        dueDate: input.dueDate,
        status: input.status,
        order: input.order,
        ...(statusChanged ? { completedAt: input.status === 'COMPLETED' ? new Date() : null } : {}),
      },
    });

    const completed = statusChanged && milestone.status === 'COMPLETED';
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: milestone.projectId,
      actor: userActor(ctx.userId),
      eventType: completed ? 'milestone.completed' : 'milestone.updated',
      entityType: 'milestone',
      entityId: milestone.id,
      visibility: completed ? 'CLIENT' : 'INTERNAL',
      metadata: { title: milestone.name, ...(statusChanged ? { from: existing.status, to: milestone.status } : {}) },
    });
    return milestone;
  });
}

export async function deleteMilestone(ctx: AgencyContext, milestoneId: string) {
  const existing = await findAgencyMilestoneOrThrow(ctx.agencyId, milestoneId);
  await prisma.$transaction(async (tx) => {
    // Tasks are kept; their milestoneId is set to NULL by the foreign key.
    await tx.milestone.delete({ where: { id: existing.id } });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: existing.projectId,
      actor: userActor(ctx.userId),
      eventType: 'milestone.deleted',
      entityType: 'milestone',
      entityId: existing.id,
      metadata: { title: existing.name },
    });
  });
}
