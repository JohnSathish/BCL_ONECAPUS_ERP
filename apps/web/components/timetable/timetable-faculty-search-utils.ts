export type TimetableFacultySearchable = {
  fullName: string;
  shortCode?: string | null;
  employeeCode?: string | null;
};

function normalize(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function nameWords(fullName: string) {
  return fullName.split(/[^a-z0-9]+/i).filter(Boolean);
}

/**
 * Short codes on print are 2–4 letters (e.g. CT). Treat those queries as
 * code/name prefix matches so employee numbers like CT001 do not flood the list.
 */
export function matchesTimetableFaculty(
  member: TimetableFacultySearchable,
  rawQuery: string,
): boolean {
  const q = normalize(rawQuery);
  if (!q) return true;

  const shortCode = normalize(member.shortCode);
  const employeeCode = normalize(member.employeeCode);
  const name = normalize(member.fullName);
  const words = nameWords(name);

  if (shortCode === q || (shortCode && shortCode.startsWith(q))) return true;
  if (words.some((word) => word.startsWith(q))) return true;
  if (q.length >= 3 && name.includes(q)) return true;

  const looksLikeEmployeeNo = /\d/.test(q) || q.length >= 3;
  if (looksLikeEmployeeNo && (employeeCode === q || employeeCode.startsWith(q))) {
    return true;
  }

  return false;
}

export function compareTimetableFacultyMatches(rawQuery: string) {
  const q = normalize(rawQuery);
  const rank = (member: TimetableFacultySearchable) => {
    const shortCode = normalize(member.shortCode);
    if (q && shortCode === q) return 0;
    if (q && shortCode.startsWith(q)) return 1;
    const employeeCode = normalize(member.employeeCode);
    if (q && employeeCode === q) return 2;
    if (q && employeeCode.startsWith(q)) return 3;
    return 4;
  };

  return (a: TimetableFacultySearchable, b: TimetableFacultySearchable) => {
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: 'base' });
  };
}
