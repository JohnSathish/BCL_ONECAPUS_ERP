import { apiFetch } from '@/api/client';
import type { UserNotification } from '@/types/notifications';

const base = '/v1/communication';

export type NotificationFilter = 'all' | 'unread' | 'archived';

export type NotificationPreference = {
  id: string;
  channel: string;
  enabled: boolean;
  settings: Record<string, unknown>;
};

export function fetchNotifications(limit = 40, filter?: NotificationFilter) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (filter) qs.set('filter', filter);
  return apiFetch<UserNotification[]>(`${base}/notifications?${qs.toString()}`);
}

export function fetchUnreadCount() {
  return apiFetch<{ count: number }>(`${base}/notifications/unread-count`);
}

export function markNotificationRead(id: string) {
  return apiFetch(`${base}/notifications/${id}/read`, { method: 'POST' });
}

export function markAllNotificationsRead() {
  return apiFetch(`${base}/notifications/read-all`, { method: 'POST' });
}

export function archiveNotification(id: string) {
  return apiFetch(`${base}/notifications/${id}/archive`, { method: 'POST' });
}

export function dismissNotification(id: string) {
  return apiFetch(`${base}/notifications/${id}/dismiss`, { method: 'POST' });
}

export function fetchNotificationPreferences() {
  return apiFetch<NotificationPreference[]>(`${base}/notifications/preferences`);
}

export function upsertNotificationPreference(input: {
  channel: string;
  enabled: boolean;
  settings?: Record<string, unknown>;
}) {
  return apiFetch<NotificationPreference>(`${base}/notifications/preferences`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
