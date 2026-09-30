import type { Request, Response } from 'express';
import { env } from '../config/env';
import { getAgencyContext } from '../middleware/authorize';
import { generateMeetingSummary, generateProjectHealth } from '../services/ai/aiService';
import { sendOk } from '../utils/response';
import { validate } from '../utils/validate';
import { meetingSummarySchema, projectHealthSchema } from '../validators/workValidators';

export function status(_req: Request, res: Response) {
  sendOk(res, { enabled: env.aiEnabled, model: env.aiEnabled ? env.openaiModel : null });
}

export async function projectHealth(req: Request, res: Response) {
  const { projectId } = validate(projectHealthSchema, req.body);
  sendOk(res, await generateProjectHealth(getAgencyContext(req), projectId));
}

export async function meetingSummary(req: Request, res: Response) {
  const input = validate(meetingSummarySchema, req.body);
  sendOk(res, await generateMeetingSummary(getAgencyContext(req), input));
}
