'use client';

const THROTTLE_MS = 1000;

let lastActivityAt = Date.now();
let lastThrottleAt = 0;
const activityListeners = new Set<() => void>();

export function getLastActivityAt(): number {
  return lastActivityAt;
}

export function pingActivity(): void {
  const now = Date.now();
  if (now - lastThrottleAt < THROTTLE_MS) return;
  lastThrottleAt = now;
  lastActivityAt = now;
  for (const listener of activityListeners) {
    listener();
  }
}

export function subscribeActivity(listener: () => void): () => void {
  activityListeners.add(listener);
  return () => activityListeners.delete(listener);
}

export function isUserActivelyTyping(): boolean {
  if (typeof document === 'undefined') return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  if (el.getAttribute('contenteditable') === 'true') return true;
  return false;
}

export function attachGlobalActivityListeners(): () => void {
  if (typeof window === 'undefined') return () => undefined;

  const onActivity = () => pingActivity();
  const events: (keyof WindowEventMap)[] = [
    'mousedown',
    'keydown',
    'scroll',
    'touchstart',
    'click',
  ];

  for (const event of events) {
    window.addEventListener(event, onActivity, { passive: true });
  }

  return () => {
    for (const event of events) {
      window.removeEventListener(event, onActivity);
    }
  };
}
