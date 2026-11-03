import { endOfCollegeDate } from './library-loan-calendar.logic';
import {
  calendarDaysOverdue,
  fineStatus,
  isLateReturn,
  normalizeReturner,
  parseTransactionCode,
  transactionCode,
  transactionStatus,
} from './library-circulation-ledger.logic';
import {
  csvCell,
  resolveReportRange,
  startOfCollegeDate,
} from './library-circulation-report.logic';

const IST = (iso: string) => new Date(`${iso}+05:30`);

describe('circulation ledger rules', () => {
  it('formats and parses transaction IDs', () => {
    expect(transactionCode(123)).toBe('CT-000123');
    expect(parseTransactionCode('CT-000123')).toBe(123);
    expect(parseTransactionCode('ct123')).toBe(123);
    expect(parseTransactionCode('123')).toBe(123);
    expect(parseTransactionCode('HI26-15')).toBeNull();
    expect(parseTransactionCode('0')).toBeNull();
  });

  it('defaults the returner to the borrower and keeps another person separate', () => {
    const borrower = { name: 'Helin Ch Marak', code: 'EC26-26' };
    expect(normalizeReturner(undefined, borrower)).toEqual({
      type: 'BORROWER',
      name: 'Helin Ch Marak',
      code: 'EC26-26',
    });
    expect(
      normalizeReturner(
        { type: 'student', name: ' Dimsrang ', code: 'HI26-15' },
        borrower,
      ),
    ).toEqual({ type: 'STUDENT', name: 'Dimsrang', code: 'HI26-15' });
    expect(() => normalizeReturner({ type: 'OTHER' }, borrower)).toThrow(
      'RETURNER_NAME_REQUIRED',
    );
  });

  it('counts a return on a later college date as late', () => {
    const due = endOfCollegeDate('2026-11-20');
    expect(isLateReturn(due, IST('2026-11-20T17:00:00'))).toBe(false);
    expect(isLateReturn(due, IST('2026-11-21T09:00:00'))).toBe(true);
    expect(calendarDaysOverdue(due, IST('2026-11-23T10:00:00'))).toBe(3);
    expect(calendarDaysOverdue(due, IST('2026-11-19T10:00:00'))).toBe(0);
  });

  it('summarises fine payment status', () => {
    expect(fineStatus([])).toBe('NONE');
    expect(fineStatus([{ amount: 0, paidAt: null, waivedAt: null }])).toBe(
      'NONE',
    );
    expect(fineStatus([{ amount: 10, paidAt: null, waivedAt: null }])).toBe(
      'PENDING',
    );
    expect(
      fineStatus([{ amount: 10, paidAt: new Date(), waivedAt: null }]),
    ).toBe('PAID');
    expect(
      fineStatus([{ amount: 10, paidAt: null, waivedAt: new Date() }]),
    ).toBe('WAIVED');
    expect(
      fineStatus([
        { amount: 10, paidAt: new Date(), waivedAt: null },
        { amount: 5, paidAt: null, waivedAt: null },
      ]),
    ).toBe('PARTIAL');
  });

  it('labels each history row from the loan state', () => {
    const due = endOfCollegeDate('2026-11-20');
    const now = IST('2026-11-25T10:00:00');
    const issue = {
      transactionType: 'ISSUE',
      isLate: false,
      bookCondition: null,
    };
    expect(
      transactionStatus(issue, { status: 'ACTIVE', dueAt: due }, now),
    ).toBe('OVERDUE');
    expect(
      transactionStatus(
        issue,
        { status: 'ACTIVE', dueAt: due },
        IST('2026-11-20T12:00:00'),
      ),
    ).toBe('ON_LOAN');
    expect(
      transactionStatus(issue, { status: 'RETURNED', dueAt: due }, now),
    ).toBe('RETURNED');
    expect(
      transactionStatus(
        { transactionType: 'RETURN', isLate: true, bookCondition: 'GOOD' },
        { status: 'RETURNED', dueAt: due },
        now,
      ),
    ).toBe('RETURNED_LATE');
    expect(
      transactionStatus(
        { transactionType: 'RETURN', isLate: false, bookCondition: 'LOST' },
        { status: 'RETURNED', dueAt: due },
        now,
      ),
    ).toBe('LOST');
    expect(
      transactionStatus(
        { transactionType: 'RENEW', isLate: false, bookCondition: null },
        { status: 'ACTIVE', dueAt: due },
        now,
      ),
    ).toBe('RENEWED');
  });
});

describe('circulation report range', () => {
  const now = IST('2026-11-03T15:00:00');

  it('defaults to the last 30 college days ending today', () => {
    const range = resolveReportRange({}, null, now);
    expect(range.fromIso).toBe('2026-10-05');
    expect(range.toIso).toBe('2026-11-03');
    expect(range.asOf).toEqual(now);
  });

  it('starts and ends on college-day boundaries', () => {
    const range = resolveReportRange(
      { from: '2026-11-01', to: '2026-11-02' },
      null,
      now,
    );
    expect(range.from.toISOString()).toBe('2026-10-31T18:30:00.000Z');
    expect(range.to.toISOString()).toBe('2026-11-02T18:29:59.999Z');
    expect(range.asOf).toEqual(range.to);
    expect(startOfCollegeDate('2026-11-03').toISOString()).toBe(
      '2026-11-02T18:30:00.000Z',
    );
  });

  it('narrows to the academic year and swaps reversed dates', () => {
    const ay = {
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2027-05-31T00:00:00Z'),
    };
    expect(resolveReportRange({}, ay, now)).toMatchObject({
      fromIso: '2026-06-01',
      toIso: '2027-05-31',
      asOf: now,
    });
    expect(resolveReportRange({ from: '2026-01-01' }, ay, now).fromIso).toBe(
      '2026-06-01',
    );
    expect(
      resolveReportRange({ from: '2026-11-03', to: '2026-11-01' }, null, now),
    ).toMatchObject({
      fromIso: '2026-11-01',
      toIso: '2026-11-03',
    });
  });

  it('escapes CSV cells', () => {
    expect(csvCell('Marak, Evelyn')).toBe('"Marak, Evelyn"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell(null)).toBe('');
  });
});
