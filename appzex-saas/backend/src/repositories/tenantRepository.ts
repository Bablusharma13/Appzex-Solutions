import { prisma, type TransactionClient } from '../config/prisma';
import type { ClientContext } from '../types/auth';
import { notFound, validationFailed } from '../utils/errors';
import {
  agencyClients,
  agencyFeedback,
  agencyFiles,
  agencyMeetings,
  agencyMilestones,
  agencyProjects,
  agencyTasks,
  clientProjects,
} from './scopes';

/*
 * Ownership-checked loaders. Pattern used everywhere:
 *
 *   findFirst({ where: { id, ...scope(authenticatedAgencyId) } })
 *
 * An id that exists in another tenant is indistinguishable from an id that
 * does not exist: both return 404, so ids cannot be probed across tenants.
 */

export async function findAgencyProjectOrThrow(agencyId: string, projectId: string, db: TransactionClient = prisma) {
  const project = await db.project.findFirst({ where: { id: projectId, ...agencyProjects(agencyId) } });
  if (!project) throw notFound('Project not found');
  return project;
}

export async function findAgencyClientOrThrow(agencyId: string, clientId: string, db: TransactionClient = prisma) {
  const client = await db.client.findFirst({ where: { id: clientId, ...agencyClients(agencyId) } });
  if (!client) throw notFound('Client not found');
  return client;
}

export async function findAgencyMilestoneOrThrow(
  agencyId: string,
  milestoneId: string,
  db: TransactionClient = prisma,
) {
  const milestone = await db.milestone.findFirst({ where: { id: milestoneId, ...agencyMilestones(agencyId) } });
  if (!milestone) throw notFound('Milestone not found');
  return milestone;
}

export async function findAgencyTaskOrThrow(agencyId: string, taskId: string, db: TransactionClient = prisma) {
  const task = await db.task.findFirst({ where: { id: taskId, ...agencyTasks(agencyId) } });
  if (!task) throw notFound('Task not found');
  return task;
}

export async function findAgencyMeetingOrThrow(agencyId: string, meetingId: string, db: TransactionClient = prisma) {
  const meeting = await db.meeting.findFirst({ where: { id: meetingId, ...agencyMeetings(agencyId) } });
  if (!meeting) throw notFound('Meeting not found');
  return meeting;
}

export async function findAgencyFeedbackOrThrow(agencyId: string, feedbackId: string, db: TransactionClient = prisma) {
  const feedback = await db.feedback.findFirst({ where: { id: feedbackId, ...agencyFeedback(agencyId) } });
  if (!feedback) throw notFound('Feedback not found');
  return feedback;
}

export async function findAgencyFileOrThrow(agencyId: string, fileId: string, db: TransactionClient = prisma) {
  const file = await db.projectFile.findFirst({ where: { id: fileId, ...agencyFiles(agencyId) } });
  if (!file) throw notFound('File not found');
  return file;
}

export async function findClientProjectOrThrow(ctx: ClientContext, projectId: string, db: TransactionClient = prisma) {
  const project = await db.project.findFirst({ where: { id: projectId, ...clientProjects(ctx) } });
  if (!project) throw notFound('Project not found');
  return project;
}

// ----- Validation of foreign ids supplied in request bodies ------------------
// These return 422 (a field error) because the caller is choosing a value
// from a dropdown; the message never reveals whether the id exists elsewhere.

export async function assertClientInAgency(agencyId: string, clientId: string, db: TransactionClient = prisma) {
  const client = await db.client.findFirst({
    where: { id: clientId, ...agencyClients(agencyId) },
    select: { id: true },
  });
  if (!client) throw validationFailed([{ path: 'clientId', message: 'Select a client from your agency' }]);
}

export async function assertMemberOfAgency(
  agencyId: string,
  userId: string,
  field: string,
  db: TransactionClient = prisma,
) {
  const member = await db.agencyMember.findFirst({
    where: { agencyId, userId, user: { isActive: true } },
    select: { id: true },
  });
  if (!member) throw validationFailed([{ path: field, message: 'Select a team member from your agency' }]);
}

export async function assertMilestoneInProject(
  agencyId: string,
  projectId: string,
  milestoneId: string,
  db: TransactionClient = prisma,
) {
  const milestone = await db.milestone.findFirst({
    where: { id: milestoneId, projectId, agencyId },
    select: { id: true },
  });
  if (!milestone) throw validationFailed([{ path: 'milestoneId', message: 'Select a milestone from this project' }]);
}
