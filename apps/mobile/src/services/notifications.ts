import { apiFetch } from '@/api/client';
import type { UserNotification } from '@/types/notifications';

const base = '/v1/communication';

export function fetchNotifications(limit = 40) {
  return apiFetch<UserNotification[]>(`${base}/notifications?limit=${limit}`);
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
