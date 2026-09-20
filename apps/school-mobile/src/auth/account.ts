import { apiFetch } from '@/api/client';
import { getDeviceId } from '@/auth/device';
import { markPasswordLogin } from '@/auth/password-gate';
import { getRefreshToken, getUser, saveSession, saveUser } from '@/auth/session';
import { registerSchoolPush } from '@/services/push';
import { isPrincipalUser, isStaffUser } from '@/persona';

export type AuthChallenge = {
  message: string;
  challengeId: string | null;
  channel?: string;
  masked?: string | null;
  contactKind?: string | null;
  codeFallback?: boolean;
  resendSeconds?: number;
};

export type LoginSession = {
  accessToken: string;
  refreshToken: string;
  firstLogin?: boolean;
  user: {
    permissions?: string[];
    roles?: string[];
    mustResetPassword?: boolean;
    displayName?: string;
  };
};

export function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  const labels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'] as const;
  return { score, label: labels[score] ?? 'Weak' };
}

export async function login(identifier: string, password: string) {
  const session = await apiFetch<LoginSession>('/v1/school-mobile/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      identifier: identifier.trim(),
      password,
      deviceId: await getDeviceId(),
      rememberMe: true,
    }),
  });
  await saveSession(session.accessToken, session.refreshToken);
  markPasswordLogin();
  await saveUser({
    displayName: session.user.displayName,
    roles: session.user.roles,
    permissions: session.user.permissions,
    mustResetPassword: Boolean(session.user.mustResetPassword),
    firstLogin: Boolean(session.firstLogin),
    persona: isPrincipalUser(session.user)
      ? 'admin'
      : isStaffUser(session.user)
        ? 'teacher'
        : undefined,
  });
  void (async () => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await registerSchoolPush();
  })().catch(() => undefined);
  return session;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await apiFetch<LoginSession>('/v1/school-mobile/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await saveSession(session.accessToken, session.refreshToken);
  const previous = await getUser();
  await saveUser({
    ...previous,
    ...session.user,
    mustResetPassword: false,
    firstLogin: false,
    persona:
      previous?.persona ??
      (isPrincipalUser(session.user) ? 'admin' : isStaffUser(session.user) ? 'teacher' : undefined),
  });
  return session;
}

export async function startActivate(identifier: string) {
  return apiFetch<AuthChallenge>('/v1/school-mobile/auth/activate/start', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ identifier: identifier.trim() }),
  });
}

export async function startForgot(identifier: string) {
  return apiFetch<AuthChallenge>('/v1/school-mobile/auth/forgot-password', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ identifier: identifier.trim() }),
  });
}

export async function sendOtp(challengeId: string, purpose: 'ACTIVATE' | 'RESET') {
  const path =
    purpose === 'RESET'
      ? '/v1/school-mobile/auth/forgot-password/send-otp'
      : '/v1/school-mobile/auth/activate/send-otp';
  return apiFetch<AuthChallenge>(path, {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ challengeId }),
  });
}

export async function verifyOtp(challengeId: string, otp: string, purpose: 'ACTIVATE' | 'RESET') {
  const path =
    purpose === 'RESET'
      ? '/v1/school-mobile/auth/forgot-password/verify-otp'
      : '/v1/school-mobile/auth/activate/verify-otp';
  return apiFetch<{ ok: boolean; challengeId: string }>(path, {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ challengeId, otp }),
  });
}

export async function verifyActivationCode(challengeId: string, code: string) {
  return apiFetch<{ ok: boolean; challengeId: string }>(
    '/v1/school-mobile/auth/activate/verify-code',
    {
      method: 'POST',
      skipAuth: true,
      body: JSON.stringify({ challengeId, code }),
    },
  );
}

export async function setPasswordFromChallenge(
  challengeId: string,
  newPassword: string,
  confirmPassword: string,
  purpose: 'ACTIVATE' | 'RESET',
) {
  const path =
    purpose === 'RESET'
      ? '/v1/school-mobile/auth/forgot-password/set-password'
      : '/v1/school-mobile/auth/activate/set-password';
  return apiFetch<{ ok: boolean; admissionHint?: string; purpose: string }>(path, {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ challengeId, newPassword, confirmPassword }),
  });
}

export async function fetchMyDevices() {
  return apiFetch<
    Array<{
      id: string;
      thisDevice?: boolean;
      deviceModel?: string | null;
      deviceLabel?: string | null;
      platform?: string;
      osVersion?: string | null;
      lastActiveAt?: string;
      deviceStatus?: string;
    }>
  >('/v1/school-mobile/devices/sessions');
}

export async function signOutOtherDevices() {
  return apiFetch('/v1/school-mobile/devices/sign-out-others', { method: 'POST' });
}

export async function signOutMyDevice(id: string) {
  return apiFetch(`/v1/school-mobile/devices/sessions/${id}`, { method: 'DELETE' });
}

export async function fetchSessions() {
  const refresh = await getRefreshToken();
  return apiFetch<
    Array<{
      id: string;
      current: boolean;
      lastActive: string;
      createdAt: string;
      device: string;
    }>
  >('/v1/school-mobile/auth/sessions', {
    headers: refresh ? { 'x-refresh-token': refresh } : undefined,
  });
}

export async function revokeSession(sessionId: string) {
  return apiFetch('/v1/school-mobile/auth/sessions/revoke', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export async function revokeOtherSessions() {
  const refreshToken = await getRefreshToken();
  return apiFetch('/v1/school-mobile/auth/sessions/revoke-others', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function logoutAllDevices() {
  return apiFetch('/v1/school-mobile/auth/sessions/revoke-all', { method: 'POST' });
}

export async function logoutCurrent() {
  const refreshToken = await getRefreshToken();
  try {
    await apiFetch('/v1/school-mobile/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    /* still clear local session */
  }
}
