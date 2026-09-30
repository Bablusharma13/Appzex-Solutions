import type { z } from 'zod';
import { validationFailed } from './errors';

/**
 * Parses untrusted input with a Zod schema. Throws a 422 AppError with
 * field-level messages when validation fails.
 */
export function validate<TSchema extends z.ZodType>(schema: TSchema, input: unknown): z.output<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw validationFailed(
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.') || '(root)',
        message: issue.message,
      })),
    );
  }
  return result.data;
}
