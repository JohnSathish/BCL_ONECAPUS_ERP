import {
  PHYSICS_NEHU_META,
  PHYSICS_NEHU_PAPERS,
  type PhysicsNehuPaper,
} from './physics-fyugp-nehu';
import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';

const PRACTICAL_HOURS_DIVISOR = 15;

function physicsPaperToCourseDef(
  paper: PhysicsNehuPaper,
  majorPaperIndex?: number,
): ArtsFyugpCourseDef {
  const base = {
    code: paper.code,
    title: paper.title,
    credits: paper.credits,
    category: paper.category,
    semesterSequence: paper.semester,
    departmentCode: PHYSICS_NEHU_META.departmentCode,
    subjectSlug: PHYSICS_NEHU_META.subjectSlug,
    programCode: PHYSICS_NEHU_META.programCode,
    ...(majorPaperIndex ? { majorPaperIndex } : {}),
  };

  if (paper.deliveryKind === 'INTERNSHIP') {
    return {
      ...base,
      deliveryType: 'INTERNSHIP',
      creditCalculationMode: 'MANUAL_OVERRIDE',
      theoryCredits: 0,
      practicalCredits: paper.practicalCredits,
      theoryHoursPerWeek: 0,
      practicalHoursPerWeek: 0,
      totalTheoryContactHours: 0,
      totalPracticalContactHours: paper.contactHours,
      totalContactHours: paper.contactHours,
    };
  }

  if (paper.deliveryKind === 'PRACTICAL') {
    const practicalHoursPerWeek = Math.round(
      paper.contactHours / PRACTICAL_HOURS_DIVISOR,
    );
    return {
      ...base,
      deliveryType: 'PRACTICAL',
      theoryCredits: 0,
      practicalCredits: paper.practicalCredits,
      theoryHoursPerWeek: 0,
      practicalHoursPerWeek: practicalHoursPerWeek,
      totalTheoryContactHours: 0,
      totalPracticalContactHours: paper.contactHours,
      totalContactHours: paper.contactHours,
    };
  }

  if (paper.deliveryKind === 'THEORY') {
    return {
      ...base,
      deliveryType: 'THEORY',
      theoryCredits: paper.theoryCredits,
      practicalCredits: 0,
      theoryHoursPerWeek: paper.theoryCredits,
      practicalHoursPerWeek: 0,
      totalTheoryContactHours: paper.contactHours,
      totalPracticalContactHours: 0,
      totalContactHours: paper.contactHours,
    };
  }

  return {
    ...base,
    deliveryType: 'THEORY_PRACTICAL',
    theoryCredits: paper.theoryCredits,
    practicalCredits: paper.practicalCredits,
    theoryHoursPerWeek: paper.theoryCredits,
    practicalHoursPerWeek: paper.practicalCredits,
    totalTheoryContactHours: paper.theoryCredits * 15,
    totalPracticalContactHours: paper.practicalCredits * 30,
    totalContactHours: paper.contactHours,
  };
}

/** Sem 1 / 3 / 5 Physics major + internship courses. */
export function buildPhysicsOddSemCourses(): ArtsFyugpCourseDef[] {
  const oddSemesters = [1, 3, 5] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of oddSemesters) {
    const papers = PHYSICS_NEHU_PAPERS.filter(
      (paper) =>
        paper.semester === semester &&
        (paper.category === 'MAJOR' || paper.category === 'INTERNSHIP'),
    );
    papers.forEach((paper, index) => {
      courses.push(
        physicsPaperToCourseDef(
          paper,
          paper.category === 'MAJOR' ? index + 1 : undefined,
        ),
      );
    });
  }

  return courses;
}

/** Sem 2 Physics major (PHY-150) and cross-programme minor slot (PHY-151). */
export function buildPhysicsSem2Courses(): ArtsFyugpCourseDef[] {
  const sem2Major = PHYSICS_NEHU_PAPERS.find(
    (paper) => paper.semester === 2 && paper.category === 'MAJOR',
  );
  if (!sem2Major) return [];

  const major = physicsPaperToCourseDef(sem2Major, 1);
  const minor: ArtsFyugpCourseDef = {
    ...major,
    code: 'PHY-151',
    category: 'MINOR',
    programCode: undefined,
    majorPaperIndex: undefined,
  };

  return [major, minor];
}

/** Sem 4 / 6 Physics honours major papers (theory + experimental lab). */
export function buildPhysicsHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const honoursSemesters = [4, 6] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of honoursSemesters) {
    const papers = PHYSICS_NEHU_PAPERS.filter(
      (paper) => paper.semester === semester && paper.category === 'MAJOR',
    );
    papers.forEach((paper, index) => {
      courses.push(physicsPaperToCourseDef(paper, index + 1));
    });
  }

  return courses;
}

export function physicsLabCourseCodes(): string[] {
  return PHYSICS_NEHU_PAPERS.filter(
    (paper) => paper.deliveryKind === 'PRACTICAL',
  ).map((paper) => paper.code);
}
