import type { Request, Response } from 'express';
import { z } from 'zod';
import { getAgencyContext } from '../middleware/authorize';
import * as feedbackService from '../services/feedbackService';
import { sendCreated, sendOk } from '../utils/response';
import { validate } from '../utils/validate';
import { commentSchema, feedbackStatusEnum, idParams, projectIdParams } from '../validators/common';
import { createFeedbackSchema, listFeedbackQuery, updateFeedbackSchema } from '../validators/workValidators';

export async function list(req: Request, res: Response) {
  const query = validate(listFeedbackQuery, req.query);
  sendOk(res, await feedbackService.listFeedback(getAgencyContext(req).agencyId, query));
}

export async function listForProject(req: Request, res: Response) {
  const { projectId } = validate(projectIdParams, req.params);
  const { status } = validate(z.object({ status: feedbackStatusEnum.optional() }), req.query);
  sendOk(res, await feedbackService.listProjectFeedback(getAgencyContext(req).agencyId, projectId, status));
}

export async function get(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  sendOk(res, await feedbackService.getFeedback(getAgencyContext(req).agencyId, id));
}

export async function create(req: Request, res: Response) {
  const { projectId } = validate(projectIdParams, req.params);
  const input = validate(createFeedbackSchema, req.body);
  sendCreated(res, await feedbackService.createFeedback(getAgencyContext(req), projectId, input));
}

export async function updateStatus(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const { status } = validate(updateFeedbackSchema, req.body);
  sendOk(res, await feedbackService.updateFeedbackStatus(getAgencyContext(req), id, status));
}

export async function addComment(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const { content } = validate(commentSchema, req.body);
  sendCreated(res, await feedbackService.addFeedbackComment(getAgencyContext(req), id, content));
}
