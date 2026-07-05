/**
 * Don Bosco College — Morning Shift Semester 2 elective pools (NEHU FYUGP).
 * BA programmes only; pool codes reference the global Course Master.
 */

/** Official DBC Morning Shift Sem 2 MDC pool (choose one). */
export const MORNING_SEM2_MDC_CODES = [
  'MDC-162',
  'MDC-163',
  'MDC-165',
  'MDC-168',
  'MDC-169',
] as const;

/** Official DBC Morning Shift Sem 2 AEC pool (choose one). */
export const MORNING_SEM2_AEC_CODES = ['AEC-170', 'AEC-173'] as const;

/** Official DBC Morning Shift Sem 2 SEC pool (choose one). */
export const MORNING_SEM2_SEC_CODES = ['SEC-180', 'SEC-181'] as const;

/** Official DBC Morning Shift Sem 2 VAC pool (choose one). */
export const MORNING_SEM2_VAC_CODES = ['VAC-191', 'VAC-192'] as const;

/** NEHU / DBC official titles for Morning Sem 2 pool courses. */
export const DBC_MORNING_SEM2_COURSE_TITLES: Record<string, string> = {
  'MDC-162': 'Environmental Ethics',
  'MDC-163': 'Fundamentals of Statistics',
  'MDC-165': 'Introduction to Educational Psychology',
  'MDC-168': 'Physical Geology & Geodynamics',
  'MDC-169': 'Understanding Human Rights',
  'AEC-170': 'Communicative English',
  'AEC-173': 'MIL-II: Communicative Garo',
  'SEC-180': 'Communication Skills',
  'SEC-181': 'Confidence Building',
  'VAC-191': 'Life Skills Education',
  'VAC-192': 'Understanding India',
};
