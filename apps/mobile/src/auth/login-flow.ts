import { Platform } from 'react-native';
import { apiFetch, setAppType } from '@/api/client';
import { getDeviceId } from '@/auth/device';
import { canAccessMobile, resolveMobileRoute } from '@/auth/role-router';
import { saveAppType, saveSession, saveUserSnapshot, saveLastLoginAt } from '@/auth/session';
import type { Challenge } from '@/components/auth/captcha-widget';

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  mfaRequired?: boolean;
  mfaToken?: string;
  user: {
    permissions?: string[];
    roles?: string[];
    shiftIds?: string[];
    allShifts?: boolean;
    mustResetPassword?: boolean;
  };
};

export type LoginResult = {
  route: ReturnType<typeof resolveMobileRoute>;
  mustResetPassword: boolean;
};

export function normalizeLoginIdentifier(raw: string) {
  const value = raw.trim();
  if (value.includes('@')) return value.toLowerCase();
  return value;
}

export async function performLogin(input: {
  identifier: string;
  password: string;
  challenge: Challenge;
  challengeAnswer: number;
  rememberMe?: boolean;
}) {
  const identifier = normalizeLoginIdentifier(input.identifier);
  const session = await apiFetch<LoginResponse>('/v1/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      ...(identifier.includes('@') ? { email: identifier } : { identifier }),
      password: input.password,
      challengeToken: input.challenge.token,
      challengeAnswer: input.challengeAnswer,
      rememberMe: input.rememberMe ?? false,
    }),
  });

  if (session.mfaRequired) {
    throw new Error(
      'Multi-factor authentication is required. Please sign in on the web portal for now.',
    );
  }

  if (!canAccessMobile(session.user)) {
    throw new Error('This account does not have mobile portal access. Contact IT support.');
  }

  const route = resolveMobileRoute(session.user);
  if (route.href === '/(auth)/login') {
    throw new Error('No mobile dashboard is configured for this account.');
  }

  await saveSession(session.accessToken, session.refreshToken);
  await saveUserSnapshot(session.user);
  await saveLastLoginAt(new Date().toISOString());
  setAppType(route.appType);
  await saveAppType(route.appType);

  const deviceId = await getDeviceId();
  await apiFetch('/v1/mobile-app/devices/register', {
    method: 'POST',
    body: JSON.stringify({
      deviceId,
      appType: route.appType === 'student' ? 'STUDENT' : 'STAFF',
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    }),
  });

  return {
    route,
    mustResetPassword: session.user.mustResetPassword ?? false,
  };
}
