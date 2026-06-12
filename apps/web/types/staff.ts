export const STAFF_TYPES = [
  'TEACHING',
  'NON_TEACHING',
  'GUEST',
  'VISITING',
  'CONTRACT',
  'ADMIN',
] as const;

export const EMPLOYMENT_TYPES = ['PERMANENT', 'CONTRACT', 'GUEST', 'VISITING'] as const;

export const STAFF_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'ON_LEAVE',
  'SUSPENDED',
  'RELIEVED',
  'RETIRED',
  'CONTRACT_ENDED',
] as const;

export type StaffType = (typeof STAFF_TYPES)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type StaffStatus = (typeof STAFF_STATUSES)[number];

export type StaffProfileSection = 'basic' | 'employment' | 'portal' | 'salary' | 'address';

export type EnhancedStaffSummary = {
  total: number;
  teaching: number;
  nonTeaching: number;
  guest: number;
  departments: number;
  activeAccounts: number;
  pendingActivation: number;
  onLeave: number;
  rfidAssigned: number;
  timetableAssigned: number;
};

export type StaffAdditionalRoleChip = { code: string; label: string };

export type StaffDirectoryRow = {
  id: string;
  employeeCode: string;
  shortCode?: string | null;
  fullName: string;
  email: string | null;
  mobile: string | null;
  staffType: StaffType | string;
  employmentType: EmploymentType | string;
  status: StaffStatus | string;
  rfidNo: string | null;
  joiningDate: string | null;
  department: string | null;
  departmentId: string | null;
  designation: string | null;
  designationId: string | null;
  additionalRoles?: StaffAdditionalRoleChip[];
  shift: string | null;
  primaryShiftId: string | null;
  portalActive: boolean;
  portalPending: boolean;
  subjectAssignments: number;
  timetableSections: number;
  publicationCount?: number;
  isSchedulable?: boolean;
  photoUrl?: string | null;
  quarter?: string | null;
  quarterNumber?: string | null;
};

export type StaffListItem = StaffDirectoryRow;

export type PaginatedStaff = {
  data: StaffDirectoryRow[];
  meta: { page: number; limit: number; total: number; totalPages: number };
};

export type StaffPortalUser = {
  id: string;
  email: string;
  username?: string | null;
  isActive: boolean;
  accountStatus: string;
  mustResetPassword: boolean;
  lastLoginAt?: string | null;
};

export type StaffSubjectAssignment = {
  id: string;
  courseId: string;
  semesterNo: number;
  programVersionId?: string | null;
  offeringSectionId?: string | null;
  shiftId?: string | null;
  academicYearId?: string | null;
  category?: string | null;
  workloadHours?: number | null;
  isPrimaryFaculty?: boolean;
  teachingRole?: string | null;
  allocationPercent?: number | null;
  weeklyHours?: number | null;
  canMarkAttendance?: boolean;
  canEnterInternalMarks?: boolean;
  canUploadLessonPlan?: boolean;
  canAccessSubjectWorkspace?: boolean;
  course?: { id: string; code: string; title: string } | null;
  offeringSection?: {
    id: string;
    sectionCode: string;
    studentGroup?: string | null;
    status?: string;
    shift?: { id: string; code: string; name: string } | null;
    eligibleStreams?: { stream: { id: string; code: string; name: string } }[];
    courseOffering?: {
      id: string;
      semesterSequence?: number | null;
      category?: string | null;
      mappingSource?: string | null;
      programVersion?: {
        id: string;
        version: number;
        status?: string;
        program: { id: string; code: string; name: string };
      } | null;
    } | null;
  } | null;
  shift?: { id: string; code: string; name: string } | null;
  programVersion?: {
    id: string;
    version?: number;
    status?: string;
    program: { id?: string; code: string; name: string };
  } | null;
  academicYear?: { id: string; name: string } | null;
  contextStatus?: 'COMPLETE' | 'LEGACY_UNRESOLVED';
  createdAt?: string;
};

export type TeachingAssignmentContext = {
  id: string;
  offeringSectionId: string;
  courseOfferingId: string;
  courseId: string;
  course: {
    id: string;
    code: string;
    title: string;
    credits?: string | number;
    department?: { id: string; code?: string | null; name: string } | null;
  };
  programVersionId: string;
  programVersion: {
    id: string;
    version: number;
    status: string;
    program: { id: string; code: string; name: string; departmentId?: string | null };
  };
  semesterNo: number;
  category: string;
  sectionCode: string;
  studentGroup?: string | null;
  shiftId: string;
  shift: { id: string; code: string; name: string };
  streamScope: { id: string; code: string; name: string }[];
  assignmentStatus: 'AVAILABLE' | 'ASSIGNED_TO_THIS_STAFF' | 'ASSIGNED_TO_OTHER_STAFF';
  assignedStaff?: { id: string; employeeCode: string; fullName: string } | null;
  teachingTeam?: {
    id: string;
    staffProfileId: string;
    staffName?: string | null;
    employeeCode?: string | null;
    shortCode?: string | null;
    role: string;
    allocationPercent?: number | null;
    weeklyHours?: number | null;
    isPrimary?: boolean;
    canMarkAttendance?: boolean;
    canEnterInternalMarks?: boolean;
    canUploadLessonPlan?: boolean;
    canAccessSubjectWorkspace?: boolean;
  }[];
};

