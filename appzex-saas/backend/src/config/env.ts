import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((value) => value === 'true' || value === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  COOKIE_SECURE: booleanString,
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(100).default(10),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().optional().default('gpt-4.1-mini'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  SUPPORT_SESSION_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .max(24 * 60)
    .default(60),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`).join('\n');
  console.error(`Invalid environment configuration:\n${details}`);
  process.exit(1);
}

const raw = parsed.data;

// SameSite=None cookies are rejected by browsers unless they are also Secure.
const cookieSecure = raw.COOKIE_SAMESITE === 'none' ? true : raw.COOKIE_SECURE;

export const env = {
  ...raw,
  isProduction: raw.NODE_ENV === 'production',
  isTest: raw.NODE_ENV === 'test',
  corsOrigins: raw.CORS_ORIGIN.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  cookieSecure,
  uploadDir: path.resolve(process.cwd(), raw.UPLOAD_DIR),
  maxUploadBytes: Math.round(raw.MAX_UPLOAD_MB * 1024 * 1024),
  openaiModel: raw.OPENAI_MODEL || 'gpt-4.1-mini',
  aiEnabled: Boolean(raw.OPENAI_API_KEY),
};
