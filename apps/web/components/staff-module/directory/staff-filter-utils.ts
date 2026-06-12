import type { StaffDirectoryRow } from '@/types/staff';

export type StaffDirectoryFilters = {
  search: string;

  staffType: string;

  departmentId: string;

  designationId: string;

  additionalRoleCode: string;

  shiftId: string;

  status: string;

  uiPortalPending: string;

  uiNoSubjects: string;

  uiOnLeave: string;

  uiHodOnly: string;

  uiActiveTeaching: string;

  uiHasPublications: string;
};

export const emptyStaffFilters = (): StaffDirectoryFilters => ({
  search: '',

  staffType: '',

  departmentId: '',

  designationId: '',

  additionalRoleCode: '',

  shiftId: '',

  status: '',

  uiPortalPending: '',

  uiNoSubjects: '',

  uiOnLeave: '',

  uiHodOnly: '',

  uiActiveTeaching: '',

  uiHasPublications: '',
});

export function staffFiltersToParams(
  filters: StaffDirectoryFilters,

  page: number,

  limit: number,
) {
  const opt = (v: string) => v || undefined;

  return {
    page,

    limit,

    search: opt(filters.search),

    staffType: opt(filters.staffType),

    departmentId: opt(filters.departmentId),

    designationId: opt(filters.designationId),

    additionalRoleCode: opt(filters.additionalRoleCode),

    shiftId: opt(filters.shiftId),

    status: opt(filters.status),

    hodOnly: filters.uiHodOnly === 'true' ? true : undefined,

    activeTeachingOnly: filters.uiActiveTeaching === 'true' ? true : undefined,

    hasPublications: filters.uiHasPublications === 'true' ? true : undefined,
  };
}

export function countActiveStaffFilters(filters: StaffDirectoryFilters): number {
  let n = 0;

  if (filters.staffType) n++;

  if (filters.departmentId) n++;

  if (filters.designationId) n++;

  if (filters.additionalRoleCode) n++;

  if (filters.shiftId) n++;

  if (filters.status) n++;

  if (filters.uiPortalPending) n++;

  if (filters.uiNoSubjects) n++;

  if (filters.uiOnLeave) n++;

  if (filters.uiHodOnly) n++;

  if (filters.uiActiveTeaching) n++;

  if (filters.uiHasPublications) n++;

  return n;
}

export function applyClientSideStaffFilters(
  rows: StaffDirectoryRow[],

  filters: StaffDirectoryFilters,
): StaffDirectoryRow[] {
  let result = rows;

  if (filters.uiPortalPending === 'true') {
    result = result.filter((r) => r.portalPending);
  }

  if (filters.uiNoSubjects === 'true') {
    result = result.filter((r) => r.staffType === 'TEACHING' && r.subjectAssignments === 0);
  }

  if (filters.uiOnLeave === 'true') {
    result = result.filter((r) => r.status === 'ON_LEAVE');
  }

  return result;
}

export function staffTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    TEACHING: 'Teaching',
    NON_TEACHING: 'Non Teaching',
    GUEST: 'Guest Faculty',
    VISITING: 'Visiting Faculty',
    CONTRACT: 'Contract Staff',
    ADMIN: 'Administrative',
  };
  if (labels[type]) return labels[type];
  return type
    .toLowerCase()
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export function staffStatusTone(status: string): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'ACTIVE':
      return 'success';

    case 'ON_LEAVE':
      return 'warning';

    case 'SUSPENDED':

    case 'INACTIVE':

    case 'RELIEVED':

    case 'RETIRED':

    case 'CONTRACT_ENDED':
      return 'danger';

    default:
      return 'default';
  }
}
