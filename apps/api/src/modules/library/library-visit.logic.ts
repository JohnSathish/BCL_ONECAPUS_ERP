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
