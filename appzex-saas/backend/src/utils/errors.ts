export interface FieldError {
  path: string;
  message: string;
}

/**
 * An error that is safe to show to API consumers. Anything that is NOT an
 * AppError is treated as an internal error and replaced with a generic message.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly options: { code?: string; errors?: FieldError[] } = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message = 'Bad request', errors?: FieldError[]) =>
  new AppError(400, message, { code: 'BAD_REQUEST', errors });

export const unauthorized = (message = 'Authentication required') =>
  new AppError(401, message, { code: 'UNAUTHORIZED' });

export const forbidden = (message = 'You do not have permission to perform this action', code = 'FORBIDDEN') =>
  new AppError(403, message, { code });

export const notFound = (message = 'Resource not found') => new AppError(404, message, { code: 'NOT_FOUND' });

export const conflict = (message: string) => new AppError(409, message, { code: 'CONFLICT' });

export const validationFailed = (errors: FieldError[]) =>
  new AppError(422, 'Validation failed', { code: 'VALIDATION_FAILED', errors });
