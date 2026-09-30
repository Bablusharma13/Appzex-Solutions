import { z } from 'zod';
import { parseDateOnly } from '../utils/dates';

export const idSchema = z.string().trim().min(1, 'Required').max(64);

export const idParams = z.object({ id: idSchema });
export const projectIdParams = z.object({ projectId: idSchema });
export const taskIdParams = z.object({ taskId: idSchema });

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string) {
  const date = parseDateOnly(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const dateOnlyString = z
  .string()
  .regex(DATE_ONLY, 'Use the YYYY-MM-DD format')
  .refine(isRealDate, 'Enter a valid date');

/** Required date (YYYY-MM-DD) -> Date at UTC midnight. */
export const dateOnly = dateOnlyString.transform(parseDateOnly);

/**
 * PATCH-friendly optional fields:
 *   undefined -> leave unchanged, null or '' -> clear, value -> set.
 */
export const nullableDate = z
  .union([dateOnlyString, z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === undefined ? undefined : value ? parseDateOnly(value) : null));

export const nullableText = (max: number) =>
  z
    .union([z.string().trim().max(max, `Must be ${max} characters or fewer`), z.null()])
    .optional()
    .transform((value) => (value === undefined ? undefined : value ? value : null));

export const nullableId = z
  .union([idSchema, z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === undefined ? undefined : value ? value : null));

export const nullableEmail = z
  .union([z.string().trim().toLowerCase().email('Enter a valid email address').max(191), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === undefined ? undefined : value ? value : null));

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address').max(191);

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const searchSchema = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => v || undefined);

/** Query-string booleans: "true"/"false". */
export const queryBoolean = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === 'true'));

export const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const projectStatusEnum = z.enum(['ACTIVE', 'ON_HOLD', 'COMPLETED']);
export const milestoneStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']);
export const taskStatusEnum = z.enum(['TODO', 'IN_PROGRESS', 'COMPLETED']);
export const feedbackStatusEnum = z.enum(['OPEN', 'IN_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'DECLINED']);

export const commentSchema = z.object({
  content: z.string().trim().min(1, 'Comment cannot be empty').max(5000),
});
