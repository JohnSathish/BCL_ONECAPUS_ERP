export type MajorPaperRow = {
  majorPaperIndex?: number | null;
  displayOrder?: number | null;
  courseId: string;
  course: { code?: string | null };
};

export function requiredMajorPaperCount(
  categoryCounts: Record<string, number>,
): number {
  return categoryCounts.MAJOR ?? 0;
}

function compareNullableIndex(
  a: number | null | undefined,
  b: number | null | undefined,
) {
  if (a != null && b != null) return a - b;
  if (a != null && b == null) return -1;
  if (a == null && b != null) return 1;
  return 0;
}

export function sortMajorPaperRows<T extends MajorPaperRow>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const byIndex = compareNullableIndex(a.majorPaperIndex, b.majorPaperIndex);
    if (byIndex !== 0) return byIndex;

    const doA = a.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const doB = b.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (doA !== doB) return doA - doB;

    return (a.course.code ?? '').localeCompare(b.course.code ?? '', undefined, {
      sensitivity: 'base',
    });
  });
}

export function dedupeMajorPaperRowsByCourse<T extends MajorPaperRow>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of sortMajorPaperRows(rows)) {
    if (seen.has(row.courseId)) continue;
    seen.add(row.courseId);
    out.push(row);
  }
  return out;
}

export function resolveMajorPaperForSlot<T extends MajorPaperRow>(
  rows: T[],
  slotIndex: number,
  usedCourseIds: Set<string>,
): T | undefined {
  const paperIndex = slotIndex + 1;
  const sorted = sortMajorPaperRows(rows);

  const exact = sorted.find(
    (row) =>
      row.majorPaperIndex === paperIndex && !usedCourseIds.has(row.courseId),
  );
  if (exact) return exact;

  for (const row of sorted) {
    if (usedCourseIds.has(row.courseId)) continue;
    if (row.majorPaperIndex != null && row.majorPaperIndex !== paperIndex)
      continue;
    return row;
  }

  return undefined;
}

export function assignMajorPaperSlots<T extends MajorPaperRow>(
  rows: T[],
  requiredCount: number,
): T[] {
  const usedCourseIds = new Set<string>();
  const assigned: T[] = [];

  for (let slotIndex = 0; slotIndex < requiredCount; slotIndex++) {
    const picked = resolveMajorPaperForSlot(rows, slotIndex, usedCourseIds);
    if (!picked) break;
    usedCourseIds.add(picked.courseId);
    assigned.push(picked);
  }

  return assigned;
}

export function assertUniqueMajorPaperCourseIds(courseIds: string[]): void {
  const seen = new Set<string>();
  for (const id of courseIds) {
    if (seen.has(id)) {
      throw new Error('Duplicate major paper assignment detected');
    }
    seen.add(id);
  }
}
