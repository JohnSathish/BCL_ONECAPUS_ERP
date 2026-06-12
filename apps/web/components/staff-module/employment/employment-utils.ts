export function suggestStaffShortCode(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function normalizeShortCodeInput(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 10);
}

export const ROLE_CHIP_ABBREV: Record<string, string> = {
  HOD: 'HoD',
  IQAC_COORD: 'IQAC',
  NAAC_COORD: 'NAAC',
  EXAM_CONTROLLER: 'Exam',
  NSS_COORD: 'NSS',
  TIMETABLE_COORD: 'TT',
  RESEARCH_COORD: 'Research',
  DEAN: 'Dean',
  VICE_PRINCIPAL: 'VP',
  PRINCIPAL: 'Principal',
};

export function roleChipLabel(code: string, label: string): string {
  return ROLE_CHIP_ABBREV[code] ?? label;
}
