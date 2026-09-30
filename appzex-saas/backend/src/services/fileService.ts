import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { agencyFiles, clientFiles } from '../repositories/scopes';
import {
  findAgencyFileOrThrow,
  findAgencyProjectOrThrow,
  findClientProjectOrThrow,
} from '../repositories/tenantRepository';
import type { AgencyContext, AuthContext, ClientContext } from '../types/auth';
import { badRequest, forbidden, notFound, validationFailed } from '../utils/errors';
import { paginate, toSkipTake } from '../utils/pagination';
import { logActivity, userActor, type Actor } from './activityService';
import { validateUpload } from './storage/fileValidation';
import { storage } from './storage/storageProvider';

export type UploadedFile = { originalname: string; buffer: Buffer; size: number };

/** Public file shape. `storageName` (the private storage key) is never returned. */
export const fileSelect = {
  id: true,
  projectId: true,
  taskId: true,
  feedbackId: true,
  originalName: true,
  mimeType: true,
  size: true,
  clientVisible: true,
  createdAt: true,
  uploadedBy: { select: { id: true, name: true, role: true } },
  project: { select: { id: true, name: true } },
  task: { select: { id: true, title: true } },
  feedback: { select: { id: true, title: true } },
} satisfies Prisma.ProjectFileSelect;

interface StoreFileParams {
  agencyId: string;
  projectId: string;
  projectName: string;
  uploadedById: string;
  actor: Actor;
  file: UploadedFile | undefined;
  clientVisible: boolean;
  taskId: string | null;
  feedbackId: string | null;
}

async function storeFile(params: StoreFileParams) {
  if (!params.file) throw badRequest('Attach a file to upload', [{ path: 'file', message: 'File is required' }]);

  const { originalName, extension, mimeType } = validateUpload(params.file);
  // Server-generated key; the user's filename is metadata only.
  const storageName = `${randomUUID()}${extension}`;

  await storage.save(storageName, params.file.buffer);

  try {
    return await prisma.$transaction(async (tx) => {
      const record = await tx.projectFile.create({
        data: {
          agencyId: params.agencyId,
          projectId: params.projectId,
          taskId: params.taskId,
          feedbackId: params.feedbackId,
          uploadedById: params.uploadedById,
          originalName,
          storageName,
          mimeType,
          size: params.file!.size,
          clientVisible: params.clientVisible,
        },
        select: fileSelect,
      });
      await logActivity(tx, {
        agencyId: params.agencyId,
        projectId: params.projectId,
        actor: params.actor,
        eventType: 'file.uploaded',
        entityType: 'file',
        entityId: record.id,
        visibility: record.clientVisible ? 'CLIENT' : 'INTERNAL',
        metadata: { title: record.originalName, projectName: params.projectName },
      });
      return record;
    });
  } catch (error) {
    await storage.remove(storageName).catch(() => undefined);
    throw error;
  }
}

export async function uploadAgencyFile(
  ctx: AgencyContext,
  projectId: string,
  file: UploadedFile | undefined,
  fields: { clientVisible: boolean; taskId?: string | null; feedbackId?: string | null },
) {
  const project = await findAgencyProjectOrThrow(ctx.agencyId, projectId);

  // Optional attachments must belong to the same project (and therefore tenant).
  if (fields.taskId) {
    const task = await prisma.task.findFirst({
      where: { id: fields.taskId, projectId: project.id, agencyId: ctx.agencyId },
    });
    if (!task) throw validationFailed([{ path: 'taskId', message: 'Select a task from this project' }]);
  }
  if (fields.feedbackId) {
    const feedback = await prisma.feedback.findFirst({
      where: { id: fields.feedbackId, projectId: project.id, agencyId: ctx.agencyId },
    });
    if (!feedback) throw validationFailed([{ path: 'feedbackId', message: 'Select feedback from this project' }]);
  }

  return storeFile({
    agencyId: ctx.agencyId,
    projectId: project.id,
    projectName: project.name,
    uploadedById: ctx.userId,
    actor: userActor(ctx.userId),
    file,
    clientVisible: fields.clientVisible,
    taskId: fields.taskId ?? null,
    feedbackId: fields.feedbackId ?? null,
  });
}

