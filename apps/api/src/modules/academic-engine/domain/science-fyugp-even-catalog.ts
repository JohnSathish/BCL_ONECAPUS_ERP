/**
 * NEHU FYUGP Science EVEN-semester (2 / 4 / 6) course catalog.
 */

import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';
import {
  BOTANY_SEM5_MINOR_CODE,
  BOTANY_SEM5_MINOR_TITLE,
} from './botany-fyugp-nehu';
import {
  buildBotanyHonoursEvenSemCourses,
  buildBotanySem2Courses,
} from './botany-fyugp-nehu.util';
import {
  CHEMISTRY_SEM5_MINOR_CODE,
  CHEMISTRY_SEM5_MINOR_TITLE,
} from './chemistry-fyugp-nehu';
import {
  buildChemistryHonoursEvenSemCourses,
  buildChemistrySem2Courses,
} from './chemistry-fyugp-nehu.util';
import {
  MATHEMATICS_SEM5_MINOR_CODE,
  MATHEMATICS_SEM5_MINOR_TITLE,
} from './mathematics-fyugp-nehu';
import {
  buildMathematicsHonoursEvenSemCourses,
  buildMathematicsSem2Courses,
} from './mathematics-fyugp-nehu.util';
import {
  PHYSICS_SEM5_MINOR_CODE,
  PHYSICS_SEM5_MINOR_TITLE,
} from './physics-fyugp-nehu';
import {
  buildPhysicsHonoursEvenSemCourses,
  buildPhysicsSem2Courses,
} from './physics-fyugp-nehu.util';
import {
  ZOOLOGY_SEM5_MINOR_CODE,
  ZOOLOGY_SEM5_MINOR_TITLE,
} from './zoology-fyugp-nehu';
import {
  buildZoologyHonoursEvenSemCourses,
  buildZoologySem2Courses,
} from './zoology-fyugp-nehu.util';
import {
  SCIENCE_FYUGP_DEPARTMENTS,
  SCIENCE_NEHU_ALIGNED_DEPT_CODES,
} from './science-fyugp-odd-catalog';
import { scienceAllowedMinorDeptCodes } from './science-fyugp-major-minor.util';
import {
  FYUGP_SEM2_PROGRAM_DEPARTMENTS,
  SEM2_MAJOR_TITLES,
} from './fyugp-sem2-departments';

export type { ArtsFyugpCourseDef };

const SCIENCE_SEM5_MINOR_BY_DEPT: Record<
  string,
  {
    codeSuffix: string;
    title: string;
    deliveryType: 'THEORY' | 'THEORY_PRACTICAL';
    theoryCredits: number;
    practicalCredits: number;
    contactHours: number;
  }
