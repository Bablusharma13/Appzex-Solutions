import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { agencyMeetings } from '../repositories/scopes';
import { findAgencyMeetingOrThrow, findAgencyProjectOrThrow } from '../repositories/tenantRepository';
import type { AgencyContext } from '../types/auth';
import { paginate, toSkipTake } from '../utils/pagination';
import { logActivity, userActor } from './activityService';

const meetingSelect = {
  id: true,
  projectId: true,
  title: true,
  meetingDate: true,
  notes: true,
  summary: true,
  clientVisible: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true, client: { select: { id: true, companyName: true } } } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.MeetingSelect;

export interface MeetingInput {
  title?: string;
  meetingDate?: Date;
  notes?: string | null;
  summary?: string | null;
  clientVisible?: boolean;
}

export async function listMeetings(
  agencyId: string,
  query: { page: number; pageSize: number; search?: string; projectId?: string; clientVisible?: boolean },
) {
  const where: Prisma.MeetingWhereInput = {
    ...agencyMeetings(agencyId),
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...(query.clientVisible !== undefined ? { clientVisible: query.clientVisible } : {}),
    ...(query.search ? { title: { contains: query.search } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.meeting.findMany({
      where,
      select: meetingSelect,
      orderBy: { meetingDate: 'desc' },
      ...toSkipTake(query.page, query.pageSize),
    }),
    prisma.meeting.count({ where }),
  ]);
  return paginate(items, total, query.page, query.pageSize);
}

export async function listProjectMeetings(agencyId: string, projectId: string) {
  await findAgencyProjectOrThrow(agencyId, projectId);
  return prisma.meeting.findMany({
    where: { ...agencyMeetings(agencyId), projectId },
    select: meetingSelect,
    orderBy: { meetingDate: 'desc' },
  });
}

export async function createMeeting(
  ctx: AgencyContext,
  projectId: string,
  input: MeetingInput & { title: string; meetingDate: Date },
) {
  const project = await findAgencyProjectOrThrow(ctx.agencyId, projectId);
  return prisma.$transaction(async (tx) => {
    const meeting = await tx.meeting.create({
      data: {
        agencyId: ctx.agencyId,
        projectId: project.id,
        title: input.title,
        meetingDate: input.meetingDate,
        notes: input.notes ?? null,
        summary: input.summary ?? null,
        clientVisible: input.clientVisible ?? false,
        createdById: ctx.userId,
      },
      select: meetingSelect,
    });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: project.id,
      actor: userActor(ctx.userId),
      eventType: 'meeting.created',
      entityType: 'meeting',
      entityId: meeting.id,
      visibility: meeting.clientVisible ? 'CLIENT' : 'INTERNAL',
      metadata: { title: meeting.title, projectName: project.name },
    });
    return meeting;
  });
}

export async function updateMeeting(ctx: AgencyContext, meetingId: string, input: MeetingInput) {
  const existing = await findAgencyMeetingOrThrow(ctx.agencyId, meetingId);
  return prisma.$transaction(async (tx) => {
    const meeting = await tx.meeting.update({
      where: { id: existing.id },
      data: {
        title: input.title,
        meetingDate: input.meetingDate,
        notes: input.notes,
        summary: input.summary,
        clientVisible: input.clientVisible,
      },
      select: meetingSelect,
    });
    const sharedNow = !existing.clientVisible && meeting.clientVisible;
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: meeting.projectId,
      actor: userActor(ctx.userId),
      eventType: sharedNow ? 'meeting.shared' : 'meeting.updated',
      entityType: 'meeting',
      entityId: meeting.id,
      visibility: sharedNow ? 'CLIENT' : 'INTERNAL',
      metadata: { title: meeting.title },
    });
    return meeting;
  });
}

export async function deleteMeeting(ctx: AgencyContext, meetingId: string) {
  const existing = await findAgencyMeetingOrThrow(ctx.agencyId, meetingId);
  await prisma.$transaction(async (tx) => {
    await tx.meeting.delete({ where: { id: existing.id } });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: existing.projectId,
      actor: userActor(ctx.userId),
      eventType: 'meeting.deleted',
      entityType: 'meeting',
      entityId: existing.id,
      metadata: { title: existing.title },
    });
  });
}
