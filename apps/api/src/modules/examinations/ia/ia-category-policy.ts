/**
 * Semester-wise subject-category policy for IA exam provisioning.
 * When a policy is present, only offerings whose normalized category is enabled
 * for that semester become papers / marks schemes.
 */

export const IA_SUBJECT_CATEGORIES = [
  'MAJOR',
  'MINOR',
  'AEC',
  'MDC',
  'SEC',
  'VAC',
  'VTC',
  'INTERNSHIP',
] as const;

export type IaSubjectCategory = (typeof IA_SUBJECT_CATEGORIES)[number];

/** Printed FYUGP First IA defaults (VTC & INTERNSHIP off). */
export const FYUGP_PRINTED_IA_CATEGORY_DEFAULTS: Record<
  number,
  IaSubjectCategory[]
> = {
  1: ['MAJOR', 'MINOR', 'AEC', 'MDC', 'SEC', 'VAC'],
  3: ['MAJOR', 'AEC', 'MDC', 'SEC'],
  5: ['MAJOR', 'MINOR'],
};

export type SemesterCategoryMap = Record<number, string[]>;

export function normalizeIaSubjectCategory(
  raw?: string | null,
): IaSubjectCategory | null {
  if (!raw?.trim()) return null;
  const cat = raw
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (cat === 'MAJOR' || cat.startsWith('MAJOR')) return 'MAJOR';
  if (cat === 'MINOR' || cat.startsWith('MINOR')) return 'MINOR';
  if (cat === 'AEC' || cat.startsWith('AEC')) return 'AEC';
  if (cat === 'MDC' || cat.startsWith('MDC')) return 'MDC';
  if (cat === 'SEC' || cat.startsWith('SEC')) return 'SEC';
  if (cat === 'VAC' || cat.startsWith('VAC')) return 'VAC';
  if (cat === 'VTC' || cat.startsWith('VTC')) return 'VTC';
  if (cat === 'INTERNSHIP' || cat.startsWith('INTERNSHIP')) return 'INTERNSHIP';
  return null;
}

export function defaultCategoriesForSemester(semesterNo: number): string[] {
  if (FYUGP_PRINTED_IA_CATEGORY_DEFAULTS[semesterNo]) {
    return [...FYUGP_PRINTED_IA_CATEGORY_DEFAULTS[semesterNo]];
  }
  // Even / other semesters: core academic families on; VTC & INTERNSHIP off.
  return ['MAJOR', 'MINOR', 'AEC', 'MDC', 'SEC', 'VAC'];
}

/**
 * Build a complete semester → enabled categories map.
 * Returns null when no policy was supplied (legacy = include all categories).
 */
export function resolveCategoryPolicy(
  semesterNos: number[],
  raw?: SemesterCategoryMap | null,
  options?: { fillDefaultsWhenEmpty?: boolean },
): SemesterCategoryMap | null {
  if (!raw || !Object.keys(raw).length) {
    if (!options?.fillDefaultsWhenEmpty) return null;
    const filled: SemesterCategoryMap = {};
    for (const sem of semesterNos) {
      filled[sem] = defaultCategoriesForSemester(sem);
    }
    return filled;
  }

  const resolved: SemesterCategoryMap = {};
  for (const sem of semesterNos) {
    const fromRaw = raw[sem] ?? (raw as Record<string, string[]>)[String(sem)];
    if (Array.isArray(fromRaw) && fromRaw.length) {
      const enabled = [
        ...new Set(
          fromRaw
            .map((c) => normalizeIaSubjectCategory(c))
            .filter((c): c is IaSubjectCategory => Boolean(c)),
        ),
      ];
      resolved[sem] = enabled.length
        ? enabled
        : defaultCategoriesForSemester(sem);
    } else {
      resolved[sem] = defaultCategoriesForSemester(sem);
    }
  }
  return resolved;
}

export function isCategoryEnabledForSemester(
  category: string | null | undefined,
  semesterNo: number,
  policy: SemesterCategoryMap | null,
): boolean {
  if (!policy) return true;
  const enabled = policy[semesterNo];
  if (!enabled?.length) return false;
  const normalized = normalizeIaSubjectCategory(category);
  if (!normalized) return false;
  return enabled.includes(normalized);
}

export function filterOfferingsByCategoryPolicy<
  T extends { semesterSequence?: number | null; category?: string | null },
>(offerings: T[], policy: SemesterCategoryMap | null): T[] {
  if (!policy) return offerings;
  return offerings.filter((o) =>
    isCategoryEnabledForSemester(o.category, o.semesterSequence ?? 0, policy),
  );
}

/** Serialize for ExamSession.metadata (string keys). */
export function categoryPolicyToMetadata(
  policy: SemesterCategoryMap | null,
): Record<string, string[]> | null {
  if (!policy) return null;
  const out: Record<string, string[]> = {};
  for (const [sem, cats] of Object.entries(policy)) {
    out[String(sem)] = cats;
  }
  return out;
}

export function categoryPolicyFromMetadata(
  meta: unknown,
  semesterNos: number[],
): SemesterCategoryMap | null {
  if (!meta || typeof meta !== 'object') return null;
  const raw = (meta as Record<string, unknown>).enabledCategoriesBySemester;
  if (!raw || typeof raw !== 'object') return null;
  const map: SemesterCategoryMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const sem = Number(k);
    if (!Number.isFinite(sem) || !Array.isArray(v)) continue;
    map[sem] = v.map(String);
  }
  return resolveCategoryPolicy(semesterNos, map);
}
