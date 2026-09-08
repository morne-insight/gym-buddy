import { supabase } from './supabase';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3002';

export class ApiError extends Error {
  status: number;
  details: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Fetch wrapper for the authenticated server API. Attaches the current Supabase
 * access token as a Bearer header on every call (D2), sends/receives JSON, and
 * surfaces the server's error envelope as an {@link ApiError}.
 */
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const text = await res.text();
  const payload = text ? JSON.parse(text) : undefined;

  if (!res.ok) {
    const message =
      (payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : undefined) ?? `Request failed (${res.status})`;
    throw new ApiError(res.status, message, (payload as { details?: unknown })?.details);
  }

  return payload as T;
}
