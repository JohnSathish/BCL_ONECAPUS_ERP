/**
 * Single source of truth for finalized FYUGP Sem 1–6 course codes and pool names.
 */
import { buildArtsFyugpOddCourses } from './arts-fyugp-odd-catalog';
import { buildArtsFyugpEvenCourses } from './arts-fyugp-even-catalog';
import { buildScienceFyugpOddCourses } from './science-fyugp-odd-catalog';
import { buildScienceFyugpEvenCourses } from './science-fyugp-even-catalog';
import { buildCommerceFyugpOddCourses } from './commerce-fyugp-odd-catalog';
import { buildCommerceFyugpEvenCourses } from './commerce-fyugp-even-catalog';
import { buildDbcDaySem3VtcCourses } from './dbc-day-sem3-electives-catalog';
import { buildDbcDaySem6VtcCourses } from './dbc-day-sem6-vtc-electives-catalog';
import {
  DAY_SEM1_MDC_CODES,
  DAY_SEM1_AEC_CODES,
  DAY_SEM1_SEC_CODES,
  DAY_SEM1_VAC_CODES,
} from './dbc-day-sem1-electives-catalog';
import {
  MORNING_SEM1_MDC_CODES,
  MORNING_SEM1_AEC_CODES,
  MORNING_SEM1_SEC_CODES,
  MORNING_SEM1_VAC_CODES,
} from './dbc-morning-sem1-electives-catalog';
import {
  DAY_SEM2_MDC_CODES,
  DAY_SEM2_AEC_CODES,
  DAY_SEM2_SEC_CODES,
  DAY_SEM2_VAC_CODES,
} from './dbc-day-sem2-electives-catalog';
import {
  MORNING_SEM2_MDC_CODES,
  MORNING_SEM2_AEC_CODES,
  MORNING_SEM2_SEC_CODES,
  MORNING_SEM2_VAC_CODES,
} from './dbc-morning-sem2-electives-catalog';
import {
  DAY_SEM3_MDC_CODES,
  DAY_SEM3_AEC_CODES,
  DAY_SEM3_SEC_CODES,
  DAY_SEM3_VTC_CODES,
} from './dbc-day-sem3-electives-catalog';
import {
  MORNING_SEM3_MDC_CODES,
  MORNING_SEM3_AEC_CODES,
  MORNING_SEM3_SEC_CODES,
  MORNING_SEM3_VTC_CODES,
} from './dbc-morning-sem3-catalog';
import {
  DAY_SEM4_VTC_CODES,
  buildDbcSem4VtcCourses,
} from './dbc-sem4-vtc-electives-catalog';
import { DAY_SEM6_VTC_CODES } from './dbc-day-sem6-vtc-electives-catalog';
import { MORNING_SEM6_VTC_CODES } from './dbc-morning-sem6-vtc-electives-catalog';

