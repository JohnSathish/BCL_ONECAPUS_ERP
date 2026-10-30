export type MemberRolePolicy = {
  loanDays: number;
  maxBooks: number;
  maxRenewals: number;
};

export type CategoryRulePolicy = {
  loanDays: number;
  maxBooks: number;
  allowIssue: boolean;
  requireApproval?: boolean;
};

export const COPY_TYPES = [
  'GENERAL',
  'REFERENCE',
  'RARE',
  'TEXTBOOK',
  'RESERVE',
  'RESTRICTED',
  'OTHER',
] as const;

export type CopyType = (typeof COPY_TYPES)[number];

export type CopyIssueRules = Record<CopyType, boolean>;

export const DEFAULT_COPY_ISSUE: CopyIssueRules = {
  GENERAL: true,
  REFERENCE: false,
  RARE: false,
  TEXTBOOK: true,
  RESERVE: true,
  RESTRICTED: false,
  OTHER: true,
};

export type CirculationPolicy = {
  student: MemberRolePolicy;
  faculty: MemberRolePolicy;
  researchScholar: MemberRolePolicy;
  staff: MemberRolePolicy;
  reference: CategoryRulePolicy;
  rare: CategoryRulePolicy;
  copyIssue: CopyIssueRules;
};

export type FinePolicy = {
  lostBookPenaltyMultiplier: number;
  damageChargeDefault: number;
};

export const DEFAULT_CIRCULATION_POLICY: CirculationPolicy = {
  student: { loanDays: 14, maxBooks: 3, maxRenewals: 1 },
  faculty: { loanDays: 30, maxBooks: 10, maxRenewals: 2 },
  researchScholar: { loanDays: 45, maxBooks: 15, maxRenewals: 2 },
  staff: { loanDays: 21, maxBooks: 5, maxRenewals: 1 },
  reference: { loanDays: 0, maxBooks: 0, allowIssue: false },
  rare: { loanDays: 7, maxBooks: 1, allowIssue: true, requireApproval: true },
  copyIssue: { ...DEFAULT_COPY_ISSUE },
};

export const DEFAULT_FINE_POLICY: FinePolicy = {
  lostBookPenaltyMultiplier: 2,
  damageChargeDefault: 100,
};

export function mergeCirculationPolicy(raw: unknown): CirculationPolicy {
  const base = DEFAULT_CIRCULATION_POLICY;
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  const role = (
    key:
      | 'student'
      | 'faculty'
      | 'researchScholar'
      | 'staff'
      | 'reference'
      | 'rare',
  ): MemberRolePolicy | CategoryRulePolicy => ({
    ...base[key],
    ...(typeof o[key] === 'object' && o[key] ? (o[key] as object) : {}),
  });
  return {
    student: role('student') as MemberRolePolicy,
    faculty: role('faculty') as MemberRolePolicy,
    researchScholar: role('researchScholar') as MemberRolePolicy,
    staff: role('staff') as MemberRolePolicy,
    reference: role('reference') as CategoryRulePolicy,
    rare: role('rare') as CategoryRulePolicy,
    copyIssue: mergeCopyIssue(o.copyIssue),
  };
}

export function mergeCopyIssue(raw: unknown): CopyIssueRules {
  const next = { ...DEFAULT_COPY_ISSUE };
  if (!raw || typeof raw !== 'object') return next;
  const source = raw as Record<string, unknown>;
  for (const key of COPY_TYPES) {
    if (typeof source[key] === 'boolean') next[key] = source[key];
  }
  return next;
}

export function mergeFinePolicy(raw: unknown): FinePolicy {
  if (!raw || typeof raw !== 'object') return DEFAULT_FINE_POLICY;
  return { ...DEFAULT_FINE_POLICY, ...(raw as Partial<FinePolicy>) };
}
