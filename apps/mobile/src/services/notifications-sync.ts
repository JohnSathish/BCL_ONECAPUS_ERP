type NotificationsInvalidatedPayload = {
  reason?: string;
  source?: 'push-received' | 'push-tap' | 'manual';
};

export type PendingNotificationOpen = {
  notificationId?: string;
  campaignId?: string;
};

type Listener = (payload?: NotificationsInvalidatedPayload) => void;

const listeners = new Set<Listener>();
let pendingOpen: PendingNotificationOpen | null = null;

/** Subscribe to push / inbox invalidation so the Notifications list can refetch. */
export function onNotificationsInvalidated(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitNotificationsInvalidated(payload?: NotificationsInvalidatedPayload) {
  for (const listener of [...listeners]) {
    try {
      listener(payload);
    } catch (err) {
      console.warn('[notifications-sync] listener failed', err);
    }
  }
}

/** Remember which inbox row to open after a push tap (cold / background / foreground). */
export function setPendingNotificationOpen(next: PendingNotificationOpen | null) {
  pendingOpen = next;
}

export function consumePendingNotificationOpen(): PendingNotificationOpen | null {
  const next = pendingOpen;
  pendingOpen = null;
  return next;
}
