export const TEACHING_SHIFT_CATEGORIES = [
  'MORNING',
  'DAY',
  'BOTH',
  'EVENING',
  'WEEKEND',
  'ONLINE',
] as const;

export type TeachingShiftCategory = (typeof TEACHING_SHIFT_CATEGORIES)[number];

export const TEACHING_SHIFT_CATEGORY_LABELS: Record<TeachingShiftCategory, string> = {
  MORNING: 'Morning Shift',
  DAY: 'Day Shift',
  BOTH: 'Both Shifts',
  EVENING: 'Evening Shift',
  WEEKEND: 'Weekend Shift',
  ONLINE: 'Online Shift',
};

export const TEACHING_SHIFT_FILTER_OPTIONS = [
  { id: '', label: 'All' },
  ...TEACHING_SHIFT_CATEGORIES.slice(0, 3).map((id) => ({
    id,
    label: TEACHING_SHIFT_CATEGORY_LABELS[id],
  })),
];

export function teachingShiftCategoryLabel(category: string | null | undefined): string {
  if (!category || !(TEACHING_SHIFT_CATEGORIES as readonly string[]).includes(category)) {
    return TEACHING_SHIFT_CATEGORY_LABELS.DAY;
  }
  return TEACHING_SHIFT_CATEGORY_LABELS[category as TeachingShiftCategory];
}
