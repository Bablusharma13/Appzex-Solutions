import type { Request, Response } from 'express';
import { pipeline } from 'node:stream/promises';
import { getAgencyContext, getAuth } from '../middleware/authorize';
import * as fileService from '../services/fileService';
import { sendCreated, sendOk } from '../utils/response';
import { validate } from '../utils/validate';
import { idParams, projectIdParams } from '../validators/common';
import { listFilesQuery, updateFileSchema, uploadFileFields } from '../validators/workValidators';

export async function upload(req: Request, res: Response) {
  const { projectId } = validate(projectIdParams, req.params);
  const fields = validate(uploadFileFields, req.body ?? {});
  sendCreated(res, await fileService.uploadAgencyFile(getAgencyContext(req), projectId, req.file, fields));
}

export async function listForProject(req: Request, res: Response) {
  const { projectId } = validate(projectIdParams, req.params);
  sendOk(res, await fileService.listProjectFiles(getAgencyContext(req).agencyId, projectId));
}

export async function list(req: Request, res: Response) {
  const query = validate(listFilesQuery, req.query);
  sendOk(res, await fileService.listFiles(getAgencyContext(req).agencyId, query));
}

/**
 * Authorized download for every role. Files are streamed from private
 * storage; there is no public URL to the stored object.
 */
export async function download(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const { file, stream } = await fileService.getFileForDownload(getAuth(req), id);

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', String(file.size));
  res.setHeader('Cache-Control', 'private, no-store');
  res.attachment(file.originalName);
  await pipeline(stream, res);
}

export async function update(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const { clientVisible } = validate(updateFileSchema, req.body);
  sendOk(res, await fileService.updateFileVisibility(getAgencyContext(req), id, clientVisible));
}

export async function remove(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  await fileService.deleteFile(getAgencyContext(req), id);
  sendOk(res, { deleted: true });
}
