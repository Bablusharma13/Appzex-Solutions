import type { Request, Response } from 'express';
import { z } from 'zod';
import { getClientContext } from '../middleware/authorize';
import * as fileService from '../services/fileService';
import * as portalService from '../services/portalService';
import { sendCreated, sendOk } from '../utils/response';
import { validate } from '../utils/validate';
import { commentSchema, feedbackStatusEnum, idParams, idSchema, projectIdParams } from '../validators/common';
import { clientUploadFileFields, createFeedbackSchema } from '../validators/workValidators';

const projectFilter = z.object({ projectId: idSchema.optional() });

export async function dashboard(req: Request, res: Response) {
  sendOk(res, await portalService.getPortalDashboard(getClientContext(req)));
}

export async function listProjects(req: Request, res: Response) {
  sendOk(res, await portalService.listPortalProjects(getClientContext(req)));
}

export async function getProject(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  sendOk(res, await portalService.getPortalProject(getClientContext(req), id));
}

export async function listFeedback(req: Request, res: Response) {
  const query = validate(projectFilter.extend({ status: feedbackStatusEnum.optional() }), req.query);
  sendOk(res, await portalService.listPortalFeedback(getClientContext(req), query));
}

export async function getFeedback(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  sendOk(res, await portalService.getPortalFeedback(getClientContext(req), id));
}

export async function createFeedback(req: Request, res: Response) {
  const { projectId } = validate(projectIdParams, req.params);
  const input = validate(createFeedbackSchema, req.body);
  sendCreated(res, await portalService.createPortalFeedback(getClientContext(req), projectId, input));
}

export async function addFeedbackComment(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const { content } = validate(commentSchema, req.body);
  sendCreated(res, await portalService.addPortalFeedbackComment(getClientContext(req), id, content));
}

export async function listMeetings(req: Request, res: Response) {
  const { projectId } = validate(projectFilter, req.query);
  sendOk(res, await portalService.listPortalMeetings(getClientContext(req), projectId));
}

export async function listFiles(req: Request, res: Response) {
  const { projectId } = validate(projectFilter, req.query);
  sendOk(res, await portalService.listPortalFiles(getClientContext(req), projectId));
}

export async function uploadFile(req: Request, res: Response) {
  const { projectId } = validate(projectIdParams, req.params);
  const fields = validate(clientUploadFileFields, req.body ?? {});
  sendCreated(res, await fileService.uploadClientFile(getClientContext(req), projectId, req.file, fields));
}
