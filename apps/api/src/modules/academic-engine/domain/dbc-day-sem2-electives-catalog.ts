/**
 * Don Bosco College — Day Shift Semester 2 elective pools (NEHU FYUGP).
 * Morning Shift Sem 2 electives are configured separately.
 */

/** Official DBC Day Shift Sem 2 MDC pool (choose one). */
export const DAY_SEM2_MDC_CODES = [
  'MDC-161',
  'MDC-162',
  'MDC-163',
  'MDC-164',
  'MDC-165',
  'MDC-167',
  'MDC-168',
  'MDC-169',
] as const;

/** Official DBC Day Shift Sem 2 AEC pool (choose one). */
export const DAY_SEM2_AEC_CODES = ['AEC-170', 'AEC-173'] as const;

/** Official DBC Day Shift Sem 2 SEC pool (choose one). */
export const DAY_SEM2_SEC_CODES = [
  'SEC-180',
  'SEC-181',
  'SEC-182',
  'SEC-183',
] as const;

/** Official DBC Day Shift Sem 2 VAC pool (choose one). */
export const DAY_SEM2_VAC_CODES = ['VAC-190', 'VAC-191', 'VAC-192'] as const;

/** NEHU / DBC official titles for Day Sem 2 pool courses. */
export const DBC_DAY_SEM2_COURSE_TITLES: Record<string, string> = {
  'MDC-161': 'Entrepreneurship',
  'MDC-162': 'Environmental Ethics',
  'MDC-163': 'Fundamentals of Statistics',
  'MDC-164':
    'Health & Hygiene, Environmental Education and Disaster Management',
  'MDC-165': 'Introduction to Educational Psychology',
  'MDC-167': 'Physical Education and Sports Science',
  'MDC-168': 'Physical Geology & Geodynamics',
  'MDC-169': 'Understanding Human Rights',
  'AEC-170': 'Communicative English',
  'AEC-173': 'MIL-II: Communicative Garo',
  'SEC-180': 'Communication Skills',
  'SEC-181': 'Confidence Building',
  'SEC-182': 'E-Commerce',
  'SEC-183': 'Python Programming',
  'VAC-190': 'Health and Wellness',
  'VAC-191': 'Life Skills Education',
  'VAC-192': 'Understanding India',
};

function titlesByCodeSuffix(codes: readonly string[]): Record<number, string> {
  const out: Record<number, string> = {};
  for (const code of codes) {
    const suffix = Number(code.split('-')[1]);
    out[suffix] = DBC_DAY_SEM2_COURSE_TITLES[code];
  }
  return out;
}

export const DAY_SEM2_MDC_TITLES = titlesByCodeSuffix(DAY_SEM2_MDC_CODES);
export const DAY_SEM2_AEC_TITLES = titlesByCodeSuffix(DAY_SEM2_AEC_CODES);
export const DAY_SEM2_SEC_TITLES = titlesByCodeSuffix(DAY_SEM2_SEC_CODES);
export const DAY_SEM2_VAC_TITLES = titlesByCodeSuffix(DAY_SEM2_VAC_CODES);
