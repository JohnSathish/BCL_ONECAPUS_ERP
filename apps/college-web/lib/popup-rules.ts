export type PublicPopup = {
  id: string;
  title: string;
  popupType: string;
  contentHtml: string;
  contentJson: Record<string, unknown>;
  imageJson: { url: string; alt?: string; caption?: string } | null;
  videoUrl?: string | null;
  videoType?: string | null;
  buttonJson: Array<{
    label: string;
    href: string;
    variant?: string;
    openInNewTab?: boolean;
  }>;
  displayOrder: number;
  showTrigger: string;
  showDelay: number;
  scrollPercent?: number | null;
  frequency: string;
  closeBehavior: string[];
  autoCloseSeconds?: number | null;
  position: string;
  animation: string;
  overlayJson: Record<string, unknown>;
  sizeJson: Record<string, unknown>;
};

const STORAGE_PREFIX = 'dbc_popup_';

function safeStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1);
  start.setDate(diff);
  return start.toISOString().slice(0, 10);
}

export function markPopupShown(popupId: string, frequency: string) {
  const storage = safeStorage();
  if (!storage) return;
  const now = Date.now();
  storage.setItem(`${STORAGE_PREFIX}shown:${popupId}`, String(now));
  if (frequency === 'ONCE_PER_DAY') {
    storage.setItem(`${STORAGE_PREFIX}day:${popupId}`, dayKey());
  }
  if (frequency === 'ONCE_PER_WEEK') {
    storage.setItem(`${STORAGE_PREFIX}week:${popupId}`, weekKey());
  }
  if (frequency === 'ONCE_PER_BROWSER') {
    storage.setItem(`${STORAGE_PREFIX}browser:${popupId}`, '1');
  }
}

export function markPopupNeverShow(popupId: string) {
  const storage = safeStorage();
  if (!storage) return;
  storage.setItem(`${STORAGE_PREFIX}never:${popupId}`, '1');
}

export function markPopupClosed(popupId: string) {
  const storage = safeStorage();
  if (!storage) return;
  storage.setItem(`${STORAGE_PREFIX}closed:${popupId}`, String(Date.now()));
}

export function shouldShowPopup(popup: PublicPopup) {
  const storage = safeStorage();
  if (!storage) return true;

  if (storage.getItem(`${STORAGE_PREFIX}never:${popup.id}`) === '1') return false;

  switch (popup.frequency) {
    case 'ONCE_PER_BROWSER':
      return storage.getItem(`${STORAGE_PREFIX}browser:${popup.id}`) !== '1';
    case 'ONCE_PER_DAY':
      return storage.getItem(`${STORAGE_PREFIX}day:${popup.id}`) !== dayKey();
    case 'ONCE_PER_WEEK':
      return storage.getItem(`${STORAGE_PREFIX}week:${popup.id}`) !== weekKey();
    case 'NEVER_SHOW_AGAIN':
      return storage.getItem(`${STORAGE_PREFIX}never:${popup.id}`) !== '1';
    default:
      return true;
  }
}

export function resolveShowDelayMs(popup: PublicPopup) {
  if (popup.showDelay > 0) return popup.showDelay * 1000;
  switch (popup.showTrigger) {
    case 'DELAY_5':
      return 5000;
    case 'DELAY_10':
      return 10000;
    default:
      return 0;
  }
}

export function resolveAutoCloseMs(popup: PublicPopup) {
  if (popup.autoCloseSeconds && popup.autoCloseSeconds > 0) {
    return popup.autoCloseSeconds * 1000;
  }
  for (const behavior of popup.closeBehavior ?? []) {
    const match = /^AUTO_CLOSE_(\d+)$/.exec(behavior);
    if (match) return Number(match[1]) * 1000;
  }
  return null;
}

export function onPopupClose(popup: PublicPopup) {
  markPopupClosed(popup.id);
  markPopupShown(popup.id, popup.frequency);
  if (popup.frequency === 'NEVER_SHOW_AGAIN') {
    markPopupNeverShow(popup.id);
  }
}
