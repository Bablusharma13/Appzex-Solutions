import type { ActivityVisibility, ActorType, Prisma } from '@prisma/client';
import { prisma, type TransactionClient } from '../config/prisma';
import { paginate, toSkipTake } from '../utils/pagination';

export interface Actor {
  actorId: string | null;
  actorType: ActorType;
}

export interface ActivityInput {
  agencyId: string | null;
  projectId?: string | null;
  actor: Actor;
  eventType: string;
  entityType: string;
  entityId?: string | null;
  visibility?: ActivityVisibility;
  /** Display facts only (titles, status transitions). Never secrets or PII. */
  metadata?: Prisma.InputJsonObject;
}

export function userActor(userId: string, isSuperAdmin = false): Actor {
  return { actorId: userId, actorType: isSuperAdmin ? 'SUPER_ADMIN' : 'USER' };
}

export function logActivity(db: TransactionClient, input: ActivityInput) {
  return db.activityLog.create({
    data: {
      agencyId: input.agencyId,
      projectId: input.projectId ?? null,
      actorId: input.actor.actorId,
      actorType: input.actor.actorType,
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      visibility: input.visibility ?? 'INTERNAL',
      metadata: input.metadata ?? undefined,
    },
  });
}

export const activitySelect = {
  id: true,
  eventType: true,
  entityType: true,
  entityId: true,
  visibility: true,
  actorType: true,
  metadata: true,
  createdAt: true,
  actor: { select: { id: true, name: true, role: true } },
  project: { select: { id: true, name: true } },
} satisfies Prisma.ActivityLogSelect;

export interface ActivityListQuery {
  page: number;
  pageSize: number;
  projectId?: string;
  entityType?: string;
  visibility?: ActivityVisibility;
}

export async function listAgencyActivity(agencyId: string, query: ActivityListQuery) {
  const where: Prisma.ActivityLogWhereInput = {
    agencyId,
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.visibility ? { visibility: query.visibility } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      select: activitySelect,
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(query.page, query.pageSize),
    }),
    prisma.activityLog.count({ where }),
  ]);
  return paginate(items, total, query.page, query.pageSize);
}
