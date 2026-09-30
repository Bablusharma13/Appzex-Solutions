import type { Request, Response } from 'express';
import { getAgencyContext } from '../middleware/authorize';
import * as meetingService from '../services/meetingService';
import { sendCreated, sendOk } from '../utils/response';
import { validate } from '../utils/validate';
import { idParams, projectIdParams } from '../validators/common';
import { createMeetingSchema, listMeetingsQuery, updateMeetingSchema } from '../validators/workValidators';

export async function list(req: Request, res: Response) {
  const query = validate(listMeetingsQuery, req.query);
  sendOk(res, await meetingService.listMeetings(getAgencyContext(req).agencyId, query));
}

export async function listForProject(req: Request, res: Response) {
  const { projectId } = validate(projectIdParams, req.params);
  sendOk(res, await meetingService.listProjectMeetings(getAgencyContext(req).agencyId, projectId));
}

export async function create(req: Request, res: Response) {
  const { projectId } = validate(projectIdParams, req.params);
  const input = validate(createMeetingSchema, req.body);
  sendCreated(res, await meetingService.createMeeting(getAgencyContext(req), projectId, input));
}

export async function update(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const input = validate(updateMeetingSchema, req.body);
  sendOk(res, await meetingService.updateMeeting(getAgencyContext(req), id, input));
}

export async function remove(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  await meetingService.deleteMeeting(getAgencyContext(req), id);
  sendOk(res, { deleted: true });
}
