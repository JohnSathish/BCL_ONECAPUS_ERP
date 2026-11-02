import type { AuthSession, LoginPayload } from '@/types/auth';
import type { LoginChallenge, LoginContext } from '@/types/login-context';

export type AdminEmailOtpChallenge = {
  emailOtpRequired: true;
  challengeId: string;
  maskedEmail: string;
  expiresAt: string;
  resendAvailableAt: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};

export function isAdminEmailOtpChallenge(
  session: AuthSession | AdminEmailOtpChallenge,
): session is AdminEmailOtpChallenge {
  return (session as AdminEmailOtpChallenge).emailOtpRequired === true;
}
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
    const { data } = await publicClient.get<LoginChallenge>(`/v1/auth/challenge`, {
      headers: getLoginRequestHeaders(),
    });
    return data;
  }, options);
}

export async function login(payload: LoginPayload): Promise<AuthSession | AdminEmailOtpChallenge> {
  const { data } = await publicClient.post<AuthSession>(`/v1/auth/login`, payload, {
    headers: getLoginRequestHeaders(),
  });
  return data;
}

export async function verifyAdminEmailOtp(payload: {
  challengeId: string;
  code: string;
  trustDevice?: boolean;
}): Promise<AuthSession> {
  const { data } = await publicClient.post<AuthSession>(
    `/v1/auth/admin-email-otp/verify`,
    payload,
    { headers: getLoginRequestHeaders() },
  );
  return data;
}

export async function resendAdminEmailOtp(challengeId: string): Promise<AdminEmailOtpChallenge> {
  const { data } = await publicClient.post<AdminEmailOtpChallenge>(
    `/v1/auth/admin-email-otp/resend`,
    { challengeId },
    { headers: getLoginRequestHeaders() },
  );
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
