export const IA_EXAM_TYPES = [
  'IA_TEST_1',
  'IA_TEST_2',
  'IA_TEST_3',
  'IA_ASSIGNMENT',
  'IA_PRACTICAL',
  'IA_VIVA',
  'IA_SEMINAR',
  'IA_PROJECT',
  'IA_PRESENTATION',
  'IA_PROJECT_WORK',
  'IA_CIE',
] as const;

export const LEGACY_EXAM_TYPES = ['SEMESTER_END'] as const;

export const DEFAULT_IA_COMPONENTS = [
  { code: 'IA_TEST_1', label: 'IA Test 1', maxMarks: 20, sortOrder: 1 },
  { code: 'IA_TEST_2', label: 'IA Test 2', maxMarks: 10, sortOrder: 2 },
  { code: 'ASSIGNMENT', label: 'Assignment', maxMarks: 10, sortOrder: 3 },
  { code: 'ATTENDANCE', label: 'Attendance', maxMarks: 5, sortOrder: 4 },
  { code: 'SEMINAR', label: 'Seminar', maxMarks: 5, sortOrder: 5 },
] as const;

export const SHEET_STATUSES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  HOD_APPROVED: 'HOD_APPROVED',
  CONTROLLER_VERIFIED: 'CONTROLLER_VERIFIED',
  PRINCIPAL_APPROVED: 'PRINCIPAL_APPROVED',
  LOCKED: 'LOCKED',
  REJECTED: 'REJECTED',
  REVOKED: 'REVOKED',
} as const;

export const APPROVAL_STEPS = [
  {
    stepCode: 'HOD_REVIEW',
    stepName: 'HOD Approval',
    roleSlug: 'hod',
    sequence: 1,
  },
  {
    stepCode: 'CONTROLLER_VERIFY',
    stepName: 'Controller Verification',
    roleSlug: 'examination-cell',
    sequence: 2,
  },
  {
    stepCode: 'PRINCIPAL_APPROVE',
    stepName: 'Principal Approval',
    roleSlug: 'principal',
    sequence: 3,
  },
] as const;

export function isIaExamType(examType?: string | null) {
  if (!examType) return false;
  return (IA_EXAM_TYPES as readonly string[]).includes(examType);
}

export function isLegacyExamType(examType?: string | null) {
  return examType === 'SEMESTER_END';
}

/** A datetime without a zone is the college wall clock in India. */
export function marksDeadlineInstant(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  const zoned = /[zZ]$|[+-]\d{2}:\d{2}$/.test(text) ? text : `${text}+05:30`;
  const date = new Date(zoned);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMarksDeadline(date: Date) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}
