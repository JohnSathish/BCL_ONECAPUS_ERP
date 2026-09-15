import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { apiFetch } from '@/api/client';
import { APP_VERSION } from '@/api/config';
import { getDeviceId } from '@/auth/device';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

export async function registerSchoolPush() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    await apiFetch('/v1/school-mobile/devices/register', {
      method: 'POST',
      body: JSON.stringify({
        deviceId: await getDeviceId(),
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        appVersion: APP_VERSION,
      }),
    });
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
  const token = await Notifications.getDevicePushTokenAsync();
  await apiFetch('/v1/school-mobile/devices/register', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: await getDeviceId(),
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      appVersion: APP_VERSION,
      pushToken: token.data,
      deviceLabel: `${Platform.OS} ${APP_VERSION}`,
    }),
  });
  Notifications.addPushTokenListener((next) => {
    void apiFetch('/v1/school-sis/notifications/devices/register', {
      method: 'POST',
      body: JSON.stringify({
        token: next.data,
        platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
        appVersion: APP_VERSION,
        deviceId: `push:${next.data.slice(-24)}`,
      }),
    });
  });
}

export function notificationPath(data?: Record<string, unknown> | null) {
  const link = String(data?.deepLink || data?.path || '').trim();
  if (link.startsWith('/')) return link;
  if (link.startsWith('notification://')) {
    const rest = link.replace('notification://', '').split('/')[0]?.toLowerCase();
    if (rest === 'fees') return '/fees';
    if (rest === 'attendance') return '/attendance';
    if (rest === 'homework') return '/homework';
    if (rest === 'holiday' || rest === 'academic_calendar') return '/calendar';
    if (rest === 'notices') return '/(tabs)/notices';
    if (rest === 'event') return '/(tabs)/events';
    if (rest === 'dashboard') return '/(tabs)';
    return '/inbox';
  }
  const type = String(data?.type || '').toLowerCase();
  const related = String(data?.relatedId || '');
  if (type === 'notice' && related) return `/notice/${related}`;
  if (type === 'event' && related) return `/event/${related}`;
  if (type === 'gallery' && related) return `/gallery/${related}`;
  if (type === 'fee' || type === 'fees') return '/fees';
  if (type === 'attendance') return '/attendance';
  return '/inbox';
}

export async function markNotificationOpened(notificationId?: string | null) {
  if (!notificationId) return;
  try {
    await apiFetch(`/v1/school-sis/notifications/${notificationId}/opened`, { method: 'POST' });
  } catch {
    /* inbox read is enough if campaign tracking is unavailable */
  }
}
