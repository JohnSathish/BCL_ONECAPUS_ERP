export type SubjectPathOption = {
  id: string;
  slug: string;
  name: string;
  programmeGroup: string | null;
  departmentId: string | null;
  department?: { id: string; name: string; code: string } | null;
};

export type AcademicEngineSummary = {
  students: number;
  registrations: number;
  waitlisted: number;
  offerings: number;
};

export type SemesterStructureRule = {
  id: string;
  semesterSequence: number;
  categoryCounts: Record<string, number>;
  continuityRules: Record<string, string>;
  categoryMeta?: Record<string, { creditRule?: number; mandatory?: boolean; optional?: boolean }>;
  semesterCreditTarget?: number | null;
  lines?: SemesterStructureRuleLine[];
};

export type SemesterStructureRuleLine = {
  id?: string;
  categoryType: string;
  requiredSubjectCount: number;
  requiredCredits?: number | string | null;
  continuityRule?: string | null;
  mandatoryFlag?: boolean;
};

export type ProgramStructureTemplateInfo = {
  structureType: string;
  totalSemesters: number;
  degreeMinCredits?: number;
  semesterCreditTarget?: number;
  lastAppliedAt?: string | null;
  lastAppliedFyugpTemplate?: { id: string; templateName: string } | null;
};

export type FyugpStructureTemplate = {
  id: string;
  templateName: string;
  regulationYear: number;
  programmeLevel: 'UG' | 'PG';
  totalSemesters: number;
  active: boolean;
  _count?: { lines: number };
  lines?: FyugpStructureTemplateLine[];
};

export type FyugpStructureTemplateLine = {
  id?: string;
  semesterNo: number;
  categoryType: string;
  subjectCount: number;
  continuityRule?: string | null;
  creditRule?: number | string | null;
  optionalFlag?: boolean;
};

export type ApplyFyugpTemplatePayload = {
  mode: 'ALL_UG' | 'SELECTED_PROGRAMS' | 'SELECTED_VERSIONS';
  conflictStrategy: 'REPLACE_ALL' | 'SKIP_EXISTING';
  programIds?: string[];
  programVersionIds?: string[];
  programmeLevel?: 'UG' | 'PG';
};

export type ApplyPreviewItem = {
  programVersionId: string;
  programCode: string;
  programName: string;
  version: number;
  skipped: boolean;
  skippedReason?: string;
  changedSemesters: number[];
  currentRules: {
    semesterSequence: number;
    categoryCounts: Record<string, number>;
    continuityRules: Record<string, string>;
  }[];
  proposedRules: {
    semesterSequence: number;
    categoryCounts: Record<string, number>;
    continuityRules: Record<string, string>;
  }[];
};

export type ApplyPreviewResult = {
  templateId: string;
  templateName: string;
  items: ApplyPreviewItem[];
};

export type CourseOfferingRow = {
  id: string;
  courseId?: string;
  category: string | null;
  semesterSequence: number | null;
  majorPaperIndex?: number | null;
  capacity: number;
  waitlistCapacity: number;
  mappingSource?: 'DIRECT' | 'SHARED_POOL';
  poolId?: string;
  poolName?: string;
  course: {
    id?: string;
    code: string;
    title: string;
    credits: string | number;
    subjectSlug?: string | null;
  };
  sections?: CatalogSectionRow[];
};

export type AcademicShift = {
  id: string;
  code: string;
  name: string;
  startTime?: string;
  endTime?: string;
  campusId?: string;
  sortOrder?: number;
};

export type CatalogSectionRow = {
  id: string;
  sectionCode: string;
  capacity: number;
  waitlistCapacity: number;
  shift: { id: string; code: string; name: string };
  seatLedger?: { confirmedCount: number; waitlistCount: number } | null;
  mappingSource?: 'DIRECT' | 'SHARED_POOL';
  poolId?: string;
  poolName?: string;
  courseOffering: {
    id: string;
    category: string | null;
    semesterSequence: number | null;
    majorPaperIndex?: number | null;
    mappingSource?: 'DIRECT' | 'SHARED_POOL';
    course: {
      code: string;
      title: string;
      credits: string | number;
      subjectSlug?: string | null;
      vtcTrackGroupCode?: string | null;
      vtcTrackStage?: number | null;
      department?: { name?: string | null } | null;
    };
  };
};

