/**
 * One course code can be offered under a different paper name.
 * GEO-302 stays "Introduction to Remote Sensing and GIS" on the course master,
 * and Semester 5 minor mappings use "Geography and Environment".
 */

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
