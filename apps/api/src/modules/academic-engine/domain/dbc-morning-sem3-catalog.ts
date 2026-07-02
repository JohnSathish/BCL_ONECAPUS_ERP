/**
 * Don Bosco College — Morning Shift Semester 3 BA curriculum (NEHU FYUGP).
 * Pool codes reference the global Course Master; no shift-specific course rows.
 */

import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';

export const MORNING_SEM3_MDC_CODES = [
  'MDC-210',
  'MDC-211',
  'MDC-212',
  'MDC-213',
  'MDC-215',
] as const;

export const MORNING_SEM3_AEC_CODES = ['AEC-222'] as const;

export const MORNING_SEM3_SEC_CODES = [
  'SEC-230',
  'SEC-232',
  'SEC-233',
] as const;

export const MORNING_SEM3_VTC_CODES = [
  'VTC-240.3',
  'VTC-241.2',
  'VTC-243.2',
  'VTC-243.3',
  'VTC-244.2',
  'VTC-245.3',
  'VTC-246.1',
  'VTC-248.1',
] as const;

/** NEHU / DBC official titles for Sem 3 shared pool courses. */
export const DBC_SEM3_COURSE_TITLES: Record<string, string> = {
  'MDC-210': 'English Proficiency and Soft Skill Development',
  'MDC-211': 'Gender Studies',
  'MDC-212': 'Financial Literacy',
  'MDC-213': 'National Service Scheme',
  'MDC-215': 'Development of Education in North-East India',
  'AEC-222': 'Introduction to Academic Writing (Arts)',
  'SEC-230': 'Introduction to Translation',
  'SEC-232': 'Conflict Resolution',
  'SEC-233': 'Goods and Service Tax (GST)',
  'VTC-240.3': 'Bee Keeping – I',
  'VTC-241.2': 'Mushroom Cultivation – I',
  'VTC-243.2': 'Desktop Publishing – I',
  'VTC-243.3': 'Computerized Accounting',
  'VTC-244.2': 'Event Management – I',
  'VTC-245.3': 'Guitar – I',
  'VTC-246.1': 'Baking and Confectionery – I',
  'VTC-248.1': 'Photography',
};

export const DBC_SEM3_MDC_ELIGIBILITY: Record<
  string,
  Record<string, unknown>
> = {
  'MDC-210': {
    excludedMajorSubjectSlugs: ['english'],
  },
  'MDC-211': {
    excludedWhenMajorAndClass12: [
      {
        majorSubjectSlug: 'sociology',
        class12SubjectSlug: 'sociology',
        label: 'Sociology',
      },
    ],
  },
  'MDC-215': {
    excludedMajorSubjectSlugs: ['education'],
    excludedMinorSubjectSlugs: ['education'],
  },
};

const VTC_SEM3_CREDITS = 4;

function vtcCourse(code: string, title: string): ArtsFyugpCourseDef {
  return {
    code,
    title,
    credits: VTC_SEM3_CREDITS,
    category: 'VTC',
    semesterSequence: 3,
    departmentCode: 'ENG',
    subjectSlug: 'vtc',
    sharedPool: true,
    deliveryType: 'THEORY',
    theoryCredits: VTC_SEM3_CREDITS,
    practicalCredits: 0,
    theoryHoursPerWeek: VTC_SEM3_CREDITS,
    practicalHoursPerWeek: 0,
    totalTheoryContactHours: VTC_SEM3_CREDITS * 15,
    totalPracticalContactHours: 0,
    totalContactHours: VTC_SEM3_CREDITS * 15,
  };
}

/** Decimal-track VTC papers used by DBC Morning Sem 3 (global master additions). */
export function buildDbcMorningSem3VtcCourses(): ArtsFyugpCourseDef[] {
  return MORNING_SEM3_VTC_CODES.map((code) =>
    vtcCourse(code, DBC_SEM3_COURSE_TITLES[code] ?? code),
  );
}

export const MORNING_SEM3_POOL_CATEGORIES = [
  'MDC',
  'AEC',
  'SEC',
  'VTC',
] as const;
