import type { Request, Response } from 'express';
import { getAgencyContext } from '../middleware/authorize';
import * as milestoneService from '../services/milestoneService';
import { sendCreated, sendOk } from '../utils/response';
import { validate } from '../utils/validate';
import { idParams, projectIdParams } from '../validators/common';
import { createMilestoneSchema, updateMilestoneSchema } from '../validators/workValidators';

export async function listForProject(req: Request, res: Response) {
  const { projectId } = validate(projectIdParams, req.params);
  sendOk(res, await milestoneService.listMilestones(getAgencyContext(req).agencyId, projectId));
}

export async function create(req: Request, res: Response) {
  const { projectId } = validate(projectIdParams, req.params);
  const input = validate(createMilestoneSchema, req.body);
  sendCreated(res, await milestoneService.createMilestone(getAgencyContext(req), projectId, input));
}

export async function update(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const input = validate(updateMilestoneSchema, req.body);
  sendOk(res, await milestoneService.updateMilestone(getAgencyContext(req), id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  await milestoneService.deleteMilestone(getAgencyContext(req), id);
  sendOk(res, { deleted: true });
}
