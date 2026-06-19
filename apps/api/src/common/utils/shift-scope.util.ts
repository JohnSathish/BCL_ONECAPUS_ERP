import type { JwtUser } from '../decorators/current-user.decorator';

/** Sentinel UUID — matches no rows when used in `{ in: [NIL_UUID] }` filters. */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export type ShiftScope = {
  shiftIds: string[];
  primaryShiftId?: string;
  allShifts: boolean;
  activeShiftId?: string;
};

export function parseTimeToDate(time: string): Date {
  const parts = time.split(':').map(Number);
  const d = new Date(
    Date.UTC(1970, 0, 1, parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0),
  );
  return d;
}

export function formatShiftTime(d: Date): string {
  return d.toISOString().substring(11, 19);
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
