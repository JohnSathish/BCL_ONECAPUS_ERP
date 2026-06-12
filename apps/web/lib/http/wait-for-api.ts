import axios from 'axios';
import { ApiError, sleep } from '@/lib/http/api-error-types';
import { API_STARTUP_MAX_WAIT_MS } from '@/lib/http/env';
import { isApiUnavailableError } from '@/utils/api-error';

const INITIAL_DELAY_MS = 750;
const MAX_DELAY_MS = 4_000;

export type ApiStartupRetryOptions = {
  signal?: AbortSignal;
  maxWaitMs?: number;
  /** Called before each retry delay (not on the first attempt). */
  onWaiting?: (info: { attempt: number; elapsedMs: number; nextDelayMs: number }) => void;
};

/** True when the failure is likely because the Nest API is still starting or restarting. */
export function isApiStartupError(error: unknown): boolean {
  if (isApiUnavailableError(error)) return true;

  if (error instanceof ApiError) {
    return error.kind === 'NetworkError' || error.kind === 'TimeoutError';
  }

  if (axios.isAxiosError(error)) {
    if (!error.response) return true;
    const status = error.response.status;
    return status >= 502 && status <= 504;
  }

  return false;
}

/**
 * Retries an API call with exponential backoff while the backend is unavailable.
 * Used on login bootstrap so the page waits for `npm run dev` / hot reload instead of failing immediately.
 */
export async function withApiStartupRetry<T>(
  operation: () => Promise<T>,
  options: ApiStartupRetryOptions = {},
): Promise<T> {
  const maxWaitMs = options.maxWaitMs ?? API_STARTUP_MAX_WAIT_MS;
  const startedAt = Date.now();
  let attempt = 0;

  while (true) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      return await operation();
    } catch (error) {
      if (!isApiStartupError(error)) throw error;

      attempt += 1;
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs >= maxWaitMs) throw error;

      const nextDelayMs = Math.min(INITIAL_DELAY_MS * 1.5 ** (attempt - 1), MAX_DELAY_MS);
      options.onWaiting?.({ attempt, elapsedMs, nextDelayMs });
      await sleep(nextDelayMs);
    }
  }
}
