import type { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { getAuth } from '../middleware/authorize';
import { getSessionProfile, issueToken } from '../services/authService';
import * as superAdminService from '../services/superAdminService';
import { setSessionCookie } from '../utils/cookies';
import { sendCreated, sendOk } from '../utils/response';
import { validate } from '../utils/validate';
import { idParams } from '../validators/common';
import {
  createAgencySchema,
  listAgenciesQuery,
  startSupportSessionSchema,
  updateAgencyStatusSchema,
} from '../validators/superAdminValidators';

export async function dashboard(_req: Request, res: Response) {
  sendOk(res, await superAdminService.getPlatformDashboard());
}

export async function listAgencies(req: Request, res: Response) {
  sendOk(res, await superAdminService.listAgencies(validate(listAgenciesQuery, req.query)));
}

export async function getAgency(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  sendOk(res, await superAdminService.getAgencyDetail(id));
}

export async function createAgency(req: Request, res: Response) {
  const input = validate(createAgencySchema, req.body);
  sendCreated(res, await superAdminService.createAgency(getAuth(req), input));
}

export async function updateAgencyStatus(req: Request, res: Response) {
  const { id } = validate(idParams, req.params);
  const { status, reason } = validate(updateAgencyStatusSchema, req.body);
  sendOk(res, await superAdminService.updateAgencyStatus(getAuth(req), id, status, reason));
}

/** Re-issues the session cookie with (or without) a support session id. */
async function refreshSessionCookie(res: Response, userId: string, supportSessionId?: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, role: true, tokenVersion: true },
  });
  setSessionCookie(res, issueToken(user, null, supportSessionId));
}

export async function startSupportSession(req: Request, res: Response) {
  const auth = getAuth(req);
  const { id } = validate(idParams, req.params);
  const { reason } = validate(startSupportSessionSchema, req.body ?? {});
  const session = await superAdminService.startSupportSession(auth, id, reason);
  await refreshSessionCookie(res, auth.userId, session.id);
  sendCreated(res, {
    session,
    profile: await getSessionProfile(auth.userId, {
      id: session.id,
      agencyId: session.agencyId,
      agencyName: session.agencyName,
      expiresAt: session.expiresAt,
    }),
  });
}

export async function endSupportSession(req: Request, res: Response) {
  const auth = getAuth(req);
  const { id } = validate(idParams, req.params);
  const session = await superAdminService.endSupportSession(auth, id);
  await refreshSessionCookie(res, auth.userId);
  sendOk(res, { session, profile: await getSessionProfile(auth.userId) });
}
