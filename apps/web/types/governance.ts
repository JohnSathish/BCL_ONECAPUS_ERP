export type GovernanceListResponse<T> = {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
};

export type GovernanceCommittee = {
  id: string;
  name: string;
  shortCode: string;
  committeeType: string;
  category: string;
  description?: string | null;
  academicYear?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  metadata?: Record<string, unknown> | null;
  memberCount?: number;
  meetingCount?: number;
  pendingAtrCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type GovernanceCommitteeMember = {
  id: string;
  committeeId: string;
  committeeName?: string;
  committeeShortCode?: string;
  staffProfileId?: string | null;
  studentId?: string | null;
  userId?: string | null;
  displayName: string;
  employeeCode?: string | null;
  departmentName?: string | null;
  designation?: string | null;
  role: string;
  mobile?: string | null;
  email?: string | null;
  joiningDate?: string | null;
  endDate?: string | null;
  replacedByMemberId?: string | null;
  status: string;
  isExternal: boolean;
  memberType?: string;
  organization?: string | null;
  address?: string | null;
  areaOfExpertise?: string | null;
  exOfficioPosition?: string | null;
  replacementRequired?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type GovernanceMemberStats = {
  totalCommittees: number;
  totalMembers: number;
  expiringSoon: number;
  membersNeedingReplacement: number;
};

export type GovernanceCommitteeComposition = {
  committeeId: string;
  committeeName: string;
  shortCode: string;
  totalMembers: number;
  internalStaff: number;
  externalMembers: number;
  studentMembers: number;
  exOfficio: number;
  alumniRepresentatives: number;
  parentRepresentatives: number;
  industryExperts: number;
  byType: Record<string, number>;
  naacCompliance: {
    applicable: boolean;
    complete?: boolean;
    ruleLabel?: string;
    checks?: Array<{ id: string; label: string; passed: boolean; detail?: string }>;
    message?: string;
  };
};

export type GovernanceMeetingAgendaItem = {
  id: string;
  meetingId: string;
  sortOrder: number;
  title: string;
  description?: string | null;
};

export type GovernanceMeeting = {
  id: string;
  committeeId: string;
  committeeName?: string;
  title: string;
  meetingDate: string;
  meetingTime?: string | null;
  venue?: string | null;
  meetingMode: string;
  agenda?: string | null;
  priority: string;
  status: string;
  qrToken?: string | null;
  agendaItems?: GovernanceMeetingAgendaItem[];
  attendanceSummary?: { present: number; absent: number; total: number };
  createdAt?: string;
  updatedAt?: string;
};

export type GovernanceMeetingAttendance = {
  id: string;
  meetingId: string;
  memberId?: string | null;
  userId?: string | null;
  displayName?: string | null;
  method: string;
  status: string;
  markedAt?: string | null;
};

export type GovernanceMeetingMinute = {
  id: string;
  meetingId: string;
  discussion?: string | null;
  decisions?: string | null;
  resolutions?: string | null;
  futureActions?: string | null;
  attachments?: unknown;
  pdfPath?: string | null;
  status: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type GovernanceActionItem = {
  id: string;
  committeeId: string;
  committeeName?: string;
  meetingId?: string | null;
  actionItem: string;
  assignedToId?: string | null;
  assignedName?: string | null;
  priority: string;
  targetDate?: string | null;
  status: string;
  remarks?: string | null;
  evidenceFiles?: unknown;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type GovernanceTask = {
  id: string;
  committeeId: string;
  committeeName?: string;
  title: string;
  description?: string | null;
  assignedToId?: string | null;
  assignedName?: string | null;
  dueDate?: string | null;
  status: string;
  completedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type GovernanceNotice = {
  id: string;
  committeeId?: string | null;
  committeeName?: string;
  noticeNo?: string | null;
  title: string;
  body: string;
  audience: string;
  status: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type GovernanceDocument = {
  id: string;
  committeeId?: string | null;
  committeeName?: string;
  folderPath: string;
  title: string;
  category: string;
  storageKey: string;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  academicYear?: string | null;
  uploadedById?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type GovernanceEvent = {
  id: string;
  committeeId: string;
  committeeName?: string;
  title: string;
  eventType: string;
  description?: string | null;
  startDate: string;
  endDate?: string | null;
  venue?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

export type GovernanceNaacTag = {
  id: string;
  entityType: string;
  entityId: string;
  criterion: number;
  evidenceNotes?: string | null;
  documentId?: string | null;
  eventId?: string | null;
  actionItemId?: string | null;
  noticeId?: string | null;
  createdAt?: string;
};

export type GovernanceImportBatch = {
  id: string;
  fileName: string;
  storageKey: string;
  status: string;
  rawText?: string | null;
  draftCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type GovernanceImportDraftMember = {
  displayName: string;
  role: string;
  designation?: string;
  email?: string;
  mobile?: string;
  employeeCode?: string;
  staffProfileId?: string | null;
  userId?: string | null;
  isExternal?: boolean;
  staffMatchConfidence?: number;
};

export type GovernanceImportDraftParsed = {
  name: string;
  shortCode?: string;
  category?: string;
  committeeType?: string;
  description?: string;
  members?: GovernanceImportDraftMember[];
  metadata?: Record<string, unknown>;
};

export type GovernanceImportDraft = {
  id: string;
  batchId: string;
  parsedJson: GovernanceImportDraftParsed;
  confidence: number;
  reviewStatus: string;
  committedAt?: string | null;
  committeeId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type GovernancePerformanceSnapshot = {
  id: string;
  committeeId: string;
  committeeName?: string;
  academicYear: string;
  scoreTotal: number;
  scoreBreakdown: Record<string, number>;
  computedAt: string;
};

export type GovernanceSettings = {
  id?: string;
  defaultAcademicYear?: string | null;
  noticePrefix: string;
  notifyEmail: boolean;
  notifyInApp: boolean;
  notifyPush: boolean;
  notifySms: boolean;
  qrAttendanceEnabled: boolean;
  performanceWeights?: Record<string, number> | null;
  metadata?: Record<string, unknown> | null;
  updatedAt?: string;
};

export type GovernanceDashboard = {
  kpis: {
    activeCommittees: number;
    totalMembers: number;
    meetingsThisMonth: number;
    pendingAtr: number;
    overdueAtr: number;
    pendingTasks: number;
    upcomingMeetings: number;
    publishedNotices: number;
    documentsThisYear: number;
    eventsThisYear: number;
  };
  todaysMeetings: GovernanceMeeting[];
  pendingAtrItems: GovernanceActionItem[];
  recentDocuments: GovernanceDocument[];
  performanceRanking: GovernancePerformanceSnapshot[];
  attendanceRanking: Array<{
    committeeId: string;
    committeeName: string;
    attendanceRate: number;
    meetingsHeld: number;
  }>;
  upcomingEvents: GovernanceEvent[];
};

export type GovernanceCalendarEvent = {
  id: string;
  title: string;
  meetingDate: string;
  meetingTime?: string | null;
  committeeId: string;
  committeeName?: string;
  status: string;
  venue?: string | null;
};

export type GovernanceAnalytics = {
  performanceTrend: Array<{ month: string; averageScore: number }>;
  attendanceTrend: Array<{ month: string; rate: number }>;
  atrCompletionTrend: Array<{ month: string; completed: number; pending: number }>;
  committeeScores: GovernancePerformanceSnapshot[];
  topCommittees: GovernancePerformanceSnapshot[];
  lowAttendanceCommittees: Array<{
    committeeId: string;
    committeeName: string;
    attendanceRate: number;
  }>;
};

export type GovernancePortalSummary = {
  committees: GovernanceCommittee[];
  upcomingMeetings: GovernanceMeeting[];
  pendingAtr: GovernanceActionItem[];
  pendingTasks: GovernanceTask[];
  recentNotices: GovernanceNotice[];
  kpis: {
    committeeCount: number;
    pendingAtr: number;
    pendingTasks: number;
    upcomingMeetings: number;
  };
};

export type GovernanceReportDefinition = {
  id: string;
  label: string;
  description: string;
  category: string;
};

export type GovernanceReportResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  summary?: Record<string, unknown>;
};
