export type SyllabusDocumentStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ARCHIVED';

export type SyllabusVersion = {
  id: string;
  documentId: string;
  versionNo: number;
  filePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  checksumSha256?: string | null;
  uploadedById?: string | null;
  changeNote?: string | null;
  createdAt: string;
};

export type SyllabusDocument = {
  id: string;
  tenantId?: string;
  paperCode: string;
  title: string;
  courseId?: string | null;
  departmentId?: string | null;
  programVersionId?: string | null;
  academicYearId?: string | null;
  semesterNo?: number | null;
  category?: string | null;
  subjectType?: string | null;
  credits?: unknown;
  language?: string | null;
  regulation?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  description?: string | null;
  notes?: string | null;
  keywords?: string[];
  filePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  checksumSha256?: string | null;
  currentVersionNo?: number;
  status: SyllabusDocumentStatus;
  uploadedById?: string | null;
  publishedById?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  approvals?: SyllabusApproval[];
  versions?: SyllabusVersion[];
  bookmarkId?: string;
  bookmarkedAt?: string;
  courseLabel?: string | null;
  courseTitle?: string | null;
  departmentName?: string | null;
  programmeName?: string | null;
  programmeCode?: string | null;
  academicYearName?: string | null;
  uploadedByName?: string | null;
  downloadCount?: number;
};

export type SyllabusApproval = {
  id: string;
  documentId: string;
  stepCode: string;
  stepName: string;
  roleSlug?: string | null;
  status: string;
  comments?: string | null;
  sequence: number;
  actedAt?: string | null;
  document?: Pick<SyllabusDocument, 'id' | 'paperCode' | 'title' | 'status' | 'semesterNo'>;
};

export type SyllabusDashboard = {
  kpis: {
    totalDocuments: number;
    publishedDocuments: number;
    approvedDocuments?: number;
    pendingDocuments?: number;
    uploadedToday?: number;
    departments?: number;
    subjects?: number;
    downloadsThisMonth?: number;
    pendingApprovals?: number;
    storageUsedBytes?: number;
    topDocument?: { id: string; title: string; paperCode: string; downloads: number } | null;
    missingSubjects?: number;
    missingCourses?: number;
  };
  statusMix?: { label: string; value: number }[];
  documentsByCategory?: { label: string; value: number }[];
  documentsByDepartment?: { label: string; value: number }[];
  mostDownloaded?: {
    id: string;
    title: string;
    paperCode: string;
    downloads: number;
  }[];
};

export type SyllabusSettings = {
  maxUploadMb: number;
  allowedMimeTypes?: string[];
  studentAccessEnabled: boolean;
};

export type SyllabusCourseLookup = {
  id: string;
  code: string;
  title: string;
  credits?: unknown;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentCode?: string | null;
  programId?: string | null;
  programVersionId?: string | null;
  programmeName?: string | null;
  programmeCode?: string | null;
  semesterNo?: number | null;
  category?: string | null;
  subjectType?: string | null;
  curriculumVersion?: string | null;
  categoryHint?: string | null;
  semesterNoHint?: number | null;
  programIdHint?: string | null;
  programVersionIdHint?: string | null;
  offerings?: {
    id: string;
    category?: string | null;
    semesterNo?: number | null;
    programVersionId?: string | null;
    programmeName?: string | null;
    programmeCode?: string | null;
  }[];
};

export type SyllabusCourseSearchResponse = {
  items: SyllabusCourseLookup[];
};

export type SyllabusPreflightResponse = {
  exists: boolean;
  document: {
    id: string;
    paperCode: string;
    paperTitle: string;
    status: string;
    currentVersionNo: number;
    createdAt: string;
    updatedAt: string;
    publishedAt?: string | null;
  } | null;
  latestVersion: {
    id: string;
    versionNo: number;
    fileName?: string | null;
    fileSizeBytes?: number | null;
    checksumSha256?: string | null;
    createdAt: string;
    changeNote?: string | null;
  } | null;
  nextVersionNo?: number;
};

export type SyllabusExtractHintsResponse = {
  readable: boolean;
  pageCount: number | null;
  textPreview?: string;
  suggestions: {
    paperCode?: string | null;
    paperTitle?: string | null;
    credits?: number | null;
  };
  mismatches: string[];
};

export type SyllabusVersionMode = 'auto' | 'new_version' | 'reject_if_exists';

export type SyllabusListResponse = {
  items: SyllabusDocument[];
  total: number;
  page: number;
  limit: number;
};

export type SyllabusFilters = {
  q?: string;
  status?: string;
  academicYearId?: string;
  semesterNo?: string;
  programVersionId?: string;
  departmentId?: string;
  courseId?: string;
  category?: string;
  subjectType?: string;
  uploadedById?: string;
};

export type AskSyllabusResponse = {
  answer: string;
  citations?: { page?: number; text?: string; score?: number }[];
};

export type SyllabusBulkPreviewResponse = {
  summary: { total: number; valid: number; invalid: number };
  rows: {
    rowNumber: number;
    status: 'VALID' | 'INVALID';
    errors: string[];
    normalized?: Record<string, unknown>;
    fileMatched?: boolean;
  }[];
  zipFileCount: number;
};
