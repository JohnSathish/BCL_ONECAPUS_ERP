import type { NepCategory } from './nep-categories';

export type CategoryCounts = Partial<Record<NepCategory, number>>;

export type ContinuityRule = 'LOCK' | 'CHANGE_ALLOWED' | 'TRACK_CONTINUE';

export type ContinuityRules = Partial<Record<NepCategory, ContinuityRule>>;

export type CategoryMetaEntry = {
  creditRule?: number;
  mandatory?: boolean;
  /** @deprecated use mandatory */
  optional?: boolean;
};

export type CategoryMeta = Partial<Record<string, CategoryMetaEntry>>;

export type SemesterRulePayload = {
  semesterSequence: number;
  categoryCounts: Record<string, number>;
  continuityRules: Record<string, string>;
  categoryMeta?: CategoryMeta;
  semesterCreditTarget?: number;
  pathwayVariants?: PathwayVariants;
};

export type TemplateLineInput = {
  semesterNo: number;
  categoryType: string;
  subjectCount: number;
  continuityRule?: string | null;
  creditRule?: number | null;
  optionalFlag?: boolean;
};

export type RuleLineInput = {
  categoryType: string;
  requiredSubjectCount: number;
  requiredCredits?: number | null;
  continuityRule?: string | null;
  mandatoryFlag?: boolean;
};

export const NEHU_FYUGP_DEFAULT_TEMPLATE_NAME = 'NEHU FYUGP Default Template';
/** @deprecated use NEHU_FYUGP_DEFAULT_TEMPLATE_NAME */
export const NEHU_FYUGP_UG_TEMPLATE_NAME = NEHU_FYUGP_DEFAULT_TEMPLATE_NAME;

export const DEFAULT_SEMESTER_CREDIT_TARGET = 20;
export const DEFAULT_DEGREE_MIN_CREDITS = 160;
export const DEFAULT_NEHU_TOTAL_SEMESTERS = 8;
export const HONOURS_RESEARCH_ELIGIBILITY_PERCENT = 75;

export type HonoursTrack = 'HONOURS' | 'HONOURS_WITH_RESEARCH';

export type PathwayVariantKey = HonoursTrack | 'WITH_PROJECT';

export type PathwayVariants = Partial<
  Record<PathwayVariantKey, SemesterRulePayload>
>;

function meta(creditRule: number, mandatory = true): CategoryMetaEntry {
  return { creditRule, mandatory };
}

export const DEFAULT_FYUGP_SEMESTER_RULES: SemesterRulePayload[] = [
  {
    semesterSequence: 1,
    semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
    categoryCounts: { MAJOR: 1, MINOR: 1, MDC: 1, AEC: 1, SEC: 1, VAC: 1 },
    continuityRules: {},
    categoryMeta: {
      MAJOR: meta(4),
      MINOR: meta(4),
      MDC: meta(3),
      AEC: meta(3),
      SEC: meta(3),
      VAC: meta(3),
    },
  },
  {
    semesterSequence: 2,
    semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
    categoryCounts: { MAJOR: 1, MINOR: 1, MDC: 1, AEC: 1, SEC: 1, VAC: 1 },
    continuityRules: { MAJOR: 'LOCK', MINOR: 'LOCK' },
    categoryMeta: {
      MAJOR: meta(4),
      MINOR: meta(4),
      MDC: meta(3),
      AEC: meta(3),
      SEC: meta(3),
      VAC: meta(3),
    },
  },
  {
    semesterSequence: 3,
    semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
    categoryCounts: { MAJOR: 2, MDC: 1, AEC: 1, SEC: 1, VTC: 1 },
    continuityRules: { MAJOR: 'LOCK' },
    categoryMeta: {
      MAJOR: meta(4),
      MDC: meta(3),
      AEC: meta(2),
      SEC: meta(3),
      VTC: meta(4),
    },
  },
  {
    semesterSequence: 4,
    semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
    categoryCounts: { MAJOR: 4, VTC: 1 },
    continuityRules: { MAJOR: 'LOCK', VTC: 'TRACK_CONTINUE' },
    categoryMeta: {
      MAJOR: meta(4),
      VTC: meta(4),
    },
  },
  {
    semesterSequence: 5,
    semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
    categoryCounts: { MAJOR: 3, MINOR: 1, INTERNSHIP: 1 },
    continuityRules: { MAJOR: 'LOCK', MINOR: 'LOCK' },
    categoryMeta: {
      MAJOR: meta(4),
      MINOR: meta(4),
      INTERNSHIP: meta(4),
    },
  },
  {
    semesterSequence: 6,
    semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
    categoryCounts: { MAJOR: 4, VTC: 1 },
    continuityRules: { MAJOR: 'LOCK', VTC: 'TRACK_CONTINUE' },
    categoryMeta: {
      MAJOR: meta(4),
      VTC: meta(4),
    },
  },
  {
    semesterSequence: 7,
    semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
    categoryCounts: { MAJOR: 3, MINOR: 2 },
    continuityRules: { MAJOR: 'LOCK', MINOR: 'LOCK' },
    categoryMeta: {
      MAJOR: meta(4),
      MINOR: meta(4),
    },
  },
  {
    semesterSequence: 8,
    semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
    categoryCounts: { MAJOR: 5 },
    continuityRules: { MAJOR: 'LOCK' },
    categoryMeta: {
      MAJOR: meta(4),
    },
    pathwayVariants: undefined as PathwayVariants | undefined,
  },
];

