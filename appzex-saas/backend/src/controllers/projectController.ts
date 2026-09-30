import type { Request, Response } from 'express';
import { getAgencyContext } from '../middleware/authorize';
import * as activityService from '../services/activityService';
import * as healthService from '../services/healthService';
import * as projectService from '../services/projectService';
import { sendCreated, sendOk } from '../utils/response';
import { validate } from '../utils/validate';
import { idParams } from '../validators/common';
import { createProjectSchema, listProjectsQuery, updateProjectSchema } from '../validators/projectValidators';
import { listActivityQuery } from '../validators/workValidators';
import { findAgencyProjectOrThrow } from '../repositories/tenantRepository';

export async function list(req: Request, res: Response) {
  const query = validate(listProjectsQuery, req.query);
  sendOk(res, await projectService.listProjects(getAgencyContext(req).agencyId, query));
}

export async function get(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  sendOk(res, await projectService.getProject(getAgencyContext(req).agencyId, id));
}

export async function create(req: Request, res: Response) {
  const input = validate(createProjectSchema, req.body);
  sendCreated(res, await projectService.createProject(getAgencyContext(req), input));
}

export async function update(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const input = validate(updateProjectSchema, req.body);
  sendOk(res, await projectService.updateProject(getAgencyContext(req), id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  await projectService.deleteProject(getAgencyContext(req), id);
  sendOk(res, { deleted: true });
}

/** Deterministic health metrics (no AI involved). */
export async function health(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const facts = await healthService.getProjectHealthFacts(getAgencyContext(req).agencyId, id);
  sendOk(res, facts);
}

export async function activity(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const ctx = getAgencyContext(req);
  await findAgencyProjectOrThrow(ctx.agencyId, id);
  const query = validate(listActivityQuery, req.query);
  sendOk(res, await activityService.listAgencyActivity(ctx.agencyId, { ...query, projectId: id }));
}
