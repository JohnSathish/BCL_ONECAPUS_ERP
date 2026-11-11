import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import * as SecureStore from 'expo-secure-store';
import { Alert, AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import { router } from 'expo-router';
import { apiFetch } from '@/api/client';
import { getDeviceId } from '@/auth/device';
import { getSchoolConfig } from '@/auth/school-config';
import { isSchoolSisConfig } from '@/auth/school-product';
import { getAccessToken, getStoredAppType, getUserSnapshot } from '@/auth/session';
import { APP_VERSION } from '@/constants/release';
import {
  resolveMobileDeepLink,
  fallbackNotificationCenter,
} from '@/services/notification-deep-link';
import {
  emitNotificationsInvalidated,
  setPendingNotificationOpen,
} from '@/services/notifications-sync';
import { getNotificationAttachments } from '@/utils/notification-attachments';
import { startAppUpdate } from '@/services/app-update';

try {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = (notification.request.content.data ?? {}) as Record<string, unknown>;
      const echo = data.trayEcho === '1';
      // Android does not post a shade notification for a remote message while the
      // app is open. The received listener posts one local copy instead.
      const show = echo || Platform.OS !== 'android';
      return {
        shouldShowAlert: show,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: show,
        shouldShowList: show,
      };
    },
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

/** Expo on iOS returns the APNs device token as 64 hex characters. */
function isApnsDeviceToken(token: string) {
  return /^[0-9a-f]{64}$/i.test(token);
}

function alertsAllowed(settings: Notifications.NotificationPermissionsStatus) {
  if (settings.status === 'granted') return true;
  return settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function ensureAndroidDefaultChannel() {
  if (Platform.OS !== 'android') return;
  // Android keeps the first importance forever. Recreate the channel so a
  // low-importance channel cannot swallow later college notices.
  await Notifications.deleteNotificationChannelAsync('onecampus_default').catch(() => undefined);
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

const SETTINGS_HINT_KEY = 'push.notification.settingsHintVersion';
/**
 * Ask only after the activity is resumed and the native splash window is gone.
 * Asking on the first tick makes Android 13+ and iOS drop the dialog and treat
 * the request as finished, so a fresh install or an update never shows it.
 */
const PERMISSION_PROMPT_DELAY_MS = 800;

let permissionRequest: Promise<boolean> | null = null;
let promptedThisSession = false;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilAppIsActive() {
  if (AppState.currentState === 'active') return;
  await new Promise<void>((resolve) => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      sub.remove();
      resolve();
    });
  });
}

async function waitForPermissionHost() {
  await waitUntilAppIsActive();
  await delay(PERMISSION_PROMPT_DELAY_MS);
}

function androidPackageName() {
  return Constants.expoConfig?.android?.package ?? 'edu.onecampus.mobile';
}

async function openNotificationSettings() {
  if (Platform.OS === 'android') {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS,
        {
          data: `package:${androidPackageName()}`,
          extra: {
            'android.provider.extra.APP_PACKAGE': androidPackageName(),
          },
        },
      );
      return;
    } catch (err) {
      console.warn('[push] notification settings intent failed', err);
    }
  }
  await Linking.openSettings().catch(() => undefined);
}

/** One explanation per installed version when the OS will not show its own dialog. */
async function offerNotificationSettingsOnce() {
  try {
    const seen = await SecureStore.getItemAsync(SETTINGS_HINT_KEY);
    if (seen === APP_VERSION) return;
    await SecureStore.setItemAsync(SETTINGS_HINT_KEY, APP_VERSION);
  } catch (err) {
    console.warn('[push] could not remember settings hint', err);
    return;
  }
  Alert.alert(
    'Allow notifications',
    'Turn on notifications so college notices, reminders, and messages reach this phone.',
    [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void openNotificationSettings() },
    ],
  );
}

async function readNotificationPermission() {
  try {
    return await Notifications.getPermissionsAsync();
  } catch (err) {
    console.warn('[push] getPermissionsAsync failed', err);
    return null;
  }
}

