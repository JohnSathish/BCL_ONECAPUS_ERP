/**
 * Don Bosco College — Day Shift Semester 3 elective pools (NEHU FYUGP).
 * Morning Shift Sem 3 electives are configured separately.
 */

import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';
import { buildNehuSem3VtcCourse } from './dbc-vtc-sem3.util';

/** Official DBC Day Shift Sem 3 MDC pool (choose one). */
export const DAY_SEM3_MDC_CODES = [
  'MDC-210',
  'MDC-211',
  'MDC-212',
  'MDC-213',
  'MDC-214',
  'MDC-215',
] as const;

/** Official DBC Day Shift Sem 3 AEC pool (choose one). */
export const DAY_SEM3_AEC_CODES = ['AEC-220', 'AEC-221', 'AEC-222'] as const;

/** Official DBC Day Shift Sem 3 SEC pool (choose one). */
export const DAY_SEM3_SEC_CODES = [
  'SEC-230',
  'SEC-232',
  'SEC-233',
  'SEC-234',
] as const;

/** Official DBC Day Shift Sem 3 VTC pool (choose one). */
export const DAY_SEM3_VTC_CODES = [
  'VTC-240.3',
  'VTC-241.2',
  'VTC-242.2',
  'VTC-243.1',
  'VTC-243.2',
  'VTC-243.3',
  'VTC-244.2',
  'VTC-245.3',
  'VTC-245.4',
  'VTC-245.5',
  'VTC-246.1',
  'VTC-247.1',
  'VTC-248.1',
] as const;

/** NEHU / DBC official titles for Day Sem 3 pool courses. */
export const DBC_DAY_SEM3_COURSE_TITLES: Record<string, string> = {
  'MDC-210': 'English Proficiency and Soft Skill Development',
  'MDC-211': 'Gender Studies',
  'MDC-212': 'Financial Literacy',
  'MDC-213': 'National Service Scheme',
  'MDC-214': 'Physics Around Us',
  'MDC-215': 'Development of Education in North-East India',
  'AEC-220': 'Critical Reading (Science)',
  'AEC-221': 'Introduction to Academic Writing (Commerce)',
  'AEC-222': 'Introduction to Academic Writing (Arts)',
  'SEC-230': 'Introduction to Translation',
  'SEC-232': 'Conflict Resolution',
  'SEC-233': 'Goods and Service Tax (GST)',
  'SEC-234': 'Analytical Thinking',
  'VTC-240.3': 'Bee Keeping – I',
  'VTC-241.2': 'Mushroom Cultivation – I',
  'VTC-242.2': 'Electrical – I',
  'VTC-243.1': 'Web Designing – I',
  'VTC-243.2': 'Desktop Publishing – I',
  'VTC-243.3': 'Computerized Accounting',
  'VTC-244.2': 'Event Management – I',
  'VTC-245.3': 'Guitar – I',
  'VTC-245.4': 'Vocals – I',
  'VTC-245.5': 'Garo Traditional Music – I',
  'VTC-246.1': 'Baking and Confectionery – I',
  'VTC-247.1': 'Beauty Care – I',
  'VTC-248.1': 'Photography',
};

export const DBC_DAY_SEM3_MDC_ELIGIBILITY: Record<
  string,
  Record<string, unknown>
> = {
  'MDC-210': {
    allowedStreams: ['SCIENCE', 'COMMERCE'],
    excludedMajorSubjectSlugs: ['english'],
  },
  'MDC-213': {
    allowedStreams: ['ARTS'],
  },
  'MDC-215': {
    allowedStreams: ['SCIENCE', 'COMMERCE'],
    excludedMajorSubjectSlugs: ['education'],
    excludedMinorSubjectSlugs: ['education'],
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
};

export const DBC_DAY_SEM3_AEC_ELIGIBILITY: Record<
  string,
  Record<string, unknown>
> = {
  'AEC-220': { allowedStreams: ['SCIENCE'] },
  'AEC-221': { allowedStreams: ['COMMERCE'] },
  'AEC-222': { allowedStreams: ['ARTS'] },
};

/** Decimal-track VTC papers for DBC Day Sem 3 (4 credits, 1T+3P each). */
export function buildDbcDaySem3VtcCourses(): ArtsFyugpCourseDef[] {
  return DAY_SEM3_VTC_CODES.map((code) =>
    buildNehuSem3VtcCourse(code, DBC_DAY_SEM3_COURSE_TITLES[code] ?? code),
  );
}
