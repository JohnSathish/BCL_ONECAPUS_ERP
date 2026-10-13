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
 * Subject line printed for one registration.
 * Code and name are the curriculum mapping on that registration:
 * titleOverride when the offering has one, otherwise the course master title.
 * This is the same pair the student profile and Curriculum & delivery show.
 * A catalog list is not used, so a card cannot invent a different paper name.
 */
export function registeredSubjectPrint(
  course: { code?: string | null; title?: string | null } | null | undefined,
  offering?: { titleOverride?: string | null } | null,
): { code: string; title: string } {
  return {
    code: course?.code?.trim() ?? '',
    title: offeringPaperTitle(course, offering),
  };
}

/** @deprecated Use registeredSubjectPrint. Kept so older call sites stay aligned. */
export function registrationPaperTitle(
  course: { code?: string | null; title?: string | null } | null | undefined,
  offering?: { titleOverride?: string | null } | null,
  _lineCategory?: string | null,
): string {
  return registeredSubjectPrint(course, offering).title;
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
