'use client';

import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { API_BASE_URL, API_GET_RETRY_COUNT, API_REQUEST_TIMEOUT_MS } from '@/lib/http/env';
import { isRetryableQueryError, normalizeAxiosError, sleep } from '@/lib/http/api-error-types';
import { dispatchLicenseWriteBlocked } from '@/components/licensing/license-write-blocked-banner';
import { useAuthStore } from '@/store/auth-store';
import { waitForAuthBootstrap } from '@/lib/auth/wait-for-auth-bootstrap';

type CreateClientOptions = {
  onUnauthorized?: (
    error: AxiosError,
    retry: (config: InternalAxiosRequestConfig) => ReturnType<AxiosInstance['request']>,
  ) => Promise<unknown>;
  onSuccess?: () => void;
  attachAuth?: boolean;
};

function isIdempotentGet(config: InternalAxiosRequestConfig) {
  return (config.method ?? 'get').toLowerCase() === 'get';
}

function requestId() {
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isApiEnvelope(value: unknown): value is { success: boolean; data?: unknown } {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'success' in value &&
    typeof (value as { success?: unknown }).success === 'boolean',
  );
}

function unwrapApiEnvelope(res: AxiosResponse) {
  if (isApiEnvelope(res.data) && res.data.success) {
    res.data = 'data' in res.data ? res.data.data : null;
  }
  return res;
}

function assertJsonApiResponse(res: AxiosResponse) {
  const contentType = String(res.headers['content-type'] ?? '').toLowerCase();
  const expectsJson = String(res.config.url ?? '').includes('/v1/');
  if (expectsJson && typeof res.data === 'string' && contentType.includes('text/html')) {
    throw new Error(
      'API returned an HTML page instead of JSON. Check the /api proxy and backend server.',
    );
  }
}

export function createHttpClient(options: CreateClientOptions = {}): AxiosInstance {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_REQUEST_TIMEOUT_MS,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });

  client.interceptors.request.use(async (config) => {
    config.headers = config.headers ?? {};
    if (options.attachAuth !== false) {
      try {
        await waitForAuthBootstrap();
      } catch {
        // Proceed without blocking forever; caller may receive 401 and redirect to login.
      }
      const session = useAuthStore.getState().session;
      if (session?.accessToken) {
        config.headers.Authorization = `Bearer ${session.accessToken}`;
      }
      if (session?.user.tenantSlug) {
        config.headers['X-Tenant-Slug'] = session.user.tenantSlug;
      }
    }
    config.headers['X-Request-Id'] = config.headers['X-Request-Id'] ?? requestId();
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  });

  client.interceptors.response.use(
    (res) => {
      assertJsonApiResponse(res);
      unwrapApiEnvelope(res);
      options.onSuccess?.();
      return res;
    },
    async (error: AxiosError) => {
      const config = error.config as InternalAxiosRequestConfig & {
        _retryCount?: number;
        _authRetry?: boolean;
      };

      if (
        error.response?.status === 401 &&
        options.onUnauthorized &&
        config &&
        !config._authRetry &&
        !String(config.url ?? '').includes('/auth/refresh')
      ) {
        config._authRetry = true;
        return options.onUnauthorized(error, (cfg) => client(cfg));
      }

      if (config && isIdempotentGet(config)) {
        const attempt = config._retryCount ?? 0;
        const noResponse = !error.response;
        const status = error.response?.status;
        const proxyDown =
          status === 502 &&
          (error.response?.data as { errorCode?: string } | undefined)?.errorCode ===
            'API_PROXY_UNAVAILABLE';
        const retryable =
          noResponse || proxyDown || (status != null && status >= 502 && status <= 504);
        if (retryable && attempt < API_GET_RETRY_COUNT) {
          config._retryCount = attempt + 1;
          await sleep(300 * 2 ** attempt);
          return client(config);
        }
      }

      if (error.response?.status === 403) {
        const payload = error.response.data as
          | { errorCode?: string; message?: string; detail?: string }
          | undefined;
        if (payload?.errorCode === 'LICENSE_WRITE_BLOCKED') {
          dispatchLicenseWriteBlocked(
            typeof payload.message === 'string'
              ? payload.message
              : typeof payload.detail === 'string'
                ? payload.detail
                : 'License expired. Please renew your subscription.',
          );
        }
      }

      return Promise.reject(normalizeAxiosError(error));
    },
  );

  return client;
}
