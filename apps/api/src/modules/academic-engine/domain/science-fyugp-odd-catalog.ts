/**
 * NEHU FYUGP Science ODD-semester (1 / 3 / 5) course catalog.
 */

import { buildBotanyOddSemCourses } from './botany-fyugp-nehu.util';
import { buildChemistryOddSemCourses } from './chemistry-fyugp-nehu.util';
import { buildMathematicsOddSemCourses } from './mathematics-fyugp-nehu.util';
import { buildPhysicsOddSemCourses } from './physics-fyugp-nehu.util';
import { buildZoologyOddSemCourses } from './zoology-fyugp-nehu.util';
import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';

export type ScienceFyugpDepartment = {
  code: string;
  programCode: string;
  programName: string;
  subjectSlug: string;
};

export const SCIENCE_FYUGP_DEPARTMENTS: ScienceFyugpDepartment[] = [
  {
    code: 'BOT',
    programCode: 'BSC-BOT',
    programName: 'FYUP in Botany',
    subjectSlug: 'botany',
  },
  {
    code: 'CHE',
    programCode: 'BSC-CHE',
    programName: 'FYUP in Chemistry',
    subjectSlug: 'chemistry',
  },
  {
    code: 'MTH',
    programCode: 'BSC-MTH',
    programName: 'FYUP in Mathematics',
    subjectSlug: 'mathematics',
  },
  {
    code: 'PHY',
    programCode: 'BSC-PHY',
    programName: 'FYUP in Physics',
    subjectSlug: 'physics',
  },
  {
    code: 'ZOO',
    programCode: 'BSC-ZOO',
    programName: 'FYUP in Zoology',
    subjectSlug: 'zoology',
  },
];

/** Science departments with dedicated NEHU reference modules (skip generic even-sem builders). */
export const SCIENCE_NEHU_ALIGNED_DEPT_CODES = [
  'BOT',
  'CHE',
  'MTH',
  'PHY',
  'ZOO',
] as const;

export function buildScienceFyugpOddCourses(): ArtsFyugpCourseDef[] {
  return [
    ...buildBotanyOddSemCourses(),
    ...buildChemistryOddSemCourses(),
    ...buildMathematicsOddSemCourses(),
    ...buildPhysicsOddSemCourses(),
    ...buildZoologyOddSemCourses(),
  ];
}
