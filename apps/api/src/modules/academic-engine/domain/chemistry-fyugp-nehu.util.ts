import {
  CHEMISTRY_NEHU_META,
  CHEMISTRY_NEHU_PAPERS,
  type ChemistryNehuPaper,
} from './chemistry-fyugp-nehu';
import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';

const PRACTICAL_HOURS_DIVISOR = 15;

function chemistryPaperToCourseDef(
  paper: ChemistryNehuPaper,
  majorPaperIndex?: number,
): ArtsFyugpCourseDef {
  const base = {
    code: paper.code,
    title: paper.title,
    credits: paper.credits,
    category: paper.category,
    semesterSequence: paper.semester,
    departmentCode: CHEMISTRY_NEHU_META.departmentCode,
    subjectSlug: CHEMISTRY_NEHU_META.subjectSlug,
    programCode: CHEMISTRY_NEHU_META.programCode,
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

/** Sem 1 / 3 / 5 Chemistry major + internship courses. */
export function buildChemistryOddSemCourses(): ArtsFyugpCourseDef[] {
  const oddSemesters = [1, 3, 5] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of oddSemesters) {
    const papers = CHEMISTRY_NEHU_PAPERS.filter(
      (paper) =>
        paper.semester === semester &&
        (paper.category === 'MAJOR' || paper.category === 'INTERNSHIP'),
    );
    papers.forEach((paper, index) => {
      courses.push(
        chemistryPaperToCourseDef(
          paper,
          paper.category === 'MAJOR' ? index + 1 : undefined,
        ),
      );
    });
  }

  return courses;
}

/** Sem 2 Chemistry major (CHE-150) and cross-programme minor slot (CHE-151). */
export function buildChemistrySem2Courses(): ArtsFyugpCourseDef[] {
  const sem2Major = CHEMISTRY_NEHU_PAPERS.find(
    (paper) => paper.semester === 2 && paper.category === 'MAJOR',
  );
  if (!sem2Major) return [];

  const major = chemistryPaperToCourseDef(sem2Major, 1);
  const minor: ArtsFyugpCourseDef = {
    ...major,
    code: 'CHE-151',
    category: 'MINOR',
    programCode: undefined,
    majorPaperIndex: undefined,
  };

  return [major, minor];
}

/** Sem 4 / 6 Chemistry honours major papers (theory + laboratory). */
export function buildChemistryHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const honoursSemesters = [4, 6] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of honoursSemesters) {
    const papers = CHEMISTRY_NEHU_PAPERS.filter(
      (paper) => paper.semester === semester && paper.category === 'MAJOR',
    );
    papers.forEach((paper, index) => {
      courses.push(chemistryPaperToCourseDef(paper, index + 1));
    });
  }

  return courses;
}

export function chemistryLabCourseCodes(): string[] {
  return CHEMISTRY_NEHU_PAPERS.filter(
    (paper) => paper.deliveryKind === 'PRACTICAL',
  ).map((paper) => paper.code);
}
