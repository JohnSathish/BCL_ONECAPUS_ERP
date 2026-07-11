export type QuestionPaperStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ARCHIVED';

export type QuestionPaperVersion = {
  id: string;
  paperId: string;
  versionNo: number;
  filePath: string;
  fileName: string;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  checksumSha256?: string | null;
  uploadedById?: string | null;
  changeNote?: string | null;
  createdAt: string;
};

export type QuestionPaperShareLink = {
  id: string;
  paperId: string;
  token: string;
  expiresAt?: string | null;
  createdById?: string | null;
  revokedAt?: string | null;
  createdAt: string;
};

export type CurriculumCourseOption = {
  id: string;
  code: string;
  title: string;
  credits?: unknown;
  departmentId?: string | null;
  category?: string | null;
  semesterNo?: number | null;
};

export type QuestionPaper = {
  id: string;
  tenantId: string;
  paperCode: string;
  paperName: string;
  academicYearId?: string | null;
  programVersionId?: string | null;
  departmentId?: string | null;
  courseId?: string | null;
  semesterNo?: number | null;
  examinationSession?: string | null;
  examinationType?: string | null;
  examCycle?: string | null;
  subjectCategory?: string | null;
  language?: string | null;
  universityName?: string | null;
  preparedById?: string | null;
  verifiedById?: string | null;
  notes?: string | null;
  paperType: string;
  paperCategory?: string | null;
  examMonth?: number | null;
  examYear?: number | null;
  durationMinutes?: number | null;
  maxMarks?: number | null;
  filePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  checksumSha256?: string | null;
  currentVersionNo?: number;
  status: QuestionPaperStatus;
  keywords: string[];
  uploadedById?: string | null;
  publishedById?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  approvals?: QuestionPaperApproval[];
  related?: QuestionPaper[];
  versions?: QuestionPaperVersion[];
  bookmarkId?: string;
  bookmarkedAt?: string;
  courseLabel?: string | null;
  courseCredits?: unknown;
  departmentName?: string | null;
  programmeName?: string | null;
  programmeCode?: string | null;
  academicYearName?: string | null;
  uploadedByName?: string | null;
  downloadCount?: number;
};

export type QuestionPaperApproval = {
  id: string;
  paperId: string;
  stepCode: string;
  stepName: string;
  roleSlug?: string | null;
  status: string;
  comments?: string | null;
  sequence: number;
  actedAt?: string | null;
  paper?: Pick<
    QuestionPaper,
    'id' | 'paperCode' | 'paperName' | 'status' | 'examYear' | 'paperType'
  >;
};

export type QuestionBankDashboard = {
  kpis: {
    totalPapers: number;
    publishedPapers: number;
    approvedPapers?: number;
    pendingPapers?: number;
    uploadedToday?: number;
    departments: number;
    subjects: number;
    academicYears: number;
    downloadsThisMonth: number;
    pendingApprovals: number;
    storageUsedBytes?: number;
    topPaper: { id: string; paperName: string; paperCode: string; downloads: number } | null;
    missingSubjects: number;
  };
  statusMix: { label: string; value: number }[];
  papersByYear: { label: string; value: number }[];
  papersByDepartment?: { label: string; value: number }[];
  mostDownloaded?: {
    id: string;
    paperName: string;
    paperCode: string;
    downloads: number;
  }[];
};

export type QuestionBankSettings = {
  maxUploadMb: number;
  allowedMimeTypes: string[];
  allowedPaperTypes: string[];
  studentAccessEnabled: boolean;
};

export type QuestionPaperListResponse = {
  items: QuestionPaper[];
  total: number;
  page: number;
  limit: number;
};

export type BulkPreviewResponse = {
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

export type QuestionPaperFilters = {
  q?: string;
  status?: string;
  academicYearId?: string;
  semesterNo?: string;
  programVersionId?: string;
  departmentId?: string;
  courseId?: string;
  paperType?: string;
  examYear?: string;
  language?: string;
  uploadedById?: string;
  examinationType?: string;
  examCycle?: string;
  subjectCategory?: string;
};
