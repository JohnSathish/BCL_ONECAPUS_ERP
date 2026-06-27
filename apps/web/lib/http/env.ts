/**
 * Resolved API base URL for browser and server-side fetches.
 * In local dev with Next rewrites, use `/api` (same-origin).
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') return '/api';
  return 'http://localhost:3001/api';
}

/**
 * Direct Nest API URL for browser multipart uploads.
 * Next.js dev proxy can truncate streaming multipart bodies; bypass it for file uploads.
 */
export function getDirectApiBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_DIRECT_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'development') return 'http://127.0.0.1:3001/api';
  return getApiBaseUrl();
}

/** Socket.IO runs on the Nest host, not the Next.js dev server. */
export function getRealtimeOrigin(): string {
  const wsFromEnv = process.env.NEXT_PUBLIC_WS_ORIGIN?.trim();
  if (wsFromEnv) return wsFromEnv.replace(/\/$/, '');

  const apiBase = getApiBaseUrl();
  if (!apiBase.startsWith('/')) {
    return apiBase.replace(/\/api\/?$/, '');
  }

  const explicitApi = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicitApi && !explicitApi.startsWith('/')) {
    return explicitApi.replace(/\/api\/?$/, '');
  }

  return process.env.NODE_ENV === 'development'
    ? 'http://127.0.0.1:3001'
    : typeof window !== 'undefined'
      ? window.location.origin
      : 'http://127.0.0.1:3001';
}

export const API_BASE_URL = getApiBaseUrl();

export const API_REQUEST_TIMEOUT_MS = 15_000;

/** Quick in-flight retries inside the HTTP client (per attempt). */
export const API_GET_RETRY_COUNT = 4;

/** Total time login/bootstrap waits for the API to come up after restarts. */
export const API_STARTUP_MAX_WAIT_MS = 90_000;
