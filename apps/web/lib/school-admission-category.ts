export const SCHOOL_CASTE_CATEGORY_CODES = ['GENERAL_UR', 'SC', 'ST', 'OBC', 'OTHER'] as const;

export type SchoolCasteCategoryCode = (typeof SCHOOL_CASTE_CATEGORY_CODES)[number];

/**
 * Category dropdown only. Certificate rules live in
 * school-document-requirements (Mother’s ST / Father’s SC or OBC).
 */
export type SchoolCasteCategoryPolicy = {
  code: SchoolCasteCategoryCode;
  label: string;
  requireCommunity: boolean;
};

/** Keep in sync with apps/api school-admission-category.ts */
export const SCHOOL_CASTE_CATEGORY_POLICY: SchoolCasteCategoryPolicy[] = [
  {
    code: 'GENERAL_UR',
    label: 'General / UR',
    requireCommunity: false,
  },
  {
    code: 'SC',
    label: 'Scheduled Caste (SC)',
    requireCommunity: false,
  },
  {
    code: 'ST',
    label: 'Scheduled Tribe (ST)',
    requireCommunity: true,
  },
  {
    code: 'OBC',
    label: 'Other Backward Class (OBC)',
    requireCommunity: false,
  },
  {
    code: 'OTHER',
    label: 'Other',
    requireCommunity: true,
  },
];

const LEGACY_CATEGORY_ALIASES: Record<string, SchoolCasteCategoryCode> = {
  general: 'GENERAL_UR',
  ur: 'GENERAL_UR',
  'general / ur': 'GENERAL_UR',
  'general/ur': 'GENERAL_UR',
  sc: 'SC',
  'scheduled caste': 'SC',
  'scheduled caste (sc)': 'SC',
  st: 'ST',
  'scheduled tribe': 'ST',
  'scheduled tribe (st)': 'ST',
  obc: 'OBC',
  'other backward class': 'OBC',
  'other backward class (obc)': 'OBC',
  other: 'OTHER',
};

export function isSchoolCasteCategoryCode(value: string): value is SchoolCasteCategoryCode {
  return (SCHOOL_CASTE_CATEGORY_CODES as readonly string[]).includes(value);
}

export function schoolCasteCategoryPolicy(
  code: string | null | undefined,
): SchoolCasteCategoryPolicy | null {
  if (!code) return null;
  return SCHOOL_CASTE_CATEGORY_POLICY.find((item) => item.code === code) ?? null;
}

export function resolveSchoolCasteCategory(
  child: Record<string, unknown> | null | undefined,
): SchoolCasteCategoryPolicy | null {
  const rawCategory = typeof child?.category === 'string' ? child.category.trim() : '';
  const rawCaste = typeof child?.caste === 'string' ? child.caste.trim() : '';
  const fromCode = isSchoolCasteCategoryCode(rawCategory)
    ? rawCategory
    : LEGACY_CATEGORY_ALIASES[rawCategory.toLowerCase()];
  if (fromCode) return schoolCasteCategoryPolicy(fromCode);
  const fromCaste = LEGACY_CATEGORY_ALIASES[rawCaste.toLowerCase()];
  if (fromCaste) return schoolCasteCategoryPolicy(fromCaste);
  return null;
}
