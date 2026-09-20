export const SCHOOL_TEACHING_CODE_PREFIX = 'SLS-TCH';
export const SCHOOL_NON_TEACHING_CODE_PREFIX = 'SLS-NTC';

export function schoolStaffCodePrefix(staffType?: string | null) {
  return staffType === 'NON_TEACHING'
    ? SCHOOL_NON_TEACHING_CODE_PREFIX
    : SCHOOL_TEACHING_CODE_PREFIX;
}

export function formatSchoolStaffEmployeeCode(prefix: string, n: number) {
  return `${prefix}-${String(Math.max(1, n)).padStart(3, '0')}`;
}

export function maxSchoolStaffCodeNumber(codes: string[], prefix: string) {
  const re = new RegExp(
    `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`,
    'i',
  );
  let max = 0;
  for (const code of codes) {
    const match = code.trim().toUpperCase().match(re);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

export function nextSchoolStaffEmployeeCode(
  codes: string[],
  staffType?: string | null,
) {
  const prefix = schoolStaffCodePrefix(staffType);
  return formatSchoolStaffEmployeeCode(
    prefix,
    maxSchoolStaffCodeNumber(codes, prefix) + 1,
  );
}
