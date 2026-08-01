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
  metricType?: string;
  isMandatory: boolean;
  weightage?: number | null;
  criterion?: { criterion: number; title: string };
};

export type NaacWorkspaceSummary = {
  id: string;
  status: string;
  progressPct: number;
  deadline?: string | null;
  evidenceCount?: number;
  commentCount?: number;
  assignees?: Array<{ id: string; staffProfileId: string; role: string }>;
};

export type NaacTreeMetric = {
  id: string;
  code: string;
  title: string;
  dataType: string;
  metricType: string;
  isMandatory: boolean;
  weightage?: number | null;
  workspace: NaacWorkspaceSummary | null;
};

export type NaacCriteriaTree = {
  academicYear: string;
  criteria: Array<{
    id: string;
    criterion: number;
    title: string;
    description?: string | null;
    progressPct: number;
    approvedCount: number;
    metricCount: number;
    keyIndicators: Array<{
      id: string;
      code: string;
      title: string;
      metrics: NaacTreeMetric[];
    }>;
    metrics: NaacTreeMetric[];
  }>;
};

export type NaacMetricWorkspaceDetail = {
  academicYear: string;
  metric: NaacMetric & {
    erpSourceKey?: string | null;
    criterion?: { criterion: number; title: string };
    keyIndicator?: { code: string; title: string } | null;
  };
  workspace: {
    id: string;
    status: string;
    progressPct: number;
    deadline?: string | null;
    narrativeDraft?: string | null;
    erpSourceHints?: {
      metricCode?: string | null;
      erpSourceKey?: string | null;
      primary?: Record<string, unknown> | null;
      related?: Record<string, unknown>;
      pulledAt?: string;
    } | null;
    assignments: Array<{
      id: string;
      staffProfileId: string;
      role: string;
      staff?: {
        id: string;
        fullName: string;
        employeeCode: string;
      } | null;
    }>;
    evidence: Array<{
      id: string;
      title: string;
      evidenceType: string;
      verificationStatus: string;
      notes?: string | null;
      versions: Array<{
        id: string;
        versionNo: number;
        fileName?: string | null;
        externalUrl?: string | null;
        changeNote?: string | null;
        createdAt: string;
      }>;
    }>;
    comments: Array<{
      id: string;
      body: string;
      authorId?: string | null;
      createdAt: string;
    }>;
    approvals: Array<{
      id: string;
      step: string;
      remark?: string | null;
      actorId?: string | null;
      createdAt: string;
    }>;
  };
  history: Array<{
    id: string;
    action: string;
    actorId?: string | null;
    createdAt: string;
    payload?: Record<string, unknown>;
  }>;
  approval?: {
    exists: boolean;
    pendingRole?: string | null;
    instance?: { id?: string; status?: string; currentStepOrder?: number } | null;
    steps?: Array<{
      stepOrder: number;
      name: string;
      assigneeRole?: string | null;
      done?: boolean;
      current?: boolean;
    }>;
  };
  approvalTimeline?: Array<{
    id: string;
    event: string;
    note?: string | null;
    at: string;
  }>;
};

export type NaacMyWorkspaces = {
  academicYear: string;
  scope: string;
  items: Array<{
    id: string;
    status: string;
    progressPct: number;
    deadline?: string | null;
    metric: {
      code: string;
      title: string;
      isMandatory?: boolean;
      criterion?: { criterion: number; title: string };
      keyIndicator?: { code: string; title: string } | null;
    };
    assignments: Array<{ staffProfileId: string; role: string }>;
    _count?: { evidence: number; comments: number };
  }>;
};

export type NaacEvidenceTag = {
  id: string;
  sourceType: string;
  sourceId: string;
  criterion: number;
  metricCode?: string;
  academicYear: string;
  departmentId?: string;
  committeeId?: string;
  programmeId?: string;
  activityTitle?: string;
  eventTitle?: string;
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
    approvedCount?: number;
    overdueCount?: number;
    progressPct?: number;
    status: string;
  }>;
  pending: {
    missingEvidence: number;
    departmentPending: number;
    facultyPending: number;
    metricsPending: number;
    pendingApproval?: number;
    overdueDeadlines?: number;
    changesRequested?: number;
  };
  workspaceRollup?: {
    pendingApproval: number;
    overdueDeadlines: number;
    changesRequested: number;
  };
  upcomingDeadlines: NaacCalendarEvent[];
  aggregates: Record<
    string,
    {
      value: number | null;
      source: string;
      asOf: string;
      pending?: boolean;
      message?: string;
      unit?: string;
    }
  >;
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
  | 'my-metrics'
  | 'extended-profile'
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