export type IneligibleCatalogSection = {
  section: CatalogSectionRow;
  reasons: string[];
  codes?: string[];
};

export type CatalogWithEligibility = {
  eligible: CatalogSectionRow[];
  ineligible: IneligibleCatalogSection[];
};

export type CategoryPool = {
  id: string;
  poolName: string;
  semesterNo: number;
  categoryType: string;
  institutionId: string;
  active: boolean;
  _count?: { courses: number; assignments: number; offerings?: number };
  createdBy?: { id: string; email: string } | null;
};

export type CategoryPoolDetail = CategoryPool & {
  courses: Array<{
    id: string;
    courseId: string;
    displayOrder: number;
    active: boolean;
    course: { id: string; code: string; title: string; credits: string | number };
  }>;
  offerings: Array<{
    id: string;
    category: string | null;
    semesterSequence: number | null;
    course: { id: string; code: string; title: string };
    sections: Array<{
      id: string;
      sectionCode: string;
      capacity: number;
      shift: { code: string; name: string };
    }>;
  }>;
  assignments: Array<{
    id: string;
    semesterNo: number;
    active: boolean;
    programVersion: {
      id: string;
      version: number;
      program: { code: string; name: string };
    };
  }>;
};

export type ProgrammePoolAssignment = {
  id: string;
  semesterNo: number;
  active: boolean;
  pool: CategoryPool & { _count?: { courses: number } };
};

export type PoolAssignPreviewResult = {
  poolId: string;
  poolName: string;
  items: Array<{
    programVersionId: string;
    programCode: string;
    programName: string;
    version: number;
    assigned: boolean;
    skippedReason?: string;
  }>;
};

export type AssignPoolPayload = {
  mode: 'ALL_UG' | 'SELECTED_PROGRAMS' | 'SELECTED_VERSIONS';
  programIds?: string[];
  programVersionIds?: string[];
};

export type ProgrammePoolExclusion = {
  id: string;
  poolId: string;
  courseId: string;
  active: boolean;
  course: { id: string; code: string; title: string };
  pool: { id: string; poolName: string; categoryType: string; semesterNo: number };
};

export type RegistrationWindow = {
  id: string;
  name: string;
  opensAt: string;
  closesAt: string;
  locked: boolean;
  status?: 'OPEN' | 'CLOSED' | 'LOCKED';
  semester: { id: string; name: string; sequence: number };
};

export type SemesterRegistration = {
  id: string;
  status: string;
  semesterSequence: number;
  lines: {
    id: string;
    category: string;
    status: string;
    offeringId: string;
    offeringSectionId?: string | null;
    eligibilityOverride?: boolean;
    eligibilityOverrideReason?: string | null;
    offering: { id: string; course: { code: string; title: string } };
  }[];
  semester?: { id: string; name: string };
};

export type SeatUtilizationRow = {
  offeringId: string;
  sectionId?: string;
  courseCode: string;
  category: string | null;
  semesterSequence: number | null;
  shift?: string;
  sectionCode?: string;
  capacity: number;
  confirmed: number;
  waitlisted: number;
  utilizationPct: number;
  firstWaitlistLineId?: string | null;
};

export type AcademicStream = {
  id: string;
  code: string;
  name: string;
};

export type StudentAcademicProfile = {
  id: string;
  streamId: string | null;
  admissionYearId: string | null;
  class12Subjects: { name: string; code?: string; marks?: number }[];
  languagePreferences: Record<string, unknown> | null;
  languageEligibility: Record<string, unknown> | null;
  stream?: { id: string; code: string; name: string } | null;
};

export type StudentProgramChoice = {
  id: string;
  choiceType: string;
  subjectSlug: string;
  status: string;
};
