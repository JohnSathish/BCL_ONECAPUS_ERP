/**
 * One course code can be offered under a different paper name.
 * GEO-302 stays "Introduction to Remote Sensing and GIS" on the course master,
 * and Semester 5 minor mappings use "Geography and Environment".
 * EDN-302 is the same: the course master is the Education major paper, and
 * other majors take it as Inclusive Education I.
 */

import { ARTS_FYUGP_DEPARTMENTS } from './arts-fyugp-odd-catalog';

export type SharedCodeMinorTitle = {
  courseCode: string;
  majorTitle: string;
  minorTitle: string;
  ownerProgramCode: string;
};

function titlesEqual(left: string, right: string) {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0;
}

/** Arts semester-5 papers whose minor name differs from the major on the same code. */
export function sharedCodeMinorTitlePairs(): SharedCodeMinorTitle[] {
  const pairs: SharedCodeMinorTitle[] = [];
  for (const dept of ARTS_FYUGP_DEPARTMENTS) {
    const minorCode = dept.papers.sem5MinorCode;
    if (!minorCode) continue;
    const index = Number(minorCode) - 300;
    const majorTitle = dept.papers.sem5[index]?.trim() ?? '';
    const minorTitle = dept.papers.sem5Minor.trim();
    if (!majorTitle || !minorTitle || titlesEqual(majorTitle, minorTitle)) {
      continue;
    }
    pairs.push({
      courseCode: `${dept.code}-${minorCode}`.toUpperCase(),
      majorTitle,
      minorTitle,
      ownerProgramCode: dept.programCode,
    });
  }
  return pairs;
}

export function artsHostProgramCodes() {
  return ARTS_FYUGP_DEPARTMENTS.map((dept) => dept.programCode);
}

/**
 * Minor title for a shared code, only while the live course title is still the
 * catalog major title. A renamed course (for example Garo) keeps that live title.
 */
export function sharedCodeMinorTitle(
  courseCode: string | null | undefined,
  courseTitle: string | null | undefined,
): string | null {
  const code = courseCode?.trim().toUpperCase() ?? '';
  const title = courseTitle?.trim() ?? '';
  if (!code || !title) return null;
  const pair = sharedCodeMinorTitlePairs().find(
    (row) => row.courseCode === code && titlesEqual(row.majorTitle, title),
  );
  return pair?.minorTitle ?? null;
}

/**
 * Name printed for one student's registration.
 * Major (and every other category) uses the live curriculum name.
 * Minor uses the mapping title, or the catalog minor title when this code
 * still carries the major name on the course master.
 */
export function registrationPaperTitle(
  course: { code?: string | null; title?: string | null } | null | undefined,
  offering?: {
    titleOverride?: string | null;
    category?: string | null;
  } | null,
  lineCategory?: string | null,
): string {
  const courseTitle = course?.title?.trim() ?? '';
  const override = offering?.titleOverride?.trim() ?? '';
  const category = (lineCategory || offering?.category || '')
    .trim()
    .toUpperCase();
  if (category === 'MINOR' || category.startsWith('MINOR')) {
    if (override && !titlesEqual(override, courseTitle)) return override;
    const catalogMinor = sharedCodeMinorTitle(course?.code, courseTitle);
    if (catalogMinor) return catalogMinor;
    if (override) return override;
    return courseTitle;
  }
  if (override) return override;
  return courseTitle;
}

export function offeringTitleOverride(
  courseTitle: string | null | undefined,
  mappingTitle: string | null | undefined,
): string | null {
  const course = courseTitle?.trim() ?? '';
  const mapping = mappingTitle?.trim() ?? '';
  if (!mapping) return null;
  if (
    mapping.localeCompare(course, undefined, { sensitivity: 'accent' }) === 0
  ) {
    return null;
  }
  return mapping;
}

export function offeringPaperTitle(
  course: { title?: string | null } | null | undefined,
  offering?: { titleOverride?: string | null } | null,
): string {
  const override = offering?.titleOverride?.trim();
  if (override) return override;
  return course?.title?.trim() ?? '';
}
