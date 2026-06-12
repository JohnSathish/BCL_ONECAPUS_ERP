import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';
import type { StudentDirectoryRow } from '@/types/students';

export type FilterOptionMaps = {
  program?: Map<string, string>;
  batch?: Map<string, string>;
  shift?: Map<string, string>;
  stream?: Map<string, string>;
  department?: Map<string, string>;
  session?: Map<string, string>;
  category?: Map<string, string>;
  religion?: Map<string, string>;
};

export function buildBulkHref(
  base: string,
  selectedIds: Set<string>,
  filters: DirectoryFilters,
): string {
  const params = new URLSearchParams();
  if (selectedIds.size > 0) {
    params.set('studentIds', [...selectedIds].join(','));
  }
  if (filters.programVersionId) params.set('programVersionId', filters.programVersionId);
  if (filters.batchId) params.set('batchId', filters.batchId);
  if (filters.shiftId) params.set('shiftId', filters.shiftId);
  if (filters.semester) params.set('semester', filters.semester);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

type ActiveFilter = {
  key: keyof DirectoryFilters;
  label: string;
  value: string;
};

export function getActiveFilters(
  filters: DirectoryFilters,
  options: FilterOptionMaps,
): ActiveFilter[] {
  const chips: ActiveFilter[] = [];

  const push = (
    key: keyof DirectoryFilters,
    label: string,
    value: string | undefined,
    resolve?: Map<string, string>,
  ) => {
    if (!value?.trim()) return;
    chips.push({
      key,
      label,
      value: resolve?.get(value) ?? value,
    });
  };

  if (filters.search.trim()) {
    chips.push({ key: 'search', label: 'Search', value: filters.search.trim() });
  }
  push('programVersionId', 'Programme', filters.programVersionId, options.program);
  push('semester', 'Semester', filters.semester ? `Sem ${filters.semester}` : '');
  push('batchId', 'Batch', filters.batchId, options.batch);
  push('shiftId', 'Shift', filters.shiftId, options.shift);
  push('streamId', 'Stream', filters.streamId, options.stream);
  push('departmentId', 'Department', filters.departmentId, options.department);
  push('sessionId', 'Session', filters.sessionId, options.session);
  push('categoryLookupId', 'Category', filters.categoryLookupId, options.category);
  push('religionLookupId', 'Religion', filters.religionLookupId, options.religion);
  if (filters.differentlyAbled === 'true') {
    chips.push({ key: 'differentlyAbled', label: 'Differently abled', value: 'Yes' });
  } else if (filters.differentlyAbled === 'false') {
    chips.push({ key: 'differentlyAbled', label: 'Differently abled', value: 'No' });
  }
  push('studentStatus', 'Status', filters.studentStatus);
  push('admissionType', 'Admission', filters.admissionType?.replace(/_/g, ' '));
  push('academicStatus', 'Academic', filters.academicStatus);
  push('admissionStatus', 'Admission status', filters.admissionStatus);
  if (filters.uiSubjectPending === 'true') {
    chips.push({ key: 'uiSubjectPending', label: 'Subjects', value: 'Pending' });
  }
  if (filters.uiFeeDue === 'true') {
    chips.push({ key: 'uiFeeDue', label: 'Fee', value: 'Due' });
  }
  if (filters.uiHostel === 'true') {
    chips.push({ key: 'uiHostel', label: 'Hostel', value: 'Yes' });
  }
  if (filters.uiRfidAssigned === 'true') {
    chips.push({ key: 'uiRfidAssigned', label: 'RFID', value: 'Assigned' });
  }
  if (filters.uiRfidAssigned === 'false') {
    chips.push({ key: 'uiRfidAssigned', label: 'RFID', value: 'Unassigned' });
  }
  if (filters.uiAttendanceShortage === 'true') {
    chips.push({ key: 'uiAttendanceShortage', label: 'Attendance', value: 'Shortage' });
  }
  if (filters.uiRecentlyAdded === 'true') {
    chips.push({ key: 'uiRecentlyAdded', label: 'Added', value: 'Recent' });
  }
  if (filters.uiNoPhoto === 'true') {
    chips.push({ key: 'uiNoPhoto', label: 'Photo', value: 'Missing' });
  }
  if (filters.uiNoMobile === 'true') {
    chips.push({ key: 'uiNoMobile', label: 'Mobile', value: 'Missing' });
  }

  return chips;
}

export function countActiveFilters(filters: DirectoryFilters): number {
  return getActiveFilters(filters, {}).length;
}

export function optionsToMap(options: { id: string; label: string }[]): Map<string, string> {
  return new Map(options.map((o) => [o.id, o.label]));
}

/** @deprecated All directory filters are server-side; kept for compatibility */
export function applyClientSideDirectoryFilters(
  rows: StudentDirectoryRow[],
  _filters: DirectoryFilters,
): StudentDirectoryRow[] {
  return rows;
}
