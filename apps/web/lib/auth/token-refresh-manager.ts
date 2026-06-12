'use client';

import { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { createHttpClient } from '@/lib/http/create-client';
import { withApiStartupRetry, isApiStartupError } from '@/lib/http/wait-for-api';
import { useAuthStore } from '@/store/auth-store';
import type { AuthSession } from '@/types/auth';
import { pingActivity } from './session-activity';
import { broadcastSessionMessage } from './session-broadcast';
import { processRefreshQueue, type RefreshQueueEntry } from './refresh-request-queue';

const refreshClient = createHttpClient({ attachAuth: false });
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

    const expiresAtMs = new Date(session.expiresAt).getTime();
    const refreshAt = expiresAtMs - 2 * 60 * 1000;
    const delay = Math.max(refreshAt - Date.now(), 5_000);

    this.refreshTimer = setTimeout(() => {
      void this.refreshSession().catch(() => {
        useAuthStore.getState().clear();
        broadcastSessionMessage({ type: 'LOGOUT' });
      });
    }, delay);
  }

  async refreshSession(): Promise<AuthSession> {
    if (this.refreshPromise) return this.refreshPromise;
    if (Date.now() - this.lastRefreshFailureAt < 10_000) {
      throw new Error('Refresh temporarily paused after a recent failure.');
    }

    this.refreshPromise = withApiStartupRetry(() =>
      refreshClient.post<AuthSession>('/v1/auth/refresh', {}),
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
