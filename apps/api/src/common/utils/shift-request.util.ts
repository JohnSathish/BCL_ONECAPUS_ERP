import type { Request } from 'express';
import type { ShiftScope } from './shift-scope.util';

type ShiftAwareRequest = Request & {
  shiftScope?: ShiftScope;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
};

export function extractRequestedShiftId(
  req: ShiftAwareRequest,
): string | undefined {
  const queryShift = req.query?.shiftId;
  if (typeof queryShift === 'string' && queryShift) return queryShift;
  const headerShift = req.headers['x-shift-id'];
  if (typeof headerShift === 'string' && headerShift) return headerShift;
  return req.shiftScope?.activeShiftId;
}

export function mergeShiftIntoQuery<T extends { shiftId?: string }>(
  query: T,
  req: ShiftAwareRequest,
): T {
  if (query.shiftId) return query;
  const shiftId = extractRequestedShiftId(req);
  return shiftId ? { ...query, shiftId } : query;
}
