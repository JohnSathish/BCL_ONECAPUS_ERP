export type AiMessageRole = 'user' | 'assistant';

export type AiLink = { label: string; href: string };

export type AiFieldOption = { key: string; label: string; selected?: boolean };

export type AiDownload = {
  label: string;
  filename: string;
  contentType: string;
  base64: string;
};

export type AiTablePayload = {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
  totalRows?: number;
};

export type AiChartPayload = {
  title: string;
  chartType: 'bar' | 'pie' | 'line';
  series: Array<{ label: string; value: number }>;
};

export type AiConfirmationPayload = {
  confirmationId: string;
  summary: string;
  actionLabel: string;
  danger?: boolean;
  /** When true, confirm triggers report export (not module navigation) */
  reportGenerate?: boolean;
};

export type AiChatResponse = {
  answer: string;
  links?: AiLink[];
  source: 'live' | 'estimated' | 'rules' | 'llm' | 'knowledge' | 'hybrid';
  suggestedFollowUps?: string[];
  fieldOptions?: AiFieldOption[];
  downloads?: AiDownload[];
  table?: AiTablePayload;
  chart?: AiChartPayload;
  confirmation?: AiConfirmationPayload;
  sessionId: string;
  knowledgeSource?: {
    documentTitle: string;
    section?: string | null;
    pageRef?: string | null;
  };
};

export type AiLookupFocus =
  | 'shift'
  | 'programme'
  | 'semester'
  | 'fee'
  | 'attendance'
  | 'profile'
  | 'who';

export type AiActionKind =
  | 'lookup_student'
  | 'knowledge_query'
  | 'hybrid_query'
  | 'generate_student_report'
  | 'generate_fee_report'
  | 'generate_attendance_report'
  | 'fee_summary'
  | 'attendance_summary'
  | 'get_institutional_kpis'
  | 'search_students'
  | 'search_staff'
  | 'search_applications'
  | 'search_subjects'
  | 'list_paper_students'
  | 'search_departments'
  | 'profile_completion_summary'
  | 'generate_chart'
  | 'propose_action'
  | 'action_stub'
  | 'exam_fee_query';

export type AiPendingIntent = {
  action: AiActionKind;
  filters: AiIntentFilters;
  columns?: string[];
  format?: 'xlsx' | 'csv' | 'pdf';
  /** User reviewed preview; waiting for explicit generate confirmation */
  awaitingReportConfirm?: boolean;
  missing?: Array<'fields' | 'format' | 'semester' | 'query'>;
  searchQuery?: string;
  actionLabel?: string;
  actionHref?: string;
  chartWidgetId?: string;
  feeReportType?: string;
  attendanceReportType?: string;
  proposedAction?: string;
  lookupFocus?: AiLookupFocus;
};

export type AiIntentFilters = {
  programmeFamily?: 'BA' | 'BSC' | 'BCOM';
  programmeCode?: string;
  programmeName?: string;
  majorSubjectName?: string;
  minorSubjectName?: string;
  departmentName?: string;
  shiftName?: string;
  semester?: number;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  feeStatus?: string;
  missingAadhaar?: boolean;
  missingPhoto?: boolean;
  missingMobile?: boolean;
  missingAbcId?: boolean;
  incompleteProfile?: boolean;
  missingClassXii?: boolean;
  pendingProfileVerification?: boolean;
};

export type AiActiveStudent = {
  id: string;
  rollNumber: string;
  enrollmentNumber?: string;
  name: string;
};

export type AiSessionState = {
  turns: Array<{ role: AiMessageRole; text: string }>;
  pendingIntent?: AiPendingIntent | null;
  /** Level 3 ERP memory — current student in conversation */
  activeStudent?: AiActiveStudent | null;
  pendingConfirmation?: {
    confirmationId: string;
    proposedAction: string;
    actionLabel: string;
    actionHref: string;
    summary: string;
  } | null;
  updatedAt: string;
};

export type ResolvedIntent = {
  action: AiActionKind | 'help' | 'clarify';
  filters: AiIntentFilters;
  columns?: string[];
  format?: 'xlsx' | 'csv' | 'pdf';
  searchQuery?: string;
  confidence: number;
  needsClarification?: Array<'fields' | 'format' | 'semester' | 'query'>;
  answerHint?: string;
  actionLabel?: string;
  actionHref?: string;
  chartWidgetId?: string;
  feeReportType?: string;
  attendanceReportType?: string;
  proposedAction?: string;
  lookupFocus?: AiLookupFocus;
  /** Original user question (used by knowledge_query / hybrid_query) */
  question?: string;
  /** ERP data slice for hybrid_query */
  hybridErpFocus?: 'fees' | 'attendance';
  /** When true, skip preview and export immediately */
  reportConfirmed?: boolean;
  source?: 'rules' | 'llm' | 'knowledge' | 'hybrid';
};
