export type StudentSummary = {
  total: number;
  activeUsers: number;
  withProgram: number;
  registrations: number;
  pendingEnrollment: number;
};

export type EnhancedStudentSummary = StudentSummary & {
  bySemester: Record<string, number>;
  byShift: Record<string, number>;
  byStream: Record<string, number>;
  byGender?: Record<string, number>;
  byProgramme?: Record<string, number>;
  rfidAssigned?: number;
  subjectRegistrationPending?: number;
  noPhoto?: number;
  noMobile?: number;
  newThisYear?: number;
  feeDefaulters?: number;
  hostelResidents?: number;
  attendanceShortage?: number;
};

export type StudentFeeStatus = 'CLEAR' | 'DUE' | 'OVERDUE' | 'PARTIAL';
export type StudentResidenceType = 'HOSTELLER' | 'DAY_SCHOLAR';
export type AttendanceEligibilityStatus = 'ELIGIBLE' | 'CONDONATION' | 'DETAINED';

export type StudentDirectoryRow = {
  id: string;
  applicationNumber?: string | null;
  admissionNumber?: string | null;
  enrollmentNumber: string;
  rollNumber?: string | null;
  rfidNumber?: string | null;
  fullName: string;
  displayFullName?: string;
  email: string;
  mobileNumber?: string | null;
  abcId?: string | null;
  programVersionId?: string | null;
  programme?: string | null;
  programmeCode?: string | null;
  majorSubject?: string | null;
  majorSubjectSlug?: string | null;
  minorSubject?: string | null;
  minorSubjectSlug?: string | null;
  semester: number;
  cycle?: string | null;
  stream?: string | null;
  streamCode?: string | null;
  shift?: string | null;
  shiftCode?: string | null;
  batch?: string | null;
  admissionYear?: number | null;
  entrySession?: string | null;
  admissionStatus: string;
  academicStatus: string;
  registrationStatus?: 'completed' | 'draft' | 'pending' | 'none';
  isActive: boolean;
  admissionDate?: string | null;
  photoPath?: string | null;
  studentStatus?: string | null;
  feeStatus?: StudentFeeStatus;
  feeDueAmount?: number;
  residenceType?: StudentResidenceType | null;
  hostelBlock?: string | null;
  hostelRoom?: string | null;
  isHosteller?: boolean;
  attendancePercent?: number | null;
  attendanceEligibility?: AttendanceEligibilityStatus | null;
  attendanceShortage?: boolean;
};

export type StudentListItem = {
  id: string;
  enrollmentNumber: string;
  admissionDate?: string | null;
  programVersionId?: string | null;
  user: { id: string; email: string; isActive: boolean };
  programVersion?: {
    id: string;
    version: number;
    program: { id: string; code: string; name: string; level?: string | null };
  } | null;
  _count: { registrations?: number; semesterRegistrations?: number };
};

