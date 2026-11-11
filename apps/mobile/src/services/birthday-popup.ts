import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '@/api/client';
import { getAccessToken } from '@/auth/session';

export type BirthdayPopupStatus = {
  isBirthday: boolean;
  shouldDisplay: boolean;
  birthdayDate: string | null;
  studentName: string;
  profilePhoto: string | null;
  message: string;
  collegeName: string;
  dismissed: boolean;
};

type LocalAck = {
  userId: string;
  birthdayDate: string;
  shown: boolean;
  dismissed: boolean;
  pending: 'shown' | 'dismissed' | null;
};

const STORE_KEY = 'oc_birthday_popup';

function istDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

function userIdFromToken(token: string | null) {
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    if (!payload || typeof globalThis.atob !== 'function') return null;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const normalized = padded + '='.repeat((4 - (padded.length % 4)) % 4);
    const json = JSON.parse(globalThis.atob(normalized)) as { sub?: unknown };
    return typeof json.sub === 'string' ? json.sub : null;
  } catch {
    return null;
  }
}

async function readLocal(): Promise<LocalAck | null> {
  try {
    const raw = await SecureStore.getItemAsync(STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LocalAck;
  } catch {
    return null;
  }
}

async function writeLocal(ack: LocalAck) {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(ack));
}

async function syncPending(
  ack: LocalAck | null,
  userId: string | null,
  birthdayDate: string | null,
) {
  if (!ack?.pending || !userId || ack.userId !== userId) return;
  if (birthdayDate && ack.birthdayDate !== birthdayDate) return;
  const path =
    ack.pending === 'dismissed'
      ? '/v1/students/me/birthday-popup/dismiss'
      : '/v1/students/me/birthday-popup/shown';
  await apiFetch(path, { method: 'POST' });
  await writeLocal({ ...ack, pending: null });
}

export async function loadBirthdayPopup(): Promise<BirthdayPopupStatus | null> {
  const userId = userIdFromToken(await getAccessToken());
  const local = await readLocal();
  const today = istDateKey();
  try {
    const status = await apiFetch<BirthdayPopupStatus>('/v1/students/me/birthday-popup');
    const sameDay =
      local && userId && local.userId === userId && local.birthdayDate === status.birthdayDate;
    if (sameDay && local.pending) {
      void syncPending(local, userId, status.birthdayDate).catch(() => undefined);
    }
    const hiddenLocally = Boolean(sameDay && (local?.dismissed || local?.shown));
    if (hiddenLocally && status.shouldDisplay && local?.dismissed) {
      void syncPending({ ...local!, pending: 'dismissed' }, userId, status.birthdayDate).catch(
        () => undefined,
      );
    }
    return {
      ...status,
      shouldDisplay: status.shouldDisplay && !hiddenLocally,
      dismissed: status.dismissed || Boolean(sameDay && local?.dismissed),
    };
  } catch {
    if (
      local &&
      userId &&
      local.userId === userId &&
      local.birthdayDate === today &&
      (local.dismissed || local.shown)
    ) {
      return {
        isBirthday: true,
        shouldDisplay: false,
        birthdayDate: today,
        studentName: '',
        profilePhoto: null,
        message: '',
        collegeName: '',
        dismissed: local.dismissed,
      };
    }
    return null;
  }
}

export async function rememberBirthdayPopup(kind: 'shown' | 'dismissed', birthdayDate: string) {
  const userId = userIdFromToken(await getAccessToken()) ?? 'session';
  const current = await readLocal();
  const same = current?.userId === userId && current.birthdayDate === birthdayDate ? current : null;
  const next: LocalAck = {
    userId,
    birthdayDate,
    shown: true,
    dismissed: kind === 'dismissed' || Boolean(same?.dismissed),
    pending: kind,
  };
  await writeLocal(next);
  try {
    await syncPending(next, userId === 'session' ? null : userId, birthdayDate);
  } catch {
    // Kept locally. The next status check sends it again.
  }
}

export function currentIstDateKey() {
  return istDateKey();
}
