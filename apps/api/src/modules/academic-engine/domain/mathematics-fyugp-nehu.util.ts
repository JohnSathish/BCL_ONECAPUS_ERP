import {
  MATHEMATICS_NEHU_META,
  MATHEMATICS_NEHU_PAPERS,
  type MathematicsNehuPaper,
} from './mathematics-fyugp-nehu';
import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';

function mathematicsPaperToCourseDef(
  paper: MathematicsNehuPaper,
  majorPaperIndex?: number,
): ArtsFyugpCourseDef {
  const base = {
    code: paper.code,
    title: paper.title,
    credits: paper.credits,
    category: paper.category,
    semesterSequence: paper.semester,
    departmentCode: MATHEMATICS_NEHU_META.departmentCode,
    subjectSlug: MATHEMATICS_NEHU_META.subjectSlug,
    programCode: MATHEMATICS_NEHU_META.programCode,
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

/** Sem 1 / 3 / 5 Mathematics major + internship courses. */
export function buildMathematicsOddSemCourses(): ArtsFyugpCourseDef[] {
  const oddSemesters = [1, 3, 5] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of oddSemesters) {
    const papers = MATHEMATICS_NEHU_PAPERS.filter(
      (paper) =>
        paper.semester === semester &&
        (paper.category === 'MAJOR' || paper.category === 'INTERNSHIP'),
    );
    papers.forEach((paper, index) => {
      courses.push(
        mathematicsPaperToCourseDef(
          paper,
          paper.category === 'MAJOR' ? index + 1 : undefined,
        ),
      );
    });
  }

  return courses;
}

/** Sem 2 Mathematics major (MTH-150) and cross-programme minor slot (MTH-151). */
export function buildMathematicsSem2Courses(): ArtsFyugpCourseDef[] {
  const sem2Major = MATHEMATICS_NEHU_PAPERS.find(
    (paper) => paper.semester === 2 && paper.category === 'MAJOR',
  );
  if (!sem2Major) return [];

  const major = mathematicsPaperToCourseDef(sem2Major, 1);
  const minor: ArtsFyugpCourseDef = {
    ...major,
    code: 'MTH-151',
    category: 'MINOR',
    programCode: undefined,
    majorPaperIndex: undefined,
  };

  return [major, minor];
}

/** Sem 4 / 6 Mathematics honours major papers. */
export function buildMathematicsHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const honoursSemesters = [4, 6] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of honoursSemesters) {
    const papers = MATHEMATICS_NEHU_PAPERS.filter(
      (paper) => paper.semester === semester && paper.category === 'MAJOR',
    );
    papers.forEach((paper, index) => {
      courses.push(mathematicsPaperToCourseDef(paper, index + 1));
    });
  }

  return courses;
}
