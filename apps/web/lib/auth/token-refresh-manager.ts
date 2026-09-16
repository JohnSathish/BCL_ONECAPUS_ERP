'use client';

import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { createHttpClient } from '@/lib/http/create-client';
import { withApiStartupRetry, isApiStartupError } from '@/lib/http/wait-for-api';
import { useAuthStore } from '@/store/auth-store';
import type { AuthSession } from '@/types/auth';
import { isBrowserAuthColdPath } from '@/lib/auth/auth-cold-path';
import { pingActivity } from './session-activity';
import { broadcastSessionMessage } from './session-broadcast';
import { processRefreshQueue, type RefreshQueueEntry } from './refresh-request-queue';

const refreshClient = createHttpClient({ attachAuth: false });

function httpStatus(error: unknown): number | undefined {
  if (axios.isAxiosError(error)) return error.response?.status;
  return undefined;
}

function accessTokenStillValid(): boolean {
  const session = useAuthStore.getState().session;
  if (!session?.accessToken || !session.expiresAt) return false;
  const expiresAtMs = new Date(session.expiresAt).getTime();
  return Number.isFinite(expiresAtMs) && expiresAtMs > Date.now() + 5_000;
}

class TokenRefreshManager {
  private refreshPromise: Promise<AuthSession> | null = null;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private failedQueue: RefreshQueueEntry[] = [];
  private lastRefreshFailureAt = 0;

  scheduleProactiveRefresh(session: AuthSession): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    if (isBrowserAuthColdPath()) return;

    const expiresAtMs = new Date(session.expiresAt).getTime();
    if (!Number.isFinite(expiresAtMs)) return;

    const refreshAt = expiresAtMs - 2 * 60 * 1000;
    const delay = expiresAtMs <= Date.now() ? 30_000 : Math.max(refreshAt - Date.now(), 60_000);

    this.refreshTimer = setTimeout(() => {
      void this.refreshSession().catch(() => undefined);
    }, delay);
  }

  async refreshSession(options?: { maxWaitMs?: number }): Promise<AuthSession> {
    if (isBrowserAuthColdPath()) {
      throw new Error('Session refresh is disabled on login screens.');
    }
    if (this.refreshPromise) return this.refreshPromise;
    if (this.lastRefreshFailureAt > 0 && Date.now() - this.lastRefreshFailureAt < 30_000) {
      throw new Error('Refresh temporarily paused after a recent failure.');
    }

    this.refreshPromise = withApiStartupRetry(
      () => refreshClient.post<AuthSession>('/v1/auth/refresh', {}),
      options?.maxWaitMs != null ? { maxWaitMs: options.maxWaitMs } : undefined,
    )
      .then(({ data }) => {
        const session: AuthSession = {
          accessToken: data.accessToken,
          expiresIn: data.expiresIn,
          expiresAt: data.expiresAt,
          user: data.user,
        };
        useAuthStore.getState().setSession(session);
        this.scheduleProactiveRefresh(session);
        broadcastSessionMessage({ type: 'SESSION_UPDATED', session });
        pingActivity();
        this.processQueue(null, session.accessToken);
        return session;
      })
      .catch((error) => {
        if (isApiStartupError(error)) {
          this.processQueue(error, null);
          throw error;
        }
        this.lastRefreshFailureAt = Date.now();
        const status = httpStatus(error);
        if (status === 429) {
          this.processQueue(error, null);
          const session = useAuthStore.getState().session;
          if (session && accessTokenStillValid()) {
            this.scheduleProactiveRefresh(session);
          }
          throw error;
        }
        useAuthStore.getState().clear();
        this.clearSchedule();
        broadcastSessionMessage({ type: 'LOGOUT' });
        this.processQueue(error, null);
        throw error;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  private processQueue(error: unknown | null, token: string | null) {
    this.failedQueue = processRefreshQueue(this.failedQueue, error, token);
  }

  async handle401(
    error: AxiosError,
    retry: (config: InternalAxiosRequestConfig) => Promise<unknown>,
  ): Promise<unknown> {
    if (isBrowserAuthColdPath()) {
      return Promise.reject(error);
    }

    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (!original || original._retry) {
      return Promise.reject(error);
    }

    if (this.refreshPromise) {
      return new Promise((resolve, reject) => {
        this.failedQueue.push({
          resolve: (token) => {
            original.headers.Authorization = `Bearer ${token}`;
            original._retry = true;
            resolve(retry(original));
          },
          reject,
        });
      });
    }

    original._retry = true;

    try {
      const session = await this.refreshSession();
      original.headers.Authorization = `Bearer ${session.accessToken}`;
      return retry(original);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }

  clearSchedule(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
}

export const tokenRefreshManager = new TokenRefreshManager();