export const DEFAULT_SEMESTER_8_PATHWAY_VARIANTS: PathwayVariants = {
  HONOURS: {
    semesterSequence: 8,
    semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
    categoryCounts: { MAJOR: 5 },
    continuityRules: { MAJOR: 'LOCK' },
    categoryMeta: { MAJOR: meta(4) },
  },
  HONOURS_WITH_RESEARCH: {
    semesterSequence: 8,
    semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
    categoryCounts: { DISSERTATION: 1, MAJOR: 2 },
    continuityRules: { MAJOR: 'LOCK' },
    categoryMeta: {
      DISSERTATION: meta(12),
      MAJOR: meta(4),
    },
  },
  WITH_PROJECT: {
    semesterSequence: 8,
    semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
    categoryCounts: { PROJECT: 1, MAJOR: 2 },
    continuityRules: { MAJOR: 'LOCK' },
    categoryMeta: {
      PROJECT: meta(8),
      MAJOR: meta(4),
    },
  },
};

DEFAULT_FYUGP_SEMESTER_RULES[7]!.pathwayVariants =
  DEFAULT_SEMESTER_8_PATHWAY_VARIANTS;

const CATEGORY_DISPLAY_ORDER = [
  'MAJOR',
  'MINOR',
  'MDC',
  'AEC',
  'SEC',
  'VAC',
  'VTC',
  'INTERNSHIP',
  'PROJECT',
  'RESEARCH',
  'DISSERTATION',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  MAJOR: 'Major',
  MINOR: 'Minor',
  MDC: 'MDC',
  AEC: 'AEC',
  SEC: 'SEC',
  VAC: 'VAC',
  VTC: 'VTC',
  INTERNSHIP: 'Internship',
  PROJECT: 'Project',
  RESEARCH: 'Research',
  DISSERTATION: 'Dissertation',
};

function categoryDisplayLabel(category: string, count: number): string {
  if (category === 'MAJOR' && count > 1) return `${count} Major`;
  if (category === 'MINOR' && count > 1) return `${count} Minor`;
  const base = CATEGORY_LABELS[category] ?? category;
  return count > 1 ? `${count} ${base}` : base;
}

