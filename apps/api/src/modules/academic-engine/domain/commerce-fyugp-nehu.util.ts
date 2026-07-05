import {
  COMMERCE_NEHU_META,
  COMMERCE_NEHU_PAPERS,
  type CommerceNehuPaper,
} from './commerce-fyugp-nehu';
import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';

function commercePaperToCourseDef(
  paper: CommerceNehuPaper,
  majorPaperIndex?: number,
): ArtsFyugpCourseDef {
  const base = {
    code: paper.code,
    title: paper.title,
    credits: paper.credits,
    category: paper.category,
    semesterSequence: paper.semester,
    departmentCode: COMMERCE_NEHU_META.departmentCode,
    subjectSlug: COMMERCE_NEHU_META.subjectSlug,
    programCode: COMMERCE_NEHU_META.programCode,
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

/** Sem 1 / 3 / 5 Commerce major + internship courses. */
export function buildCommerceOddSemCourses(): ArtsFyugpCourseDef[] {
  const oddSemesters = [1, 3, 5] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of oddSemesters) {
    const papers = COMMERCE_NEHU_PAPERS.filter(
      (paper) =>
        paper.semester === semester &&
        (paper.category === 'MAJOR' || paper.category === 'INTERNSHIP'),
    );
    papers.forEach((paper, index) => {
      courses.push(
        commercePaperToCourseDef(
          paper,
          paper.category === 'MAJOR' ? index + 1 : undefined,
        ),
      );
    });
  }

  return courses;
}

/** Sem 2 Commerce major (COM-150) and cross-programme minor slot (COM-151). */
export function buildCommerceSem2Courses(): ArtsFyugpCourseDef[] {
  const sem2Major = COMMERCE_NEHU_PAPERS.find(
    (paper) => paper.semester === 2 && paper.category === 'MAJOR',
  );
  if (!sem2Major) return [];

  const major = commercePaperToCourseDef(sem2Major, 1);
  const minor: ArtsFyugpCourseDef = {
    ...major,
    code: 'COM-151',
    category: 'MINOR',
    programCode: undefined,
    majorPaperIndex: undefined,
  };

  return [major, minor];
}

/** Sem 4 / 6 Commerce honours major papers. */
export function buildCommerceHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const honoursSemesters = [4, 6] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of honoursSemesters) {
    const papers = COMMERCE_NEHU_PAPERS.filter(
      (paper) => paper.semester === semester && paper.category === 'MAJOR',
    );
    papers.forEach((paper, index) => {
      courses.push(commercePaperToCourseDef(paper, index + 1));
    });
  }

  return courses;
}
