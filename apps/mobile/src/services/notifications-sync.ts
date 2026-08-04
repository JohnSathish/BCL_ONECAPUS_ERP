type NotificationsInvalidatedPayload = {
  reason?: string;
  source?: 'push-received' | 'push-tap' | 'manual';
};

type Listener = (payload?: NotificationsInvalidatedPayload) => void;

const listeners = new Set<Listener>();

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