export type PaginatedStudents = {
  data: StudentDirectoryRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type StudentFeeSummary = {
  feeStatus: StudentFeeStatus;
  feeDueAmount: number;
  demands: {
    id: string;
    demandNo: string;
    status: string;
    balanceAmount: number;
    totalAmount: number;
    paidAmount: number;
    dueDate?: string | null;
    semesterNumber?: number | null;
  }[];
};

export type StudentAttendanceSummary = {
  attendancePercent: number | null;
  attendanceEligibility: AttendanceEligibilityStatus | null;
  attendanceShortage: boolean;
  subjects: {
    subjectName?: string | null;
    percentage: number;
    presentCount?: number | null;
    totalCount?: number | null;
    semesterSequence?: number | null;
  }[];
};

export type StudentProfile = StudentDirectoryRow & {
  applicationNumber?: string | null;
  admissionNumber?: string | null;
  rfidNumber?: string | null;
  importSource?: string | null;
  admissionSource?: string | null;
  photoPath?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  nationalId?: string | null;
  email?: string | null;
  maritalStatus?: string | null;
  studentStatus?: string | null;
  departmentId?: string | null;
  departmentName?: string | null;
  bloodGroupLookupId?: string | null;
  bloodGroup?: string | null;
  religionLookupId?: string | null;
  categoryLookupId?: string | null;
  tribeLookupId?: string | null;
  denominationLookupId?: string | null;
  differentlyAbled?: boolean;
  ews?: boolean;
  addresses?: import('./student-profile').StudentAddress[];
  guardians?: import('./student-profile').StudentGuardian[];
  boardExam?: import('./student-profile').StudentBoardExam | null;
  cuetDetail?: import('./student-profile').StudentCuetDetail | null;
  programChoices?: import('./student-profile').ProgramChoice[];
  semesterHistory: unknown[];
  promotionEntries: unknown[];
  registrations: unknown[];
  sectionEnrollments: {
    registrationId: string;
    semesterSequence: number;
    semesterId?: string;
    registrationStatus?: string;
    sectionCode?: string;
    courseCode: string;
    courseTitle: string;
    category?: string | null;
    status: string;
    credits?: number;
    assignedById?: string | null;
    assignmentSource?: string | null;
    registrationSource?: string | null;
    generatedBy?: string | null;
    generatedAt?: string;
    curriculumMappingId?: string;
    mappingSource?: string | null;
    curriculumVersion?: number | null;
    facultyName?: string | null;
    facultyId?: string | null;
  }[];
  nepCategoryGroups: import('./student-profile').NepCategoryGroups;
  completion?: import('./student-profile').ProfileCompletion;
  system?: {
    createdAt: string;
    updatedAt: string;
    createdBy?: { id: string; email: string } | null;
    lastModifiedBy?: { id: string; email: string } | null;
    loginEnabled?: boolean;
  };
  documents?: import('./student-profile').StudentDocumentRecord[];
  attendanceSummary: StudentAttendanceSummary | null;
  feeSummary: StudentFeeSummary | null;
  examinationSummary: null;
};

export type MasterLookup = {
  id: string;
  lookupType: string;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
};

export type AdmitStudentPayload = {
  email: string;
  enrollmentNumber: string;
  applicationNumber?: string;
  fullName: string;
  programVersionId: string;
  admissionBatchId: string;
  streamId: string;
  primaryShiftId: string;
  rollNumber?: string;
  admissionNumber?: string;
  abcId?: string;
  campusId?: string;
  departmentId?: string;
  gender?: string;
  maritalStatus?: string;
  dateOfBirth?: string;
  mobileNumber?: string;
  nationalId?: string;
  categoryLookupId?: string;
  religionLookupId?: string;
  bloodGroupLookupId?: string;
  nationalityLookupId?: string;
  tribeLookupId?: string;
  denominationLookupId?: string;
  differentlyAbled?: boolean;
  ews?: boolean;
  address?: Record<string, unknown>;
  guardianName?: string;
  guardianMobile?: string;
  majorSubjectSlug?: string;
  minorSubjectSlug?: string;
  admissionDate?: string;
  admissionType?: string;
  currentSemester?: number;
  rfidNumber?: string;
};

export type AdmitStudentFullPayload = AdmitStudentPayload & {
  sections?: Record<string, Record<string, unknown>>;
};

export type AdmitStudentWithRegistrationPayload = AdmitStudentFullPayload & {
  subjectSelections?: Record<string, string>;
  registrationAction?: 'NONE' | 'DRAFT' | 'SUBMIT';
  semesterSequence?: number;
  generateRollNumber?: boolean;
  rollNumberAutoGenerated?: boolean;
};

export type AdmissionPoolsResponse = {
  structureRules: import('@/types/academic-engine').SemesterStructureRule[];
  semesterRule: import('@/types/academic-engine').SemesterStructureRule | null;
  semesterSummary?: string;
  creditTarget: number;
  categoryCounts: Record<string, number>;
  major: AdmissionPoolOffering[];
  minor: AdmissionPoolOffering[];
  pools: Record<string, AdmissionPoolOffering[]>;
  template: { streamId?: string | null } | null;
};

export type AdmissionPoolOffering = {
  id: string;
  offeringId?: string;
  category: string;
  course?: {
    id?: string;
    code?: string;
    title?: string;
    credits?: string | number;
    subjectSlug?: string | null;
    department?: { id: string; name: string; code?: string | null } | null;
  };
  mappingSource?: string;
  poolId?: string;
  poolName?: string;
};

export type SubjectBasketValidation = {
  ok: boolean;
  issues: { code: string; message: string }[];
};

export type LifecycleEventType =
  | 'READMISSION'
  | 'LEAVING'
  | 'DROPOUT'
  | 'ALUMNI'
  | 'MIGRATION'
  | 'DEACTIVATE';

export type StudentLifecycleEvent = {
  id: string;
  studentId: string;
  eventType: LifecycleEventType;
  effectiveDate: string;
  reason?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  student?: {
    enrollmentNumber: string;
    masterProfile?: { fullName: string } | null;
  };
  actor?: { email: string } | null;
};

export type StudentRemark = {
  id: string;
  studentId: string;
  remarkType: string;
  body: string;
  visibility: string;
  createdAt: string;
  actor?: { email: string } | null;
};

export type StudentAuditLog = {
  id: string;
  studentId: string;
  sectionKey: string;
  fieldKey: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
  actor?: { email: string } | null;
  student?: {
    enrollmentNumber: string;
    masterProfile?: { fullName: string } | null;
  };
};

export type StudentExportParams = {
  search?: string;
  programVersionId?: string;
  shiftId?: string;
  sessionId?: string;
  batchId?: string;
  semester?: string;
  streamId?: string;
  departmentId?: string;
  admissionStatus?: string;
  academicStatus?: string;
  ids?: string;
  limit?: number;
};
