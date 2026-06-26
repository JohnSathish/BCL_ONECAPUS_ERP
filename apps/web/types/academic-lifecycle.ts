export type InstitutionAcademicConfig = {
  id: string;
  institutionId: string;
  programmeModel: string;
  structureType: string;
  maxActiveSemesters: number;
  operationalYears: number;
  semesterPattern: string;
  promotionTrigger: string;
  terminalSemesterNumber: number;
  allowPostgraduateContinuation: boolean;
  currentCycle: string;
  lastCycleSwitchAt?: string | null;
};

export type SemesterStructureRow = {
  id: string;
  name: string;
  semesterNumber: number;
  semesterType: string;
  progressionOrder: number;
  academicYearIndex: number;
  isTerminal: boolean;
  status: string;
  isActive: boolean;
  registrationOpen: boolean;
  timetableEnabled?: boolean;
};

export type AcademicStructureResponse = {
  config: InstitutionAcademicConfig;
  years: {
    id: string;
    name: string;
    academicYearIndex: number | null;
    semesters: SemesterStructureRow[];
  }[];
};

export type CycleDashboard = {
  config: InstitutionAcademicConfig | null;
  primarySession: { id: string; name: string; status: string } | null;
  currentCycle: string;
  activeSemesters: number[];
  totalStudents: number;
  promotionStatus: { pendingBatches: number; recentRuns: number };
  semesterLifecycle: {
    id: string;
    semesterNumber: number;
    semesterType: string;
    cycle: string;
    isActive: boolean;
    status: string;
    studentCount: number;
    registrationOpen: boolean;
    frozen: boolean;
    name: string;
  }[];
  batchProgression: {
    id: string;
    batchCode: string;
    admissionYear: number;
    entrySession: string;
    currentSemester: number;
    cycleType: string;
    promotionStatus: string;
    studentCount: number;
  }[];
};

export type CycleRolloverPreview = {
  institutionId: string;
  outgoingCycle: string;
  incomingCycle: string;
  terminalSemesterNumber: number;
  batches: {
    batchId: string;
    batchCode: string;
    admissionYear: number;
    fromSequence: number;
    toSequence: number;
    studentCount: number;
    promoted: number;
    detained: number;
    completed: number;
    skipped: boolean;
    reason?: string;
  }[];
  totals: {
    batches: number;
    promoted: number;
    detained: number;
    completed: number;
  };
};

export type PromotionLogRow = {
  id: string;
  action: string;
  createdAt: string;
  actor?: { email: string } | null;
  run?: {
    fromSequence: number;
    toSemesterSequence: number;
    trigger: string;
    admissionBatch?: { batchCode: string } | null;
    appliedBy?: { email: string } | null;
  } | null;
};

export type AdmissionBatchRow = {
  id: string;
  batchCode: string;
  admissionYear: number;
  currentSemester: number;
  cycleType: string;
  promotionStatus: string;
  isActive: boolean;
  entrySession: { id: string; name: string };
  _count?: { studentProfiles: number };
};

export type PromotionMappingLine = {
  category: string;
  majorPaperIndex?: number | null;
  departmentName?: string | null;
  from?: { code: string; title: string; offeringId: string } | null;
  to: { code: string; title: string; offeringId: string };
  resolved: boolean;
  message?: string;
};

export type PromotionMappingPreviewStudent = {
  studentId: string;
  enrollmentNumber?: string | null;
  studentName?: string | null;
  lines: PromotionMappingLine[];
  valid: boolean;
  messages: string[];
};

export type PromotionPreviewResponse = {
  fromSequence: number;
  toSequence: number;
  counts: {
    eligible: number;
    detained: number;
    failed: number;
    total: number;
  };
  eligible: unknown[];
  detained: unknown[];
  failed: unknown[];
};

export type PromotionValidateResponse = {
  fromSequence: number;
  toSequence: number;
  valid: boolean;
  counts: { total: number; valid: number; blocked: number };
  students: PromotionMappingPreviewStudent[];
};
