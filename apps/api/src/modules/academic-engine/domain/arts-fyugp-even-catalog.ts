/**
 * NEHU FYUGP EVEN-semester (2 / 4 / 6) course catalog — Semester 2 focus for DBC.
 */

import {
  ARTS_FYUGP_DEPARTMENTS,
  type ArtsFyugpCourseDef,
} from './arts-fyugp-odd-catalog';
import {
  FYUGP_SEM2_PROGRAM_DEPARTMENTS,
  SEM2_MAJOR_TITLES,
} from './fyugp-sem2-departments';

export type { ArtsFyugpCourseDef };

export const MORNING_SEM2_MDC_CODES = [
  'MDC-162',
  'MDC-163',
  'MDC-165',
  'MDC-168',
  'MDC-169',
] as const;

export const MORNING_SEM2_AEC_CODES = ['AEC-170', 'AEC-173'] as const;
export const MORNING_SEM2_SEC_CODES = ['SEC-180', 'SEC-181'] as const;
export const MORNING_SEM2_VAC_CODES = ['VAC-191', 'VAC-192'] as const;

/** Day Shift Sem 2 elective pools (DBC official list). */
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

export const DAY_SEM2_AEC_CODES = ['AEC-170', 'AEC-173'] as const;
export const DAY_SEM2_SEC_CODES = [
  'SEC-180',
  'SEC-181',
  'SEC-182',
  'SEC-183',
] as const;
export const DAY_SEM2_VAC_CODES = ['VAC-190', 'VAC-191', 'VAC-192'] as const;

const MDC_SEM2_TITLES: Record<number, string> = {
  161: 'Entrepreneurship',
  162: 'Environmental Ethics',
  163: 'Fundamentals of Statistics',
  164: 'Health & Hygiene Environmental Education and Disaster Management',
  165: 'Introduction to Educational Psychology',
  167: 'Physical Education and Sports Science',
  168: 'Physical Geology & Geodynamics',
  169: 'Understanding Human Rights',
};

const AEC_SEM2_TITLES: Record<number, string> = {
  170: 'Communicative English',
  173: 'MIL-II: Communicative Garo',
};

const SEC_SEM2_TITLES: Record<number, string> = {
  180: 'Communication Skills',
  181: 'Confidence Building',
  182: 'E-Commerce',
  183: 'Python Programming',
};

const VAC_SEM2_TITLES: Record<number, string> = {
  190: 'Health and Wellness',
  191: 'Life Skills Education',
  192: 'Understanding India',
};

function theoryCourse(
  partial: Omit<
    ArtsFyugpCourseDef,
    'deliveryType' | 'theoryCredits' | 'practicalCredits'
  >,
): ArtsFyugpCourseDef {
  const theoryCredits = partial.credits;
  return {
    ...partial,
    deliveryType: 'THEORY',
    theoryCredits,
    practicalCredits: 0,
    theoryHoursPerWeek: theoryCredits,
    practicalHoursPerWeek: 0,
    totalTheoryContactHours: theoryCredits * 15,
    totalPracticalContactHours: 0,
    totalContactHours: theoryCredits * 15,
  };
}

function poolCourses(
  prefix: string,
  semesterSequence: number,
  category: string,
  credits: number,
  titles: Record<number, string>,
  departmentCode = 'ENG',
  subjectSlug = 'general',
): ArtsFyugpCourseDef[] {
  return Object.entries(titles).map(([num, title]) =>
    theoryCourse({
      code: `${prefix}-${num}`,
      title,
      credits,
      category,
      semesterSequence,
      departmentCode,
      subjectSlug,
      sharedPool: true,
    }),
  );
}

export function buildArtsFyugpEvenCourses(): ArtsFyugpCourseDef[] {
  const courses: ArtsFyugpCourseDef[] = [];

  for (const dept of FYUGP_SEM2_PROGRAM_DEPARTMENTS) {
    courses.push(
      theoryCourse({
        code: `${dept.code}-150`,
        title: dept.sem2MajorTitle,
        credits: 4,
        category: 'MAJOR',
        semesterSequence: 2,
        departmentCode: dept.code,
        subjectSlug: dept.subjectSlug,
        programCode: dept.programCode,
      }),
      theoryCourse({
        code: `${dept.code}-151`,
        title: dept.sem2MajorTitle,
        credits: 4,
        category: 'MINOR',
        semesterSequence: 2,
        departmentCode: dept.code,
        subjectSlug: dept.subjectSlug,
      }),
    );
  }

  courses.push(
    ...poolCourses('MDC', 2, 'MDC', 3, MDC_SEM2_TITLES, 'ENG', 'mdc'),
    ...poolCourses('AEC', 2, 'AEC', 3, AEC_SEM2_TITLES, 'ENG', 'english'),
    ...poolCourses('SEC', 2, 'SEC', 3, SEC_SEM2_TITLES, 'ENG', 'sec'),
    ...poolCourses('VAC', 2, 'VAC', 3, VAC_SEM2_TITLES, 'ENG', 'environment'),
  );

  return courses;
}

/** Sem 2 minor offerings: other departments' -151 papers on each FYUGP programme version. */
export function buildArtsFyugpSem2MinorCourseDefs(
  hostProgramCode: string,
): ArtsFyugpCourseDef[] {
  const host = FYUGP_SEM2_PROGRAM_DEPARTMENTS.find(
    (d) => d.programCode === hostProgramCode,
  );
  if (!host) return [];

  return FYUGP_SEM2_PROGRAM_DEPARTMENTS.filter(
    (d) => d.programCode !== hostProgramCode,
  ).map((dept) =>
    theoryCourse({
      code: `${dept.code}-151`,
      title: dept.sem2MajorTitle,
      credits: 4,
      category: 'MINOR',
      semesterSequence: 2,
      departmentCode: dept.code,
      subjectSlug: dept.subjectSlug,
      programCode: hostProgramCode,
    }),
  );
}

/** @deprecated use FYUGP_SEM2_PROGRAM_DEPARTMENTS */
export { SEM2_MAJOR_TITLES, ARTS_FYUGP_DEPARTMENTS };
