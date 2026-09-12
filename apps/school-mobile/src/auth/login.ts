import { apiFetch } from '@/api/client';
import { saveActiveChild, saveSession, saveUser } from '@/auth/session';
import { registerSchoolPush } from '@/services/push';

export type LoginSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    permissions?: string[];
    roles?: string[];
    mustResetPassword?: boolean;
    displayName?: string;
  };
};

export async function login(identifier: string, password: string) {
  const session = await apiFetch<LoginSession>('/v1/school-mobile/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      identifier: identifier.trim(),
      password,
    }),
  });
  await saveSession(session.accessToken, session.refreshToken);
  await saveUser(session.user);
  try {
    await registerSchoolPush();
  } catch {
    /* login still succeeds */
  }
  return session;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await apiFetch<LoginSession>('/v1/school-mobile/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  await saveSession(session.accessToken, session.refreshToken);
  await saveUser({ ...session.user, mustResetPassword: false });
  return session;
}

export async function fetchHome(childId?: string | null) {
  const q = childId ? `?childId=${encodeURIComponent(childId)}` : '';
  return apiFetch<Record<string, unknown>>(`/v1/school-mobile/home${q}`);
}

export async function switchChild(id: string) {
  await saveActiveChild(id);
}
