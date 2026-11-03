import { collegeDateIso } from './library-loan-calendar.logic';

export const CIRCULATION_TYPES = ['ISSUE', 'RENEW', 'RETURN'] as const;
export type CirculationType = (typeof CIRCULATION_TYPES)[number];

export const RETURNER_TYPES = [
  'BORROWER',
  'STUDENT',
  'STAFF',
  'OTHER',
] as const;
export type ReturnerType = (typeof RETURNER_TYPES)[number];

export const BOOK_CONDITIONS = ['GOOD', 'DAMAGED', 'LOST'] as const;
export type BookCondition = (typeof BOOK_CONDITIONS)[number];

export function transactionCode(seqNo: number): string {
  return `CT-${String(seqNo).padStart(6, '0')}`;
}

/** "CT-000123", "ct123" or "123" → 123. Anything else → null. */
export function parseTransactionCode(text: string): number | null {
  const match = /^(?:ct-?)?0*(\d{1,9})$/i.exec(text.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/** A return is late when it happens on a later college date than the due date. */
export function isLateReturn(dueAt: Date, returnedAt: Date): boolean {
  return collegeDateIso(returnedAt) > collegeDateIso(dueAt);
}

export type ReturnerInput = {
  type?: string | null;
  name?: string | null;
  code?: string | null;
};

export type Returner = {
  type: ReturnerType;
  name: string | null;
  code: string | null;
};

/**
 * Who physically brought the book back. Defaults to the borrower. Another
 * person must have a name; a roll number or staff ID is optional.
 */
export function normalizeReturner(
  input: ReturnerInput | undefined,
  borrower: { name: string | null; code: string | null },
): Returner {
  const type = String(input?.type ?? 'BORROWER').toUpperCase();
  const name = input?.name?.trim() || null;
  const code = input?.code?.trim() || null;
  if (type === 'BORROWER' || !RETURNER_TYPES.includes(type as ReturnerType)) {
    return { type: 'BORROWER', name: borrower.name, code: borrower.code };
  }
  if (!name && !code) {
    throw new Error('RETURNER_NAME_REQUIRED');
  }
  return { type: type as ReturnerType, name, code };
}

export type FineLike = {
  amount: number | string | { toString(): string };
  paidAt: Date | string | null;
  waivedAt: Date | string | null;
};

export type FineStatus = 'NONE' | 'PENDING' | 'PAID' | 'WAIVED' | 'PARTIAL';

export function fineStatus(fines: FineLike[]): FineStatus {
  const charged = fines.filter((f) => Number(f.amount) > 0);
  if (!charged.length) return 'NONE';
  const paid = charged.filter((f) => f.paidAt).length;
  const waived = charged.filter((f) => !f.paidAt && f.waivedAt).length;
  const pending = charged.length - paid - waived;
  if (pending === charged.length) return 'PENDING';
  if (pending > 0) return 'PARTIAL';
  if (paid === 0) return 'WAIVED';
  return 'PAID';
}

export type TransactionStatus =
  | 'ON_LOAN'
  | 'OVERDUE'
  | 'RETURNED'
  | 'RENEWED'
  | 'RETURNED_LATE'
  | 'RETURNED_DAMAGED'
  | 'LOST';

/** Status shown for one history row, given the loan's state today. */
export function transactionStatus(
  row: {
    transactionType: string;
    isLate: boolean;
    bookCondition: string | null;
  },
  loan: { status: string; dueAt: Date },
  now: Date,
): TransactionStatus {
  if (row.transactionType === 'RETURN') {
    if (row.bookCondition === 'LOST') return 'LOST';
    if (row.bookCondition === 'DAMAGED') return 'RETURNED_DAMAGED';
    return row.isLate ? 'RETURNED_LATE' : 'RETURNED';
  }
  if (row.transactionType === 'RENEW') return 'RENEWED';
  if (loan.status !== 'ACTIVE') return 'RETURNED';
  return collegeDateIso(now) > collegeDateIso(loan.dueAt)
    ? 'OVERDUE'
    : 'ON_LOAN';
}

/** Whole college days a loan has been overdue as of `asOf` (calendar days). */
export function calendarDaysOverdue(dueAt: Date, asOf: Date): number {
  const due = Date.parse(`${collegeDateIso(dueAt)}T00:00:00Z`);
  const now = Date.parse(`${collegeDateIso(asOf)}T00:00:00Z`);
  return Math.max(0, Math.round((now - due) / 86_400_000));
}
