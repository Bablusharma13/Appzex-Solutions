import type { FeedbackStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import {
  clientActivity,
  clientFeedback,
  clientFiles,
  clientMeetings,
  clientMilestones,
  clientProjects,
  clientTasks,
} from '../repositories/scopes';
import { findClientProjectOrThrow } from '../repositories/tenantRepository';
import type { ClientContext } from '../types/auth';
import { startOfTodayUtc } from '../utils/dates';
import { notFound } from '../utils/errors';
import { logActivity, userActor } from './activityService';
import { OPEN_FEEDBACK_STATUSES, feedbackCommentSelect } from './feedbackService';
import { getProgressForProjects, getProjectProgress } from './progressService';

/*
 * Client portal read models. Every select below is an explicit allow-list of
 * client-safe fields: internal notes, private files, internal activity,
 * team emails and other clients' data are never selected.
 */

const portalProjectSelect = {
  id: true,
  name: true,
  description: true,
  status: true,
  startDate: true,
  dueDate: true,
  completedAt: true,
  createdAt: true,
  manager: { select: { name: true } },
} satisfies Prisma.ProjectSelect;

const portalMilestoneSelect = {
  id: true,
  name: true,
  description: true,
  dueDate: true,
  status: true,
  order: true,
  completedAt: true,
} satisfies Prisma.MilestoneSelect;

const portalTaskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  dueDate: true,
  completedAt: true,
  project: { select: { id: true, name: true } },
  milestone: { select: { name: true } },
} satisfies Prisma.TaskSelect;

const portalMeetingSelect = {
  id: true,
  title: true,
  meetingDate: true,
  summary: true, // raw internal `notes` are deliberately excluded
  project: { select: { id: true, name: true } },
} satisfies Prisma.MeetingSelect;

const portalFileSelect = {
  id: true,
  originalName: true,
  mimeType: true,
  size: true,
  createdAt: true,
  feedbackId: true,
  uploadedBy: { select: { name: true, role: true } },
  project: { select: { id: true, name: true } },
} satisfies Prisma.ProjectFileSelect;

const portalFeedbackSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true } },
  submittedBy: { select: { id: true, name: true, role: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.FeedbackSelect;

const portalActivitySelect = {
  id: true,
  eventType: true,
  entityType: true,
  metadata: true,
  createdAt: true,
  actorType: true,
  actor: { select: { name: true, role: true } },
  project: { select: { id: true, name: true } },
} satisfies Prisma.ActivityLogSelect;

type PortalFeedbackRow = Prisma.FeedbackGetPayload<{ select: typeof portalFeedbackSelect }>;
const toPortalFeedback = ({ _count, ...row }: PortalFeedbackRow) => ({ ...row, commentCount: _count.comments });

export async function getPortalDashboard(ctx: ClientContext) {
  const today = startOfTodayUtc();
  const [client, agency, projects, upcomingMilestones, pendingActions, recentUpdates, openFeedback] = await Promise.all(
    [
      prisma.client.findUniqueOrThrow({
        where: { id: ctx.clientId },
        select: { companyName: true, contactName: true },
      }),
      prisma.agency.findUniqueOrThrow({ where: { id: ctx.agencyId }, select: { name: true, contactEmail: true } }),
      prisma.project.findMany({
        where: clientProjects(ctx),
        orderBy: { createdAt: 'desc' },
        select: portalProjectSelect,
      }),
      prisma.milestone.findMany({
        where: { ...clientMilestones(ctx), status: { not: 'COMPLETED' }, dueDate: { gte: today } },
        orderBy: { dueDate: 'asc' },
        take: 6,
        select: { ...portalMilestoneSelect, project: { select: { id: true, name: true } } },
      }),
      prisma.task.findMany({
        where: { ...clientTasks(ctx), status: { not: 'COMPLETED' } },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
        take: 8,
        select: portalTaskSelect,
      }),
      prisma.activityLog.findMany({
        where: clientActivity(ctx),
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: portalActivitySelect,
      }),
      prisma.feedback.count({ where: { ...clientFeedback(ctx), status: { in: OPEN_FEEDBACK_STATUSES } } }),
    ],
  );

  const progress = await getProgressForProjects(
    ctx.agencyId,
    projects.map((project) => project.id),
  );

  return {
    client,
    agency,
    stats: {
      activeProjects: projects.filter((project) => project.status === 'ACTIVE').length,
      totalProjects: projects.length,
      upcomingMilestones: upcomingMilestones.length,
      pendingActions: pendingActions.length,
      openFeedback,
    },
    projects: projects.map((project) => ({ ...project, progress: progress.get(project.id)! })),
    upcomingMilestones,
    pendingActions,
    recentUpdates,
  };
}

export async function listPortalProjects(ctx: ClientContext) {
  const projects = await prisma.project.findMany({
    where: clientProjects(ctx),
    orderBy: { createdAt: 'desc' },
    select: {
      ...portalProjectSelect,
      milestones: {
        where: { status: { not: 'COMPLETED' } },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
        take: 1,
        select: { name: true, dueDate: true },
      },
    },
  });
  const progress = await getProgressForProjects(
    ctx.agencyId,
    projects.map((project) => project.id),
  );
  return projects.map(({ milestones, ...project }) => ({
    ...project,
    nextMilestone: milestones[0] ?? null,
    progress: progress.get(project.id)!,
  }));
}

export async function getPortalProject(ctx: ClientContext, projectId: string) {
  // 404 unless the project belongs to the caller's own client company.
  await findClientProjectOrThrow(ctx, projectId);
  const scopedToProject = { projectId };

  const [project, milestones, sharedTasks, meetings, files, feedback, updates, progress] = await Promise.all([
    prisma.project.findFirstOrThrow({ where: { id: projectId, ...clientProjects(ctx) }, select: portalProjectSelect }),
    prisma.milestone.findMany({
      where: { ...clientMilestones(ctx), ...scopedToProject },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: portalMilestoneSelect,
    }),
    prisma.task.findMany({
      where: { ...clientTasks(ctx), ...scopedToProject },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
      select: portalTaskSelect,
    }),
    prisma.meeting.findMany({
      where: { ...clientMeetings(ctx), ...scopedToProject },
      orderBy: { meetingDate: 'desc' },
      select: portalMeetingSelect,
    }),
    prisma.projectFile.findMany({
      where: { ...clientFiles(ctx), ...scopedToProject },
      orderBy: { createdAt: 'desc' },
      select: portalFileSelect,
    }),
    prisma.feedback.findMany({
      where: { ...clientFeedback(ctx), ...scopedToProject },
      orderBy: { createdAt: 'desc' },
      select: portalFeedbackSelect,
    }),
    prisma.activityLog.findMany({
      where: { ...clientActivity(ctx), ...scopedToProject },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: portalActivitySelect,
    }),
    getProjectProgress(ctx.agencyId, projectId),
  ]);

  const today = startOfTodayUtc();
  const upcomingDeadlines = [
    ...milestones
      .filter((m) => m.status !== 'COMPLETED' && m.dueDate && m.dueDate >= today)
      .map((m) => ({ type: 'milestone' as const, id: m.id, title: m.name, dueDate: m.dueDate })),
    ...sharedTasks
      .filter((t) => t.status !== 'COMPLETED' && t.dueDate && t.dueDate >= today)
      .map((t) => ({ type: 'action' as const, id: t.id, title: t.title, dueDate: t.dueDate })),
  ]
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    .slice(0, 6);

  return {
    ...project,
    progress,
    milestones,
    sharedTasks,
    meetings,
    files,
    feedback: feedback.map(toPortalFeedback),
    updates,
    upcomingDeadlines,
  };
}

export async function listPortalFeedback(ctx: ClientContext, query: { projectId?: string; status?: FeedbackStatus }) {
  const rows = await prisma.feedback.findMany({
    where: {
      ...clientFeedback(ctx),
      ...(query.projectId ? { projectId: query.projectId } : {}),
      ...(query.status ? { status: query.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: portalFeedbackSelect,
  });
  return rows.map(toPortalFeedback);
}

export async function getPortalFeedback(ctx: ClientContext, feedbackId: string) {
  const row = await prisma.feedback.findFirst({
    where: { id: feedbackId, ...clientFeedback(ctx) },
    select: portalFeedbackSelect,
  });
  if (!row) throw notFound('Feedback not found');

  const [comments, files] = await Promise.all([
    prisma.feedbackComment.findMany({
      where: { agencyId: ctx.agencyId, feedbackId: row.id },
      orderBy: { createdAt: 'asc' },
      select: feedbackCommentSelect,
    }),
    prisma.projectFile.findMany({
      where: { ...clientFiles(ctx), feedbackId: row.id },
      orderBy: { createdAt: 'desc' },
      select: portalFileSelect,
    }),
  ]);
  return { ...toPortalFeedback(row), comments, files };
}

export async function createPortalFeedback(
  ctx: ClientContext,
  projectId: string,
  input: { title: string; description: string },
) {
  const project = await findClientProjectOrThrow(ctx, projectId);
  return prisma.$transaction(async (tx) => {
    const feedback = await tx.feedback.create({
      data: {
        agencyId: ctx.agencyId,
        projectId: project.id,
        title: input.title,
        description: input.description,
        submittedById: ctx.userId,
        status: 'OPEN',
      },
      select: portalFeedbackSelect,
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
    return toPortalFeedback(feedback);
  });
}

export async function addPortalFeedbackComment(ctx: ClientContext, feedbackId: string, content: string) {
  const feedback = await prisma.feedback.findFirst({ where: { id: feedbackId, ...clientFeedback(ctx) } });
  if (!feedback) throw notFound('Feedback not found');

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

export async function listPortalMeetings(ctx: ClientContext, projectId?: string) {
  return prisma.meeting.findMany({
    where: { ...clientMeetings(ctx), ...(projectId ? { projectId } : {}) },
    orderBy: { meetingDate: 'desc' },
    take: 100,
    select: portalMeetingSelect,
  });
}

export async function listPortalFiles(ctx: ClientContext, projectId?: string) {
  return prisma.projectFile.findMany({
    where: { ...clientFiles(ctx), ...(projectId ? { projectId } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: portalFileSelect,
  });
}
