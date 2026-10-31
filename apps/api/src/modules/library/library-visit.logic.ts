import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type VisitMemberFilter =
  | 'ALL'
  | 'STUDENT'
  | 'STAFF'
  | 'FACULTY'
  | 'NON_TEACHING'
  | 'VISITOR'
  | undefined;

export function memberTypeWhere(
  memberType?: string | null,
): Prisma.LibraryVisitWhereInput {
  if (!memberType || memberType === 'ALL') return {};
  if (memberType === 'STAFF')
    return { memberType: { in: ['STAFF', 'FACULTY'] } };
  if (memberType === 'NON_TEACHING') return { memberType: 'STAFF' };
  if (memberType === 'FACULTY') return { memberType: 'FACULTY' };
  if (memberType === 'STUDENT' || memberType === 'VISITOR')
    return { memberType };
  return {};
}

/** Open visits are closed automatically after this many minutes. */
export const AUTO_SIGNOUT_MINUTES = 60;

export function staleVisitSignOut(entryAt: Date, now = new Date()) {
  const elapsedMs = now.getTime() - entryAt.getTime();
  if (elapsedMs < AUTO_SIGNOUT_MINUTES * 60_000) return null;
  return {
    exitAt: new Date(entryAt.getTime() + AUTO_SIGNOUT_MINUTES * 60_000),
    durationMinutes: AUTO_SIGNOUT_MINUTES,
    exitMethod: 'AUTO' as const,
  };
}

export function visitRange(input: {
  period?: 'today' | 'week' | 'month' | 'custom';
  from?: string;
  to?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const startToday = startOfDay(now);
  const endToday = endOfDay(now);
  const period = input.period ?? (input.from || input.to ? 'custom' : 'today');
  if (period === 'week') {
    const from = startOfDay(now);
    const weekday = from.getDay();
    from.setDate(from.getDate() - (weekday === 0 ? 6 : weekday - 1));
    return { from, to: endToday };
  }
  if (period === 'month') {
    const from = startOfDay(now);
    from.setDate(1);
    return { from, to: endToday };
  }
  if (period === 'custom') {
    const from = input.from ? startOfDay(new Date(input.from)) : startToday;
    const to = input.to ? endOfDay(new Date(input.to)) : endToday;
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Enter a valid date range.');
    }
    if (to < from) {
      throw new BadRequestException(
        'The end date cannot be earlier than the start date.',
      );
    }
    return { from, to };
  }
  return { from: startToday, to: endToday };
}

export function previousRange(range: { from: Date; to: Date }) {
  const length = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  const from = new Date(to.getTime() - length);
  return { from, to };
}

export function visitPresentation(
  entryAt: Date,
  exitAt: Date | null,
  storedMinutes: number | null,
  now = new Date(),
) {
  if (exitAt && exitAt.getTime() < entryAt.getTime()) {
    return { status: 'REVIEW' as const, durationMinutes: null, ongoing: false };
  }
  if (!exitAt) {
    return {
      status: 'INSIDE' as const,
      durationMinutes: Math.max(
        0,
        Math.round((now.getTime() - entryAt.getTime()) / 60_000),
      ),
      ongoing: true,
    };
  }
  return {
    status: 'COMPLETED' as const,
    durationMinutes:
      storedMinutes ??
      Math.max(0, Math.round((exitAt.getTime() - entryAt.getTime()) / 60_000)),
    ongoing: false,
  };
}

export function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

export const DUPLICATE_SCAN_MESSAGE = 'Duplicate scan detected. Please wait.';
export const TOO_SOON_EXIT_MESSAGE =
  'You have just entered the library. Please wait at least 1 minute before exiting.';

export type AccessDeskSettings = {
  voiceEnabled: boolean;
  entryText: string;
  exitText: string;
  voiceName: string;
  speechRate: number;
  volume: number;
  minStaySeconds: number;
  duplicateWindowSeconds: number;
};

export const DEFAULT_ACCESS_DESK: AccessDeskSettings = {
  voiceEnabled: true,
  entryText: 'Welcome to Don Bosco Library.',
  exitText: 'Thank you for visiting Don Bosco Library. Visit again!',
  voiceName: '',
  speechRate: 0.95,
  volume: 1,
  minStaySeconds: 60,
  duplicateWindowSeconds: 5,
};

export type LibraryScanDecision =
  | { action: 'ENTRY' }
  | { action: 'EXIT' }
  | { action: 'IGNORED'; message: string }
  | { action: 'TOO_SOON'; message: string; remainingSeconds: number };

export function mergeAccessDeskSettings(raw: unknown): AccessDeskSettings {
  const source =
    raw && typeof raw === 'object' ? (raw as Partial<AccessDeskSettings>) : {};
  const minStay = clampInt(
    source.minStaySeconds,
    0,
    3600,
    DEFAULT_ACCESS_DESK.minStaySeconds,
  );
  const duplicate = clampInt(
    source.duplicateWindowSeconds,
    1,
    60,
    DEFAULT_ACCESS_DESK.duplicateWindowSeconds,
  );
  const rate = clampNumber(
    source.speechRate,
    0.5,
    1.5,
    DEFAULT_ACCESS_DESK.speechRate,
  );
  const volume = clampNumber(source.volume, 0, 1, DEFAULT_ACCESS_DESK.volume);
  return {
    voiceEnabled: source.voiceEnabled !== false,
    entryText: cleanLine(source.entryText, DEFAULT_ACCESS_DESK.entryText),
    exitText: cleanLine(source.exitText, DEFAULT_ACCESS_DESK.exitText),
    voiceName:
      typeof source.voiceName === 'string' ? source.voiceName.slice(0, 80) : '',
    speechRate: rate,
    volume,
    minStaySeconds: minStay,
    duplicateWindowSeconds: duplicate,
  };
}

/** The latest open visit is the only session a scan may close. */
export function pickActiveOpenVisit<T extends { entryAt: Date }>(
  rows: T[],
): T | null {
  if (!rows.length) return null;
  return rows.reduce((latest, row) =>
    row.entryAt.getTime() > latest.entryAt.getTime() ? row : latest,
  );
}

export function decideLibraryScan(input: {
  memberType: string;
  openEntryAt: Date | null;
  lastAcceptedAt: Date | null;
  now?: Date;
  minStaySeconds: number;
  duplicateWindowSeconds: number;
}): LibraryScanDecision {
  const now = input.now ?? new Date();
  const duplicateMs = Math.max(0, input.duplicateWindowSeconds) * 1000;
  if (
    input.lastAcceptedAt &&
    duplicateMs > 0 &&
    now.getTime() - input.lastAcceptedAt.getTime() >= 0 &&
    now.getTime() - input.lastAcceptedAt.getTime() < duplicateMs
  ) {
    return { action: 'IGNORED', message: DUPLICATE_SCAN_MESSAGE };
  }
  if (!input.openEntryAt) return { action: 'ENTRY' };
  const elapsed = now.getTime() - input.openEntryAt.getTime();
  const minMs = Math.max(0, input.minStaySeconds) * 1000;
  if (input.memberType === 'STUDENT' && minMs > 0 && elapsed < minMs) {
    return {
      action: 'TOO_SOON',
      message: TOO_SOON_EXIT_MESSAGE,
      remainingSeconds: Math.max(1, Math.ceil((minMs - elapsed) / 1000)),
    };
  }
  return { action: 'EXIT' };
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function cleanLine(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  const text = value.trim().slice(0, 180);
  return text || fallback;
}
