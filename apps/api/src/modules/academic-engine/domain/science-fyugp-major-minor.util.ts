/**
 * DBC official science major → allowed minor department names.
 * Mirrors seed-dbc-fyugp-rules DBC_MAJOR_MINOR_MATRIX for curriculum builders.
 */
export const SCIENCE_MAJOR_ALLOWED_MINORS: Record<string, readonly string[]> = {
  BOT: ['Zoology', 'Chemistry'],
  CHE: ['Mathematics', 'Physics'],
  MTH: ['Physics', 'Chemistry'],
  ZOO: ['Botany', 'Chemistry'],
  PHY: ['Chemistry', 'Mathematics'],
};

export const SCIENCE_MINOR_DEPT_CODE_BY_NAME: Record<string, string> = {
  Zoology: 'ZOO',
  Chemistry: 'CHE',
  Mathematics: 'MTH',
  Physics: 'PHY',
  Botany: 'BOT',
};

export function scienceAllowedMinorDeptCodes(hostDeptCode: string): string[] {
  const allowed = SCIENCE_MAJOR_ALLOWED_MINORS[hostDeptCode] ?? [];
  return allowed
    .map((name) => SCIENCE_MINOR_DEPT_CODE_BY_NAME[name])
    .filter((code): code is string => Boolean(code));
}
