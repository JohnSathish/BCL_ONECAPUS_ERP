export type DepartmentRef = {
  id: string;
  name: string;
  code?: string | null;
};

export type ProgramVersionStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export type ProgramVersionUsage = {
  offerings: number;
  students: number;
  registrations: number;
  outcomeRuns: number;
  approvalPolicies: number;
  poolAssignments?: number;
  semesterRules?: number;
  deliverySections?: number;
  staffAssignments?: number;
  programOutcomes?: number;
};

export type ProgramVersionUserRef = {
  id: string;
  email: string;
};

export type ProgramVersion = {
  id: string;
  programId: string;
  version: number;
  status: ProgramVersionStatus;
  cbcsEnabled: boolean;
  effectiveFrom?: string | null;
  publishedAt?: string | null;
  archivedAt?: string | null;
  createdAt?: string;
  createdById?: string | null;
  createdBy?: ProgramVersionUserRef | null;
  archivedBy?: ProgramVersionUserRef | null;
  usage?: ProgramVersionUsage;
};

export type ProgramVersionDetail = ProgramVersion & {
  program?: { id: string; code: string; name: string };
};

export type Program = {
  id: string;
  code: string;
  name: string;
  level?: string | null;
  departmentId?: string | null;
  department?: DepartmentRef | null;
  versions: ProgramVersion[];
};

export type ImportBatch = {
  id: string;
  module: string;
  fileName: string;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  successfulRows: number;
  failedRows: number;
  errorMessage?: string | null;
  uploadedByEmail?: string | null;
  createdAt: string;
  completedAt?: string | null;
};

export type CourseImportPreviewRow = {
  rowNumber: number;
  status: string;
  displayCode?: string;
  displayTitle?: string;
  errors: string[];
};

export type CourseImportPreview = {
  batchId: string;
  status: string;
  async?: boolean;
  summary: { total: number; valid: number; invalid: number };
  rows: CourseImportPreviewRow[];
  hasMore: boolean;
};

export type CourseMappingSummary = {
  programCode: string;
  programName: string;
  version: number;
  category: string | null;
  semesterSequence: number | null;
};

export type CourseListParams = {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  courseType?: string;
  deliveryType?: string;
  programVersionId?: string;
  semesterSequence?: number;
  category?: string;
};

export type Course = {
  id: string;
  code: string;
  title: string;
  credits: string | number;
  deliveryType?: string;
  creditCalculationMode?: string;
  requiresTheorySplit?: boolean;
  requiresPracticalSplit?: boolean;
  attendanceMode?: string;
  labRequired?: boolean;
  requiresTimetableSlots?: boolean;
  hasPractical?: boolean;
  theoryCredits?: string | number;
  practicalCredits?: string | number;
  theoryHoursPerWeek?: number;
  practicalHoursPerWeek?: number;
  totalTheoryContactHours?: number;
  totalPracticalContactHours?: number;
  totalContactHours?: number;
  courseType: string;
  description?: string | null;
  status?: string;
  syllabusVersion?: string | null;
  departmentId?: string | null;
  department?: DepartmentRef | null;
  subjectSlug?: string | null;
  eligibilityRules?: import('@/types/course-eligibility').CourseEligibilityRules;
  mappingSummary?: CourseMappingSummary[];
  mappingSummaryTotal?: number;
  mappingSummaryTruncated?: boolean;
};

export type OfferingSectionStreamRef = {
  academicStreamId: string;
  stream: { id: string; code: string; name: string };
};

export type OfferingSection = {
  id: string;
  sectionCode: string;
  studentGroup?: string | null;
  capacity: number;
  waitlistCapacity: number;
  status: string;
  shift?: { id: string; code: string; name: string; campusId?: string };
  faculty?: { id: string; user?: { email: string } } | null;
  classroom?: { id: string; code: string } | null;
  eligibleStreams?: OfferingSectionStreamRef[];
  seatLedger?: {
    confirmedCount: number;
    waitlistCount: number;
  } | null;
};

export type CourseOffering = {
  id: string;
  programVersionId?: string | null;
  courseId: string;
  semesterId?: string | null;
  isElective: boolean;
  category?: string | null;
  semesterSequence?: number | null;
  displayOrder?: number | null;
  capacity?: number | null;
  waitlistCapacity?: number | null;
  mappingSource?: 'DIRECT' | 'SHARED_POOL';
  categoryPoolId?: string | null;
  course: Course;
  semester?: { id: string; name: string; sequence: number } | null;
  programVersion?: {
    id: string;
    version: number;
    program: { id: string; code: string; name: string };
  } | null;
  sections?: OfferingSection[];
};

export type CatalogSummary = {
  programs: number;
  courses: number;
  programVersions: number;
  offerings: number;
};

export type Paginated<T> = {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};
