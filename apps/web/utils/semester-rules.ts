import { isAutoAssignedCategory } from '@/constants/nep-curriculum-categories';

export { requiredMajorPaperCount } from '@/utils/major-paper-assignment';
export { isAutoAssignedCategory };

export type SemesterRuleLike = {
  semesterSequence?: number;
  categoryCounts: Record<string, number>;
  categoryMeta?: Record<string, { creditRule?: number; mandatory?: boolean }>;
  semesterCreditTarget?: number | null;
  summary?: string;
};

const CATEGORY_DISPLAY_ORDER = [
  'MAJOR',
  'MINOR',
  'MDC',
  'AEC',
  'SEC',
  'VAC',
  'VTC',
  'INTERNSHIP',
  'PROJECT',
  'RESEARCH',
  'DISSERTATION',
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  MAJOR: 'Major',
  MINOR: 'Minor',
  MDC: 'MDC',
  AEC: 'AEC',
  SEC: 'SEC',
  VAC: 'VAC',
  VTC: 'VTC',
  INTERNSHIP: 'Internship',
  PROJECT: 'Project',
  RESEARCH: 'Research',
  DISSERTATION: 'Dissertation',
};

export const MULTI_SLOT_CATEGORIES = new Set(['MAJOR', 'MINOR']);

export function categorySlotKeys(categoryCounts: Record<string, number>): string[] {
  const keys: string[] = [];
  const sorted = Object.entries(categoryCounts).sort(([a], [b]) => {
    const ia = CATEGORY_DISPLAY_ORDER.indexOf(a as (typeof CATEGORY_DISPLAY_ORDER)[number]);
    const ib = CATEGORY_DISPLAY_ORDER.indexOf(b as (typeof CATEGORY_DISPLAY_ORDER)[number]);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  for (const [cat, count] of sorted) {
    for (let i = 0; i < count; i++) {
      keys.push(MULTI_SLOT_CATEGORIES.has(cat) && count > 1 ? `${cat}-${i + 1}` : cat);
    }
  }
  return keys;
}

export function slotCategory(slotKey: string): string {
  return slotKey.startsWith('MAJOR') ? 'MAJOR' : slotKey.split('-')[0]!;
}

export function requiredCategories(rule?: SemesterRuleLike | null): string[] {
  if (!rule) return [];
  return Object.entries(rule.categoryCounts)
    .filter(([, count]) => count > 0)
    .map(([cat]) => cat);
}

export function minorRequired(rule?: SemesterRuleLike | null): boolean {
  return (rule?.categoryCounts.MINOR ?? 0) > 0;
}

export function formatSemesterSummary(rule?: SemesterRuleLike | null): string {
  if (!rule) return '';
  if (rule.summary) return rule.summary;
  const entries = Object.entries(rule.categoryCounts ?? {}).filter(([, count]) => count > 0);
  entries.sort(([a], [b]) => {
    const ia = CATEGORY_DISPLAY_ORDER.indexOf(a as (typeof CATEGORY_DISPLAY_ORDER)[number]);
    const ib = CATEGORY_DISPLAY_ORDER.indexOf(b as (typeof CATEGORY_DISPLAY_ORDER)[number]);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
  return entries
    .map(([cat, count]) => {
      if (cat === 'MAJOR' && count > 1) return `${count} Major`;
      if (cat === 'MINOR' && count > 1) return `${count} Minor`;
      const base = CATEGORY_LABELS[cat] ?? cat;
      return count > 1 ? `${count} ${base}` : base;
    })
    .join(' + ');
}

export function buildSlotKeysFromRule(rule?: SemesterRuleLike | null): string[] {
  if (!rule) return [];
  return categorySlotKeys(rule.categoryCounts);
}

export function buildAutoSlotKeysFromRule(rule?: SemesterRuleLike | null): string[] {
  return buildSlotKeysFromRule(rule).filter((key) => isAutoAssignedCategory(slotCategory(key)));
}

export function buildSelectableSlotKeysFromRule(rule?: SemesterRuleLike | null): string[] {
  return buildSlotKeysFromRule(rule).filter((key) => !isAutoAssignedCategory(slotCategory(key)));
}

export function categoryLabel(category: string, slotKey?: string): string {
  if (category === 'MAJOR' && slotKey?.includes('-')) {
    return `Major Paper ${slotKey.split('-')[1]}`;
  }
  if (category === 'MINOR' && slotKey?.includes('-')) {
    return `Minor Paper ${slotKey.split('-')[1]}`;
  }
  return CATEGORY_LABELS[category] ?? category;
}
