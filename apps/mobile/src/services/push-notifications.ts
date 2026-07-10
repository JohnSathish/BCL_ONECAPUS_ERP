import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { router } from 'expo-router';
import { apiFetch } from '@/api/client';
import { getDeviceId } from '@/auth/device';
import { getAccessToken, getStoredAppType } from '@/auth/session';
import {
  resolveMobileDeepLink,
  fallbackNotificationCenter,
} from '@/services/notification-deep-link';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

export async function ensureAndroidDefaultChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('onecampus_default', {
    name: 'OneCampus',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#020f2e',
  });
}

export async function requestPushPermissions(): Promise<boolean> {
  if (!Device.isDevice && Platform.OS === 'ios') {
    return false;
  }
  await ensureAndroidDefaultChannel();
  const current = await Notifications.getPermissionsAsync();
  if (
    current.status === 'granted' ||
    current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }
  const asked = await Notifications.requestPermissionsAsync();
  return (
    asked.status === 'granted' ||
    asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

export async function getExpoPushToken(): Promise<string | null> {
  const allowed = await requestPushPermissions();
  if (!allowed) return null;
  try {
    // Prefer native FCM/APNs device token — Nest API sends via FCM HTTP v1.
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    if (deviceToken?.data) return String(deviceToken.data);

    const projectId = easProjectId();
    const expoToken = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return expoToken.data ?? null;
  } catch {
    return null;
  }
}

export async function collectDeviceMeta() {
  return {
    appVersion: Constants.expoConfig?.version ?? '1.0.0',
    osVersion: String(Platform.Version ?? ''),
    deviceModel: Device.modelName ?? Device.deviceName ?? undefined,
  };
}

export async function registerDeviceWithPush(appType: 'STUDENT' | 'STAFF') {
  const deviceId = await getDeviceId();
  const meta = await collectDeviceMeta();
  const pushToken = await getExpoPushToken();
  await apiFetch('/v1/mobile-app/devices/register', {
    method: 'POST',
    body: JSON.stringify({
      deviceId,
      appType,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      pushToken: pushToken ?? undefined,
      ...meta,
    }),
  });
  return { deviceId, pushToken };
}

export async function refreshPushRegistrationIfLoggedIn() {
  const token = await getAccessToken();
  if (!token) return;
  const appTypeRaw = await getStoredAppType();
  const appType = appTypeRaw === 'staff' ? 'STAFF' : 'STUDENT';
  try {
    await registerDeviceWithPush(appType);
  } catch {
    // non-blocking
  }
}

export async function unregisterPushDevice() {
  try {
    const deviceId = await getDeviceId();
    await apiFetch(`/v1/mobile-app/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
    });
  } catch {
    // session may already be cleared
  }
}

export function extractLinkFromNotification(
  content: Notifications.NotificationContent,
): string | undefined {
  const data = (content.data ?? {}) as Record<string, unknown>;
  const link = data.link ?? data.url ?? data.path;
  return typeof link === 'string' && link.trim() ? link.trim() : undefined;
}

export async function trackPushOpened(link?: string) {
  try {
    const appTypeRaw = await getStoredAppType();
    await apiFetch('/v1/mobile-app/analytics/events', {
      method: 'POST',
      body: JSON.stringify({
        events: [
          {
            eventType: 'PUSH_OPENED',
            appType: appTypeRaw === 'staff' ? 'STAFF' : 'STUDENT',
            appVersion: Constants.expoConfig?.version ?? '1.0.0',
            metadata: { link: link ?? null },
          },
        ],
      }),
    });
  } catch {
    // optional
  }
}

export function navigateFromPushLink(link?: string | null) {
  const href = resolveMobileDeepLink(link);
  if (href) {
    router.push(href as never);
    return;
  }
  void getStoredAppType().then((appType) => {
    router.push(fallbackNotificationCenter(appType === 'staff' ? 'staff' : 'student') as never);
  });
}

let responseSub: Notifications.Subscription | null = null;

export function attachPushResponseListener() {
  if (responseSub) return;
  responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
    const link = extractLinkFromNotification(response.notification.request.content);
    void trackPushOpened(link);
    navigateFromPushLink(link);
  });
}

export function detachPushResponseListener() {
  responseSub?.remove();
  responseSub = null;
}
