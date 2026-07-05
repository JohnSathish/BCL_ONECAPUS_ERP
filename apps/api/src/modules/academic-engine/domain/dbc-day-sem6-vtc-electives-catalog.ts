/**
 * Don Bosco College — Day Shift Semester 6 VTC pool (NEHU FYUGP).
 * No MDC / AEC / SEC in Sem 6. Stage-III track codes (360.x series).
 */

import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';
import { buildNehuVtcCourse } from './dbc-vtc-sem3.util';

/** Official DBC Day Shift Sem 6 VTC pool (choose one). */
export const DAY_SEM6_VTC_CODES = [
  'VTC-360.3',
  'VTC-361.2',
  'VTC-362.2',
  'VTC-363.1',
  'VTC-363.2',
  'VTC-363.3',
  'VTC-364.2',
  'VTC-365.3',
  'VTC-365.4',
  'VTC-366.1',
  'VTC-369.1',
] as const;

export const DBC_DAY_SEM6_VTC_COURSE_TITLES: Record<string, string> = {
  'VTC-360.3': 'Bee Keeping – III',
  'VTC-361.2': 'Mushroom Cultivation – III',
  'VTC-362.2': 'Electrical – III',
  'VTC-363.1': 'Web Designing – III',
  'VTC-363.2': 'Desktop Publishing – III',
  'VTC-363.3': 'Computerized Accounting – III',
  'VTC-364.2': 'Event Management – III',
  'VTC-365.3': 'Guitar – III',
  'VTC-365.4': 'Vocals – III',
  'VTC-366.1': 'Baking and Confectionery – III',
  'VTC-369.1': 'Photography – III',
};

export function buildDbcDaySem6VtcCourses(): ArtsFyugpCourseDef[] {
  return DAY_SEM6_VTC_CODES.map((code) =>
    buildNehuVtcCourse(code, DBC_DAY_SEM6_VTC_COURSE_TITLES[code] ?? code, 6),
  );
}
