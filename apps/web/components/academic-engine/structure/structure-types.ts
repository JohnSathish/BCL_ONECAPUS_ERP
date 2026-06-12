import {
  NEP_CURRICULUM_CATEGORIES,
  STRUCTURE_CATEGORY_TYPES,
} from '@/constants/nep-curriculum-categories';

export const NEP_CATEGORIES = NEP_CURRICULUM_CATEGORIES;
export { STRUCTURE_CATEGORY_TYPES };

export const DEFAULT_SEMESTER_CREDIT_TARGET = 20;
export const DEFAULT_DEGREE_MIN_CREDITS = 160;

export type RuleDraft = {
  semesterSequence: number;
  categoryCounts: Record<string, number>;
  continuityRules: Record<string, string>;
  categoryMeta?: Record<string, { creditRule?: number; mandatory?: boolean; optional?: boolean }>;
  semesterCreditTarget?: number;
};

export function buildEmptyRules(totalSemesters = 8): RuleDraft[] {
  return Array.from({ length: totalSemesters }, (_, index) => ({
    semesterSequence: index + 1,
    categoryCounts: {},
    continuityRules: {},
    categoryMeta: {},
    semesterCreditTarget: DEFAULT_SEMESTER_CREDIT_TARGET,
  }));
}

export function categoriesForRule(rule: RuleDraft): string[] {
  const set = new Set<string>([
    ...NEP_CATEGORIES,
    ...Object.keys(rule.categoryCounts),
    ...Object.keys(rule.continuityRules),
    ...Object.keys(rule.categoryMeta ?? {}),
  ]);
  return [...set];
}

export function isCategoryMandatory(meta?: {
  creditRule?: number;
  mandatory?: boolean;
  optional?: boolean;
}): boolean {
  if (!meta) return true;
  if (meta.mandatory != null) return meta.mandatory;
  if (meta.optional != null) return !meta.optional;
  return true;
}

export function computeSemesterTotals(rule: RuleDraft): { papers: number; credits: number } {
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

export type ProgramVersionOption = {
  id: string;
  label: string;
  programId: string;
  level?: string | null;
};
export type ProgramOption = {
  id: string;
  code: string;
  name: string;
  level?: string | null;
  versions: ProgramVersionOption[];
};

export function buildProgramOptions(
  programs: Array<{
    id: string;
    code: string;
    name: string;
    level?: string | null;
    versions?: Array<{ id: string; version: number }>;
  }>,
): ProgramOption[] {
  return programs.map((program) => ({
    id: program.id,
    code: program.code,
    name: program.name,
    level: program.level,
    versions: (program.versions ?? []).map((version) => ({
      id: version.id,
      programId: program.id,
      level: program.level,
      label: `${program.code} v${version.version}`,
    })),
  }));
}

export function buildVersionOptions(programs: ProgramOption[]): ProgramVersionOption[] {
  return programs.flatMap((program) => program.versions);
}
