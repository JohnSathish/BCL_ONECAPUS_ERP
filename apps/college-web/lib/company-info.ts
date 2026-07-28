/**
 * College institution constants — keep founding year here so experience
 * badges stay correct across years without manual UI edits.
 */
export const COMPANY_INFO = {
  name: 'Don Bosco College, Tura',
  /** Year the college was established */
  establishedYear: Number(process.env.NEXT_PUBLIC_COLLEGE_ESTABLISHED_YEAR ?? 1987),
} as const;

/** Full years since establishment (e.g. 2026 − 1987 = 39). */
export function yearsOfExperience(asOf: Date = new Date()): number {
  return Math.max(0, asOf.getFullYear() - COMPANY_INFO.establishedYear);
}

/** Display form used on seals and stat strips, e.g. "39+". */
export function yearsOfExperienceLabel(asOf: Date = new Date()): string {
  return `${yearsOfExperience(asOf)}+`;
}

export function isYearsOfExcellenceLabel(label: string): boolean {
  return /years of excellence|years of experience/i.test(label.trim());
}
