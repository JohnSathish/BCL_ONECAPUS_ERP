import {
  GEOGRAPHY_NEHU_META,
  GEOGRAPHY_NEHU_PAPERS,
  type GeographyNehuPaper,
} from './geography-fyugp-nehu';
import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';

const PRACTICAL_HOURS_PER_WEEK = 6;

function geographyPaperToCourseDef(
  paper: GeographyNehuPaper,
  majorPaperIndex?: number,
): ArtsFyugpCourseDef {
  const base = {
    code: paper.code,
    title: paper.title,
    credits: paper.credits,
    category: paper.category,
    semesterSequence: paper.semester,
    departmentCode: GEOGRAPHY_NEHU_META.departmentCode,
    subjectSlug: GEOGRAPHY_NEHU_META.subjectSlug,
    programCode: GEOGRAPHY_NEHU_META.programCode,
    ...(majorPaperIndex ? { majorPaperIndex } : {}),
  };

  if (paper.deliveryKind === 'PRACTICAL') {
    return {
      ...base,
      deliveryType: 'PRACTICAL',
      theoryCredits: 0,
      practicalCredits: paper.practicalCredits,
      theoryHoursPerWeek: 0,
      practicalHoursPerWeek: PRACTICAL_HOURS_PER_WEEK,
      totalTheoryContactHours: 0,
      totalPracticalContactHours: paper.contactHours,
      totalContactHours: paper.contactHours,
    };
  }

  if (paper.deliveryKind === 'INTERNSHIP') {
    return {
      ...base,
      deliveryType: 'INTERNSHIP',
      creditCalculationMode: 'MANUAL_OVERRIDE',
      theoryCredits: 0,
      practicalCredits: 0,
      theoryHoursPerWeek: 0,
      practicalHoursPerWeek: 0,
      totalTheoryContactHours: 0,
      totalPracticalContactHours: 0,
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

/** Sem 1 / 3 / 5 Geography major + internship courses. */
export function buildGeographyOddSemCourses(): ArtsFyugpCourseDef[] {
  const oddSemesters = [1, 3, 5] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of oddSemesters) {
    const papers = GEOGRAPHY_NEHU_PAPERS.filter(
      (paper) =>
        paper.semester === semester &&
        (paper.category === 'MAJOR' || paper.category === 'INTERNSHIP'),
    );
    papers.forEach((paper, index) => {
      courses.push(
        geographyPaperToCourseDef(
          paper,
          paper.category === 'MAJOR' ? index + 1 : undefined,
        ),
      );
    });
  }

  return courses;
}

/** Sem 4 / 6 Geography honours major papers (theory + practical). */
export function buildGeographyHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const honoursSemesters = [4, 6] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of honoursSemesters) {
    const papers = GEOGRAPHY_NEHU_PAPERS.filter(
      (paper) => paper.semester === semester && paper.category === 'MAJOR',
    );
    papers.forEach((paper, index) => {
      courses.push(geographyPaperToCourseDef(paper, index + 1));
    });
  }

  return courses;
}

export function geographyPracticalCourseCodes(): string[] {
  return GEOGRAPHY_NEHU_PAPERS.filter(
    (paper) => paper.deliveryKind === 'PRACTICAL',
  ).map((paper) => paper.code);
}
