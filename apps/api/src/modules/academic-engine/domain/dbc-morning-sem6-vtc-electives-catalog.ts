/**
 * Don Bosco College — Morning Shift Semester 6 VTC pool (NEHU FYUGP).
 * No MDC / AEC / SEC in Sem 6. Stage-III track codes (360.x series).
 */

import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';
import { buildNehuVtcCourse } from './dbc-vtc-sem3.util';

/** Official DBC Morning Shift Sem 6 VTC pool (choose one). */
export const MORNING_SEM6_VTC_CODES = [
  'VTC-360.3',
  'VTC-361.2',
  'VTC-363.2',
  'VTC-363.3',
  'VTC-364.2',
  'VTC-365.3',
  'VTC-366.1',
  'VTC-369.1',
] as const;

export const DBC_MORNING_SEM6_VTC_COURSE_TITLES: Record<string, string> = {
  'VTC-360.3': 'Bee Keeping – III',
  'VTC-361.2': 'Mushroom Cultivation – III',
  'VTC-363.2': 'Desktop Publishing – III',
  'VTC-363.3': 'Computerized Accounting',
  'VTC-364.2': 'Event Management – III',
  'VTC-365.3': 'Guitar – I',
  'VTC-366.1': 'Baking and Confectionery – I',
  'VTC-369.1': 'Photography',
};

export function buildDbcMorningSem6VtcCourses(): ArtsFyugpCourseDef[] {
  return MORNING_SEM6_VTC_CODES.map((code) =>
    buildNehuVtcCourse(
      code,
      DBC_MORNING_SEM6_VTC_COURSE_TITLES[code] ?? code,
      6,
    ),
  );
}
