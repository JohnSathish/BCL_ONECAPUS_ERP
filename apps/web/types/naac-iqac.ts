export type NaacCriterion = {
  id: string;
  criterion: number;
  title: string;
  description?: string;
  metrics?: NaacMetric[];
};

export type NaacMetric = {
  id: string;
  code: string;
  title: string;
  description?: string;
  dataType: string;
  isMandatory: boolean;
  criterion?: { criterion: number; title: string };
};

export type NaacEvidenceTag = {
  id: string;
  sourceType: string;
  sourceId: string;
  criterion: number;
  metricCode?: string;
  academicYear: string;
  departmentId?: string;
  activityTitle?: string;
  evidenceNotes?: string;
  fileName?: string;
  storageKey?: string;
  fileUrl?: string;
  origin?: 'nims' | 'governance';
  createdAt?: string;
};

export type NaacEvidenceSearchResult = {
  items: NaacEvidenceTag[];
  total: number;
  page: number;
  limit: number;
  nimsTotal: number;
  governanceTotal: number;
};

export type NaacDashboard = {
  academicYear: string;
  overallReadiness: number;
  aqarCompletionPct: number;
  aqarStatus: string;
  criterionStatus: Array<{
    criterion: number;
    title: string;
    score: number;
    evidenceCount: number;
    metricCount: number;
    status: string;
  }>;
  pending: {
    missingEvidence: number;
    departmentPending: number;
    facultyPending: number;
    metricsPending: number;
  };
  upcomingDeadlines: NaacCalendarEvent[];
  aggregates: Record<string, { value: number; source: string; asOf: string }>;
};

export type NaacAqar = {
  id: string;
  academicYear: string;
  title: string;
  status: string;
  completionPct: number;
  sections?: NaacAqarSection[];
};

export type NaacAqarSection = {
  id: string;
  sectionKey: string;
  content?: Record<string, unknown>;
  completionPct: number;
  lastSyncedAt?: string;
};

export type NaacVaultDocument = {
  id: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  createdAt: string;
  evidenceTags?: NaacEvidenceTag[];
};

export type NaacFacultyAchievement = {
  id: string;
  staffProfileId: string;
  achievementType: string;
  title: string;
  description?: string;
  status: string;
  evidenceTag?: NaacEvidenceTag;
};

export type NaacStudentAchievement = {
  id: string;
  studentId?: string;
  achievementType: string;
  title: string;
  status: string;
};

export type NaacMou = {
  id: string;
  partnerType: string;
  partnerName: string;
  signedAt?: string;
  expiresAt?: string;
  status: string;
  fileName?: string;
  activities?: NaacMouActivity[];
};

export type NaacMouActivity = {
  id: string;
  title: string;
  activityDate?: string;
  outcomes?: string;
};

export type NaacDepartmentSubmission = {
  id: string;
  departmentId: string;
  academicYear: string;
  submissionType: string;
  status: string;
  payload?: Record<string, unknown>;
};

export type NaacCalendarEvent = {
  id: string;
  title: string;
  eventType: string;
  dueDate: string;
  description?: string;
  status: string;
};

export type NaacDvvReadiness = {
  academicYear: string;
  readinessScore: number;
  documentsMissing: number;
  metricsMissing: Array<{ code: string; title: string; criterion: number; criterionTitle: string }>;
  departmentsPending: Array<{ id: string; name: string; code: string }>;
  facultyPending: number;
  studentPending: number;
  criterionCoverage: Array<{
    criterion: number;
    title: string;
    evidenceCount: number;
    metricsMissing: number;
    ready: boolean;
  }>;
};

export type NaacIqacSummary = {
  iqacCommittee: { id: string; name: string; shortCode?: string } | null;
  governanceEvidenceByCriterion: Array<{ criterion: number; title: string; evidenceCount: number }>;
  openAtrCount: number;
  recentMeetings: unknown[];
  links: Record<string, string>;
};

export type NaacListResponse<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type NaacPage =
  | 'dashboard'
  | 'criteria'
  | 'evidence'
  | 'vault'
  | 'aqar'
  | 'department'
  | 'faculty'
  | 'student'
  | 'mous'
  | 'iqac'
  | 'dvv'
  | 'calendar'
  | 'reports'
  | 'settings';
