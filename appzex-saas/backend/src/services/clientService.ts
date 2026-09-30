import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { agencyClients, agencyProjects } from '../repositories/scopes';
import { findAgencyClientOrThrow } from '../repositories/tenantRepository';
import type { AgencyContext } from '../types/auth';
import { conflict } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/pagination';
import { hashPassword } from '../utils/password';
import { logActivity, userActor } from './activityService';
import { getProgressForProjects } from './progressService';

export interface ClientInput {
  companyName?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  portalEnabled?: boolean;
}

export async function listClients(
  agencyId: string,
  query: { page: number; pageSize: number; search?: string; sort: 'companyName' | 'createdAt'; order: 'asc' | 'desc' },
) {
  const where: Prisma.ClientWhereInput = {
    ...agencyClients(agencyId),
    ...(query.search
      ? {
          OR: [
            { companyName: { contains: query.search } },
            { contactName: { contains: query.search } },
            { email: { contains: query.search } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
      ...toSkipTake(query.page, query.pageSize),
      select: {
        id: true,
        companyName: true,
        contactName: true,
        email: true,
        phone: true,
        portalEnabled: true,
        createdAt: true,
        _count: { select: { projects: { where: { deletedAt: null } }, users: true } },
      },
    }),
    prisma.client.count({ where }),
  ]);

  const items = rows.map(({ _count, ...row }) => ({
    ...row,
    projectCount: _count.projects,
    portalUserCount: _count.users,
  }));
  return paginate(items, total, query.page, query.pageSize);
}

export async function getClient(agencyId: string, clientId: string) {
  const client = await findAgencyClientOrThrow(agencyId, clientId);

  const [projects, portalUsers] = await Promise.all([
    prisma.project.findMany({
      where: { ...agencyProjects(agencyId), clientId: client.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        status: true,
        priority: true,
        dueDate: true,
        manager: { select: { id: true, name: true } },
      },
    }),
    prisma.user.findMany({
      where: { clientId: client.id, role: 'CLIENT' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true, createdAt: true },
    }),
  ]);

  const progress = await getProgressForProjects(
    agencyId,
    projects.map((project) => project.id),
  );
  const { deletedAt: _deletedAt, ...rest } = client;
  return {
    ...rest,
    projects: projects.map((project) => ({ ...project, progress: progress.get(project.id)! })),
    portalUsers,
  };
}

export async function createClient(ctx: AgencyContext, input: ClientInput & { companyName: string }) {
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        agencyId: ctx.agencyId,
        companyName: input.companyName,
        contactName: input.contactName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        notes: input.notes ?? null,
        portalEnabled: input.portalEnabled ?? true,
      },
    });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      actor: userActor(ctx.userId),
      eventType: 'client.created',
      entityType: 'client',
      entityId: client.id,
      metadata: { companyName: client.companyName },
    });
    return client;
  });
}

export async function updateClient(ctx: AgencyContext, clientId: string, input: ClientInput) {
  const existing = await findAgencyClientOrThrow(ctx.agencyId, clientId);
  return prisma.$transaction(async (tx) => {
    const client = await tx.client.update({
      where: { id: existing.id },
      data: {
        companyName: input.companyName,
        contactName: input.contactName,
        email: input.email,
        phone: input.phone,
        notes: input.notes,
        portalEnabled: input.portalEnabled,
      },
    });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      actor: userActor(ctx.userId),
      eventType: 'client.updated',
      entityType: 'client',
      entityId: client.id,
      metadata: {
        companyName: client.companyName,
        fields: Object.keys(input).filter((key) => input[key as keyof ClientInput] !== undefined),
      },
    });
    return client;
  });
}

/**
 * Soft delete. Refuses while the client still has projects so a single click
 * can never hide a large amount of related work.
 */
export async function deleteClient(ctx: AgencyContext, clientId: string) {
  const existing = await findAgencyClientOrThrow(ctx.agencyId, clientId);
  const projectCount = await prisma.project.count({
    where: { ...agencyProjects(ctx.agencyId), clientId: existing.id },
  });
  if (projectCount > 0) {
    throw conflict(
      `This client still has ${projectCount} project${projectCount === 1 ? '' : 's'}. Delete or complete them before removing the client.`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.client.update({ where: { id: existing.id }, data: { deletedAt: new Date(), portalEnabled: false } });
    await tx.user.updateMany({ where: { clientId: existing.id }, data: { isActive: false } });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      actor: userActor(ctx.userId),
      eventType: 'client.deleted',
      entityType: 'client',
      entityId: existing.id,
      metadata: { companyName: existing.companyName },
    });
  });
}

export async function createPortalUser(
  ctx: AgencyContext,
  clientId: string,
  input: { name: string; email: string; password: string },
) {
  const client = await findAgencyClientOrThrow(ctx.agencyId, clientId);
  const existingUser = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existingUser) throw conflict('A user with this email already exists.');

  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.name, email: input.email, passwordHash, role: 'CLIENT', clientId: client.id },
      select: { id: true, name: true, email: true, isActive: true, lastLoginAt: true, createdAt: true },
    });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      actor: userActor(ctx.userId),
      eventType: 'user.created',
      entityType: 'user',
      entityId: user.id,
      metadata: { name: user.name, role: 'CLIENT', companyName: client.companyName },
    });
    return user;
  });
}
