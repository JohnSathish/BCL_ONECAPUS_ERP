/**
 * NEHU FYUGP Commerce EVEN-semester (2 / 4 / 6) course catalog.
 */

import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';
import { GEOGRAPHY_SEM5_MINOR_TITLE } from './geography-fyugp-nehu';
import { MATHEMATICS_SEM5_MINOR_TITLE } from './mathematics-fyugp-nehu';
import {
  buildCommerceHonoursEvenSemCourses,
  buildCommerceSem2Courses,
} from './commerce-fyugp-nehu.util';
import { commerceAllowedMinorDeptCodes } from './commerce-fyugp-major-minor.util';
import {
  COMMERCE_FYUGP_DEPARTMENTS,
  COMMERCE_NEHU_ALIGNED_DEPT_CODES,
} from './commerce-fyugp-odd-catalog';
import {
  FYUGP_SEM2_PROGRAM_DEPARTMENTS,
  SEM2_MAJOR_TITLES,
} from './fyugp-sem2-departments';

export type { ArtsFyugpCourseDef };

const COMMERCE_SEM5_MINOR_BY_DEPT: Record<
  string,
  {
    codeSuffix: string;
    title: string;
    deliveryType: 'THEORY';
    theoryCredits: number;
    practicalCredits: number;
    contactHours: number;
  }
> = {
  ECO: {
    codeSuffix: '302',
    title: 'Indian Economy',
    deliveryType: 'THEORY',
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
  },
  MTH: {
    codeSuffix: '302',
    title: MATHEMATICS_SEM5_MINOR_TITLE,
    deliveryType: 'THEORY',
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
  },
  GEO: {
    codeSuffix: '302',
    title: GEOGRAPHY_SEM5_MINOR_TITLE,
    deliveryType: 'THEORY',
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
  },
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

export function buildCommerceFyugpEvenCourses(): ArtsFyugpCourseDef[] {
  const courses: ArtsFyugpCourseDef[] = [];

  for (const dept of FYUGP_SEM2_PROGRAM_DEPARTMENTS) {
    if (
      dept.stream !== 'COMMERCE' ||
      COMMERCE_NEHU_ALIGNED_DEPT_CODES.includes(
        dept.code as (typeof COMMERCE_NEHU_ALIGNED_DEPT_CODES)[number],
      )
    ) {
      continue;
    }
    const sem2Title = SEM2_MAJOR_TITLES[dept.code];
    if (!sem2Title) continue;
    courses.push(
      theoryCourse({
        code: `${dept.code}-150`,
        title: sem2Title,
        credits: 4,
        category: 'MAJOR',
        semesterSequence: 2,
        departmentCode: dept.code,
        subjectSlug: dept.subjectSlug,
        programCode: dept.programCode,
      }),
      theoryCourse({
        code: `${dept.code}-151`,
        title: sem2Title,
        credits: 4,
        category: 'MINOR',
        semesterSequence: 2,
        departmentCode: dept.code,
        subjectSlug: dept.subjectSlug,
      }),
    );
  }

  courses.push(
    ...buildCommerceSem2Courses(),
    ...buildCommerceHonoursEvenSemCourses(),
  );

  return courses;
}

function allowedMinorDeptCodes(hostProgramCode: string): string[] {
  const host = COMMERCE_FYUGP_DEPARTMENTS.find(
    (dept) => dept.programCode === hostProgramCode,
  );
  if (!host) return [];
  return commerceAllowedMinorDeptCodes(host.code);
}

/** Sem 2 minor offerings filtered by DBC major–minor matrix. */
export function buildCommerceFyugpSem2MinorCourseDefs(
  hostProgramCode: string,
): ArtsFyugpCourseDef[] {
  const allowedCodes = new Set(allowedMinorDeptCodes(hostProgramCode));
  if (!allowedCodes.size) return [];

  return FYUGP_SEM2_PROGRAM_DEPARTMENTS.filter((dept) =>
    allowedCodes.has(dept.code),
  ).map((dept) => {
    const sem2Minor = buildCommerceFyugpEvenCourses().find(
      (course) =>
        course.code === `${dept.code}-151` && course.category === 'MINOR',
    );
    const title =
      sem2Minor?.title ?? SEM2_MAJOR_TITLES[dept.code] ?? `${dept.code}-151`;
    return {
      ...(sem2Minor ??
        theoryCourse({
          code: `${dept.code}-151`,
          title,
          credits: 4,
          category: 'MINOR',
          semesterSequence: 2,
          departmentCode: dept.code,
          subjectSlug: dept.subjectSlug,
        })),
      programCode: hostProgramCode,
      category: 'MINOR',
    };
  });
}

/** Sem 5 cross-department minor offerings for B.Com. */
export function buildCommerceFyugpSem5MinorCourseDefs(
  hostProgramCode: string,
): ArtsFyugpCourseDef[] {
  const allowedCodes = new Set(allowedMinorDeptCodes(hostProgramCode));
  if (!allowedCodes.size) return [];

  return [...allowedCodes].map((deptCode) => {
    const minorDef = COMMERCE_SEM5_MINOR_BY_DEPT[deptCode];
    const dept = FYUGP_SEM2_PROGRAM_DEPARTMENTS.find(
      (d) => d.code === deptCode,
    );
    const code = `${deptCode}-${minorDef.codeSuffix}`;
    return {
      code,
      title: minorDef.title,
      credits: 4,
      category: 'MINOR',
      semesterSequence: 5,
      departmentCode: deptCode,
      subjectSlug: dept?.subjectSlug ?? deptCode.toLowerCase(),
      programCode: hostProgramCode,
      deliveryType: 'THEORY',
      theoryCredits: minorDef.theoryCredits,
      practicalCredits: 0,
      theoryHoursPerWeek: minorDef.theoryCredits,
      practicalHoursPerWeek: 0,
      totalTheoryContactHours: minorDef.contactHours,
      totalPracticalContactHours: 0,
      totalContactHours: minorDef.contactHours,
    };
  });
}
