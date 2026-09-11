import { apiFetch } from '@/api/client';
import { saveActiveChild, saveSession, saveUser } from '@/auth/session';
import { registerSchoolPush } from '@/services/push';

export type Challenge = { token: string; question?: string; expression?: string };

export type LoginSession = {
  accessToken: string;
  refreshToken: string;
  mfaRequired?: boolean;
  user: {
    permissions?: string[];
    roles?: string[];
    mustResetPassword?: boolean;
  };
};

export async function fetchChallenge() {
  return apiFetch<Challenge>('/v1/auth/challenge', { skipAuth: true });
}

export async function login(
  identifier: string,
  password: string,
  challenge: Challenge,
  answer: number,
) {
  const value = identifier.trim();
  const session = await apiFetch<LoginSession>('/v1/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      ...(value.includes('@') ? { email: value.toLowerCase() } : { identifier: value }),
      password,
      challengeToken: challenge.token,
      challengeAnswer: answer,
      rememberMe: true,
      clientType: 'mobile',
    }),
  });
  if (session.mfaRequired) {
    throw new Error('Please complete sign-in on the school ERP website first.');
  }
  await saveSession(session.accessToken, session.refreshToken);
  await saveUser(session.user);
  try {
    await registerSchoolPush();
  } catch {
    /* login still succeeds */
  }
  return session;
}

export async function fetchHome(childId?: string | null) {
  const q = childId ? `?childId=${encodeURIComponent(childId)}` : '';
  return apiFetch<Record<string, unknown>>(`/v1/school-mobile/home${q}`);
}

export async function switchChild(id: string) {
  await saveActiveChild(id);
}
