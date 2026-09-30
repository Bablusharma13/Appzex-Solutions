import type { FeedbackStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { agencyFeedback } from '../repositories/scopes';
import { findAgencyFeedbackOrThrow, findAgencyProjectOrThrow } from '../repositories/tenantRepository';
import type { AgencyContext } from '../types/auth';
import { paginate, toSkipTake } from '../utils/pagination';
import { logActivity, userActor } from './activityService';

export const OPEN_FEEDBACK_STATUSES: FeedbackStatus[] = ['OPEN', 'IN_REVIEW', 'IN_PROGRESS'];

export const feedbackListSelect = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true, client: { select: { id: true, companyName: true } } } },
  submittedBy: { select: { id: true, name: true, role: true } },
  _count: { select: { comments: true, files: true } },
} satisfies Prisma.FeedbackSelect;

export const feedbackCommentSelect = {
  id: true,
  content: true,
  createdAt: true,
  user: { select: { id: true, name: true, role: true } },
} satisfies Prisma.FeedbackCommentSelect;

type FeedbackRow = Prisma.FeedbackGetPayload<{ select: typeof feedbackListSelect }>;

export function toFeedbackDto({ _count, ...row }: FeedbackRow) {
  return { ...row, commentCount: _count.comments, fileCount: _count.files };
}

export async function listFeedback(
  agencyId: string,
  query: {
    page: number;
    pageSize: number;
    search?: string;
    status?: FeedbackStatus;
    projectId?: string;
    open?: boolean;
  },
) {
  const where: Prisma.FeedbackWhereInput = {
    ...agencyFeedback(agencyId),
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...(query.open ? { status: { in: OPEN_FEEDBACK_STATUSES } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.search ? { title: { contains: query.search } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      select: feedbackListSelect,
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(query.page, query.pageSize),
    }),
    prisma.feedback.count({ where }),
  ]);
  return paginate(rows.map(toFeedbackDto), total, query.page, query.pageSize);
}

export async function listProjectFeedback(agencyId: string, projectId: string, status?: FeedbackStatus) {
  await findAgencyProjectOrThrow(agencyId, projectId);
  const rows = await prisma.feedback.findMany({
    where: { ...agencyFeedback(agencyId), projectId, ...(status ? { status } : {}) },
    select: feedbackListSelect,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(toFeedbackDto);
}

export async function getFeedback(agencyId: string, feedbackId: string) {
  const feedback = await findAgencyFeedbackOrThrow(agencyId, feedbackId);
  const [row, comments, files] = await Promise.all([
    prisma.feedback.findFirstOrThrow({ where: { id: feedback.id, agencyId }, select: feedbackListSelect }),
    prisma.feedbackComment.findMany({
      where: { agencyId, feedbackId: feedback.id },
      orderBy: { createdAt: 'asc' },
      select: feedbackCommentSelect,
    }),
    prisma.projectFile.findMany({
      where: { agencyId, feedbackId: feedback.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, originalName: true, mimeType: true, size: true, clientVisible: true, createdAt: true },
    }),
  ]);
  return { ...toFeedbackDto(row), comments, files };
}

export async function createFeedback(
  ctx: AgencyContext,
  projectId: string,
  input: { title: string; description: string },
) {
  const project = await findAgencyProjectOrThrow(ctx.agencyId, projectId);
  return prisma.$transaction(async (tx) => {
    const feedback = await tx.feedback.create({
      data: {
        agencyId: ctx.agencyId,
        projectId: project.id,
        title: input.title,
        description: input.description,
        submittedById: ctx.userId,
      },
      select: feedbackListSelect,
    });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: project.id,
      actor: userActor(ctx.userId),
      eventType: 'feedback.submitted',
      entityType: 'feedback',
      entityId: feedback.id,
      visibility: 'CLIENT',
      metadata: { title: feedback.title, projectName: project.name },
    });
    return toFeedbackDto(feedback);
  });
}

export async function updateFeedbackStatus(ctx: AgencyContext, feedbackId: string, status: FeedbackStatus) {
  const existing = await findAgencyFeedbackOrThrow(ctx.agencyId, feedbackId);
  if (existing.status === status) {
    return getFeedback(ctx.agencyId, existing.id);
  }
  await prisma.$transaction(async (tx) => {
    await tx.feedback.update({ where: { id: existing.id }, data: { status } });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: existing.projectId,
      actor: userActor(ctx.userId),
      eventType: 'feedback.status_changed',
      entityType: 'feedback',
      entityId: existing.id,
      visibility: 'CLIENT',
      metadata: { title: existing.title, from: existing.status, to: status },
    });
  });
  return getFeedback(ctx.agencyId, existing.id);
}

export async function addFeedbackComment(ctx: AgencyContext, feedbackId: string, content: string) {
  const feedback = await findAgencyFeedbackOrThrow(ctx.agencyId, feedbackId);
  return prisma.$transaction(async (tx) => {
    const comment = await tx.feedbackComment.create({
      data: { agencyId: ctx.agencyId, feedbackId: feedback.id, userId: ctx.userId, content },
      select: feedbackCommentSelect,
    });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: feedback.projectId,
      actor: userActor(ctx.userId),
      eventType: 'feedback.comment_added',
      entityType: 'feedback',
      entityId: feedback.id,
      visibility: 'CLIENT',
      metadata: { title: feedback.title },
    });
    return comment;
  });
}
