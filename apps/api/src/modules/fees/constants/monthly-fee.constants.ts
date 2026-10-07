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
 * Lab lines on the Science plan. Charged once when the student has at least
 * one practical subject. 2024 B.Sc. Sem V–VI due list:
 * ₹1,000 without a practical (tuition 100 + college 900),
 * ₹1,800 with a practical (+ lab 450 + expendables 350),
 * ₹1,100 / ₹1,900 when VTC (+₹100) is also taken.
 * The lab package is not multiplied per subject and is not added again
 * on top of these plan lines. Year-3 admission/session fee stays ₹9,500.
 */
export const SCIENCE_PRACTICAL_LAB_LINE_CODES = [
  'LAB_FEE',
  'LAB_EXPENDABLES',
] as const;

export function applySciencePracticalLabLines<T extends { code: string }>(
  lines: T[],
  practicalSubjectCount: number,
): T[] {
  if (practicalSubjectCount > 0) return lines;
  const lab = new Set<string>(SCIENCE_PRACTICAL_LAB_LINE_CODES);
  return lines.filter((line) => !lab.has(line.code));
}
