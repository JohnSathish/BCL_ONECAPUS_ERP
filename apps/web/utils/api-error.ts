import axios from 'axios';
import { ApiError, normalizeAxiosError } from '@/lib/http/api-error-types';

type ApiIssue = { code?: string; message?: string };

function formatIssues(issues: unknown): string | null {
  if (!Array.isArray(issues) || issues.length === 0) return null;
  return issues
    .map((issue) => {
      if (typeof issue === 'string') return issue;
      const row = issue as ApiIssue;
      return row.message ?? row.code ?? '';
    })
    .filter(Boolean)
    .join('\n');
}

function extractApiMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as { detail?: unknown; message?: unknown; issues?: unknown };

  const detailIssues = formatIssues(
    row.detail && typeof row.detail === 'object'
      ? (row.detail as { issues?: unknown }).issues
      : null,
  );
  if (detailIssues) return detailIssues;

  if (typeof row.detail === 'string' && row.detail.length > 0) {
    return row.detail;
  }

  const topIssues = formatIssues(row.issues);
  if (topIssues) return topIssues;

  if (typeof row.message === 'string' && row.message.length > 0) {
    return row.message;
  }

  if (Array.isArray(row.message)) {
    return row.message.join(', ');
  }

  if (row.message && typeof row.message === 'object') {
    const nested = row.message as { message?: unknown; issues?: unknown };
    const nestedIssues = formatIssues(nested.issues);
    if (nestedIssues) {
      return typeof nested.message === 'string' && nested.message.length > 0
        ? `${nested.message}: ${nestedIssues}`
        : nestedIssues;
    }
    if (typeof nested.message === 'string' && nested.message.length > 0) {
      return nested.message;
    }
  }

  return null;
}

export function isApiUnavailableError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.kind === 'NetworkError' || error.kind === 'TimeoutError';
  }
  if (axios.isAxiosError(error)) {
    if (!error.response) return true;
    const data = error.response.data as { errorCode?: string } | undefined;
    return error.response.status === 502 || data?.errorCode === 'API_PROXY_UNAVAILABLE';
  }
  return false;
}

export function apiErrorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof ApiError) {
    return error.message || fallback;
  }

  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return 'Unable to reach API server. Run: npm run dev (starts database + API + web).';
    }
    if (error.response.status === 502) {
      const message = extractApiMessage(error.response.data);
      return (
        message ??
        'API server is not running. Run: npm run dev:infra && npm run dev (or npm run dev:setup on first run).'
      );
    }
    const message = extractApiMessage(error.response.data);
    if (message) return message;
  }

  const normalized = normalizeAxiosError(error);
  if (normalized.message) return normalized.message;
  if (error instanceof Error && error.message) {
    if (error.message.includes('is not valid JSON')) {
      return 'Could not read the server response. Hard-refresh the page (Ctrl+Shift+R). If it persists, confirm the API is running.';
    }
    return error.message;
  }
  return fallback;
}

export { ApiError, normalizeAxiosError };
