import type { Request, Response } from 'express';
import { getAgencyContext } from '../middleware/authorize';
import * as activityService from '../services/activityService';
import * as agencyService from '../services/agencyService';
import { sendCreated, sendOk } from '../utils/response';
import { validate } from '../utils/validate';
import { createTeamMemberSchema, updateAgencySettingsSchema } from '../validators/agencyValidators';
import { listActivityQuery } from '../validators/workValidators';

export async function dashboard(req: Request, res: Response) {
  sendOk(res, await agencyService.getAgencyDashboard(getAgencyContext(req).agencyId));
}

export async function getSettings(req: Request, res: Response) {
  sendOk(res, await agencyService.getAgencySettings(getAgencyContext(req).agencyId));
}

export async function updateSettings(req: Request, res: Response) {
  const input = validate(updateAgencySettingsSchema, req.body);
  sendOk(res, await agencyService.updateAgencySettings(getAgencyContext(req), input));
}

export async function listTeam(req: Request, res: Response) {
  sendOk(res, await agencyService.listTeam(getAgencyContext(req).agencyId));
}

export async function createTeamMember(req: Request, res: Response) {
  const input = validate(createTeamMemberSchema, req.body);
  sendCreated(res, await agencyService.createTeamMember(getAgencyContext(req), input));
}

export async function listActivity(req: Request, res: Response) {
  const query = validate(listActivityQuery, req.query);
  sendOk(res, await activityService.listAgencyActivity(getAgencyContext(req).agencyId, query));
}
