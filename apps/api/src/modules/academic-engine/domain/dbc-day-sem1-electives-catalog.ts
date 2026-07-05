/**
 * Don Bosco College — Day Shift Semester 1 elective pools (NEHU FYUGP).
 * Morning Shift Sem 1 electives are configured separately.
 */

/** Official DBC Day Shift Sem 1 MDC pool (choose one). */
export const DAY_SEM1_MDC_CODES = [
  'MDC-111',
  'MDC-118',
  'MDC-119',
  'MDC-116',
  'MDC-112',
  'MDC-115',
  'MDC-110',
] as const;

/** Official DBC Day Shift Sem 1 AEC pool (choose one). */
export const DAY_SEM1_AEC_CODES = ['AEC-120', 'AEC-123'] as const;

/** Official DBC Day Shift Sem 1 SEC pool (choose one). */
export const DAY_SEM1_SEC_CODES = ['SEC-131', 'SEC-132', 'SEC-133'] as const;

/** Day Shift Sem 1 VAC (compulsory). */
export const DAY_SEM1_VAC_CODES = ['VAC-140'] as const;

/** NEHU / DBC official titles for Day Sem 1 pool courses (overrides global catalog where needed). */
export const DBC_DAY_SEM1_COURSE_TITLES: Record<string, string> = {
  'MDC-110': 'Commercial Arithmetic & Elementary Statistics',
  'MDC-111': 'Culture and Society',
  'MDC-112': 'Fundamentals of Computer Systems',
  'MDC-115': 'Introduction to Life Sciences',
  'MDC-116': 'Introduction to National Cadet Corps',
  'MDC-118': 'Mathematics in Daily Life',
  'MDC-119': 'Philosophy of Culture',
  'AEC-120': 'Alternative English',
  'AEC-123': 'MIL-I: Garo',
  'SEC-131': 'Motivation',
  'SEC-132': 'Personality Development',
  'SEC-133': 'Public Speaking',
  'VAC-140': 'Environmental Studies',
};

export const DBC_DAY_SEM1_MDC_ELIGIBILITY: Record<
  string,
  Record<string, unknown>
> = {
  'MDC-111': {
    class12SubjectExclusions: [
      { subjectSlug: 'geography', label: 'Geography' },
      { subjectSlug: 'sociology', label: 'Sociology' },
    ],
  },
  'MDC-116': { triggersNccEnrollment: true },
  'MDC-119': {
    class12SubjectExclusions: [
      { subjectSlug: 'philosophy', label: 'Philosophy' },
    ],
    excludedMajorSubjectSlugs: ['philosophy'],
  },
};
