export type ShiftSectionCandidate = {
  id: string;
  sectionCode: string;
  status: string;
  courseOfferingId: string;
  courseOffering: {
    id: string;
    category: string | null;
    semesterSequence: number | null;
    titleOverride: string | null;
    course: { id: string; code: string; title: string };
  };
};

export type ShiftSectionSource = {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  category?: string | null;
  semesterSequence?: number | null;
  sectionCode?: string | null;
};

const CLOSED_SECTION_STATUSES = new Set([
  'closed',
  'cancelled',
  'canceled',
  'inactive',
  'archived',
]);

export function normalizeCourseCode(code: string) {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function normalizePaperLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isOpenSection(status: string) {
  return !CLOSED_SECTION_STATUSES.has(status.trim().toLowerCase());
}

/**
 * Pick the Morning/Day section that is the same paper.
 * Course id and course code win. Category and section code only break ties,
 * so a paper is not rejected because the destination row says MAJOR vs Major.
 */
export function pickEquivalentOfferingSection<T extends ShiftSectionCandidate>(
  sections: T[],
  source: ShiftSectionSource,
): T | null {
  const codeKey = normalizeCourseCode(source.courseCode);
  const titleKey = normalizePaperLabel(source.courseTitle);
  const categoryKey = source.category?.trim().toLowerCase() ?? '';
  const sectionCode = source.sectionCode?.trim().toUpperCase() ?? '';

  const ranked = sections
    .filter((section) => isOpenSection(section.status))
    .map((section) => {
      const offering = section.courseOffering;
      const course = offering.course;
      const sameCourse = course.id === source.courseId;
      const sameCode =
        Boolean(codeKey) && normalizeCourseCode(course.code) === codeKey;
      const paperTitle = normalizePaperLabel(
        offering.titleOverride || course.title,
      );
      const sameTitle = Boolean(titleKey) && paperTitle === titleKey;
      const sameSemester =
        source.semesterSequence != null &&
        offering.semesterSequence === source.semesterSequence;
      const sameCategory =
        Boolean(categoryKey) &&
        (offering.category ?? '').trim().toLowerCase() === categoryKey;
      const sameSection =
        Boolean(sectionCode) &&
        section.sectionCode.trim().toUpperCase() === sectionCode;

      let score = 0;
      if (sameCourse) score += 100;
      if (sameCode) score += 40;
      if (sameTitle && sameSemester) score += 25;
      if (sameSemester) score += 10;
      if (sameCategory) score += 5;
      if (sameSection) score += 3;
      return { section, score, sameCourse, sameCode, sameTitle, sameSemester };
    })
    .filter(
      (row) =>
        row.sameCourse ||
        row.sameCode ||
        (row.sameTitle && row.sameSemester && row.score >= 25),
    )
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.section ?? null;
}
