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
    await Notifications.setNotificationChannelAsync('stlukes_school_default', {
      name: "St. Luke's School",
      importance: Notifications.AndroidImportance.HIGH,
    });
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
}

export function notificationPath(data?: Record<string, unknown> | null) {
  const link = String(data?.deepLink || data?.path || '').trim();
  if (link.startsWith('/')) return link;
  const type = String(data?.type || '');
  const related = String(data?.relatedId || '');
  if (type === 'notice' && related) return `/notice/${related}`;
  if (type === 'event' && related) return `/event/${related}`;
  if (type === 'gallery' && related) return `/gallery/${related}`;
  if (type === 'fee') return '/fees';
  return '/inbox';
}
