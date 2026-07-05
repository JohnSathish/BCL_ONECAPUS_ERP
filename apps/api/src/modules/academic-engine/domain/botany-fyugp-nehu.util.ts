import {
  BOTANY_NEHU_META,
  BOTANY_NEHU_PAPERS,
  type BotanyNehuPaper,
} from './botany-fyugp-nehu';
import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';

function botanyPaperToCourseDef(
  paper: BotanyNehuPaper,
  majorPaperIndex?: number,
): ArtsFyugpCourseDef {
  const base = {
    code: paper.code,
    title: paper.title,
    credits: paper.credits,
    category: paper.category,
    semesterSequence: paper.semester,
    departmentCode: BOTANY_NEHU_META.departmentCode,
    subjectSlug: BOTANY_NEHU_META.subjectSlug,
    programCode: BOTANY_NEHU_META.programCode,
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

/** Sem 1 / 3 / 5 Botany major + internship courses. */
export function buildBotanyOddSemCourses(): ArtsFyugpCourseDef[] {
  const oddSemesters = [1, 3, 5] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of oddSemesters) {
    const papers = BOTANY_NEHU_PAPERS.filter(
      (paper) =>
        paper.semester === semester &&
        (paper.category === 'MAJOR' || paper.category === 'INTERNSHIP'),
    );
    papers.forEach((paper, index) => {
      courses.push(
        botanyPaperToCourseDef(
          paper,
          paper.category === 'MAJOR' ? index + 1 : undefined,
        ),
      );
    });
  }

  return courses;
}

/** Sem 2 Botany major paper (BOT-150) and cross-programme minor slot (BOT-151). */
export function buildBotanySem2Courses(): ArtsFyugpCourseDef[] {
  const sem2Major = BOTANY_NEHU_PAPERS.find(
    (paper) => paper.semester === 2 && paper.category === 'MAJOR',
  );
  if (!sem2Major) return [];

  const major = botanyPaperToCourseDef(sem2Major, 1);
  const minor: ArtsFyugpCourseDef = {
    ...major,
    code: 'BOT-151',
    category: 'MINOR',
    programCode: undefined,
    majorPaperIndex: undefined,
  };

  return [major, minor];
}

/** Sem 4 / 6 Botany honours major papers. */
export function buildBotanyHonoursEvenSemCourses(): ArtsFyugpCourseDef[] {
  const honoursSemesters = [4, 6] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of honoursSemesters) {
    const papers = BOTANY_NEHU_PAPERS.filter(
      (paper) => paper.semester === semester && paper.category === 'MAJOR',
    );
    papers.forEach((paper, index) => {
      courses.push(botanyPaperToCourseDef(paper, index + 1));
    });
  }

  return courses;
}

export function botanyLabCourseCodes(): string[] {
  return BOTANY_NEHU_PAPERS.filter(
    (paper) => paper.deliveryKind === 'THEORY_PRACTICAL',
  ).map((paper) => paper.code);
}