/** Files uploaded by a client are always visible to that client. */
export async function uploadClientFile(
  ctx: ClientContext,
  projectId: string,
  file: UploadedFile | undefined,
  fields: { feedbackId?: string | null },
) {
  const project = await findClientProjectOrThrow(ctx, projectId);
  if (fields.feedbackId) {
    const feedback = await prisma.feedback.findFirst({
      where: { id: fields.feedbackId, projectId: project.id, agencyId: ctx.agencyId },
    });
    if (!feedback) throw validationFailed([{ path: 'feedbackId', message: 'Select feedback from this project' }]);
  }

  return storeFile({
    agencyId: ctx.agencyId,
    projectId: project.id,
    projectName: project.name,
    uploadedById: ctx.userId,
    actor: userActor(ctx.userId),
    file,
    clientVisible: true,
    taskId: null,
    feedbackId: fields.feedbackId ?? null,
  });
}

export async function listProjectFiles(agencyId: string, projectId: string) {
  await findAgencyProjectOrThrow(agencyId, projectId);
  return prisma.projectFile.findMany({
    where: { ...agencyFiles(agencyId), projectId },
    select: fileSelect,
    orderBy: { createdAt: 'desc' },
  });
}

export async function listFiles(
  agencyId: string,
  query: { page: number; pageSize: number; search?: string; projectId?: string; clientVisible?: boolean },
) {
  const where: Prisma.ProjectFileWhereInput = {
    ...agencyFiles(agencyId),
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...(query.clientVisible !== undefined ? { clientVisible: query.clientVisible } : {}),
    ...(query.search ? { originalName: { contains: query.search } } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.projectFile.findMany({
      where,
      select: fileSelect,
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(query.page, query.pageSize),
    }),
    prisma.projectFile.count({ where }),
  ]);
  return paginate(items, total, query.page, query.pageSize);
}

/**
 * Authorization for downloads, by role:
 *  - agency users / support mode: file must belong to their agency
 *  - clients: file must be client-visible AND belong to one of their projects
 *  - super admin outside support mode: never
 */
export async function getFileForDownload(auth: AuthContext, fileId: string) {
  let where: Prisma.ProjectFileWhereInput;

  if (auth.role === 'CLIENT' && auth.agencyId && auth.clientId) {
    where = { id: fileId, ...clientFiles({ userId: auth.userId, agencyId: auth.agencyId, clientId: auth.clientId }) };
  } else if ((auth.role === 'AGENCY_ADMIN' || auth.role === 'AGENCY_MEMBER') && auth.agencyId) {
    where = { id: fileId, ...agencyFiles(auth.agencyId) };
  } else if (auth.role === 'SUPER_ADMIN' && auth.supportSession) {
    where = { id: fileId, ...agencyFiles(auth.supportSession.agencyId) };
  } else {
    throw forbidden();
  }

  const file = await prisma.projectFile.findFirst({
    where,
    select: { id: true, originalName: true, mimeType: true, size: true, storageName: true },
  });
  if (!file) throw notFound('File not found');

  try {
    const stream = await storage.read(file.storageName);
    return { file, stream };
  } catch {
    throw notFound('The file is no longer available');
  }
}

export async function updateFileVisibility(ctx: AgencyContext, fileId: string, clientVisible: boolean) {
  const existing = await findAgencyFileOrThrow(ctx.agencyId, fileId);
  return prisma.$transaction(async (tx) => {
    const file = await tx.projectFile.update({
      where: { id: existing.id },
      data: { clientVisible },
      select: fileSelect,
    });
    if (existing.clientVisible !== clientVisible) {
      await logActivity(tx, {
        agencyId: ctx.agencyId,
        projectId: file.projectId,
        actor: userActor(ctx.userId),
        eventType: clientVisible ? 'file.shared' : 'file.unshared',
        entityType: 'file',
        entityId: file.id,
        visibility: clientVisible ? 'CLIENT' : 'INTERNAL',
        metadata: { title: file.originalName },
      });
    }
    return file;
  });
}

export async function deleteFile(ctx: AgencyContext, fileId: string) {
  const existing = await findAgencyFileOrThrow(ctx.agencyId, fileId);
  if (ctx.role !== 'AGENCY_ADMIN' && existing.uploadedById !== ctx.userId) {
    throw forbidden('Only agency admins or the uploader can delete this file.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.projectFile.delete({ where: { id: existing.id } });
    await logActivity(tx, {
      agencyId: ctx.agencyId,
      projectId: existing.projectId,
      actor: userActor(ctx.userId),
      eventType: 'file.deleted',
      entityType: 'file',
      entityId: existing.id,
      metadata: { title: existing.originalName },
    });
  });

  await storage.remove(existing.storageName).catch((error: unknown) => {
    console.error('[files] failed to remove stored file', existing.id, error);
  });
}
