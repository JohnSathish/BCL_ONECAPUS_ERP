import type { AudienceFilter } from '@/types/communication';

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
};

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
      audienceType: 'STUDENTS',
      patch: {},
    });
  }

  return suggestions;
}
