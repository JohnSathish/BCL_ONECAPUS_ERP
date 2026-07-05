/**
 * Don Bosco College — Morning Shift Semester 3 BA curriculum (NEHU FYUGP).
 * Pool codes reference the global Course Master; no shift-specific course rows.
 */

import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';
import { DBC_DAY_SEM3_COURSE_TITLES } from './dbc-day-sem3-electives-catalog';
import { buildNehuSem3VtcCourse } from './dbc-vtc-sem3.util';

export const MORNING_SEM3_MDC_CODES = [
  'MDC-210',
  'MDC-211',
  'MDC-212',
  'MDC-213',
  'MDC-215',
] as const;

/** Morning Sem 3 AEC is compulsory — single paper auto-assigned for BA programmes. */
export const MORNING_SEM3_AEC_CODES = ['AEC-222'] as const;

export const MORNING_SEM3_SEC_CODES = [
  'SEC-230',
  'SEC-232',
  'SEC-233',
] as const;

/** Official Morning Shift Sem 3 VTC pool (choose one). */
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

/** Morning-specific MDC eligibility (official DBC Morning Sem 3 sheet). */
export const DBC_MORNING_SEM3_MDC_ELIGIBILITY: Record<
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
  'MDC-212': {},
  'MDC-213': {},
  'MDC-215': {
    excludedMajorSubjectSlugs: ['education'],
    excludedMinorSubjectSlugs: ['education'],
  },
};

/** @deprecated Use DBC_DAY_SEM3_COURSE_TITLES */
export const DBC_SEM3_COURSE_TITLES = DBC_DAY_SEM3_COURSE_TITLES;

/** @deprecated Use DBC_MORNING_SEM3_MDC_ELIGIBILITY */
export const DBC_SEM3_MDC_ELIGIBILITY = DBC_MORNING_SEM3_MDC_ELIGIBILITY;

export function buildDbcMorningSem3VtcCourses(): ArtsFyugpCourseDef[] {
  return MORNING_SEM3_VTC_CODES.map((code) =>
    buildNehuSem3VtcCourse(code, DBC_DAY_SEM3_COURSE_TITLES[code] ?? code),
  );
}

export const MORNING_SEM3_POOL_CATEGORIES = [
  'MDC',
  'AEC',
  'SEC',
  'VTC',
] as const;
