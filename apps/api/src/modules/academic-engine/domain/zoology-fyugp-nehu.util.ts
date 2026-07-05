import {
  ZOOLOGY_NEHU_META,
  ZOOLOGY_NEHU_PAPERS,
  type ZoologyNehuPaper,
} from './zoology-fyugp-nehu';
import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';

function zoologyPaperToCourseDef(
  paper: ZoologyNehuPaper,
  majorPaperIndex?: number,
): ArtsFyugpCourseDef {
  const base = {
    code: paper.code,
    title: paper.title,
    credits: paper.credits,
    category: paper.category,
    semesterSequence: paper.semester,
    departmentCode: ZOOLOGY_NEHU_META.departmentCode,
    subjectSlug: ZOOLOGY_NEHU_META.subjectSlug,
    programCode: ZOOLOGY_NEHU_META.programCode,
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

  const totalTheoryContact = paper.theoryCredits * 15;
  const totalPracticalContact = paper.contactHours - totalTheoryContact;

  return {
    ...base,
    deliveryType: 'THEORY_PRACTICAL',
    theoryCredits: paper.theoryCredits,
    practicalCredits: paper.practicalCredits,
    theoryHoursPerWeek: paper.theoryCredits,
    practicalHoursPerWeek: paper.practicalCredits,
    totalTheoryContactHours: totalTheoryContact,
    totalPracticalContactHours: totalPracticalContact,
    totalContactHours: paper.contactHours,
  };
}

/** Sem 1 / 3 / 5 Zoology major + internship courses. */
export function buildZoologyOddSemCourses(): ArtsFyugpCourseDef[] {
  const oddSemesters = [1, 3, 5] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of oddSemesters) {
    const papers = ZOOLOGY_NEHU_PAPERS.filter(
      (paper) =>
        paper.semester === semester &&
        (paper.category === 'MAJOR' || paper.category === 'INTERNSHIP'),
    );
    papers.forEach((paper, index) => {
      courses.push(
        zoologyPaperToCourseDef(
          paper,
          paper.category === 'MAJOR' ? index + 1 : undefined,
        ),
      );
    });
  }

  return courses;
}

/** Sem 2 Zoology major (ZOO-150) and cross-programme minor slot (ZOO-151). */
export function buildZoologySem2Courses(): ArtsFyugpCourseDef[] {
  const sem2Major = ZOOLOGY_NEHU_PAPERS.find(
    (paper) => paper.semester === 2 && paper.category === 'MAJOR',
  );
  if (!sem2Major) return [];

  const major = zoologyPaperToCourseDef(sem2Major, 1);
  const minor: ArtsFyugpCourseDef = {
    ...major,
    code: 'ZOO-151',
    category: 'MINOR',
    programCode: undefined,
    majorPaperIndex: undefined,
  };

  return [major, minor];
}

/** Sem 4 / 6 Zoology honours major papers. */
export function buildZoologyHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const honoursSemesters = [4, 6] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of honoursSemesters) {
    const papers = ZOOLOGY_NEHU_PAPERS.filter(
      (paper) => paper.semester === semester && paper.category === 'MAJOR',
    );
    papers.forEach((paper, index) => {
      courses.push(zoologyPaperToCourseDef(paper, index + 1));
    });
  }

  return courses;
}

export function zoologyLabCourseCodes(): string[] {
  return ZOOLOGY_NEHU_PAPERS.filter(
    (paper) =>
      paper.deliveryKind === 'THEORY_PRACTICAL' && paper.practicalCredits > 0,
  ).map((paper) => paper.code);
}