export function formatSemesterSummary(rule: SemesterRulePayload): string {
  const entries = Object.entries(rule.categoryCounts ?? {}).filter(
    ([, count]) => count > 0,
  );
  entries.sort(([a], [b]) => {
    const ia = CATEGORY_DISPLAY_ORDER.indexOf(
      a as (typeof CATEGORY_DISPLAY_ORDER)[number],
    );
    const ib = CATEGORY_DISPLAY_ORDER.indexOf(
      b as (typeof CATEGORY_DISPLAY_ORDER)[number],
    );
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  return entries
    .map(([cat, count]) => categoryDisplayLabel(cat, count))
    .join(' + ');
}

/** Categories that use numbered slot keys when count > 1 (e.g. MAJOR-1, MINOR-2). */
export const MULTI_SLOT_CATEGORIES = new Set(['MAJOR', 'MINOR']);

export function categorySlotKeys(
  categoryCounts: Record<string, number>,
): string[] {
  const keys: string[] = [];
  const sorted = Object.entries(categoryCounts).sort(([a], [b]) => {
    const ia = CATEGORY_DISPLAY_ORDER.indexOf(
      a as (typeof CATEGORY_DISPLAY_ORDER)[number],
    );
    const ib = CATEGORY_DISPLAY_ORDER.indexOf(
      b as (typeof CATEGORY_DISPLAY_ORDER)[number],
    );
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  for (const [cat, count] of sorted) {
    for (let i = 0; i < count; i++) {
      keys.push(
        MULTI_SLOT_CATEGORIES.has(cat) && count > 1 ? `${cat}-${i + 1}` : cat,
      );
    }
  }
  return keys;
}

export function resolveSemesterRuleWithPathway(
  baseRule: SemesterRulePayload,
  pathwayVariants: PathwayVariants | null | undefined,
  honoursTrack?: HonoursTrack | null,
): SemesterRulePayload {
  if (
    baseRule.semesterSequence !== 8 ||
    !honoursTrack ||
    !pathwayVariants?.[honoursTrack]
  ) {
    return baseRule;
  }
  return {
    ...pathwayVariants[honoursTrack]!,
    semesterSequence: 8,
    semesterCreditTarget:
      pathwayVariants[honoursTrack]!.semesterCreditTarget ??
      baseRule.semesterCreditTarget,
  };
}

export function isCategoryMandatory(metaEntry?: CategoryMetaEntry): boolean {
  if (!metaEntry) return true;
  if (metaEntry.mandatory != null) return metaEntry.mandatory;
  if (metaEntry.optional != null) return !metaEntry.optional;
  return true;
}

export function computeSemesterTotals(rule: SemesterRulePayload): {
  papers: number;
  credits: number;
} {
  let papers = 0;
  let credits = 0;
  for (const [category, count] of Object.entries(rule.categoryCounts ?? {})) {
    if (count <= 0) continue;
    papers += count;
    const creditRule = rule.categoryMeta?.[category]?.creditRule ?? 0;
    credits += count * creditRule;
  }
  return { papers, credits };
}

export function buildCategoryRequirements(
  rule: SemesterRulePayload,
): Record<string, { count: number; creditRule?: number; mandatory: boolean }> {
  const requirements: Record<
    string,
    { count: number; creditRule?: number; mandatory: boolean }
  > = {};
  for (const [category, count] of Object.entries(rule.categoryCounts ?? {})) {
    if (count <= 0) continue;
    const metaEntry = rule.categoryMeta?.[category];
    requirements[category] = {
      count,
      creditRule: metaEntry?.creditRule,
      mandatory: isCategoryMandatory(metaEntry),
    };
  }
  return requirements;
}

export function semesterRulesToLines(
  rules: SemesterRulePayload[],
): TemplateLineInput[] {
  const lines: TemplateLineInput[] = [];
  for (const rule of rules) {
    const categories = new Set<string>([
      ...Object.keys(rule.categoryCounts ?? {}),
      ...Object.keys(rule.continuityRules ?? {}),
      ...Object.keys(rule.categoryMeta ?? {}),
    ]);
    for (const categoryType of categories) {
      const subjectCount = rule.categoryCounts[categoryType] ?? 0;
      const continuityRule = rule.continuityRules[categoryType] ?? null;
      const metaEntry = rule.categoryMeta?.[categoryType];
      if (subjectCount === 0 && !continuityRule && !metaEntry) continue;
      lines.push({
        semesterNo: rule.semesterSequence,
        categoryType,
        subjectCount,
        continuityRule,
        creditRule: metaEntry?.creditRule ?? null,
        optionalFlag: !isCategoryMandatory(metaEntry),
      });
    }
  }
  return lines;
}

export function semesterRulesToRuleLines(
  rules: SemesterRulePayload[],
): Array<RuleLineInput & { semesterNo: number }> {
  return semesterRulesToLines(rules).map((line) => ({
    semesterNo: line.semesterNo,
    categoryType: line.categoryType,
    requiredSubjectCount: line.subjectCount,
    requiredCredits: line.creditRule ?? null,
    continuityRule: line.continuityRule ?? null,
    mandatoryFlag: !line.optionalFlag,
  }));
}

export function linesToSemesterRules(
  lines: TemplateLineInput[],
  totalSemesters = DEFAULT_NEHU_TOTAL_SEMESTERS,
  semesterCreditTarget = DEFAULT_SEMESTER_CREDIT_TARGET,
): SemesterRulePayload[] {
  const bySem = new Map<number, SemesterRulePayload>();
  for (
    let semesterSequence = 1;
    semesterSequence <= totalSemesters;
    semesterSequence += 1
  ) {
    bySem.set(semesterSequence, {
      semesterSequence,
      semesterCreditTarget,
      categoryCounts: {},
      continuityRules: {},
      categoryMeta: {},
    });
  }
  for (const line of lines) {
    const rule = bySem.get(line.semesterNo);
    if (!rule) continue;
    if (line.subjectCount > 0) {
      rule.categoryCounts[line.categoryType] = line.subjectCount;
    }
    if (line.continuityRule) {
      rule.continuityRules[line.categoryType] = line.continuityRule;
    }
    if (line.creditRule != null || line.optionalFlag) {
      rule.categoryMeta ??= {};
      rule.categoryMeta[line.categoryType] = {
        ...(line.creditRule != null
          ? { creditRule: Number(line.creditRule) }
          : {}),
        mandatory: !line.optionalFlag,
      };
    }
  }
  return Array.from(bySem.values()).filter(
    (rule) =>
      Object.keys(rule.categoryCounts).length > 0 ||
      Object.keys(rule.continuityRules).length > 0 ||
      Object.keys(rule.categoryMeta ?? {}).length > 0,
  );
}

export function ruleLinesToSemesterRules(
  lines: Array<
    RuleLineInput & { semesterNo?: number; semesterSequence?: number }
  >,
  totalSemesters = DEFAULT_NEHU_TOTAL_SEMESTERS,
  semesterCreditTarget = DEFAULT_SEMESTER_CREDIT_TARGET,
): SemesterRulePayload[] {
  return linesToSemesterRules(
    lines.map((line) => ({
      semesterNo: line.semesterNo ?? line.semesterSequence ?? 1,
      categoryType: line.categoryType,
      subjectCount: line.requiredSubjectCount,
      continuityRule: line.continuityRule,
      creditRule: line.requiredCredits ?? null,
      optionalFlag: !(line.mandatoryFlag ?? true),
    })),
    totalSemesters,
    semesterCreditTarget,
  );
}

export function defaultNehuTemplateLines(): TemplateLineInput[] {
  return semesterRulesToLines(DEFAULT_FYUGP_SEMESTER_RULES);
}
