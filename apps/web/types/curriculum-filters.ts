export { NEP_CURRICULUM_CATEGORIES as CURRICULUM_CATEGORIES } from '@/constants/nep-curriculum-categories';
export type { NepCurriculumCategory } from '@/constants/nep-curriculum-categories';

export const CURRICULUM_MAPPING_STATUSES = ['FULL', 'PARTIAL', 'UNMAPPED'] as const;
export const CURRICULUM_ENROLLMENT_STATUSES = [
  'OPEN',
  'NEAR_FULL',
  'FULL',
  'NO_ENROLLMENT',
] as const;
export const CURRICULUM_VERSION_STATUSES = ['ALL', 'ACTIVE', 'DRAFT', 'ARCHIVED'] as const;
export const CURRICULUM_CREDIT_FILTERS = ['2', '3', '4', 'gt4'] as const;

export const CURRICULUM_QUICK_TOGGLES = [
  { id: 'SHARED_POOLS', label: 'Shared Pools', quickToggle: 'SHARED_POOLS' as const },
  { id: 'COMMON_FYUGP', label: 'Common FYUGP', quickToggle: 'COMMON_FYUGP' as const },
  { id: 'MINOR_TRACK', label: 'Minor Track', quickToggle: 'MINOR_TRACK' as const },
  { id: 'HONOURS', label: 'Honours Papers', quickToggle: 'HONOURS' as const },
  { id: 'LABS', label: 'Labs', quickToggle: 'LABS' as const },
  { id: 'HAS_PRACTICAL', label: 'Has Practical', quickToggle: 'HAS_PRACTICAL' as const },
  { id: 'MISSING_FACULTY', label: 'Missing Faculty', quickToggle: 'MISSING_FACULTY' as const },
  { id: 'CROSS_LISTED', label: 'Cross-listed', disabled: true },
  { id: 'MISSING_TIMETABLE', label: 'Missing Timetable', disabled: true },
] as const;

export type CurriculumFilters = {
  search: string;
  programVersionId: string;
  departmentId: string;
  categories: string[];
  semesters: number[];
  streamId: string;
  shiftId: string;
  batchId: string;
  sharedPool: '' | 'pool' | 'programme';
  mappingStatus: string;
  deliveryType: string;
  credits: string;
  enrollmentStatus: string;
  facultyAssigned: '' | 'true' | 'false';
  versionStatus: string;
  quickToggle: string;
};

export const emptyCurriculumFilters = (): CurriculumFilters => ({
  search: '',
  programVersionId: '',
  departmentId: '',
  categories: [],
  semesters: [],
  streamId: '',
  shiftId: '',
  batchId: '',
  sharedPool: '',
  mappingStatus: '',
  deliveryType: '',
  credits: '',
  enrollmentStatus: '',
  facultyAssigned: '',
  versionStatus: 'ALL',
  quickToggle: '',
});

export type CurriculumOfferingQuery = {
  page?: number;
  limit?: number;
  search?: string;
  programVersionId?: string;
  departmentId?: string;
  category?: string;
  semesterSequence?: string;
  streamId?: string;
  shiftId?: string;
  isSharedPool?: boolean;
  mappingStatus?: string;
  deliveryType?: string;
  credits?: string;
  enrollmentStatus?: string;
  facultyAssigned?: boolean;
  versionStatus?: string;
  quickToggle?: string;
};

export function curriculumFiltersToQuery(
  filters: CurriculumFilters,
  searchOverride?: string,
): CurriculumOfferingQuery {
  const search = (searchOverride ?? filters.search).trim();
  return {
    search: search || undefined,
    programVersionId: filters.programVersionId || undefined,
    departmentId: filters.departmentId || undefined,
    category: filters.categories.length ? filters.categories.join(',') : undefined,
    semesterSequence: filters.semesters.length ? filters.semesters.join(',') : undefined,
    streamId: filters.streamId || undefined,
    shiftId: filters.shiftId || undefined,
    isSharedPool:
      filters.sharedPool === 'pool' ? true : filters.sharedPool === 'programme' ? false : undefined,
    mappingStatus: filters.mappingStatus || undefined,
    deliveryType: filters.deliveryType || undefined,
    credits: filters.credits || undefined,
    enrollmentStatus: filters.enrollmentStatus || undefined,
    facultyAssigned:
      filters.facultyAssigned === 'true'
        ? true
        : filters.facultyAssigned === 'false'
          ? false
          : undefined,
    versionStatus:
      filters.versionStatus && filters.versionStatus !== 'ALL' ? filters.versionStatus : undefined,
    quickToggle: filters.quickToggle || undefined,
  };
}

export type CurriculumOfferingRow = import('@/types/programs').CourseOffering & {
  mappingStatus?: string;
  enrollmentStatus?: string;
  hasFaculty?: boolean;
  isHonours?: boolean;
  isCrossListed?: boolean;
  poolId?: string | null;
  poolName?: string | null;
};
