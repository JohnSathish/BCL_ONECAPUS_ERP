import type { AuthSession, LoginPayload } from '@/types/auth';
import type { LoginChallenge, LoginContext } from '@/types/login-context';
import { getLoginRequestHeaders } from '@/lib/login-host';
import { publicClient } from '@/lib/http/public-client';
import { type ApiStartupRetryOptions, withApiStartupRetry } from '@/lib/http/wait-for-api';
import { api } from './api';

export async function fetchLoginContext(options?: ApiStartupRetryOptions): Promise<LoginContext> {
  return withApiStartupRetry(async () => {
    const { data } = await publicClient.get<LoginContext>(`/v1/auth/context`, {
      headers: getLoginRequestHeaders(),
    });
    return data;
  }, options);
}

export async function fetchLoginChallenge(
  options?: ApiStartupRetryOptions,
): Promise<LoginChallenge> {
  return withApiStartupRetry(async () => {
    const { data } = await publicClient.get<LoginChallenge>(`/v1/auth/challenge`);
    return data;
  }, options);
}

export async function login(payload: LoginPayload): Promise<AuthSession> {
  const { data } = await publicClient.post<AuthSession>(`/v1/auth/login`, payload, {
    headers: getLoginRequestHeaders(),
  });
  return data;
}

export async function logout() {
  await publicClient.post(`/v1/auth/logout`);
}

/** Restore session from httpOnly refresh cookie on app load. */
export async function bootstrapSession(
  options?: ApiStartupRetryOptions,
): Promise<AuthSession | null> {
  try {
    return await withApiStartupRetry(async () => {
      const { data } = await publicClient.post<AuthSession>(`/v1/auth/refresh`, {});
      return {
        accessToken: data.accessToken,
        expiresIn: data.expiresIn,
        expiresAt: data.expiresAt,
        user: data.user,
      };
    }, options);
  } catch {
    return null;
  }
}

export { api };