async function requestAndroidNotificationPermission(): Promise<boolean> {
  if (Number(Platform.Version) < 33) {
    const current = await readNotificationPermission();
    if (current && alertsAllowed(current)) return true;
    promptedThisSession = true;
    await offerNotificationSettingsOnce();
    return false;
  }

  if (promptedThisSession) {
    const current = await readNotificationPermission();
    return Boolean(current && alertsAllowed(current));
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      promptedThisSession = true;
      if (result === PermissionsAndroid.RESULTS.GRANTED) return true;
      if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        await offerNotificationSettingsOnce();
      }
      return false;
    } catch (err) {
      console.warn('[push] Android notification permission request failed', err);
      await waitUntilAppIsActive();
      await delay(700);
    }
  }
  return false;
}

async function requestIosNotificationPermission(): Promise<boolean> {
  if (promptedThisSession) {
    const current = await readNotificationPermission();
    return Boolean(current && alertsAllowed(current));
  }

  const current = await readNotificationPermission();
  if (current && alertsAllowed(current)) return true;
  if (current && current.status !== 'undetermined' && current.canAskAgain === false) {
    promptedThisSession = true;
    await offerNotificationSettingsOnce();
    return false;
  }

  const asked = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });
  promptedThisSession = true;
  return alertsAllowed(asked);
}

async function requestPushPermissionsOnce(): Promise<boolean> {
  if (!Device.isDevice && Platform.OS === 'ios') {
    return false;
  }

  const current = await readNotificationPermission();
  if (current && alertsAllowed(current)) return true;
  if (promptedThisSession) return false;

  await waitForPermissionHost();
  await ensureAndroidDefaultChannel();

  const ready = await readNotificationPermission();
  if (ready && alertsAllowed(ready)) return true;

  if (Platform.OS === 'android') {
    return requestAndroidNotificationPermission();
  }
  return requestIosNotificationPermission();
}

/**
 * Shows the system notification dialog once the activity is in the foreground.
 * A later call in the same session only re-reads the grant, so opening Settings
 * and coming back can still register the device.
 */
