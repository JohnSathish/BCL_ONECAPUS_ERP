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

/** Major and minor classes must not share one attendance list. */
export function majorMinorCategory(
  value?: string | null,
): 'MAJOR' | 'MINOR' | null {
  const category = normalizeFyugpCategory(value);
  if (category === 'MAJOR' || category === 'MINOR') return category;
  return null;
}

function cleanName(value?: string | null) {
  const text = value?.trim() ?? '';
  if (!text || text.toLowerCase() === 'student') return '';
  return text;
}

/** A portal username is often the roll. An email address is not a roll. */
export function attendanceRollNumber(
  student?: {
    rollNumber?: string | null;
    universityRollNumber?: string | null;
    user?: { username?: string | null } | null;
  } | null,
) {
  const username = student?.user?.username?.trim() ?? '';
  return (
    student?.rollNumber?.trim() ||
    student?.universityRollNumber?.trim() ||
    (username && !username.includes('@') ? username : '') ||
    null
  );
}

export function attendanceEnrollmentNumber(
  student?: {
    enrollmentNumber?: string | null;
    universityRegistrationNumber?: string | null;
    admissionNumber?: string | null;
  } | null,
) {
  return (
    student?.enrollmentNumber?.trim() ||
    student?.universityRegistrationNumber?.trim() ||
    student?.admissionNumber?.trim() ||
    null
  );
}

/** Profile name, then the login name, then roll or enrollment. */
export function resolveStudentFullName(
  student?: {
    masterProfile?: { fullName?: string | null } | null;
    user?: { displayName?: string | null; username?: string | null } | null;
    enrollmentNumber?: string | null;
    rollNumber?: string | null;
    universityRollNumber?: string | null;
    universityRegistrationNumber?: string | null;
    admissionNumber?: string | null;
  } | null,
) {
  const profile = cleanName(student?.masterProfile?.fullName);
  if (profile) return profile;
  const display = cleanName(student?.user?.displayName);
  if (display) return display;
  return (
    attendanceRollNumber(student) ||
    attendanceEnrollmentNumber(student) ||
    'Student'
  );
}

/** Fields a report needs. Do not load the full profile (address JSON can fail the request). */
export const attendanceStudentSelect = {
  id: true,
  userId: true,
  rollNumber: true,
  enrollmentNumber: true,
  admissionNumber: true,
  universityRollNumber: true,
  universityRegistrationNumber: true,
  masterProfile: {
    select: { fullName: true, mobileNumber: true, email: true },
  },
  user: { select: { displayName: true, username: true, email: true } },
} as const;

/** Fields the attendance roll needs. Do not load the full profile (address JSON can fail the request). */
export const rosterStudentSelect = {
  id: true,
  rollNumber: true,
  enrollmentNumber: true,
  admissionNumber: true,
  masterProfile: { select: { fullName: true } },
  user: { select: { displayName: true } },
} as const;

export function registrationLineCategoryWhere(value?: string | null) {
  const category = majorMinorCategory(value);
  if (!category) return {};
  return { category: { equals: category, mode: 'insensitive' as const } };
}

/** category is a required string, so `{ not: null }` is an invalid Prisma filter. */
export function majorMinorCategorySetWhere() {
  return {
    OR: [
      { category: { equals: 'MAJOR', mode: 'insensitive' as const } },
      { category: { equals: 'MINOR', mode: 'insensitive' as const } },
    ],
  };
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
    input.semesterNo != null ? `Semester ${input.semesterNo}` : null;
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
