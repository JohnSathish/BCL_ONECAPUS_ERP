import type { JwtUser } from '../decorators/current-user.decorator';

/** Sentinel UUID — matches no rows when used in `{ in: [NIL_UUID] }` filters. */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export type ShiftScope = {
  shiftIds: string[];
  primaryShiftId?: string;
  allShifts: boolean;
  activeShiftId?: string;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Accepts HH:mm, HH:mm:ss, or ISO datetimes (e.g. 1970-01-01T09:45:00.000Z). */
export function parseTimeToDate(time: string): Date {
  const raw = String(time ?? '').trim();
  if (!raw) {
    throw new Error('Time value is required');
  }

  const isoMatch = raw.match(/T(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
  const clock = isoMatch
    ? `${isoMatch[1]}:${isoMatch[2]}:${isoMatch[3] ?? '00'}`
    : raw;

  const parts = clock.split(':').map((part) => Number(part));
  const hours = parts[0];
  const minutes = parts[1];
  const seconds = parts[2] ?? 0;
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    throw new Error(`Invalid time value: ${time}`);
  }

  const d = new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid time value: ${time}`);
  }
  return d;
}

export function formatShiftTime(d: Date | string): string {
  if (typeof d === 'string') {
    const raw = d.trim();
    const iso = raw.match(/T(\d{2}:\d{2}:\d{2})/i);
    if (iso) return iso[1];
    if (/^\d{2}:\d{2}:\d{2}/.test(raw)) return raw.slice(0, 8);
    if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
    return raw;
  }
  return d.toISOString().substring(11, 19);
}

/** Empty / synthetic ids (e.g. entry-<uuid>, synthetic-<uuid>) → null so Prisma UUID columns do not 500. */
export function optionalUuid(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (
    !trimmed ||
    trimmed.startsWith('entry-') ||
    trimmed.startsWith('synthetic-')
  ) {
    return null;
  }
  return UUID_RE.test(trimmed) ? trimmed : null;
}

export function buildShiftScope(
  user: JwtUser,
  requestedShiftId?: string,
): ShiftScope {
  const shiftIds = user.shiftIds ?? [];
  const allShifts = Boolean(user.allShifts);
  const primaryShiftId = user.primaryShiftId;

  let activeShiftId = requestedShiftId;
  if (!allShifts && activeShiftId && !shiftIds.includes(activeShiftId)) {
    activeShiftId = undefined;
  }
  if (!activeShiftId && !allShifts) {
    activeShiftId = primaryShiftId ?? shiftIds[0];
  }

  return { shiftIds, primaryShiftId, allShifts, activeShiftId };
}

export function shiftFilter(
  scope: ShiftScope,
  field = 'shiftId',
): Record<string, unknown> | undefined {
  if (scope.allShifts) {
    return scope.activeShiftId ? { [field]: scope.activeShiftId } : undefined;
  }
  const ids = scope.activeShiftId ? [scope.activeShiftId] : scope.shiftIds;
  if (!ids.length) return { [field]: { in: [NIL_UUID] } };
  return { [field]: { in: ids } };
}

export function applyShiftWhere<T extends Record<string, unknown>>(
  where: T,
  scope: ShiftScope,
  field = 'shiftId',
): T {
  const filter = shiftFilter(scope, field);
  if (!filter) return where;
  return { ...where, ...filter };
}
