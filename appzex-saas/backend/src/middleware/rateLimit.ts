import type { Request, Response } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { env } from '../config/env';

function tooManyRequests(message: string) {
  return (_req: Request, res: Response) => {
    res.status(429).json({ success: false, code: 'RATE_LIMITED', message });
  };
}

/**
 * Login brute-force protection. Only FAILED attempts count, so normal demo
 * usage (switching between accounts) is never throttled.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: tooManyRequests('Too many failed login attempts. Please wait 15 minutes and try again.'),
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 2000,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  handler: tooManyRequests('Too many requests. Please slow down and try again shortly.'),
});

/** AI calls cost money; limit per authenticated user. */
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip ?? 'unknown'),
  handler: tooManyRequests('AI request limit reached. Please wait a minute and try again.'),
});
