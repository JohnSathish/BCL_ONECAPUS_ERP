/**
 * A marked class still belongs to the student's current semester when the
 * session row kept an older semester number (timetable slots often stay on
 * semester 1 while the subject group is semester 3 or 5).
 */
export function sessionCountsForCurrentSemester(input: {
  currentSemester: number | null;
  sessionSemester: number | null;
  courseId?: string | null;
  offeringSectionId?: string | null;
  groupSemester?: number | null;
  registeredCourseIds?: ReadonlySet<string>;
  registeredSectionIds?: ReadonlySet<string>;
}) {
  if (input.currentSemester == null) return true;
  if (
    input.sessionSemester == null ||
    input.sessionSemester === input.currentSemester
  ) {
    return true;
  }
  if (input.courseId && input.registeredCourseIds?.has(input.courseId)) {
    return true;
  }
  if (
    input.offeringSectionId &&
    input.registeredSectionIds?.has(input.offeringSectionId)
  ) {
    return true;
  }
  return (
    input.groupSemester != null && input.groupSemester === input.currentSemester
  );
}

/** Prefer the live session when a duplicate class was soft-deleted. */
export function pickMarkedRows<T extends { deleted: boolean; key: string }>(
  rows: T[],
) {
  const best = new Map<string, T>();
  for (const row of rows) {
    const current = best.get(row.key);
    if (!current || (current.deleted && !row.deleted)) {
      best.set(row.key, row);
    }
  }
  return [...best.values()];
}
