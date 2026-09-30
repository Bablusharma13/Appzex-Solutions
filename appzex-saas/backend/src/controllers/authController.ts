import type { Request, Response } from 'express';
import { getAuth } from '../middleware/authorize';
import * as authService from '../services/authService';
import { clearSessionCookie, setSessionCookie } from '../utils/cookies';
import { sendOk } from '../utils/response';
import { validate } from '../utils/validate';
import { loginSchema } from '../validators/authValidators';

export async function login(req: Request, res: Response) {
  const { email, password } = validate(loginSchema, req.body);
  const { token, userId } = await authService.login(email, password);
  setSessionCookie(res, token);
  sendOk(res, await authService.getSessionProfile(userId));
}

export async function logout(req: Request, res: Response) {
  await authService.logout(getAuth(req));
  clearSessionCookie(res);
  sendOk(res, { loggedOut: true });
}

export async function me(req: Request, res: Response) {
  const auth = getAuth(req);
  sendOk(res, await authService.getSessionProfile(auth.userId, auth.supportSession));
}
