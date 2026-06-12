export type QuestionPaperStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'ARCHIVED';

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
  status: QuestionPaperStatus;
  keywords: string[];
  uploadedById?: string | null;
  publishedById?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  approvals?: QuestionPaperApproval[];
  related?: QuestionPaper[];
  bookmarkId?: string;
  bookmarkedAt?: string;
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
    departments: number;
    subjects: number;
    academicYears: number;
    downloadsThisMonth: number;
    pendingApprovals: number;
    topPaper: { id: string; paperName: string; paperCode: string; downloads: number } | null;
    missingSubjects: number;
  };
  statusMix: { label: string; value: number }[];
  papersByYear: { label: string; value: number }[];
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
