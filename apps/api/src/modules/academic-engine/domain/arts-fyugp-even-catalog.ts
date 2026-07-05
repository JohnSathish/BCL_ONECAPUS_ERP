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
import { SCIENCE_NEHU_ALIGNED_DEPT_CODES } from './science-fyugp-odd-catalog';
import { COMMERCE_NEHU_ALIGNED_DEPT_CODES } from './commerce-fyugp-odd-catalog';
import { ECONOMICS_NEHU_PAPERS } from './economics-fyugp-nehu';
import { EDUCATION_NEHU_PAPERS } from './education-fyugp-nehu';
import { ENGLISH_NEHU_PAPERS } from './english-fyugp-nehu';
import { GARO_NEHU_PAPERS } from './garo-fyugp-nehu';
import { buildGeographyHonoursEvenSemCourses } from './geography-fyugp-nehu.util';
import { HISTORY_NEHU_PAPERS } from './history-fyugp-nehu';
import { PHILOSOPHY_NEHU_PAPERS } from './philosophy-fyugp-nehu';
import { POLITICAL_SCIENCE_NEHU_PAPERS } from './political-science-fyugp-nehu';
import { SOCIOLOGY_NEHU_PAPERS } from './sociology-fyugp-nehu';
import { buildNehuHonoursEvenSemCourses } from './fyugp-nehu-honours.util';
import {
  DAY_SEM2_AEC_CODES,
  DAY_SEM2_AEC_TITLES,
  DAY_SEM2_MDC_CODES,
  DAY_SEM2_MDC_TITLES,
  DAY_SEM2_SEC_CODES,
  DAY_SEM2_SEC_TITLES,
  DAY_SEM2_VAC_CODES,
  DAY_SEM2_VAC_TITLES,
} from './dbc-day-sem2-electives-catalog';

export type { ArtsFyugpCourseDef };

export {
  MORNING_SEM2_AEC_CODES,
  MORNING_SEM2_MDC_CODES,
  MORNING_SEM2_SEC_CODES,
  MORNING_SEM2_VAC_CODES,
} from './dbc-morning-sem2-electives-catalog';

export {
  DAY_SEM2_AEC_CODES,
  DAY_SEM2_MDC_CODES,
  DAY_SEM2_SEC_CODES,
  DAY_SEM2_VAC_CODES,
} from './dbc-day-sem2-electives-catalog';

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

export function buildEconomicsHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const economics = ARTS_FYUGP_DEPARTMENTS.find((dept) => dept.code === 'ECO');
  if (!economics) return [];
  return buildNehuHonoursEvenSemCourses(economics, ECONOMICS_NEHU_PAPERS);
}

export function buildEducationHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const education = ARTS_FYUGP_DEPARTMENTS.find((dept) => dept.code === 'EDN');
  if (!education) return [];
  return buildNehuHonoursEvenSemCourses(education, EDUCATION_NEHU_PAPERS);
}

export function buildEnglishHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const english = ARTS_FYUGP_DEPARTMENTS.find((dept) => dept.code === 'ENG');
  if (!english) return [];
  return buildNehuHonoursEvenSemCourses(english, ENGLISH_NEHU_PAPERS);
}

export function buildGaroHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const garo = ARTS_FYUGP_DEPARTMENTS.find((dept) => dept.code === 'GAR');
  if (!garo) return [];
  return buildNehuHonoursEvenSemCourses(garo, GARO_NEHU_PAPERS);
}

export function buildHistoryHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const history = ARTS_FYUGP_DEPARTMENTS.find((dept) => dept.code === 'HIS');
  if (!history) return [];
  return buildNehuHonoursEvenSemCourses(history, HISTORY_NEHU_PAPERS);
}

export function buildPhilosophyHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const philosophy = ARTS_FYUGP_DEPARTMENTS.find((dept) => dept.code === 'PHI');
  if (!philosophy) return [];
  return buildNehuHonoursEvenSemCourses(philosophy, PHILOSOPHY_NEHU_PAPERS);
}

export function buildPoliticalScienceHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const politicalScience = ARTS_FYUGP_DEPARTMENTS.find(
    (dept) => dept.code === 'POL',
  );
  if (!politicalScience) return [];
  return buildNehuHonoursEvenSemCourses(
    politicalScience,
    POLITICAL_SCIENCE_NEHU_PAPERS,
  );
}

export function buildSociologyHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const sociology = ARTS_FYUGP_DEPARTMENTS.find((dept) => dept.code === 'SOC');
  if (!sociology) return [];
  return buildNehuHonoursEvenSemCourses(sociology, SOCIOLOGY_NEHU_PAPERS);
}

export function buildArtsFyugpEvenCourses(): ArtsFyugpCourseDef[] {
  const courses: ArtsFyugpCourseDef[] = [];

  for (const dept of FYUGP_SEM2_PROGRAM_DEPARTMENTS) {
    if (
      SCIENCE_NEHU_ALIGNED_DEPT_CODES.includes(
        dept.code as (typeof SCIENCE_NEHU_ALIGNED_DEPT_CODES)[number],
      ) ||
      COMMERCE_NEHU_ALIGNED_DEPT_CODES.includes(
        dept.code as (typeof COMMERCE_NEHU_ALIGNED_DEPT_CODES)[number],
      )
    ) {
      continue;
    }
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
    ...poolCourses('MDC', 2, 'MDC', 3, DAY_SEM2_MDC_TITLES, 'ENG', 'mdc'),
    ...poolCourses('AEC', 2, 'AEC', 3, DAY_SEM2_AEC_TITLES, 'ENG', 'english'),
    ...poolCourses('SEC', 2, 'SEC', 3, DAY_SEM2_SEC_TITLES, 'ENG', 'sec'),
    ...poolCourses(
      'VAC',
      2,
      'VAC',
      3,
      DAY_SEM2_VAC_TITLES,
      'ENG',
      'environment',
    ),
    ...buildEconomicsHonoursEvenSemCourses(),
    ...buildEducationHonoursEvenSemCourses(),
    ...buildEnglishHonoursEvenSemCourses(),
    ...buildGaroHonoursEvenSemCourses(),
    ...buildGeographyHonoursEvenSemCourses(),
    ...buildHistoryHonoursEvenSemCourses(),
    ...buildPhilosophyHonoursEvenSemCourses(),
    ...buildPoliticalScienceHonoursEvenSemCourses(),
    ...buildSociologyHonoursEvenSemCourses(),
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
