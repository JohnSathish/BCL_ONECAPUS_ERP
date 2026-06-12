export const COMPLETION_STATUSES = ['COMPLETE', 'PARTIAL', 'NOT_CONFIGURED'] as const;
export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];

export const COMPLETION_ISSUE_TYPES = [
  'MISSING_CATEGORY',
  'MISSING_POOL',
  'MISSING_MAPPING',
  'MISSING_SECTION',
  'MISSING_FACULTY',
  'MISSING_CREDITS',
  'MISSING_STRUCTURE',
] as const;
export type CompletionIssueType = (typeof COMPLETION_ISSUE_TYPES)[number];

export const COMPLETION_QUICK_ACTIONS = [
  'ADD_COURSE',
  'CREATE_MAPPING',
  'CREATE_SECTION',
  'ADD_SHARED_POOL',
  'ASSIGN_FACULTY',
] as const;
export type CompletionQuickAction = (typeof COMPLETION_QUICK_ACTIONS)[number];

export type CompletionFilters = {
  institutionId: string;
  departmentId: string;
  programVersionId: string;
  semesterSequence: string;
  versionStatus: string;
  batchId: string;
};

export const emptyCompletionFilters = (): CompletionFilters => ({
  institutionId: '',
  departmentId: '',
  programVersionId: '',
  semesterSequence: '',
  versionStatus: 'ALL',
  batchId: '',
});

export type CompletionQueryParams = {
  institutionId?: string;
  departmentId?: string;
  programVersionId?: string;
  semesterSequence?: number;
  versionStatus?: string;
  batchId?: string;
  page?: number;
  limit?: number;
};

export function completionFiltersToParams(filters: CompletionFilters): CompletionQueryParams {
  return {
    institutionId: filters.institutionId || undefined,
    departmentId: filters.departmentId || undefined,
    programVersionId: filters.programVersionId || undefined,
    semesterSequence: filters.semesterSequence ? Number(filters.semesterSequence) : undefined,
    versionStatus:
      filters.versionStatus && filters.versionStatus !== 'ALL' ? filters.versionStatus : undefined,
    batchId: filters.batchId || undefined,
  };
}

export type CompletionCell = {
  category: string;
  required: number;
  actual: number;
  directCount: number;
  poolCount: number;
  status: CompletionStatus;
  poolAssigned: boolean;
  issues: CompletionIssueType[];
};

export type CompletionSemester = {
  semesterSequence: number;
  semesterStatus: CompletionStatus;
  hasStructureRule: boolean;
  cells: CompletionCell[];
};

export type CompletionProgramme = {
  programVersionId: string;
  programId: string;
  programCode: string;
  programName: string;
  version: number;
  versionStatus: string;
  departmentId: string | null;
  overallStatus: CompletionStatus;
  semesters: CompletionSemester[];
};

export type CompletionSummary = {
  totalProgrammes: number;
  completedSemesters: number;
  missingMappings: number;
  unmappedCourses: number;
  sharedPoolsMissing: number;
  pendingFacultyAssignment: number;
  highlightedSemester?: number | null;
};

export type CompletionMissingItem = {
  programVersionId: string;
  programCode: string;
  programName: string;
  semesterSequence: number;
  category: string;
  issueType: CompletionIssueType;
  courseCode?: string | null;
  courseTitle?: string | null;
  offeringId?: string | null;
  sectionId?: string | null;
  message: string;
  quickAction: CompletionQuickAction;
};

export type SharedPoolAuditRow = {
  category: string;
  semesterNo: number;
  poolExists: boolean;
  poolId?: string | null;
  poolName?: string | null;
  courseCount: number;
  sectionCount: number;
  programmesAssigned: number;
  status: CompletionStatus;
};

export type CellSelection = {
  programVersionId: string;
  programCode: string;
  semesterSequence: number;
  category: string;
} | null;

export const STATUS_STYLES: Record<CompletionStatus, string> = {
  COMPLETE: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30',
  PARTIAL: 'bg-amber-500/15 text-amber-800 border-amber-500/30',
  NOT_CONFIGURED: 'bg-destructive/10 text-destructive border-destructive/30',
};

export const STATUS_DOT: Record<CompletionStatus, string> = {
  COMPLETE: 'bg-emerald-500',
  PARTIAL: 'bg-amber-500',
  NOT_CONFIGURED: 'bg-destructive',
};

export function quickActionHref(item: CompletionMissingItem): string {
  switch (item.quickAction) {
    case 'ADD_COURSE':
      return '/admin/programs?tab=courses';
    case 'ADD_SHARED_POOL':
      return '/admin/academic-engine?tab=pools';
    case 'CREATE_MAPPING':
    case 'CREATE_SECTION':
    case 'ASSIGN_FACULTY':
      return `/admin/programs?tab=curriculum&programVersionId=${item.programVersionId}&category=${item.category}&sem=${item.semesterSequence}${item.offeringId ? `&offeringId=${item.offeringId}` : ''}`;
    default:
      return '/admin/programs?tab=curriculum';
  }
}

export function quickActionLabel(action: CompletionQuickAction): string {
  switch (action) {
    case 'ADD_COURSE':
      return 'Add course';
    case 'CREATE_MAPPING':
      return 'Create mapping';
    case 'CREATE_SECTION':
      return 'Create section';
    case 'ADD_SHARED_POOL':
      return 'Add shared pool';
    case 'ASSIGN_FACULTY':
      return 'Assign faculty';
    default:
      return 'Fix';
  }
}
