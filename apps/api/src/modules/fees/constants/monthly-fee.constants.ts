export const MONTHLY_DEMAND_TYPE = 'MONTHLY_TUITION';
export const ADMISSION_DEMAND_TYPE = 'ADMISSION_SESSION';

export const DON_BOSCO_MONTHLY_PLANS = [
  {
    code: 'ARTS_MORNING',
    name: 'FYUP Arts — Morning',
    majorSlug: 'arts',
    shiftCodes: ['MORNING'],
    lines: [
      { code: 'TUITION', name: 'Tuition Fee', amount: 100 },
      { code: 'COLLEGE_FEE', name: 'College Fee', amount: 600 },
    ],
  },
  {
    code: 'ARTS_DAY',
    name: 'FYUP Arts — Day',
    majorSlug: 'arts',
    shiftCodes: ['DAY'],
    lines: [
      { code: 'TUITION', name: 'Tuition Fee', amount: 100 },
      { code: 'COLLEGE_FEE', name: 'College Fee', amount: 850 },
    ],
  },
  {
    code: 'ARTS_GEO_PRACTICAL',
    name: 'Arts with Geography Practical',
    majorSlug: 'geography',
    shiftCodes: ['*'],
    lines: [
      { code: 'TUITION', name: 'Tuition Fee', amount: 100 },
      { code: 'COLLEGE_FEE', name: 'College Fee', amount: 800 },
      { code: 'LAB_FEE', name: 'Lab Fee', amount: 200 },
    ],
  },
  {
    code: 'COMMERCE',
    name: 'Commerce Major',
    majorSlug: 'commerce',
    shiftCodes: ['*'],
    lines: [
      { code: 'TUITION', name: 'Tuition Fee', amount: 100 },
      { code: 'COLLEGE_FEE', name: 'College Fee', amount: 900 },
    ],
  },
  {
    code: 'SCIENCE',
    name: 'Science Major',
    majorSlug: 'science',
    shiftCodes: ['*'],
    lines: [
      { code: 'TUITION', name: 'Tuition Fee', amount: 100 },
      { code: 'COLLEGE_FEE', name: 'College Fee', amount: 900 },
      { code: 'LAB_FEE', name: 'Lab Fee', amount: 450 },
      { code: 'LAB_EXPENDABLES', name: 'Lab Expendables', amount: 350 },
    ],
  },
] as const;

export const VTC_MONTHLY_MODIFIER = {
  code: 'VTC',
  name: 'VTC Subject',
  ruleType: 'VTC',
  amount: 100,
};

/**
 * Lab lines on the Science plan. Charged once, never per subject, and never
 * a second time on top of these lines. 2024 B.Sc. Sem V–VI due list:
 * ₹1,000 without a lab, ₹1,800 with a lab, +₹100 when the student has VTC.
 * Year-3 admission/session fee stays ₹9,500.
 *
 * Botany, Chemistry, and Zoology on that list are always ₹1,800 (or ₹1,900
 * with VTC). Mathematics and Physics are ₹1,000 unless a real practical paper
 * is registered. Internship is not a lab paper.
 */
export const SCIENCE_PRACTICAL_LAB_LINE_CODES = [
  'LAB_FEE',
  'LAB_EXPENDABLES',
] as const;

const SCIENCE_NON_LAB_DELIVERY = new Set([
  'INTERNSHIP',
  'PROJECT',
  'FIELD_WORK',
  'DISSERTATION',
  'SEMINAR',
  'VIVA',
  'APPRENTICESHIP',
  'COMMUNITY_ENGAGEMENT',
]);

export function applySciencePracticalLabLines<T extends { code: string }>(
  lines: T[],
  practicalSubjectCount: number,
): T[] {
  if (practicalSubjectCount > 0) return lines;
  const lab = new Set<string>(SCIENCE_PRACTICAL_LAB_LINE_CODES);
  return lines.filter((line) => !lab.has(line.code));
}

/** Botany, Chemistry, and Zoology pay the lab package even in a theory-only semester. */
export function scienceHonoursIncludesLab(input: {
  programCode?: string | null;
  majorSlug?: string | null;
}): boolean {
  const code = (input.programCode ?? '').toUpperCase();
  const tokens = (input.majorSlug ?? '')
    .toLowerCase()
    .split(/[-_\s/]+/)
    .filter(Boolean);
  if (code.startsWith('BSC-BOT') || tokens.includes('botany')) return true;
  if (
    code.startsWith('BSC-CHE') ||
    code.startsWith('BSC-CHM') ||
    tokens.includes('chemistry')
  ) {
    return true;
  }
  if (code.startsWith('BSC-ZOO') || tokens.includes('zoology')) return true;
  return false;
}

/** A registered paper that should add the ₹800 lab package. Internship does not. */
export function isBillableScienceLabCourse(
  course?: {
    hasPractical?: boolean | null;
    deliveryType?: string | null;
    practicalCredits?: unknown;
  } | null,
): boolean {
  if (!course) return false;
  const delivery = String(course.deliveryType ?? '').toUpperCase();
  if (SCIENCE_NON_LAB_DELIVERY.has(delivery)) return false;
  if (course.hasPractical) return true;
  return Number(course.practicalCredits ?? 0) > 0;
}
