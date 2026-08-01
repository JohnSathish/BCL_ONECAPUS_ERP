/**
 * Minimal RRULE expander for V1 (Daily / Weekly / Monthly / Yearly).
 * Supports: FREQ, INTERVAL, COUNT, UNTIL, BYDAY (MO..SU), BYMONTHDAY.
 * Expands only within [rangeFrom, rangeTo] — never materializes unbounded series.
 */

import { parseDateOnly, toDateOnlyIso } from './academic-calendar.types';

const DOW: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const day = Math.min(
    d.getUTCDate(),
    daysInMonth(x.getUTCFullYear(), x.getUTCMonth()),
  );
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), day));
}

function addYears(d: Date, n: number): Date {
  return addMonths(d, n * 12);
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

function parseRrule(rule: string): Record<string, string> {
  const raw = rule.replace(/^RRULE:/i, '').trim();
  const out: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const [k, v] = part.split('=');
    if (k && v) out[k.toUpperCase()] = v.toUpperCase();
  }
  return out;
}

export function expandRruleOccurrences(input: {
  startDate: string;
  endDate: string;
  recurrenceRule: string;
  rangeFrom: string;
  rangeTo: string;
  maxOccurrences?: number;
}): Array<{ startDate: string; endDate: string }> {
  const spanDays =
    (parseDateOnly(input.endDate).getTime() -
      parseDateOnly(input.startDate).getTime()) /
    86_400_000;
  const start = parseDateOnly(input.startDate);
  const rangeFrom = parseDateOnly(input.rangeFrom);
  const rangeTo = parseDateOnly(input.rangeTo);
  const parts = parseRrule(input.recurrenceRule);
  const freq = parts.FREQ ?? 'DAILY';
  const interval = Math.max(1, Number(parts.INTERVAL ?? '1') || 1);
  const count = parts.COUNT ? Math.max(1, Number(parts.COUNT) || 1) : null;
  let untilDate: Date | null = null;
  if (parts.UNTIL) {
    const u = parts.UNTIL;
    if (/^\d{8}/.test(u)) {
      untilDate = parseDateOnly(
        `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}`,
      );
    } else {
      untilDate = parseDateOnly(u);
    }
  }

  const byDay = parts.BYDAY
    ? parts.BYDAY.split(',')
        .map((d) => DOW[d.replace(/^-?\d+/, '')] ?? -1)
        .filter((n) => n >= 0)
    : null;
  const byMonthDay = parts.BYMONTHDAY
    ? parts.BYMONTHDAY.split(',')
        .map((n) => Number(n))
        .filter((n) => n >= 1 && n <= 31)
    : null;

  const max = input.maxOccurrences ?? 500;
  const results: Array<{ startDate: string; endDate: string }> = [];
  let cursor = start;
  let emitted = 0;
  let guard = 0;

  while (emitted < max && guard < 2000) {
    guard += 1;
    if (untilDate && cursor > untilDate) break;
    if (count != null && emitted >= count) break;
    if (cursor > rangeTo && emitted > 0 && cursor > addDays(rangeTo, 370))
      break;

    let matches = true;
    if (byDay && byDay.length && !byDay.includes(cursor.getUTCDay())) {
      matches = false;
    }
    if (
      byMonthDay &&
      byMonthDay.length &&
      !byMonthDay.includes(cursor.getUTCDate())
    ) {
      matches = false;
    }

    if (matches) {
      const occEnd = addDays(cursor, spanDays);
      if (occEnd >= rangeFrom && cursor <= rangeTo) {
        results.push({
          startDate: toDateOnlyIso(cursor),
          endDate: toDateOnlyIso(occEnd),
        });
      }
      emitted += 1;
      if (count != null && emitted >= count) break;
    }

    // Advance
    if (freq === 'DAILY') {
      cursor = addDays(cursor, matches || !byDay ? interval : 1);
    } else if (freq === 'WEEKLY') {
      if (byDay && byDay.length) {
        cursor = addDays(cursor, 1);
        // when wrapping week and interval > 1, skip weeks
        if (cursor.getUTCDay() === start.getUTCDay() && interval > 1) {
          cursor = addDays(cursor, (interval - 1) * 7);
        }
      } else {
        cursor = addDays(cursor, 7 * interval);
      }
    } else if (freq === 'MONTHLY') {
      cursor = addMonths(cursor, interval);
    } else if (freq === 'YEARLY') {
      cursor = addYears(cursor, interval);
    } else {
      cursor = addDays(cursor, interval);
    }

    if (cursor > addDays(rangeTo, 400)) break;
  }

  return results;
}

export function buildSimpleRrule(opts: {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  count?: number;
  until?: string;
  byDay?: string[];
}): string {
  const parts = [`FREQ=${opts.freq}`];
  if (opts.interval && opts.interval > 1)
    parts.push(`INTERVAL=${opts.interval}`);
  if (opts.count) parts.push(`COUNT=${opts.count}`);
  if (opts.until) {
    const d = opts.until.replace(/-/g, '').slice(0, 8);
    parts.push(`UNTIL=${d}`);
  }
  if (opts.byDay?.length) parts.push(`BYDAY=${opts.byDay.join(',')}`);
  return parts.join(';');
}
