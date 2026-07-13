import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Alert, Linking, Platform } from 'react-native';
import { router } from 'expo-router';
import { apiFetch } from '@/api/client';
import { getDeviceId } from '@/auth/device';
import { getAccessToken, getStoredAppType } from '@/auth/session';
import {
  resolveMobileDeepLink,
  fallbackNotificationCenter,
} from '@/services/notification-deep-link';
import { getNotificationAttachments } from '@/utils/notification-attachments';

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (err) {
  console.warn('[push] setNotificationHandler failed', err);
}

function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

function isExpoPushToken(token: string) {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[');
}

export async function ensureAndroidDefaultChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('onecampus_default', {
    name: 'Campus Portal',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#020f2e',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
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

/**
 * Returns a native FCM/APNs device token suitable for Nest FCM HTTP v1.
 * Expo tokens are rejected — the API cannot deliver those via FCM.
 */
export async function getNativePushToken(): Promise<string | null> {
  const allowed = await requestPushPermissions();
  if (!allowed) {
    console.warn('[push] Notification permission not granted');
    return null;
  }

  // Retry briefly — FCM token can be late right after install / first open.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const deviceToken = await Notifications.getDevicePushTokenAsync();
      const raw = deviceToken?.data != null ? String(deviceToken.data).trim() : '';
      if (raw && !isExpoPushToken(raw)) {
        return raw;
      }
      if (raw && isExpoPushToken(raw)) {
        console.warn(
          '[push] Got Expo token; need a release build with google-services.json for FCM',
        );
        return null;
      }
    } catch (err) {
      console.warn('[push] getDevicePushTokenAsync failed', err);
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }

  // Last resort: Expo token is useless for our FCM sender — do not register it.
  try {
    const projectId = easProjectId();
    await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  } catch {
    // ignore — only used to surface config issues in logs
  }
  return null;
}

/** @deprecated Prefer getNativePushToken */
export async function getExpoPushToken(): Promise<string | null> {
  return getNativePushToken();
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
  const pushToken = await getNativePushToken();
  await apiFetch('/v1/mobile-app/devices/register', {
    method: 'POST',
    body: JSON.stringify({
      deviceId,
      appType,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      // Only send when present so we never wipe a good token with undefined→null quirks.
      ...(pushToken ? { pushToken } : {}),
      ...meta,
    }),
  });
  if (!pushToken) {
    console.warn(
      '[push] Device registered without FCM token — enable notifications and ensure google-services.json is in the APK',
    );
  }
  return { deviceId, pushToken };
}

export async function refreshPushRegistrationIfLoggedIn() {
  const token = await getAccessToken();
  if (!token) return;
  const appTypeRaw = await getStoredAppType();
  const appType = appTypeRaw === 'staff' ? 'STAFF' : 'STUDENT';
  try {
    await registerDeviceWithPush(appType);
  } catch (err) {
    console.warn('[push] refresh registration failed', err);
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

export function extractAttachmentUrls(content: Notifications.NotificationContent): {
  imageUrl?: string;
  pdfUrl?: string;
  fileUrl?: string;
  fileName?: string;
} {
  const data = (content.data ?? {}) as Record<string, unknown>;
  let attachmentsMeta: Record<string, unknown> = {
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl : data.image,
    pdfUrl: typeof data.pdfUrl === 'string' ? data.pdfUrl : data.pdf,
    fileUrl: typeof data.fileUrl === 'string' ? data.fileUrl : undefined,
    fileName: typeof data.fileName === 'string' ? data.fileName : undefined,
  };
  if (typeof data.attachments === 'string' && data.attachments.trim()) {
    try {
      const parsed = JSON.parse(data.attachments) as unknown;
      if (Array.isArray(parsed)) {
        attachmentsMeta = { ...attachmentsMeta, attachments: parsed };
      }
    } catch {
      // ignore malformed payload
    }
  } else if (Array.isArray(data.attachments)) {
    attachmentsMeta = { ...attachmentsMeta, attachments: data.attachments };
  }

  const all = getNotificationAttachments({ metadata: attachmentsMeta });
  return {
    imageUrl: all.find((a) => a.type === 'image')?.url,
    pdfUrl: all.find((a) => a.type === 'pdf')?.url,
    fileUrl: all.find((a) => a.type === 'file')?.url,
    fileName: all.find((a) => a.type === 'file')?.name,
  };
}

export async function openNotificationAttachment(url?: string | null, label = 'Attachment') {
  if (!url?.trim()) return false;
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert(label, 'Unable to open this attachment on the device.');
      return false;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert(label, 'Unable to open this attachment.');
    return false;
  }
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
  // No link on the push → open the inbox so the user can read it.
  void getStoredAppType().then((appType) => {
    router.push(fallbackNotificationCenter(appType === 'staff' ? 'staff' : 'student') as never);
  });
}

function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const content = response.notification.request.content;
  const link = extractLinkFromNotification(content);
  const { imageUrl, pdfUrl, fileUrl, fileName } = extractAttachmentUrls(content);
  void trackPushOpened(link);

  // Prefer opening attached media when present (PDF / file / image).
  if (pdfUrl) {
    void openNotificationAttachment(pdfUrl, 'PDF attachment').then((opened) => {
      if (!opened) navigateFromPushLink(link);
    });
    return;
  }
  if (fileUrl) {
    void openNotificationAttachment(fileUrl, fileName ?? 'File attachment').then((opened) => {
      if (!opened) navigateFromPushLink(link);
    });
    return;
  }
  if (imageUrl && !link) {
    void openNotificationAttachment(imageUrl, 'Image attachment').then((opened) => {
      if (!opened) navigateFromPushLink(link);
    });
    return;
  }
  navigateFromPushLink(link);
}

/**
 * Clear a stale "last notification response" so cold starts do not keep
 * replaying the previous push navigation into Alerts.
 */
export async function clearStalePushResponse() {
  try {
    await Notifications.clearLastNotificationResponseAsync();
  } catch {
    // ignore if native module unavailable
  }
}

/**
 * Handle a notification that launched the app from a killed state, then clear it.
 */
export async function consumeInitialPushResponse() {
  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    if (last) {
      handleNotificationResponse(last);
      await clearStalePushResponse();
    }
  } catch {
    // ignore
  }
}

let responseSub: Notifications.Subscription | null = null;
let receivedSub: Notifications.Subscription | null = null;

export function attachPushResponseListener() {
  if (!responseSub) {
    responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponse(response);
    });
  }
  // Keep foreground arrivals visible in the system shade / banners.
  if (!receivedSub) {
    receivedSub = Notifications.addNotificationReceivedListener(() => {
      // Handler above already shows alert/banner/list; listener kept for future analytics.
    });
  }
}

export function detachPushResponseListener() {
  responseSub?.remove();
  responseSub = null;
  receivedSub?.remove();
  receivedSub = null;
}
