/** College-record signals. The member list SQL uses these same tokens. */

export const INACTIVE_STUDENT_STATUSES = [
  'ALUMNI',
  'GRADUATED',
  'PASSED_OUT',
  'PASSED OUT',
  'LEFT',
  'TRANSFERRED',
  'INACTIVE',
  'DROPPED',
  'DISCONTINUED',
  'CANCELLED',
  'WITHDRAWN',
] as const;

export const INACTIVE_LIFECYCLES = [
  'GRADUATED',
  'ALUMNI',
  'LEFT',
  'TRANSFERRED',
  'WITHDRAWN',
  'INACTIVE',
  'COMPLETED',
  'EXITED',
] as const;

export const INACTIVE_PROGRAMMES = [
  'COMPLETED',
  'GRADUATED',
  'ALUMNI',
  'WITHDRAWN',
] as const;

export const RESEARCH_LEVELS = [
  'PHD',
  'PH.D',
  'DOCTORAL',
  'RESEARCH',
  'MPHIL',
  'M.PHIL',
] as const;

export const RESEARCH_TEXT_MARKERS = [
  'PHD',
  'MPHIL',
  'RESEARCH SCHOLAR',
] as const;

export const BLOCK_REASONS = [
  'OVERDUE',
  'UNPAID_FINES',
  'LOST_BOOKS',
  'DAMAGED_BOOKS',
  'DISCIPLINARY',
  'ADMINISTRATIVE',
  'OTHER',
] as const;

export type BlockReason = (typeof BLOCK_REASONS)[number];
export type DerivedMembershipStatus = 'ACTIVE' | 'INACTIVE';
export type ShownMembershipStatus = DerivedMembershipStatus | 'BLOCKED';

export function textMatchesResearch(value: string) {
  const blob = value.toUpperCase().replace(/\./g, '');
  return RESEARCH_TEXT_MARKERS.some((marker) => blob.includes(marker));
}

export function programmeKind(
  level?: string | null,
  name?: string | null,
  code?: string | null,
): 'STUDENT' | 'RESEARCH_SCHOLAR' {
  if (
    RESEARCH_LEVELS.includes(
      (level ?? '').toUpperCase() as (typeof RESEARCH_LEVELS)[number],
    )
  ) {
    return 'RESEARCH_SCHOLAR';
  }
  if (textMatchesResearch(`${name ?? ''} ${code ?? ''}`))
    return 'RESEARCH_SCHOLAR';
  return 'STUDENT';
}

/** Teaching staff use faculty loan rules. Every other staff type is non-teaching. */
export function staffKind(
  staffType?: string | null,
  designation?: string | null,
): 'FACULTY' | 'STAFF' | 'RESEARCH_SCHOLAR' {
  if (textMatchesResearch(designation ?? '')) return 'RESEARCH_SCHOLAR';
  if ((staffType ?? '').toUpperCase() === 'TEACHING') return 'FACULTY';
  return 'STAFF';
}

export function studentActivityStatus(
  studentStatus?: string | null,
  lifecycle?: string | null,
  programmeStatus?: string | null,
): DerivedMembershipStatus {
  const status = (studentStatus ?? '').toUpperCase();
  const life = (lifecycle ?? '').toUpperCase();
  const programme = (programmeStatus ?? '').toUpperCase();
  if (
    (INACTIVE_STUDENT_STATUSES as readonly string[]).includes(status) ||
    (INACTIVE_LIFECYCLES as readonly string[]).includes(life) ||
    (INACTIVE_PROGRAMMES as readonly string[]).includes(programme)
  ) {
    return 'INACTIVE';
  }
  return 'ACTIVE';
}

export function staffActivityStatus(
  status?: string | null,
  relievingDate?: Date | string | null,
  today = new Date(),
): DerivedMembershipStatus {
  if ((status ?? '').toUpperCase() !== 'ACTIVE') return 'INACTIVE';
  if (relievingDate) {
    const end = new Date(relievingDate);
    const day = new Date(today);
    end.setHours(0, 0, 0, 0);
    day.setHours(0, 0, 0, 0);
    if (!Number.isNaN(end.getTime()) && end < day) return 'INACTIVE';
  }
  return 'ACTIVE';
}

/** A librarian block stays in force. College active/inactive comes from the live record. */
export function shownStatus(
  derived: DerivedMembershipStatus,
  stored?: string | null,
): ShownMembershipStatus {
  if (stored === 'BLOCKED') return 'BLOCKED';
  return derived;
}
