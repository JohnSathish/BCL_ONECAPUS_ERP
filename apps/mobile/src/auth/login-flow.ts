import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { apiFetch, setAppType } from '@/api/client';
import { getDeviceId } from '@/auth/device';
import { getInstalledAppVersion } from '@/utils/app-version';
import { canAccessMobile, resolveMobileRoute } from '@/auth/role-router';
import {
  saveAppType,
  saveLastLoginAt,
  saveRememberMe,
  saveSession,
  saveUserSnapshot,
  type StoredUserSnapshot,
} from '@/auth/session';
import type { Challenge } from '@/components/auth/captcha-widget';
import { registerDeviceWithPush } from '@/services/push-notifications';

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

export type SessionTokensInput = {
  accessToken: string;
  refreshToken: string;
  user?: StoredUserSnapshot | null;
  rememberMe?: boolean;
  /** When false, skip push/device registration (e.g. mid unlock). Default true. */
  registerDevice?: boolean;
};

export function normalizeLoginIdentifier(raw: string) {
  const value = raw.trim();
  if (value.includes('@')) return value.toLowerCase();
  return value;
}

/**
 * Best-effort device details so the web admin's Device & Login panel can show
 * real model / manufacturer / OS instead of "Unknown". All fields are optional
 * — a null from expo-device just omits that field.
 */
async function collectDeviceMeta() {
  const platform = Device.osName ?? (Platform.OS === 'ios' ? 'iOS' : 'Android');
  const osVersion = Device.osVersion ?? String(Platform.Version ?? '') ?? undefined;
  const model = Device.modelName ?? undefined;

  // Distinguish phones from tablets (e.g. iPad) so the admin panel buckets them
  // correctly. Failure to resolve just omits the hint (server falls back).
  let deviceType: 'MOBILE' | 'TABLET' | 'DESKTOP' | undefined;
  try {
    const kind = await Device.getDeviceTypeAsync();
    if (kind === Device.DeviceType.TABLET) deviceType = 'TABLET';
    else if (kind === Device.DeviceType.PHONE) deviceType = 'MOBILE';
    else if (kind === Device.DeviceType.DESKTOP) deviceType = 'DESKTOP';
  } catch {
    // Ignore — deviceType stays undefined.
  }

  return {
    clientType: 'mobile',
    deviceType,
    platform,
    osVersion: osVersion || undefined,
    deviceModel: model,
    deviceLabel: model,
    manufacturer: Device.manufacturer ?? undefined,
    brand: Device.brand ?? undefined,
    appVersion: getInstalledAppVersion(),
  };
}

/**
 * Persist tokens + user snapshot and resolve the mobile home route.
 * Shared by password login, biometric unlock (after refresh), QR, and RFID redeem.
 */
export async function completeSessionFromTokens(input: SessionTokensInput): Promise<LoginResult> {
  const user = input.user ?? {};

  if (!canAccessMobile(user)) {
    throw new Error('This account does not have mobile portal access. Contact IT support.');
  }

  const route = resolveMobileRoute(user);
  if (route.href === '/(auth)/login') {
    throw new Error('No mobile dashboard is configured for this account.');
  }

  await saveSession(input.accessToken, input.refreshToken);
  await saveUserSnapshot({
    permissions: user.permissions,
    roles: user.roles,
    shiftIds: user.shiftIds,
    allShifts: user.allShifts,
    mustResetPassword: user.mustResetPassword ?? false,
  });
  if (input.rememberMe != null) {
    await saveRememberMe(input.rememberMe);
  }
  await saveLastLoginAt(new Date().toISOString());
  setAppType(route.appType);
  await saveAppType(route.appType);

  const mustResetPassword = user.mustResetPassword ?? false;

  if (!mustResetPassword && input.registerDevice !== false) {
    const appType = route.appType === 'student' ? 'STUDENT' : 'STAFF';
    try {
      await registerDeviceWithPush(appType);
    } catch {
      try {
        const deviceId = await getDeviceId();
        await apiFetch('/v1/mobile-app/devices/register', {
          method: 'POST',
          body: JSON.stringify({
            deviceId,
            appType,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
          }),
        });
      } catch {
        // Device registration must not block login
      }
    }
  }

  return {
    route,
    mustResetPassword,
  };
}

export async function performLogin(input: {
  identifier: string;
  password: string;
  challenge: Challenge;
  challengeAnswer: number;
  rememberMe?: boolean;
}) {
  const identifier = normalizeLoginIdentifier(input.identifier);
  const deviceMeta = await collectDeviceMeta();
  const session = await apiFetch<LoginResponse>('/v1/auth/login', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      ...(identifier.includes('@') ? { email: identifier } : { identifier }),
      password: input.password,
      challengeToken: input.challenge.token,
      challengeAnswer: input.challengeAnswer,
      rememberMe: input.rememberMe ?? false,
      ...deviceMeta,
    }),
  });

  if (session.mfaRequired) {
    throw new Error(
      'Multi-factor authentication is required. Please sign in on the web portal for now.',
    );
  }

  return completeSessionFromTokens({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: session.user,
    rememberMe: input.rememberMe ?? false,
  });
}

export async function performQrRedeem(token: string) {
  const session = await apiFetch<LoginResponse>('/v1/auth/qr/redeem', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ token: token.trim() }),
  });
  return completeSessionFromTokens({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: session.user,
    rememberMe: true,
  });
}

export async function performRfidRedeem(cardUid: string) {
  const session = await apiFetch<LoginResponse>('/v1/auth/rfid/redeem', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ cardUid: cardUid.trim() }),
  });
  return completeSessionFromTokens({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    user: session.user,
    rememberMe: true,
  });
}