export function requestPushPermissions(): Promise<boolean> {
  if (!permissionRequest) {
    permissionRequest = requestPushPermissionsOnce()
      .catch((err) => {
        console.warn('[push] permission request failed', err);
        return false;
      })
      .finally(() => {
        permissionRequest = null;
      });
  }
  return permissionRequest;
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
      // iOS returns the APNs device token. Android returns an FCM registration
      // token. The college API exchanges the APNs token before it talks to FCM.
      if (raw && isApnsDeviceToken(raw)) {
        return raw;
      }
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
  const school = await getSchoolConfig();
  let pushToken = await getNativePushToken();
  // School apps keep their own push path. A raw APNs token is for the college app.
  if (isSchoolSisConfig(school) && pushToken && isApnsDeviceToken(pushToken)) {
    pushToken = null;
  }
  const path = isSchoolSisConfig(school)
    ? '/v1/school-mobile/devices/register'
    : '/v1/mobile-app/devices/register';
  await apiFetch(path, {
    method: 'POST',
    body: JSON.stringify({
      deviceId,
      ...(isSchoolSisConfig(school) ? {} : { appType }),
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      ...(pushToken ? { pushToken } : {}),
      ...meta,
    }),
  });
  if (!pushToken) {
    console.warn(
      Platform.OS === 'ios'
        ? '[push] iPhone registered without an Apple push token — allow notifications for this app'
        : '[push] Device registered without an FCM token — allow notifications and ship google-services.json in the Android build',
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
  const mobilePath = data.mobilePath;
  if (typeof mobilePath === 'string' && mobilePath.trim()) return mobilePath.trim();
  const link = data.link ?? data.url ?? data.path;
  if (typeof link === 'string' && link.trim()) return link.trim();
  const type = typeof data.type === 'string' ? data.type.toUpperCase() : '';
  const messageId = typeof data.messageId === 'string' ? data.messageId.trim() : '';
  if (type === 'PRINCIPAL_MAIL' && messageId) {
    return `/(principal)/mail/${messageId}`;
  }
  return undefined;
}

function extractOpenTargets(content: Notifications.NotificationContent): {
  notificationId?: string;
  campaignId?: string;
} {
  const data = (content.data ?? {}) as Record<string, unknown>;
  const notificationId =
    typeof data.notificationId === 'string'
      ? data.notificationId.trim()
      : typeof data.inboxId === 'string'
        ? data.inboxId.trim()
        : undefined;
  const campaignId = typeof data.campaignId === 'string' ? data.campaignId.trim() : undefined;
  return {
    notificationId: notificationId || undefined,
    campaignId: campaignId || undefined,
  };
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

let inboxRefreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleInboxRefresh(source: 'push-received' | 'push-tap') {
  if (inboxRefreshTimer) clearTimeout(inboxRefreshTimer);
  inboxRefreshTimer = setTimeout(() => {
    inboxRefreshTimer = null;
    emitNotificationsInvalidated({ source, reason: 'refresh' });
  }, 500);
}

export function navigateFromPushLink(
  link?: string | null,
  openTargets?: { notificationId?: string; campaignId?: string },
) {
  void (async () => {
    const [appType, snapshot] = await Promise.all([getStoredAppType(), getUserSnapshot()]);
    const isPrincipal = (snapshot?.permissions ?? []).includes('principal-mobile:access');

    if (openTargets?.notificationId || openTargets?.campaignId) {
      setPendingNotificationOpen({
        notificationId: openTargets.notificationId,
        campaignId: openTargets.campaignId,
      });
    }

    // Principal Command Center users share appType "staff" for device APIs, but must
    // never be routed into Faculty Workspace on push tap.
    if (isPrincipal) {
      scheduleInboxRefresh('push-tap');
      const href = resolveMobileDeepLink(link);
      if (href && String(href).startsWith('/(principal)')) {
        router.push(href as never);
        return;
      }
      // Raw expo path from push data.mobilePath
      if (link?.includes('/(principal)/mail/')) {
        router.push(link as never);
        return;
      }
      if (link?.includes('/(principal)/')) {
        router.push(link as never);
        return;
      }
      router.push('/(principal)/(tabs)/notifications' as never);
      return;
    }

    // Faculty / other staff: always open Notifications tab on push tap.
    if (appType === 'staff') {
      router.push('/(staff)/(tabs)/notifications' as never);
      scheduleInboxRefresh('push-tap');
      return;
    }

    // Students: always open Notifications inbox on push tap (never Home),
    // even when the payload link is a generic /student home path.
    scheduleInboxRefresh('push-tap');
    router.push(fallbackNotificationCenter('student') as never);
  })();
}

function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const content = response.notification.request.content;
  const data = (content.data ?? {}) as Record<string, unknown>;
  if (String(data.type ?? '').toUpperCase() === 'APP_UPDATE') {
    void trackPushOpened('app-update');
    void startAppUpdate({
      required: false,
      storeUrl: typeof data.storeUrl === 'string' ? data.storeUrl : null,
    });
    return;
  }
  const link = extractLinkFromNotification(content);
  const openTargets = extractOpenTargets(content);
  void trackPushOpened(link);

  // Always land on the Notifications menu first so the tapped item is visible.
  // Attachments remain available from the inbox detail modal.
  navigateFromPushLink(link, openTargets);
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
 * Ignores stale responses so a previous tap does not reopen Notifications on every cold start.
 * @returns true if navigation was triggered from a fresh push tap
 */
const INITIAL_PUSH_MAX_AGE_MS = 60_000;

export async function consumeInitialPushResponse(): Promise<boolean> {
  try {
    const last = await Notifications.getLastNotificationResponseAsync();
    if (!last) return false;

    const rawDate = last.notification.date;
    const whenMs =
      typeof rawDate === 'number' ? (rawDate < 1e12 ? rawDate * 1000 : rawDate) : Date.now();

    if (Date.now() - whenMs > INITIAL_PUSH_MAX_AGE_MS) {
      await clearStalePushResponse();
      return false;
    }

    handleNotificationResponse(last);
    await clearStalePushResponse();
    return true;
  } catch {
    return false;
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
  // Foreground arrivals: refresh in-app Notifications inbox (student + staff).
  if (!receivedSub) {
    receivedSub = Notifications.addNotificationReceivedListener((event) => {
      const content = event.request.content;
      const data = (content.data ?? {}) as Record<string, unknown>;
      if (data.trayEcho === '1') return;
      scheduleInboxRefresh('push-received');
      if (Platform.OS === 'android' && AppState.currentState === 'active') {
        void Notifications.scheduleNotificationAsync({
          content: {
            title: content.title || 'Don Bosco College',
            body: content.body || 'New campus notice',
            sound: 'default',
            data: { ...data, trayEcho: '1' },
          },
          trigger: null,
        });
      }
    });
  }
}

export function detachPushResponseListener() {
  responseSub?.remove();
  responseSub = null;
  receivedSub?.remove();
  receivedSub = null;
}
