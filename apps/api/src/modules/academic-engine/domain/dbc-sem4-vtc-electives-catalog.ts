/**
 * NEHU FYUGP Semester 4 VTC pools — shared by Day and Morning shifts.
 * No MDC / AEC / SEC in Sem 4. Global course codes match Sem 3 track groups;
 * stage II titles are documented here for display and import resolution.
 */

/** Official DBC Sem 4 VTC pool (choose one) — same codes on Day and Morning. */
export const FYUGP_SEM4_VTC_CODES = [
  'VTC-240.3',
  'VTC-241.2',
  'VTC-242.2',
  'VTC-243.1',
  'VTC-243.2',
  'VTC-243.3',
  'VTC-244.2',
  'VTC-245.3',
  'VTC-245.4',
  'VTC-246.1',
  'VTC-248.1',
] as const;

export const DAY_SEM4_VTC_CODES = FYUGP_SEM4_VTC_CODES;
export const MORNING_SEM4_VTC_CODES = FYUGP_SEM4_VTC_CODES;

/** Stage-II display titles for Sem 4 VTC pool papers. */
export const DBC_SEM4_VTC_COURSE_TITLES: Record<string, string> = {
  'VTC-240.3': 'Bee Keeping – II',
  'VTC-241.2': 'Mushroom Cultivation – II',
  'VTC-242.2': 'Electrical – II',
  'VTC-243.1': 'Web Designing – II',
  'VTC-243.2': 'Desktop Publishing – I',
  'VTC-243.3': 'Computerized Accounting',
  'VTC-244.2': 'Event Management – II',
  'VTC-245.3': 'Guitar – II',
  'VTC-245.4': 'Vocals – II',
  'VTC-246.1': 'Baking and Confectionery – II',
  'VTC-248.1': 'Photography',
};
