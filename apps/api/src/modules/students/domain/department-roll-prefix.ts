/**
 * 2026 college roll numbers are per major department, not one Arts prefix.
 * Economics is EC26-01, Education is ED26-01, English is EN26-01, and so on.
 * The number starts at 01 inside that department.
 */
export const DEPARTMENT_ROLL_PREFIXES: ReadonlyArray<{
  names: readonly string[];
  prefix: string;
}> = [
  { names: ['economics'], prefix: 'EC' },
  { names: ['education'], prefix: 'ED' },
  { names: ['english'], prefix: 'EN' },
  { names: ['garo'], prefix: 'GA' },
  { names: ['geography'], prefix: 'GE' },
  { names: ['history'], prefix: 'HI' },
  { names: ['philosophy'], prefix: 'PHI' },
  { names: ['political science'], prefix: 'PS' },
  { names: ['sociology'], prefix: 'SO' },
  { names: ['commerce'], prefix: 'COM' },
  { names: ['botany'], prefix: 'BOT' },
  { names: ['chemistry'], prefix: 'CHE' },
  { names: ['mathematics', 'maths'], prefix: 'MAT' },
  { names: ['physics'], prefix: 'PHY' },
  { names: ['zoology'], prefix: 'ZOO' },
];

/** Department rolls are EC26-01, not EC26-001. Numbers above 99 stay as EC26-128. */
export const DEPARTMENT_ROLL_SEQUENCE_LENGTH = 2;

export function normalizeDepartmentLabel(value?: string | null) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function prefixForDepartment(
  name?: string | null,
  code?: string | null,
): string | null {
  const labels = [
    normalizeDepartmentLabel(name),
    normalizeDepartmentLabel(code),
  ].filter(Boolean);
  for (const row of DEPARTMENT_ROLL_PREFIXES) {
    if (row.names.some((label) => labels.includes(label))) return row.prefix;
  }
  const codeKey = (code ?? '').trim().toUpperCase();
  if (DEPARTMENT_ROLL_PREFIXES.some((row) => row.prefix === codeKey))
    return codeKey;
  return null;
}

export function prefixForStreamCode(code?: string | null): string | null {
  return prefixForDepartment(null, (code ?? '').replace(/_/g, ' '));
}