> = {
  BOT: {
    codeSuffix: BOTANY_SEM5_MINOR_CODE,
    title: BOTANY_SEM5_MINOR_TITLE,
    deliveryType: 'THEORY_PRACTICAL',
    theoryCredits: 3,
    practicalCredits: 1,
    contactHours: 75,
  },
  CHE: {
    codeSuffix: CHEMISTRY_SEM5_MINOR_CODE,
    title: CHEMISTRY_SEM5_MINOR_TITLE,
    deliveryType: 'THEORY_PRACTICAL',
    theoryCredits: 3,
    practicalCredits: 1,
    contactHours: 75,
  },
  MTH: {
    codeSuffix: MATHEMATICS_SEM5_MINOR_CODE,
    title: MATHEMATICS_SEM5_MINOR_TITLE,
    deliveryType: 'THEORY',
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
  },
  PHY: {
    codeSuffix: PHYSICS_SEM5_MINOR_CODE,
    title: PHYSICS_SEM5_MINOR_TITLE,
    deliveryType: 'THEORY',
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
  },
  ZOO: {
    codeSuffix: ZOOLOGY_SEM5_MINOR_CODE,
    title: ZOOLOGY_SEM5_MINOR_TITLE,
    deliveryType: 'THEORY_PRACTICAL',
    theoryCredits: 3,
    practicalCredits: 1,
    contactHours: 75,
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

export function buildScienceFyugpEvenCourses(): ArtsFyugpCourseDef[] {
  const courses: ArtsFyugpCourseDef[] = [];

  for (const dept of FYUGP_SEM2_PROGRAM_DEPARTMENTS) {
    if (
      dept.stream !== 'SCIENCE' ||
      SCIENCE_NEHU_ALIGNED_DEPT_CODES.includes(
        dept.code as (typeof SCIENCE_NEHU_ALIGNED_DEPT_CODES)[number],
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
    ...buildBotanySem2Courses(),
    ...buildBotanyHonoursEvenSemCourses(),
    ...buildChemistrySem2Courses(),
    ...buildChemistryHonoursEvenSemCourses(),
    ...buildMathematicsSem2Courses(),
    ...buildMathematicsHonoursEvenSemCourses(),
    ...buildPhysicsSem2Courses(),
    ...buildPhysicsHonoursEvenSemCourses(),
    ...buildZoologySem2Courses(),
    ...buildZoologyHonoursEvenSemCourses(),
  );

  return courses;
}

function allowedMinorDeptCodes(hostProgramCode: string): string[] {
  const host = SCIENCE_FYUGP_DEPARTMENTS.find(
    (dept) => dept.programCode === hostProgramCode,
  );
  if (!host) return [];
  return scienceAllowedMinorDeptCodes(host.code);
}

/** Sem 2 minor offerings filtered by DBC major–minor matrix. */
export function buildScienceFyugpSem2MinorCourseDefs(
  hostProgramCode: string,
): ArtsFyugpCourseDef[] {
  const allowedCodes = new Set(allowedMinorDeptCodes(hostProgramCode));
  if (!allowedCodes.size) return [];

  return FYUGP_SEM2_PROGRAM_DEPARTMENTS.filter(
    (dept) => dept.stream === 'SCIENCE' && allowedCodes.has(dept.code),
  ).map((dept) => {
    const sem2Minor = buildScienceFyugpEvenCourses().find(
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

/** Sem 5 cross-department minor offerings for science programmes. */
export function buildScienceFyugpSem5MinorCourseDefs(
  hostProgramCode: string,
): ArtsFyugpCourseDef[] {
  const allowedCodes = new Set(allowedMinorDeptCodes(hostProgramCode));
  if (!allowedCodes.size) return [];

  return SCIENCE_FYUGP_DEPARTMENTS.filter(
    (dept) =>
      dept.programCode !== hostProgramCode && allowedCodes.has(dept.code),
  ).map((dept) => {
    const minorDef = SCIENCE_SEM5_MINOR_BY_DEPT[dept.code];
    if (!minorDef) {
      return theoryCourse({
        code: `${dept.code}-303`,
        title: `${dept.programName} Minor Paper`,
        credits: 4,
        category: 'MINOR',
        semesterSequence: 5,
        departmentCode: dept.code,
        subjectSlug: dept.subjectSlug,
        programCode: hostProgramCode,
      });
    }

    const code = `${dept.code}-${minorDef.codeSuffix}`;
    if (minorDef.deliveryType === 'THEORY_PRACTICAL') {
      return {
        code,
        title: minorDef.title,
        credits: 4,
        category: 'MINOR',
        semesterSequence: 5,
        departmentCode: dept.code,
        subjectSlug: dept.subjectSlug,
        programCode: hostProgramCode,
        deliveryType: 'THEORY_PRACTICAL',
        theoryCredits: minorDef.theoryCredits,
        practicalCredits: minorDef.practicalCredits,
        theoryHoursPerWeek: minorDef.theoryCredits,
        practicalHoursPerWeek: minorDef.practicalCredits,
        totalTheoryContactHours: minorDef.theoryCredits * 15,
        totalPracticalContactHours: minorDef.practicalCredits * 30,
        totalContactHours: minorDef.contactHours,
      };
    }

    return theoryCourse({
      code,
      title: minorDef.title,
      credits: 4,
      category: 'MINOR',
      semesterSequence: 5,
      departmentCode: dept.code,
      subjectSlug: dept.subjectSlug,
      programCode: hostProgramCode,
    });
  });
}