export type TeachingAssignmentContextQuery = {
  page?: number;
  limit?: number;
  search?: string;
  programVersionId?: string;
  departmentId?: string;
  semesterNo?: number;
  category?: string;
  shiftId?: string;
  sectionCode?: string;
};

export type StaffDocument = {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  filePath?: string;
  mimeType?: string | null;
  verificationStatus?: string;
  verificationRemarks?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  uploadedAt?: string;
  createdAt?: string;
  verifiedAt?: string | null;
  verifiedByName?: string | null;
  uploadedByName?: string | null;
  verifiedBy?: { displayName?: string | null; email?: string } | null;
};

export type StaffDocumentSlotRow = {
  code: string;
  label: string;
  category: string;
  supportsExpiry?: boolean;
  staffSelfUpload?: boolean;
  status: 'VERIFIED' | 'PENDING' | 'REJECTED' | 'MISSING' | 'EXPIRED';
  document: {
    id: string;
    fileName: string | null;
    fileUrl: string;
    mimeType: string | null;
    verificationStatus: string;
    verificationRemarks: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    createdAt: string;
    verifiedAt: string | null;
    verifiedByName: string | null;
    uploadedByName: string | null;
  } | null;
};

export type StaffDocumentCompliance = {
  totalSlots: number;
  uploaded: number;
  pending: number;
  verified: number;
  expiredSoon: number;
  missing: string[];
  completionPercent: number;
  complianceScore: number;
  slots: StaffDocumentSlotRow[];
};

export type StaffDocumentAuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  user?: { displayName?: string | null; email?: string } | null;
};

export type StaffPublication = {
  id: string;
  title: string;
  publicationType: string;
  journal?: string | null;
  isbnIssn?: string | null;
  doi?: string | null;
  coAuthors?: string | null;
  indexedIn?: string | null;
  publishedAt?: string | null;
  attachmentUrl?: string | null;
};

export type StaffAward = {
  id: string;
  title: string;
  organization?: string | null;
  level?: string | null;
  awardDate?: string | null;
  description?: string | null;
  certificateUrl?: string | null;
};

export type StaffQualificationRecord = {
  id: string;
  qualification: string;
  specialization?: string | null;
  university?: string | null;
};

export type StaffProfile = StaffDirectoryRow & {
  bloodGroupLookupId?: string | null;
  bloodGroup?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
  aadhaarNo?: string | null;
  panNo?: string | null;
  photoUrl?: string | null;
  biometricId?: string | null;
  biometricDeviceId?: string | null;
  biometricSyncStatus?: string | null;
  biometricLastSyncAt?: string | null;
  biometricExternalUserId?: string | null;
  qualification?: string | null;
  specialization?: string | null;
  experienceYears?: number | null;
  campusId?: string | null;
  probationEndDate?: string | null;
  confirmationDate?: string | null;
  relievingDate?: string | null;
  retirementDate?: string | null;
  lastWorkingDate?: string | null;
  resignationReason?: string | null;
  additionalShiftIds?: string[];
  addressJson?: Record<string, unknown> | null;
  emergencyContactJson?: Record<string, unknown> | null;
  attendanceDeviceMapping?: Record<string, unknown> | null;
  bankName?: string | null;
  accountNumber?: string | null;
  ifsc?: string | null;
  pfNumber?: string | null;
  basicPay?: string | number | null;
  salaryStructure?: Record<string, unknown> | null;
  portalUser?: StaffPortalUser | null;
  shiftAssignments?: {
    id: string;
    shiftId?: string;
    isPrimary?: boolean;
    active?: boolean;
    shift: { id: string; code: string; name: string };
  }[];
  additionalRoles?: StaffAdditionalRoleChip[];
  publications?: StaffPublication[];
  awards?: StaffAward[];
  qualifications?: StaffQualificationRecord[];
  subjectAssignments: StaffSubjectAssignment[];
  offeringSections?: unknown[];
  documents?: StaffDocument[];
  workloads?: {
    id: string;
    academicYear?: { id: string; name: string } | null;
    totalHours?: number | null;
  }[];
  accommodation?: StaffAccommodationSummary;
  createdAt?: string;
  updatedAt?: string;
};

