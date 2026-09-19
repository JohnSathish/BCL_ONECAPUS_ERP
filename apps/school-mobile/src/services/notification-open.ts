import { secureGet, secureSet } from '@/auth/secure-storage';
import {
  HOME_PATH,
  MESSAGES_PATH,
  notificationPath,
  resolveAppHref,
} from '@/services/notification-path';

export { HOME_PATH, MESSAGES_PATH };

const CONSUMED_KEY = 'sls_consumed_notif_response';

type NotificationResponseLike = {
  actionIdentifier?: string;
  notification: {
    date?: number | Date;
    request: {
      identifier: string;
      content: { data?: Record<string, unknown> };
    };
  };
};

let queued: string | null = null;
const consumedThisProcess = new Set<string>();
const inflight = new Map<string, Promise<string | null>>();
let openedFromNotificationAt = 0;

export function queueNotificationDestination(href: string) {
  queued = href || MESSAGES_PATH;
}

export function takeNotificationDestination() {
  const href = queued;
  queued = null;
  return href;
}

export function discardNotificationDestination() {
  queued = null;
}

export function wasOpenedFromNotificationRecently(ms = 8_000) {
  return openedFromNotificationAt > 0 && Date.now() - openedFromNotificationAt < ms;
}

export function replaceWithNotificationOr(
  router: { replace: (href: never) => void },
  fallback: string = HOME_PATH,
) {
  router.replace(resolveAppHref(takeNotificationDestination(), fallback) as never);
}

function fingerprint(response: NotificationResponseLike) {
  const date = response.notification.date;
  const when = date instanceof Date ? date.getTime() : Number(date || 0);
  return `${response.notification.request.identifier}:${when}:${response.actionIdentifier ?? ''}`;
}

async function persistConsumed(fp: string) {
  try {
    await secureSet(CONSUMED_KEY, fp);
  } catch {
    /* in-memory set is enough for this process */
  }
}

async function persistedFingerprint() {
  try {
    return (await secureGet(CONSUMED_KEY)) ?? '';
  } catch {
    return '';
  }
}

async function clearNativeLastResponse(Notifications: {
  clearLastNotificationResponseAsync?: () => Promise<void>;
}) {
  try {
    await Notifications.clearLastNotificationResponseAsync?.();
  } catch {
    /* older native builds omit this API */
  }
}

/**
 * Accept a notification tap once. Returns the destination, or null when this
 * response was already used (icon launch replaying the last tap).
 */
export function consumeNotificationResponse(
  response: NotificationResponseLike,
): Promise<string | null> {
  const fp = fingerprint(response);
  const pending = inflight.get(fp);
  if (pending) return pending.then(() => null);
  if (consumedThisProcess.has(fp)) return Promise.resolve(null);

  const work = (async () => {
    if ((await persistedFingerprint()) === fp) {
      consumedThisProcess.add(fp);
      return null;
    }
    consumedThisProcess.add(fp);
    openedFromNotificationAt = Date.now();
    const dest = notificationPath(response.notification.request.content.data);
    queueNotificationDestination(dest);
    await persistConsumed(fp);
    return dest;
  })();
  inflight.set(fp, work);
  return work;
}

export async function captureLaunchNotification() {
  try {
    const Notifications = await import('expo-notifications');
    const last = await Notifications.getLastNotificationResponseAsync();
    if (!last) {
      discardNotificationDestination();
      return;
    }
    const fp = fingerprint(last);
    if (consumedThisProcess.has(fp)) {
      await clearNativeLastResponse(Notifications);
      return;
    }
    if ((await persistedFingerprint()) === fp) {
      consumedThisProcess.add(fp);
      discardNotificationDestination();
      await clearNativeLastResponse(Notifications);
      return;
    }
    await consumeNotificationResponse(last);
    await clearNativeLastResponse(Notifications);
  } catch {
    /* native notifications optional until Firebase is in the APK */
  }
}
