export const NEP_CATEGORIES = [
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
  'ELECTIVE',
  'OPEN_ELECTIVE',
  'DISSERTATION',
] as const;

export const STRUCTURE_CATEGORY_TYPES = [...NEP_CATEGORIES, 'LAB'] as const;

export type NepCategory = (typeof NEP_CATEGORIES)[number];
export type StructureCategoryType = (typeof STRUCTURE_CATEGORY_TYPES)[number];

export function isNepCategory(value: string): value is NepCategory {
  return (NEP_CATEGORIES as readonly string[]).includes(value);
}

export function isStructureCategoryType(
  value: string,
): value is StructureCategoryType {
  return (STRUCTURE_CATEGORY_TYPES as readonly string[]).includes(value);
}

export function slugifySubject(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