export type StaffAccommodationSummary = {
  status: 'OCCUPIED' | 'NONE';
  active: {
    occupancyId: string;
    quarterNumber: string;
    quarterType: string;
    building: string | null;
    allottedAt: string;
    monthlyRent: number;
    waterCharge: number;
    electricityCharge: number;
    maintenanceCharge: number;
    internetCharge: number;
    payrollDeductionEnabled: boolean;
  } | null;
  history: {
    id: string;
    status: string;
    quarterNumber: string;
    quarterType: string;
    building: string | null;
    allottedAt: string;
    vacatedAt: string | null;
    monthlyRent: number;
  }[];
};

export type CreateStaffPayload = {
  employeeCode?: string;
  employeeCodeAutoGenerated?: boolean;
  institutionId?: string;
  fullName: string;
  email?: string;
  mobile?: string;
  staffType?: StaffType | string;
  employmentType?: EmploymentType | string;
  departmentId?: string;
  designationId?: string;
  primaryShiftId?: string;
  additionalShiftIds?: string[];
  additionalRoleCodes?: string[];
  shortCode?: string;
  joiningDate?: string;
  probationEndDate?: string;
  confirmationDate?: string;
  relievingDate?: string;
  retirementDate?: string;
  lastWorkingDate?: string;
  resignationReason?: string;
  gender?: string;
  dateOfBirth?: string;
  qualification?: string;
  specialization?: string;
  experienceYears?: number;
  rfidNo?: string;
  biometricId?: string;
  createPortalAccount?: boolean;
  portalRoleSlugs?: string[];
  password?: string;
};

export type UpdateStaffPayload = Partial<CreateStaffPayload> & {
  status?: StaffStatus | string;
  departmentId?: string | null;
  designationId?: string | null;
  primaryShiftId?: string | null;
  additionalShiftIds?: string[];
  additionalRoleCodes?: string[];
  shortCode?: string | null;
  joiningDate?: string | null;
  probationEndDate?: string | null;
  confirmationDate?: string | null;
  relievingDate?: string | null;
  retirementDate?: string | null;
  lastWorkingDate?: string | null;
  resignationReason?: string | null;
  rfidNo?: string | null;
  biometricId?: string | null;
};

export type AssignSubjectPayload = {
  courseId: string;
  semesterNo: number;
  programVersionId?: string;
  offeringSectionId?: string;
  shiftId?: string;
  academicYearId?: string;
  category?: string;
  workloadHours?: number;
  isPrimaryFaculty?: boolean;
  role?: string;
  allocationPercent?: number;
  startDate?: string;
  endDate?: string;
  canMarkAttendance?: boolean;
  canEnterInternalMarks?: boolean;
  canUploadLessonPlan?: boolean;
  canAccessSubjectWorkspace?: boolean;
};

export type ProvisionStaffPortalPayload = {
  email: string;
  roleSlugs?: string[];
  password?: string;
  shiftId?: string;
  campusId?: string;
};

export type StaffExportParams = {
  search?: string;
  staffType?: string;
  departmentId?: string;
  designationId?: string;
  shiftId?: string;
  status?: string;
  additionalRoleCode?: string;
  hodOnly?: boolean;
  activeTeachingOnly?: boolean;
  hasPublications?: boolean;
  ids?: string;
  limit?: number;
};

export type AcademicRoleDefinition = {
  id: string;
  code: string;
  label: string;
  sortOrder?: number;
};

export const PUBLICATION_TYPES = [
  'JOURNAL',
  'CONFERENCE',
  'BOOK',
  'CHAPTER',
  'PATENT',
  'RESEARCH_PAPER',
] as const;

export const AWARD_LEVELS = [
  'INTERNATIONAL',
  'NATIONAL',
  'STATE',
  'UNIVERSITY',
  'COLLEGE',
] as const;

export type StaffDesignation = {
  id: string;
  code: string;
  label: string;
  category?: string;
  sortOrder?: number;
  isActive?: boolean;
};

export const STAFF_PROFILE_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'employment', label: 'Employment' },
  { key: 'academic', label: 'Academic' },
  { key: 'qualifications', label: 'Qualifications' },
  { key: 'subjects', label: 'Subjects' },
  { key: 'publications', label: 'Publications' },
  { key: 'awards', label: 'Awards' },
  { key: 'timetable', label: 'Timetable' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'documents', label: 'Documents' },
  { key: 'id-card', label: 'ID Card' },
  { key: 'communication', label: 'Communication' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'accommodation', label: 'Accommodation' },
  { key: 'leave', label: 'Leave' },
  { key: 'audit', label: 'Audit' },
  { key: 'settings', label: 'Settings' },
] as const;

export type StaffProfileTabKey = (typeof STAFF_PROFILE_TABS)[number]['key'];
