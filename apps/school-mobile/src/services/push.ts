import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { apiFetch } from '@/api/client';
import { APP_VERSION } from '@/api/config';
import { getDeviceId } from '@/auth/device';

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
} catch {
  /* native notifications optional until Firebase is configured */
}

const ANDROID_CHANNELS: Array<{
  id: string;
  name: string;
  importance: Notifications.AndroidImportance;
}> = [
  {
    id: 'stlukes_school_default',
    name: 'General',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  { id: 'stlukes_general', name: 'General', importance: Notifications.AndroidImportance.DEFAULT },
  {
    id: 'stlukes_announcements',
    name: 'Announcements',
    importance: Notifications.AndroidImportance.DEFAULT,
  },
  { id: 'stlukes_fees', name: 'Fees', importance: Notifications.AndroidImportance.HIGH },
  {
    id: 'stlukes_attendance',
    name: 'Attendance',
    importance: Notifications.AndroidImportance.HIGH,
  },
  {
    id: 'stlukes_examination',
    name: 'Examination',
    importance: Notifications.AndroidImportance.HIGH,
  },
  { id: 'stlukes_transport', name: 'Transport', importance: Notifications.AndroidImportance.HIGH },
  { id: 'stlukes_emergency', name: 'Emergency', importance: Notifications.AndroidImportance.MAX },
];

async function registerDevice(extra?: Record<string, unknown>) {
  await apiFetch('/v1/school-mobile/devices/register', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: await getDeviceId(),
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      appVersion: APP_VERSION,
      deviceModel: Device.modelName ?? undefined,
      manufacturer: Device.manufacturer ?? undefined,
      deviceName: Device.deviceName ?? undefined,
      osVersion: Device.osVersion ?? undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      ...extra,
    }),
  });
}

async function savePushToken(token: string) {
  await registerDevice({
    pushToken: token,
    deviceLabel: `${Device.modelName || Platform.OS} ${APP_VERSION}`,
  });
}

export async function registerSchoolPush() {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      await registerDevice();
      return;
    }
    if (Platform.OS === 'android') {
      for (const channel of ANDROID_CHANNELS) {
        await Notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name,
          importance: channel.importance,
          vibrationPattern: [0, 250, 250, 250],
          sound: 'default',
        });
      }
    }
    try {
      const token = await Notifications.getDevicePushTokenAsync();
      if (token?.data) await savePushToken(String(token.data));
      else await registerDevice({ deviceLabel: `${Platform.OS} ${APP_VERSION}` });
    } catch {
      await registerDevice({ deviceLabel: `${Platform.OS} ${APP_VERSION}` });
    }
    Notifications.addPushTokenListener((token) => {
      void savePushToken(String(token.data)).catch(() => undefined);
    });
  } catch {
    try {
      await registerDevice();
    } catch {
      /* login still succeeds without push */
    }
  }
}

export { notificationPath } from '@/services/notification-path';

export async function markNotificationOpened(notificationId?: string | null) {
  if (!notificationId || notificationId === 'test') return;
  try {
    await apiFetch(`/v1/school-sis/notifications/${notificationId}/opened`, { method: 'POST' });
  } catch {
    /* inbox read is enough if campaign tracking is unavailable */
  }
}

export async function pingDeviceHeartbeat() {
  try {
    await apiFetch('/v1/school-mobile/devices/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ deviceId: await getDeviceId() }),
    });
  } catch {
    /* last-seen updates when the app next authenticates */
  }
}
