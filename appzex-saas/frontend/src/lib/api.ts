/**
 * Centralized API client. Every request:
 *  - sends the HTTP-only session cookie (credentials: 'include')
 *  - sends the X-Requested-With header the API requires for CSRF defence
 *  - unwraps the `{ success, data }` envelope or throws an ApiError
 *  - reports 401 / suspension centrally so pages do not have to
 */

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

export interface FieldError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly errors?: FieldError[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

type SessionEvent = 'unauthorized' | 'suspended';
let sessionListener: ((event: SessionEvent) => void) | null = null;

/** Registered once by the app providers. */
export function setSessionListener(listener: (event: SessionEvent) => void) {
  sessionListener = listener;
}

function buildUrl(path: string, query?: QueryParams) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `${API_URL}${path}${qs ? `?${qs}` : ''}`;
}

async function send(method: string, path: string, init: { body?: unknown; formData?: FormData; query?: QueryParams; signal?: AbortSignal }) {
  const headers: Record<string, string> = { 'X-Requested-With': 'appzex-web' };
  let body: BodyInit | undefined;
  if (init.formData) {
    body = init.formData;
  } else if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.body);
  }

  try {
    return await fetch(buildUrl(path, init.query), {
      method,
      headers,
      body,
      credentials: 'include',
      cache: 'no-store',
      signal: init.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('Unable to reach the server. Check your connection and try again.', 0, 'NETWORK_ERROR');
  }
}

function handleFailure(path: string, status: number, json: { message?: string; code?: string; errors?: FieldError[] } | null): never {
  const error = new ApiError(json?.message || `Request failed (${status})`, status, json?.code, json?.errors);
  if (status === 401 && !path.startsWith('/auth/')) sessionListener?.('unauthorized');
  if (status === 403 && json?.code === 'AGENCY_SUSPENDED') sessionListener?.('suspended');
  throw error;
}

async function request<T>(
  method: string,
  path: string,
  init: { body?: unknown; formData?: FormData; query?: QueryParams; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await send(method, path, init);
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) handleFailure(path, response.status, json);
  return json.data as T;
}

export const apiClient = {
  get: <T>(path: string, query?: QueryParams, signal?: AbortSignal) => request<T>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body: body ?? {} }),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, formData: FormData) => request<T>('POST', path, { formData }),

  /** Downloads through the authorized API endpoint and saves with the original name. */
  async download(fileId: string, filename: string) {
    const path = `/files/${fileId}`;
    const response = await send('GET', path, {});
    if (!response.ok) {
      const json = await response.json().catch(() => null);
      handleFailure(path, response.status, json);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};

/** First field error message, or the top-level message. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (error instanceof ApiError) return error.errors?.[0]?.message ?? error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
