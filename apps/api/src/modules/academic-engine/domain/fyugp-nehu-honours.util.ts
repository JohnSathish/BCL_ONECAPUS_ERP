import type { ArtsFyugpCourseDef } from './arts-fyugp-odd-catalog';

type NehuHonoursPaper = {
  code: string;
  title: string;
  semester: number;
  category: string;
  credits: number;
};

type HonoursDeptRef = {
  code: string;
  programCode: string;
  subjectSlug: string;
};

function theoryHonoursCourse(
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

/** Sem 4 / 6 honours major papers from a NEHU department reference list. */
export function buildNehuHonoursEvenSemCourses(
  dept: HonoursDeptRef,
  papers: NehuHonoursPaper[],
): ArtsFyugpCourseDef[] {
  const honoursSemesters = [4, 6] as const;
  const courses: ArtsFyugpCourseDef[] = [];

  for (const semester of honoursSemesters) {
    const semesterPapers = papers.filter(
      (paper) => paper.category === 'MAJOR' && paper.semester === semester,
    );
    semesterPapers.forEach((paper, index) => {
      courses.push(
        theoryHonoursCourse({
          code: paper.code,
          title: paper.title,
          credits: paper.credits,
          category: 'MAJOR',
          semesterSequence: paper.semester,
          departmentCode: dept.code,
          subjectSlug: dept.subjectSlug,
          majorPaperIndex: index + 1,
          programCode: dept.programCode,
        }),
      );
    });
  }

  return courses;
}
