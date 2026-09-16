export type CircRule = {
  memberKind: string;
  gradePattern?: string | null;
  maxBooks: number;
  loanDays: number;
  maxRenewals: number;
  finePerDay: string | number | { toString(): string };
  graceDays: number;
};

export type IssueBlock = { ok: true } | { ok: false; reason: string };

export function pickRule(
  rules: CircRule[],
  memberKind: string,
  gradeCode?: string | null,
): CircRule | undefined {
  const kind = rules.filter((r) => r.memberKind === memberKind);
  if (gradeCode) {
    const match = kind.find((r) =>
      (r.gradePattern ?? '')
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .includes(gradeCode.trim().toUpperCase()),
    );
    if (match) return match;
  }
  return kind.find((r) => !r.gradePattern) ?? kind[0];
}

export function dueDate(issuedAt: Date, loanDays: number) {
  const d = new Date(issuedAt);
  d.setUTCDate(d.getUTCDate() + loanDays);
  return d;
}

export function overdueDays(dueAt: Date, returnedAt: Date, graceDays = 0) {
  const ms = returnedAt.getTime() - dueAt.getTime();
  const days = Math.floor(ms / 86_400_000) - graceDays;
  return Math.max(0, days);
}

export function fineAmount(
  days: number,
  finePerDay: string | number,
  maxFine?: string | number,
) {
  const raw = Math.round(days * Number(finePerDay) * 100) / 100;
  if (maxFine && Number(maxFine) > 0) return Math.min(raw, Number(maxFine));
  return raw;
}

export function validateIssue(input: {
  memberStatus: string;
  validUntil?: Date | null;
  now?: Date;
  activeLoans: number;
  maxBooks: number;
  overdueCount: number;
  unpaidFines: number;
  blockOnOverdue: boolean;
  blockOnUnpaidFine: boolean;
  copyStatus: string;
  reservedForOther: boolean;
}): IssueBlock {
  if (input.memberStatus === 'BLOCKED') {
    return { ok: false, reason: 'This member is blocked from circulation.' };
  }
  if (input.memberStatus !== 'ACTIVE') {
    return { ok: false, reason: 'Membership is not active.' };
  }
  if (input.validUntil && (input.now ?? new Date()) > input.validUntil) {
    return { ok: false, reason: 'Membership has expired.' };
  }
  if (input.activeLoans >= input.maxBooks) {
    return {
      ok: false,
      reason: `This member already has ${input.activeLoans} books issued. Maximum allowed: ${input.maxBooks}.`,
    };
  }
  if (input.blockOnOverdue && input.overdueCount > 0) {
    return {
      ok: false,
      reason: `This member has ${input.overdueCount} overdue book(s). Return them before issuing another.`,
    };
  }
  if (input.blockOnUnpaidFine && input.unpaidFines > 0) {
    return {
      ok: false,
      reason: 'This member has unpaid library fines.',
    };
  }
  if (input.copyStatus !== 'AVAILABLE' && input.copyStatus !== 'RESERVED') {
    return {
      ok: false,
      reason: `This copy is ${input.copyStatus.toLowerCase()} and cannot be issued.`,
    };
  }
  if (input.reservedForOther) {
    return {
      ok: false,
      reason: 'This title is reserved for another member.',
    };
  }
  return { ok: true };
}

export function canRenew(input: {
  renewals: number;
  maxRenewals: number;
  reserved: boolean;
  memberBlocked: boolean;
  overdue: boolean;
}): IssueBlock {
  if (input.memberBlocked) return { ok: false, reason: 'Member is blocked.' };
  if (input.reserved) {
    return { ok: false, reason: 'Another member has reserved this title.' };
  }
  if (input.renewals >= input.maxRenewals) {
    return { ok: false, reason: 'Renewal limit reached.' };
  }
  if (input.overdue)
    return { ok: false, reason: 'Overdue loans cannot be renewed.' };
  return { ok: true };
}
