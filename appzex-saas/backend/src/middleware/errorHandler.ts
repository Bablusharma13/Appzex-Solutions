import { Prisma } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

interface ErrorBody {
  success: false;
  message: string;
  code?: string;
  errors?: { path: string; message: string }[];
}

function send(res: Response, status: number, body: Omit<ErrorBody, 'success'>) {
  res.status(status).json({ success: false, ...body } satisfies ErrorBody);
}

export function notFoundHandler(_req: Request, res: Response) {
  send(res, 404, { message: 'Route not found', code: 'NOT_FOUND' });
}

/**
 * Centralized error handler. Only AppError messages reach the client; any
 * other error is logged server-side and replaced with a generic 500 so that
 * stack traces, SQL and internal details never leak.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return send(res, err.statusCode, { message: err.message, code: err.options.code, errors: err.options.errors });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return send(res, 413, {
        message: `File is too large. Maximum size is ${env.MAX_UPLOAD_MB} MB.`,
        code: 'FILE_TOO_LARGE',
      });
    }
    return send(res, 400, { message: 'Invalid file upload request.', code: 'BAD_UPLOAD' });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002')
      return send(res, 409, { message: 'A record with these details already exists.', code: 'CONFLICT' });
    if (err.code === 'P2025') return send(res, 404, { message: 'Resource not found', code: 'NOT_FOUND' });
    if (err.code === 'P2003')
      return send(res, 409, { message: 'This action conflicts with related records.', code: 'CONFLICT' });
  }

  const bodyParserError = err as { type?: string; status?: number };
  if (bodyParserError?.type === 'entity.parse.failed') {
    return send(res, 400, { message: 'Malformed JSON request body.', code: 'BAD_REQUEST' });
  }
  if (bodyParserError?.type === 'entity.too.large') {
    return send(res, 413, { message: 'Request body is too large.', code: 'PAYLOAD_TOO_LARGE' });
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  return send(res, 500, { message: 'Something went wrong on our side. Please try again.', code: 'INTERNAL_ERROR' });
}