export const CANONICAL_POOL_DEFS = [
  {
    poolName: 'Day Shift Sem 1 MDC',
    semesterNo: 1,
    shift: 'DAY',
    categoryType: 'MDC',
    courseCodes: DAY_SEM1_MDC_CODES,
  },
  {
    poolName: 'Day Shift Sem 1 AEC',
    semesterNo: 1,
    shift: 'DAY',
    categoryType: 'AEC',
    courseCodes: DAY_SEM1_AEC_CODES,
  },
  {
    poolName: 'Day Shift Sem 1 SEC',
    semesterNo: 1,
    shift: 'DAY',
    categoryType: 'SEC',
    courseCodes: DAY_SEM1_SEC_CODES,
  },
  {
    poolName: 'Day Shift Sem 1 VAC',
    semesterNo: 1,
    shift: 'DAY',
    categoryType: 'VAC',
    courseCodes: DAY_SEM1_VAC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 1 MDC',
    semesterNo: 1,
    shift: 'MORNING',
    categoryType: 'MDC',
    courseCodes: MORNING_SEM1_MDC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 1 AEC',
    semesterNo: 1,
    shift: 'MORNING',
    categoryType: 'AEC',
    courseCodes: MORNING_SEM1_AEC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 1 SEC',
    semesterNo: 1,
    shift: 'MORNING',
    categoryType: 'SEC',
    courseCodes: MORNING_SEM1_SEC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 1 VAC',
    semesterNo: 1,
    shift: 'MORNING',
    categoryType: 'VAC',
    courseCodes: MORNING_SEM1_VAC_CODES,
  },
  {
    poolName: 'Day Shift Sem 2 MDC',
    semesterNo: 2,
    shift: 'DAY',
    categoryType: 'MDC',
    courseCodes: DAY_SEM2_MDC_CODES,
  },
  {
    poolName: 'Day Shift Sem 2 AEC',
    semesterNo: 2,
    shift: 'DAY',
    categoryType: 'AEC',
    courseCodes: DAY_SEM2_AEC_CODES,
  },
  {
    poolName: 'Day Shift Sem 2 SEC',
    semesterNo: 2,
    shift: 'DAY',
    categoryType: 'SEC',
    courseCodes: DAY_SEM2_SEC_CODES,
  },
  {
    poolName: 'Day Shift Sem 2 VAC',
    semesterNo: 2,
    shift: 'DAY',
    categoryType: 'VAC',
    courseCodes: DAY_SEM2_VAC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 2 MDC',
    semesterNo: 2,
    shift: 'MORNING',
    categoryType: 'MDC',
    courseCodes: MORNING_SEM2_MDC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 2 AEC',
    semesterNo: 2,
    shift: 'MORNING',
    categoryType: 'AEC',
    courseCodes: MORNING_SEM2_AEC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 2 SEC',
    semesterNo: 2,
    shift: 'MORNING',
    categoryType: 'SEC',
    courseCodes: MORNING_SEM2_SEC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 2 VAC',
    semesterNo: 2,
    shift: 'MORNING',
    categoryType: 'VAC',
    courseCodes: MORNING_SEM2_VAC_CODES,
  },
  {
    poolName: 'Day Shift Sem 3 MDC',
    semesterNo: 3,
    shift: 'DAY',
    categoryType: 'MDC',
    courseCodes: DAY_SEM3_MDC_CODES,
  },
  {
    poolName: 'Day Shift Sem 3 AEC',
    semesterNo: 3,
    shift: 'DAY',
    categoryType: 'AEC',
    courseCodes: DAY_SEM3_AEC_CODES,
  },
  {
    poolName: 'Day Shift Sem 3 SEC',
    semesterNo: 3,
    shift: 'DAY',
    categoryType: 'SEC',
    courseCodes: DAY_SEM3_SEC_CODES,
  },
  {
    poolName: 'Day Shift Sem 3 VTC',
    semesterNo: 3,
    shift: 'DAY',
    categoryType: 'VTC',
    courseCodes: DAY_SEM3_VTC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 3 MDC',
    semesterNo: 3,
    shift: 'MORNING',
    categoryType: 'MDC',
    courseCodes: MORNING_SEM3_MDC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 3 AEC',
    semesterNo: 3,
    shift: 'MORNING',
    categoryType: 'AEC',
    courseCodes: MORNING_SEM3_AEC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 3 SEC',
    semesterNo: 3,
    shift: 'MORNING',
    categoryType: 'SEC',
    courseCodes: MORNING_SEM3_SEC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 3 VTC',
    semesterNo: 3,
    shift: 'MORNING',
    categoryType: 'VTC',
    courseCodes: MORNING_SEM3_VTC_CODES,
  },
  {
    poolName: 'Day Shift Sem 4 VTC',
    semesterNo: 4,
    shift: 'DAY',
    categoryType: 'VTC',
    courseCodes: DAY_SEM4_VTC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 4 VTC',
    semesterNo: 4,
    shift: 'MORNING',
    categoryType: 'VTC',
    courseCodes: DAY_SEM4_VTC_CODES,
  },
  {
    poolName: 'Day Shift Sem 6 VTC',
    semesterNo: 6,
    shift: 'DAY',
    categoryType: 'VTC',
    courseCodes: DAY_SEM6_VTC_CODES,
  },
  {
    poolName: 'Morning Shift Sem 6 VTC',
    semesterNo: 6,
    shift: 'MORNING',
    categoryType: 'VTC',
    courseCodes: MORNING_SEM6_VTC_CODES,
  },
] as const;

