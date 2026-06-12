import type { CurriculumOfferingListQueryDto } from '../dto/curriculum-offering-list-query.dto';

export type CurriculumSectionSnapshot = {
  sectionCode: string;
  shiftId: string | null;
  capacity: number;
  studentGroup?: string | null;
  staffProfileId?: string | null;
  seatLedger?: { confirmedCount: number } | null;
  subjectAssignments?: unknown[];
};

export type CurriculumOfferingSnapshot = {
  majorPaperIndex?: number | null;
  sections: CurriculumSectionSnapshot[];
};

export type CurriculumMappingStatus = 'FULL' | 'PARTIAL' | 'UNMAPPED';
export type CurriculumEnrollmentStatus =
  | 'OPEN'
  | 'NEAR_FULL'
  | 'FULL'
  | 'NO_ENROLLMENT';

const HONOURS_GROUPS = new Set(['HONOURS', 'HONOR', 'HONORS']);
const FYUGP_POOL_CATEGORIES = ['MDC', 'AEC', 'SEC', 'VAC', 'VTC'];

export function applyQuickToggle(
  query: CurriculumOfferingListQueryDto,
): CurriculumOfferingListQueryDto {
  if (!query.quickToggle) return query;
  const next = { ...query };
  switch (query.quickToggle) {
    case 'SHARED_POOLS':
      next.isSharedPool = true;
      break;
    case 'COMMON_FYUGP':
      next.category = FYUGP_POOL_CATEGORIES;
      break;
    case 'MINOR_TRACK':
      next.category = ['MINOR'];
      break;
    case 'HONOURS':
      break;
    case 'LABS':
      break;
    case 'HAS_PRACTICAL':
      break;
    case 'MISSING_FACULTY':
      next.facultyAssigned = false;
      break;
    default:
      break;
  }
  return next;
}

function isSectionComplete(section: CurriculumSectionSnapshot): boolean {
  return Boolean(
    section.shiftId && section.sectionCode?.trim() && section.capacity > 0,
  );
}

export function computeMappingStatus(
  sections: CurriculumSectionSnapshot[],
): CurriculumMappingStatus {
  if (!sections.length) return 'UNMAPPED';
  if (sections.every(isSectionComplete)) return 'FULL';
  return 'PARTIAL';
}

export function computeEnrollmentStatus(
  sections: CurriculumSectionSnapshot[],
): CurriculumEnrollmentStatus {
  if (!sections.length) return 'NO_ENROLLMENT';
  const counts = sections.map((section) => ({
    confirmed: section.seatLedger?.confirmedCount ?? 0,
    capacity: section.capacity,
  }));
  if (counts.every((row) => row.confirmed === 0)) return 'NO_ENROLLMENT';
  if (counts.some((row) => row.capacity > 0 && row.confirmed >= row.capacity)) {
    return 'FULL';
  }
  if (
    counts.some(
      (row) =>
        row.capacity > 0 &&
        row.confirmed >= Math.ceil(row.capacity * 0.9) &&
        row.confirmed < row.capacity,
    )
  ) {
    return 'NEAR_FULL';
  }
  return 'OPEN';
}

export function computeHasFaculty(
  sections: CurriculumSectionSnapshot[],
): boolean {
  return sections.some(
    (section) =>
      Boolean(section.staffProfileId) ||
      (section.subjectAssignments?.length ?? 0) > 0,
  );
}

export function computeIsHonours(
  offering: CurriculumOfferingSnapshot,
): boolean {
  if (offering.majorPaperIndex != null) return true;
  return offering.sections.some((section) =>
    section.studentGroup
      ? HONOURS_GROUPS.has(section.studentGroup.trim().toUpperCase())
      : false,
  );
}

export function matchesHonoursQuickToggle(
  offering: CurriculumOfferingSnapshot,
): boolean {
  return computeIsHonours(offering);
}

export function matchesMappingStatusFilter(
  status: CurriculumMappingStatus,
  filter?: CurriculumMappingStatus,
): boolean {
  if (!filter) return true;
  return status === filter;
}

export function matchesEnrollmentStatusFilter(
  status: CurriculumEnrollmentStatus,
  filter?: CurriculumEnrollmentStatus,
): boolean {
  if (!filter) return true;
  return status === filter;
}

export function matchesFacultyFilter(
  hasFaculty: boolean,
  filter?: boolean,
): boolean {
  if (filter === undefined) return true;
  return filter ? hasFaculty : !hasFaculty;
}

/** Keep first occurrence when the same offering id appears more than once. */
export function dedupeCurriculumOfferingRows<T extends { id: string }>(
  rows: T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}
