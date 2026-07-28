import type { TimetableEntry } from '@/services/timetable';

/** FYUGP pool categories — department routine shows period block, not one paper. */
export const POOL_FYUGP_CATEGORIES = new Set(['VTC', 'MDC', 'SEC', 'AEC', 'VAC']);

const POOL_CATEGORY_LABELS: Record<string, string> = {
  VTC: 'Vocational Training Course',
  MDC: 'Multidisciplinary Course',
  SEC: 'Skill Enhancement Course',
  AEC: 'Ability Enhancement Course',
  VAC: 'Value Added Course',
};

export function isPoolFyugpCategory(category?: string | null) {
  return POOL_FYUGP_CATEGORIES.has(String(category ?? '').toUpperCase());
}

export function isCategoryOnlyTimetableEntry(
  entry: Pick<
    TimetableEntry,
    'fyugpCategory' | 'metadata' | 'courseId' | 'course' | 'teachingSubjectGroupId'
  >,
) {
  const metadata = (entry.metadata ?? {}) as { displayAsCategoryOnly?: boolean };
  if (metadata.displayAsCategoryOnly) return true;
  const category = String(entry.fyugpCategory ?? '').toUpperCase();
  if (!isPoolFyugpCategory(category)) return false;
  return !entry.courseId && !entry.course?.code && !entry.teachingSubjectGroupId;
}

export function timetableEntryDisplay(
  entry: Pick<
    TimetableEntry,
    | 'fyugpCategory'
    | 'slotType'
    | 'metadata'
    | 'courseId'
    | 'course'
    | 'teachingSubjectGroupId'
    | 'teachingSubjectGroup'
  >,
) {
  const category = (entry.fyugpCategory || entry.slotType || 'GENERAL').toUpperCase();
  if (isCategoryOnlyTimetableEntry(entry)) {
    return {
      category,
      code: category,
      title: POOL_CATEGORY_LABELS[category] ?? category,
      categoryOnly: true as const,
    };
  }
  const group = entry.teachingSubjectGroup;
  return {
    category,
    code: group?.code ?? entry.course?.code ?? entry.slotType ?? category,
    title: group?.title ?? entry.course?.title ?? 'Scheduled slot',
    categoryOnly: false as const,
  };
}
