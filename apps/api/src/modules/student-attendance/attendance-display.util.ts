/**
 * Faculty-facing attendance display labels.
 * Major/Minor → "Major Economics" / "Minor Sociology" (department / subject name).
 * AEC/SEC/MDC/VAC/VTC/Internship/Practical → keep course / paper title.
 */

const DEPARTMENT_STYLE_CATEGORIES = new Set(['MAJOR', 'MINOR']);

const COURSE_TITLE_CATEGORIES = new Set([
  'AEC',
  'SEC',
  'MDC',
  'VAC',
  'VTC',
  'INTERNSHIP',
  'INT',
  'PRACTICAL',
  'SKILL',
]);

function prettyName(value?: string | null) {
  if (!value?.trim()) return '';
  return value
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeFyugpCategory(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}

export function resolveAttendanceDisplayTitle(input: {
  fyugpCategory?: string | null;
  departmentName?: string | null;
  academicSubjectName?: string | null;
  subjectGroupTitle?: string | null;
  courseTitle?: string | null;
  courseCode?: string | null;
}): string {
  const category = normalizeFyugpCategory(input.fyugpCategory);
  const deptOrSubject =
    prettyName(input.departmentName) ||
    prettyName(input.academicSubjectName) ||
    prettyName(
      input.subjectGroupTitle?.replace(/^(Major|Minor)\s+/i, '').trim(),
    );

  if (DEPARTMENT_STYLE_CATEGORIES.has(category) && deptOrSubject) {
    const prefix = category === 'MINOR' ? 'Minor' : 'Major';
    return `${prefix} ${deptOrSubject}`;
  }

  if (
    COURSE_TITLE_CATEGORIES.has(category) ||
    !DEPARTMENT_STYLE_CATEGORIES.has(category)
  ) {
    return (
      input.courseTitle?.trim() ||
      input.subjectGroupTitle?.trim() ||
      input.courseCode?.trim() ||
      'Class'
    );
  }

  return (
    input.subjectGroupTitle?.trim() ||
    input.courseTitle?.trim() ||
    input.courseCode?.trim() ||
    'Class'
  );
}

export function buildAttendanceHeaderMeta(input: {
  displayTitle: string;
  semesterNo?: number | null;
  sectionCode?: string | null;
  periodNo?: number | null;
  sessionType?: string | null;
  roomLabel?: string | null;
}) {
  const lines: string[] = [input.displayTitle];
  const semester =
    input.semesterNo != null ? `Semester ${toRoman(input.semesterNo)}` : null;
  const section = input.sectionCode ? `Section ${input.sectionCode}` : null;
  const period =
    input.periodNo != null && input.periodNo > 0
      ? `Period ${input.periodNo}`
      : null;
  const type = input.sessionType ? prettyName(input.sessionType) : null;
  const room = input.roomLabel?.trim() || null;

  return {
    title: input.displayTitle,
    subtitle: [semester, section].filter(Boolean).join(' · '),
    details: [period, type, room].filter(Boolean).join(' · '),
    lines: [
      input.displayTitle,
      [semester, section].filter(Boolean).join(' · '),
      [period, type, room].filter(Boolean).join(' · '),
    ].filter(Boolean),
  };
}

function toRoman(n: number) {
  const map: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let value = Math.max(1, Math.floor(n));
  let out = '';
  for (const [num, roman] of map) {
    while (value >= num) {
      out += roman;
      value -= num;
    }
  }
  return out || String(n);
}
