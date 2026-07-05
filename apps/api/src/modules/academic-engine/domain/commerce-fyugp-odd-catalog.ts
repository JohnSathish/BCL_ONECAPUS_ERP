/**
 * NEHU FYUGP Commerce ODD-semester (1 / 3 / 5) course catalog.
 */

import { buildCommerceOddSemCourses } from './commerce-fyugp-nehu.util';
import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';

export type CommerceFyugpDepartment = {
  code: string;
  programCode: string;
  programName: string;
  subjectSlug: string;
};

export const COMMERCE_FYUGP_DEPARTMENTS: CommerceFyugpDepartment[] = [
  {
    code: 'COM',
    programCode: 'BCOM',
    programName: 'FYUP in Commerce',
    subjectSlug: 'commerce',
  },
];

export const COMMERCE_NEHU_ALIGNED_DEPT_CODES = ['COM'] as const;

export function buildCommerceFyugpOddCourses(): ArtsFyugpCourseDef[] {
  return [...buildCommerceOddSemCourses()];
}
