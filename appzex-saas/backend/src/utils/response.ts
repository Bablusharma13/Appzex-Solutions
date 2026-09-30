import type { Response } from 'express';

/** Consistent success envelope: `{ success: true, data }`. */
export function sendOk<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

export function sendCreated<T>(res: Response, data: T) {
  return sendOk(res, data, 201);
}
