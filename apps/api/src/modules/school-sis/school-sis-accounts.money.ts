import { Prisma } from '@prisma/client';

export type Money = Prisma.Decimal;

export function money(value: Prisma.Decimal | string | number): Money {
  return new Prisma.Decimal(value).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );
}

export function zero(): Money {
  return money(0);
}

export function add(...parts: Array<Prisma.Decimal | string | number>): Money {
  return money(parts.reduce((s: Money, p) => s.add(money(p)), zero()));
}

export function paiseToMoney(paise: number): Money {
  return money(new Prisma.Decimal(paise).div(100));
}

export type DraftLine = {
  accountId?: string;
  systemKey?: string;
  debit: Money | string | number;
  credit: Money | string | number;
  particulars?: string;
  costCentreId?: string;
};

export function assertBalanced(lines: DraftLine[]): {
  debit: Money;
  credit: Money;
} {
  if (!lines.length) throw new Error('Voucher must have at least two lines');
  let debit = zero();
  let credit = zero();
  for (const line of lines) {
    const d = money(line.debit);
    const c = money(line.credit);
    if (d.lt(0) || c.lt(0))
      throw new Error('Debit and credit cannot be negative');
    if (!d.isZero() && !c.isZero()) {
      throw new Error('A line cannot have both debit and credit');
    }
    if (d.isZero() && c.isZero())
      throw new Error('A line must have debit or credit');
    debit = add(debit, d);
    credit = add(credit, c);
  }
  if (!debit.eq(credit)) {
    throw new Error(`Total Debit ${debit} ≠ Total Credit ${credit}`);
  }
  if (debit.lte(0)) throw new Error('Voucher amount must be greater than zero');
  return { debit, credit };
}

export function twoSided(opts: {
  debitAccount?: { id?: string; systemKey?: string };
  creditAccount?: { id?: string; systemKey?: string };
  amount: Money | string | number;
  debitNote?: string;
  creditNote?: string;
}): DraftLine[] {
  const amount = money(opts.amount);
  if (amount.lte(0)) throw new Error('Amount must be greater than zero');
  return [
    {
      accountId: opts.debitAccount?.id,
      systemKey: opts.debitAccount?.systemKey,
      debit: amount,
      credit: 0,
      particulars: opts.debitNote,
    },
    {
      accountId: opts.creditAccount?.id,
      systemKey: opts.creditAccount?.systemKey,
      debit: 0,
      credit: amount,
      particulars: opts.creditNote,
    },
  ];
}

export function indianFy(at = new Date()) {
  const month = at.getUTCMonth();
  const year = at.getUTCFullYear();
  const startYear = month >= 3 ? year : year - 1;
  const startsOn = new Date(Date.UTC(startYear, 3, 1));
  const endsOn = new Date(Date.UTC(startYear + 1, 2, 31));
  const code = `${startYear}-${String(startYear + 1).slice(-2)}`;
  return {
    code,
    name: `Financial Year ${code}`,
    startsOn,
    endsOn,
  };
}

export function maskAccountNumber(value?: string | null) {
  const digits = (value ?? '').replace(/\s+/g, '');
  if (digits.length < 4) return '••••';
  return `XXXX${digits.slice(-4)}`;
}
