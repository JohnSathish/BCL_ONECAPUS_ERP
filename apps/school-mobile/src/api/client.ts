import { getApiBase, schoolHeaders } from '@/api/config';
import { getAccessToken } from '@/auth/session';
import { refreshAccessToken } from '@/auth/token-refresh';

let onAuthFailure: (() => void) | null = null;
export function setAuthFailureHandler(handler: () => void) {
  onAuthFailure = handler;
}

type Options = RequestInit & { skipAuth?: boolean; _retried?: boolean };

function unwrap<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'data' in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

function messageOf(json: unknown, fallback: string) {
  if (json && typeof json === 'object') {
    const row = json as { message?: string; detail?: string };
    return row.detail || row.message || fallback;
  }
  return fallback;
}

export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  const headers = await schoolHeaders(options.headers as Record<string, string>);
  if (!options.skipAuth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const url = `${getApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new Error("You're offline. Some information may be unavailable.");
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && !options.skipAuth && !options._retried) {
    try {
      await refreshAccessToken();
      return apiFetch<T>(path, { ...options, _retried: true });
    } catch {
      onAuthFailure?.();
      throw new Error('Please sign in again.');
    }
  }
  if (!res.ok) {
    throw new Error(messageOf(json, 'Something went wrong. Please try again.'));
  }
  return unwrap<T>(json);
}
