/** Canonical gender codes for student profile / portal forms. */
export const GENDER_CODES = [
  'MALE',
  'FEMALE',
  'TRANSGENDER',
  'OTHER',
  'PREFER_NOT_TO_SAY',
] as const;

export type GenderCode = (typeof GENDER_CODES)[number];

export const GENDER_OPTIONS: Array<{ value: GenderCode; label: string }> = [
  { value: 'MALE', label: 'Male' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'TRANSGENDER', label: 'Transgender' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer Not To Say' },
];

/** Map free-text / legacy values (Male, M, female…) to a select option value. */
export function normalizeGenderCode(raw?: string | null): GenderCode | '' {
  const g = String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s\-]+/g, '_');
  if (!g) return '';
  if (g === 'M' || g === 'MALE' || g.startsWith('MALE')) return 'MALE';
  if (g === 'F' || g === 'FEMALE' || g.startsWith('FEMALE')) return 'FEMALE';
  if (g.includes('TRANS')) return 'TRANSGENDER';
  if (g === 'O' || g === 'OTHER' || g.includes('OTHER')) return 'OTHER';
  if (g.includes('PREFER') || g.includes('NOT_TO_SAY') || g.includes('NA')) {
    return 'PREFER_NOT_TO_SAY';
  }
  return '';
}
