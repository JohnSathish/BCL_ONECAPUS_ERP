import type { CategoryMeta, SemesterRulePayload } from './fyugp-templates';

export const COMPLETION_STATUSES = [
  'COMPLETE',
  'PARTIAL',
  'NOT_CONFIGURED',
] as const;
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

export const CATEGORY_DISPLAY_ORDER = [
  'MAJOR',
  'MINOR',
  'MDC',
  'AEC',
  'SEC',
  'VAC',
  'VTC',
  'INTERNSHIP',
  'PROJECT',
  'RESEARCH',
  'DISSERTATION',
] as const;

export type CompletionSectionSnapshot = {
  id: string;
  sectionCode: string;
  shiftId: string | null;
  capacity: number;
  staffProfileId?: string | null;
  subjectAssignments?: unknown[];
};

export type CompletionOfferingSnapshot = {
  id: string;
  category: string | null;
  courseId: string;
  mappingSource?: string | null;
  course: { id: string; code: string; title: string; credits: number };
  sections: CompletionSectionSnapshot[];
};

export type CompletionCellInput = {
  category: string;
  required: number;
  directOfferings: CompletionOfferingSnapshot[];
  poolOfferings: CompletionOfferingSnapshot[];
  poolAssigned: boolean;
  isPoolEligible: boolean;
  hasStructureRule: boolean;
  expectedCredits?: number | null;
};

export type CompletionCellResult = {
  category: string;
  required: number;
  actual: number;
  directCount: number;
  poolCount: number;
  status: CompletionStatus;
  poolAssigned: boolean;
  issues: CompletionIssueType[];
};

export type CompletionSemesterResult = {
  semesterSequence: number;
  semesterStatus: CompletionStatus;
  hasStructureRule: boolean;
  cells: CompletionCellResult[];
};

export type CompletionProgrammeResult = {
  programVersionId: string;
  programId: string;
  programCode: string;
  programName: string;
  version: number;
  versionStatus: string;
  departmentId: string | null;
  overallStatus: CompletionStatus;
  semesters: CompletionSemesterResult[];
};

export type CompletionSummaryResult = {
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

export type ResolvedSemesterExpectation = SemesterRulePayload & {
  fromDefaults: boolean;
};
