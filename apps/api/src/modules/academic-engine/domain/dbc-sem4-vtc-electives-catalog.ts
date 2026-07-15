/**
 * NEHU FYUGP Semester 4 VTC pools — shared by Day and Morning shifts.
 * No MDC / AEC / SEC in Sem 4. These are the distinct Stage-II courses
 * (VTC-26x, "– II"); they continue the Sem-3 Stage-I track and lead into the
 * Sem-6 Stage-III course. VTC is NOT offered in Semester 5.
 *
 * Traditional Music and Beauty Care are NOT offered by the college, so they
 * have no Stage-II course here.
 */

import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';
import { buildNehuVtcCourse } from './dbc-vtc-sem3.util';

/** Official DBC Sem 4 VTC pool (choose one) — same codes on Day and Morning. */
export const FYUGP_SEM4_VTC_CODES = [
  'VTC-260.3',
  'VTC-261.2',
  'VTC-262.2',
  'VTC-263.1',
  'VTC-263.2',
  'VTC-263.3',
  'VTC-264.2',
  'VTC-265.3',
  'VTC-265.4',
  'VTC-266.1',
  'VTC-269.1',
] as const;

export const DAY_SEM4_VTC_CODES = FYUGP_SEM4_VTC_CODES;
export const MORNING_SEM4_VTC_CODES = FYUGP_SEM4_VTC_CODES;

/** Stage-II titles for Sem 4 VTC pool papers. */
export const DBC_SEM4_VTC_COURSE_TITLES: Record<string, string> = {
  'VTC-260.3': 'Bee Keeping – II',
  'VTC-261.2': 'Mushroom Cultivation – II',
  'VTC-262.2': 'Electrical – II',
  'VTC-263.1': 'Web Designing – II',
  'VTC-263.2': 'Desktop Publishing – II',
  'VTC-263.3': 'Computerized Accounting – II',
  'VTC-264.2': 'Event Management – II',
  'VTC-265.3': 'Guitar – II',
  'VTC-265.4': 'Vocals – II',
  'VTC-266.1': 'Baking and Confectionery – II',
  'VTC-269.1': 'Photography – II',
};

/** Distinct Stage-II VTC course definitions for Sem 4 (4 credits, 1T+3P each). */
export function buildDbcSem4VtcCourses(): ArtsFyugpCourseDef[] {
  return FYUGP_SEM4_VTC_CODES.map((code) =>
    buildNehuVtcCourse(code, DBC_SEM4_VTC_COURSE_TITLES[code] ?? code, 4),
  );
}
