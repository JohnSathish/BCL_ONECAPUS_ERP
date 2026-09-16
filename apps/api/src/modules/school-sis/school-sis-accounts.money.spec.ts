import { Prisma } from '@prisma/client';
import {
  assertBalanced,
  indianFy,
  money,
  twoSided,
} from './school-sis-accounts.money';

describe('school accounts money engine', () => {
  it('rejects unbalanced vouchers', () => {
    expect(() =>
      assertBalanced([
        { debit: 3600, credit: 0 },
        { debit: 0, credit: 3500 },
      ]),
    ).toThrow(/≠/);
  });

  it('posts a cash fee receipt as Dr Cash Cr Fee Income', () => {
    const lines = twoSided({
      debitAccount: { systemKey: 'CASH' },
      creditAccount: { systemKey: 'TUITION_FEES' },
      amount: '3600.00',
    });
    const totals = assertBalanced(lines);
    expect(totals.debit.toFixed(2)).toBe('3600.00');
    expect(String(lines[0].systemKey)).toBe('CASH');
    expect(String(lines[1].systemKey)).toBe('TUITION_FEES');
  });

  it('never uses binary float for money', () => {
    const sum = money('0.1').add(money('0.2'));
    expect(sum.toFixed(2)).toBe('0.30');
    expect(new Prisma.Decimal('0.1').add('0.2').toFixed(2)).toBe('0.30');
  });

  it('computes April–March financial year independently of academic year', () => {
    const fy = indianFy(new Date('2026-09-16T00:00:00Z'));
    expect(fy.code).toBe('2026-27');
    expect(fy.startsOn.toISOString().slice(0, 10)).toBe('2026-04-01');
    expect(fy.endsOn.toISOString().slice(0, 10)).toBe('2027-03-31');
  });
});
