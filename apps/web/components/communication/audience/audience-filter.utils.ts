import type { AudienceFilter } from '@/types/communication';
import {
  COMMITTEE_ONLY_FILTER_KEYS,
  INDIVIDUAL_ONLY_FILTER_KEYS,
  STAFF_ONLY_FILTER_KEYS,
  STUDENT_ONLY_FILTER_KEYS,
} from '@/components/communication/audience/audience-filter-config';

/** Drop empty arrays / blank strings / falsey optionals so the API payload stays clean. */
export function compactAudienceFilter(filter: AudienceFilter): AudienceFilter {
  const out: AudienceFilter = {};
  const copy = filter as Record<string, unknown>;
  for (const [key, value] of Object.entries(copy)) {
    // Academic Year / calendar semester UUIDs must never drive student targeting.
    if (key === 'academicYearIds' || key === 'semesterIds') continue;
    if (value == null || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (typeof value === 'boolean' && value === false) continue;
    if (key === 'semesterSequences' && Array.isArray(value)) {
      const sequences = [
        ...new Set(
          value.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 8),
        ),
      ].sort((a, b) => a - b);
      if (!sequences.length) continue;
      out.semesterSequences = sequences;
      continue;
    }
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

export const EMPTY_AUDIENCE_FILTER: AudienceFilter = {
  departmentIds: [],
  shiftIds: [],
  semesterSequences: [],
  admissionBatchIds: [],
  studentIds: [],
  excludeStudentIds: [],
  staffProfileIds: [],
  designationIds: [],
  committeeIds: [],
  userIds: [],
  staffStatuses: [],
};

function clearKeys(filter: AudienceFilter, keys: readonly string[]): AudienceFilter {
  const next = { ...filter } as Record<string, unknown>;
  for (const key of keys) {
    if (key.endsWith('Ids') || key === 'semesterSequences' || key === 'staffStatuses') {
      next[key] = [];
    } else {
      next[key] = undefined;
    }
  }
  return next as AudienceFilter;
}

/**
 * When the administrator switches audience type, drop incompatible filter fields
 * so student-only chips never leak into staff campaigns and vice versa.
 */
export function resetFilterForAudience(
  audienceType: string,
  current: AudienceFilter = EMPTY_AUDIENCE_FILTER,
): AudienceFilter {
  let next = { ...EMPTY_AUDIENCE_FILTER, ...current };

  switch (audienceType) {
    case 'STUDENTS':
    case 'PARENTS':
    case 'ALUMNI':
      next = clearKeys(next, [
        ...STAFF_ONLY_FILTER_KEYS,
        ...COMMITTEE_ONLY_FILTER_KEYS,
        ...INDIVIDUAL_ONLY_FILTER_KEYS,
      ]);
      if (audienceType === 'ALUMNI') {
        next.semesterSequences = [];
      }
      break;
    case 'FACULTY':
    case 'TEACHING_STAFF':
    case 'NON_TEACHING_STAFF':
      next = clearKeys(next, [
        ...STUDENT_ONLY_FILTER_KEYS,
        ...COMMITTEE_ONLY_FILTER_KEYS,
        ...INDIVIDUAL_ONLY_FILTER_KEYS,
      ]);
      if (audienceType === 'TEACHING_STAFF') {
        next.teaching = true;
        next.nonTeaching = undefined;
      } else if (audienceType === 'NON_TEACHING_STAFF') {
        next.nonTeaching = true;
        next.teaching = undefined;
      }
      break;
    case 'COMMITTEE':
      next = clearKeys(next, [
        ...STUDENT_ONLY_FILTER_KEYS,
        ...STAFF_ONLY_FILTER_KEYS,
        ...INDIVIDUAL_ONLY_FILTER_KEYS,
        'departmentIds',
        'shiftIds',
        'gender',
      ]);
      break;
    case 'DEPARTMENTS':
      next = clearKeys(next, [
        ...STUDENT_ONLY_FILTER_KEYS,
        ...STAFF_ONLY_FILTER_KEYS,
        ...COMMITTEE_ONLY_FILTER_KEYS,
        ...INDIVIDUAL_ONLY_FILTER_KEYS,
        'shiftIds',
        'gender',
      ]);
      break;
    case 'INDIVIDUAL':
      next = clearKeys(next, [
        ...STUDENT_ONLY_FILTER_KEYS.filter((k) => k !== 'studentIds' && k !== 'excludeStudentIds'),
        ...STAFF_ONLY_FILTER_KEYS.filter((k) => k !== 'staffProfileIds'),
        ...COMMITTEE_ONLY_FILTER_KEYS,
        'departmentIds',
        'shiftIds',
        'gender',
      ]);
      break;
    default:
      break;
  }

  next.academicYearIds = undefined;
  next.semesterIds = undefined;
  return next;
}

/**
 * Map legacy saved-segment audience types onto the Phase-1 dropdown values.
 */
export function migrateLegacyAudience(
  audienceType: string,
  filter: AudienceFilter,
): {
  audienceType: string;
  filter: AudienceFilter;
} {
  if (audienceType === 'TEACHING_STAFF') {
    return {
      audienceType: 'FACULTY',
      filter: resetFilterForAudience('FACULTY', {
        ...filter,
        teaching: true,
        nonTeaching: undefined,
      }),
    };
  }
  if (audienceType === 'NON_TEACHING_STAFF') {
    return {
      audienceType: 'FACULTY',
      filter: resetFilterForAudience('FACULTY', {
        ...filter,
        nonTeaching: true,
        teaching: undefined,
      }),
    };
  }
  if (audienceType === 'ALL_USERS' || audienceType === 'APPLICANTS') {
    return {
      audienceType: 'STUDENTS',
      filter: resetFilterForAudience('STUDENTS', filter),
    };
  }
  return { audienceType, filter: resetFilterForAudience(audienceType, filter) };
}

export const LARGE_BROADCAST_THRESHOLD = 1000;

const ROMAN: Record<number, string> = {
  1: 'I',
  2: 'II',
  3: 'III',
  4: 'IV',
  5: 'V',
  6: 'VI',
  7: 'VII',
  8: 'VIII',
};

export function formatSemesterLabel(sequence: number) {
  return `Semester ${ROMAN[sequence] ?? sequence}`;
}

export type AudienceSuggestion = {
  id: string;
  label: string;
  description: string;
  audienceType?: string;
  patch: Partial<AudienceFilter>;
};

export function titleAudienceSuggestions(title: string): AudienceSuggestion[] {
  const t = title.toLowerCase();
  const suggestions: AudienceSuggestion[] = [];

  if (/\b(holiday|vacation|closure|closed|puja|christmas|diwali)\b/.test(t)) {
    suggestions.push({
      id: 'holiday-all-students',
      label: 'All current students',
      description: 'Clears shift/department/semester — all active students.',
      audienceType: 'STUDENTS',
      patch: {
        departmentIds: [],
        shiftIds: [],
        semesterSequences: [],
        admissionBatchIds: [],
        feeStatus: undefined,
        attendanceBelowPct: undefined,
      },
    });
  }

  if (/\b(fee|fees|payment|dues?|defaulter|outstanding)\b/.test(t)) {
    suggestions.push({
      id: 'fee-pending',
      label: 'Pending fees',
      description: 'Target students with open fee balances.',
      audienceType: 'STUDENTS',
      patch: { feeStatus: 'PENDING' },
    });
  }

  if (/\b(seminar|workshop|guest lecture|orientation)\b/.test(t)) {
    suggestions.push({
      id: 'seminar-dept',
      label: 'Keep department filter',
      description: 'Seminars are usually department-scoped — confirm department below.',
      audienceType: 'STUDENTS',
      patch: {},
    });
  }

  if (/\b(fresher|freshers|induction|semester\s*i\b|sem\s*1)\b/.test(t)) {
    suggestions.push({
      id: 'freshers-sem1',
      label: 'Semester I',
      description: 'Current first-semester students from the active cycle.',
      audienceType: 'STUDENTS',
      patch: { semesterSequences: [1] },
    });
  }

  if (/\b(attendance|shortage|absen)/.test(t)) {
    suggestions.push({
      id: 'attendance-below-75',
      label: 'Attendance below 75%',
      description: 'Reach students below the eligibility threshold.',
      audienceType: 'STUDENTS',
      patch: { attendanceBelowPct: 75 },
    });
  }

  if (/\b(convocation|graduation|alumni|placement)\b/.test(t)) {
    suggestions.push({
      id: 'use-batch-filter',
      label: 'Use admission batch',
      description: 'Open More filters → Admission batch for cohort announcements.',
      audienceType: 'ALUMNI',
      patch: {},
    });
  }

  if (/\b(staff|faculty|teachers?|hod|principal)\b/.test(t)) {
    suggestions.push({
      id: 'all-staff',
      label: 'All staff',
      description: 'Switch audience to Staff and clear student-only filters.',
      audienceType: 'FACULTY',
      patch: {
        teaching: undefined,
        nonTeaching: undefined,
        designationIds: [],
        staffStatuses: [],
      },
    });
  }

  return suggestions;
}
