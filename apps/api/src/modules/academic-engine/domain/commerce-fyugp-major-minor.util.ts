/**
 * DBC official commerce major → allowed minor department names.
 */
export const COMMERCE_MAJOR_ALLOWED_MINORS_MAP: Record<
  string,
  readonly string[]
> = {
  COM: ['Economics', 'Mathematics', 'Geography'],
};

export const COMMERCE_MINOR_DEPT_CODE_BY_NAME: Record<string, string> = {
  Economics: 'ECO',
  Mathematics: 'MTH',
  Geography: 'GEO',
};

export function commerceAllowedMinorDeptCodes(hostDeptCode: string): string[] {
  const allowed = COMMERCE_MAJOR_ALLOWED_MINORS_MAP[hostDeptCode] ?? [];
  return allowed
    .map((name) => COMMERCE_MINOR_DEPT_CODE_BY_NAME[name])
    .filter((code): code is string => Boolean(code));
}
