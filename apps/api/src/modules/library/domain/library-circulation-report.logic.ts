import {
  addCalendarDays,
  collegeDateIso,
  endOfCollegeDate,
} from './library-loan-calendar.logic';

/** First instant of a college (Asia/Kolkata) calendar date. */
export function startOfCollegeDate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1, 18, 30, 0, 0));
}

export type ReportRange = {
  fromIso: string;
  toIso: string;
  from: Date;
  to: Date;
  /** End of the range, but never later than now. Used for "as of" counts. */
  asOf: Date;
};

/**
 * From/To are college dates. An academic year narrows the range to its own
 * start and end. With no dates at all the last 30 days are used.
 */
export function resolveReportRange(
  input: { from?: string; to?: string },
  academicYear: { startDate: Date; endDate: Date } | null,
  now = new Date(),
): ReportRange {
  const today = collegeDateIso(now);
  let fromIso =
    input.from ?? (academicYear ? null : addCalendarDays(today, -29));
  let toIso = input.to ?? (academicYear ? null : today);
  if (academicYear) {
    const ayFrom = academicYear.startDate.toISOString().slice(0, 10);
    const ayTo = academicYear.endDate.toISOString().slice(0, 10);
    fromIso = fromIso && fromIso > ayFrom ? fromIso : ayFrom;
    toIso = toIso && toIso < ayTo ? toIso : ayTo;
  }
  let start = fromIso!;
  let end = toIso!;
  if (start > end) [start, end] = [end, start];
  const to = endOfCollegeDate(end);
  return {
    fromIso: start,
    toIso: end,
    from: startOfCollegeDate(start),
    to,
    asOf: to.getTime() > now.getTime() ? now : to,
  };
}

export const REPORT_TITLES: Record<string, string> = {
  all: 'All Circulation Transactions',
  issued: 'Books Issued',
  renewed: 'Books Renewed',
  returned: 'Books Returned',
  current: 'Currently Borrowed Books',
  overdue: 'Overdue Books',
  late: 'Late Returns',
  borrower: 'Borrower-wise Circulation',
  departments: 'Department-wise Circulation',
  librarians: 'Librarian-wise Transactions',
  'lost-damaged': 'Lost and Damaged Books',
};

export const TYPE_LABELS: Record<string, string> = {
  ISSUE: 'Issue',
  RENEW: 'Renewal',
  RETURN: 'Return',
};

export const STATUS_LABELS: Record<string, string> = {
  ON_LOAN: 'On loan',
  OVERDUE: 'Overdue',
  RETURNED: 'Returned',
  RENEWED: 'Renewed',
  RETURNED_LATE: 'Returned late',
  RETURNED_DAMAGED: 'Returned damaged',
  LOST: 'Lost',
};

export const FINE_STATUS_LABELS: Record<string, string> = {
  NONE: '—',
  PENDING: 'Pending',
  PAID: 'Paid',
  WAIVED: 'Waived',
  PARTIAL: 'Part paid',
};

export const RETURNER_LABELS: Record<string, string> = {
  BORROWER: 'Borrower',
  STUDENT: 'Other student',
  STAFF: 'Staff',
  OTHER: 'Other',
};

export function memberTypeLabel(value: string | null | undefined): string {
  switch (value) {
    case 'STUDENT':
      return 'Student';
    case 'FACULTY':
      return 'Faculty';
    case 'STAFF':
      return 'Staff';
    case 'RESEARCH_SCHOLAR':
      return 'Research scholar';
    default:
      return value ?? '—';
  }
}

export function csvCell(value: string | number | null | undefined): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
