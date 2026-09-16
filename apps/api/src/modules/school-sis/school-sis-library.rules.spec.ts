import {
  canRenew,
  dueDate,
  fineAmount,
  overdueDays,
  pickRule,
  validateIssue,
} from './school-sis-library.rules';
import { DEFAULT_CIRC_RULES } from './school-sis-library.catalog';

describe('school library circulation rules', () => {
  it('uses class-wise student limits when a grade matches', () => {
    const rule = pickRule([...DEFAULT_CIRC_RULES], 'STUDENT', 'IX');
    expect(rule?.maxBooks).toBe(3);
    expect(rule?.loanDays).toBe(21);
  });

  it('blocks issue when the member is at the loan cap', () => {
    const r = validateIssue({
      memberStatus: 'ACTIVE',
      activeLoans: 3,
      maxBooks: 3,
      overdueCount: 0,
      unpaidFines: 0,
      blockOnOverdue: true,
      blockOnUnpaidFine: true,
      copyStatus: 'AVAILABLE',
      reservedForOther: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/Maximum allowed: 3/);
  });

  it('computes overdue fine after grace', () => {
    const due = new Date('2026-09-10T00:00:00Z');
    const returned = new Date('2026-09-15T00:00:00Z');
    expect(overdueDays(due, returned, 0)).toBe(5);
    expect(fineAmount(5, 2)).toBe(10);
  });

  it('sets due date from loan days', () => {
    const due = dueDate(new Date('2026-09-01T00:00:00Z'), 14);
    expect(due.toISOString().slice(0, 10)).toBe('2026-09-15');
  });

  it('refuses renewal when a reservation is waiting', () => {
    expect(
      canRenew({
        renewals: 0,
        maxRenewals: 2,
        reserved: true,
        memberBlocked: false,
        overdue: false,
      }).ok,
    ).toBe(false);
  });
});