export const CANONICAL_POOL_NAMES = new Set(
  CANONICAL_POOL_DEFS.map((d) => d.poolName),
);

/** NEHU FYUGP: minor/core papers are offered only in Semesters 2 and 5. */
export const FYUGP_MINOR_SEMESTER_SEQUENCES = [2, 5] as const;

/** Legacy import / demo codes that must never be re-seeded. */
export const LEGACY_EXCLUDED_COURSE_CODES = [
  'BCA-M101',
  'BCA-M201',
  'BCA-M301',
  'BCA-M302',
  'BCA-M501',
  'BCA-M502',
  'MAT-M101',
  'MAT-M201',
  'MDC101',
  'MDC201',
  'MDC301',
  'AEC-ENG',
  'AEC-HIN',
  'AEC-ENG2',
  'SEC-PY',
  'SEC-WEB',
  'SEC-DS',
  'VAC-ENV',
  'VAC-YOGA',
  'VTC301',
] as const;

export function normalizeCourseCode(code: string): string {
  return code
    .trim()
    .replace(/\u2013/g, '-')
    .replace(/^VTC:\s*/i, 'VTC-')
    .replace(/\s+/g, ' ');
}

/** Map obsolete alias codes to canonical NEHU codes. */
export function resolveCanonicalCourseCode(code: string): string {
  const normalized = normalizeCourseCode(code);
  const internshipAlias = normalized.match(/^([A-Z]{3})-304$/);
  if (internshipAlias) return `${internshipAlias[1]}-303`;
  const spacedMinor = normalized.match(/^([A-Z]{3})-302\s+M$/);
  if (spacedMinor) return `${spacedMinor[1]}-302`;
  const variantB = normalized.match(/^([A-Z]{3})-35[23]\s+B$/);
  if (variantB) {
    const num = normalized.includes('352') ? '352' : '353';
    return `${variantB[1]}-${num}`;
  }
  const garoDash = normalized.replace(/^GAR-/i, 'GAR-');
  return garoDash;
}

export function buildCanonicalCourseCodeSet(): Set<string> {
  const defs = [
    ...buildArtsFyugpOddCourses(),
    ...buildArtsFyugpEvenCourses(),
    ...buildScienceFyugpOddCourses(),
    ...buildScienceFyugpEvenCourses(),
    ...buildCommerceFyugpOddCourses(),
    ...buildCommerceFyugpEvenCourses(),
    ...buildDbcDaySem3VtcCourses(),
    ...buildDbcSem4VtcCourses(),
    ...buildDbcDaySem6VtcCourses(),
    ...CANONICAL_POOL_DEFS.flatMap((d) => d.courseCodes),
  ];
  const codes = new Set<string>();
  for (const def of defs) {
    if (typeof def === 'string') codes.add(def);
    else if (def && typeof def === 'object' && 'code' in def) {
      codes.add(def.code);
    }
  }
  return codes;
}

export function legacyPoolToCanonicalName(
  legacyPoolName: string,
  shiftCode: 'DAY' | 'MORNING',
): string | null {
  const match = legacyPoolName.match(
    /^(MDC|AEC|SEC|VAC|VTC) Semester (\d) Pool$/,
  );
  if (!match) return null;
  const [, category, semester] = match;
  const prefix = shiftCode === 'MORNING' ? 'Morning' : 'Day';
  return `${prefix} Shift Sem ${semester} ${category}`;
}

export function poolCodesForName(poolName: string): readonly string[] | null {
  const def = CANONICAL_POOL_DEFS.find((d) => d.poolName === poolName);
  return def?.courseCodes ?? null;
}
