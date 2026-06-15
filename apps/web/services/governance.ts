import { api } from '@/services/api';
import type {
  GovernanceActionItem,
  GovernanceAnalytics,
  GovernanceCalendarEvent,
  GovernanceCommittee,
  GovernanceCommitteeMember,
  GovernanceDashboard,
  GovernanceDocument,
  GovernanceEvent,
  GovernanceImportBatch,
  GovernanceImportDraft,
  GovernanceImportDraftParsed,
  GovernanceListResponse,
  GovernanceMeeting,
  GovernanceMeetingAttendance,
  GovernanceMeetingMinute,
  GovernanceNaacTag,
  GovernanceNotice,
  GovernancePerformanceSnapshot,
  GovernancePortalSummary,
  GovernanceReportResult,
  GovernanceSettings,
  GovernanceTask,
} from '@/types/governance';

const base = '/v1/governance';

type QueryParams = Record<string, string | number | boolean | undefined>;

// Dashboard
export const fetchGovernanceDashboard = () =>
  api.get<GovernanceDashboard>(`${base}/dashboard`).then((r) => r.data);

// Committees
export const fetchGovernanceCommittees = (params?: QueryParams) =>
  api
    .get<GovernanceListResponse<GovernanceCommittee>>(`${base}/committees`, { params })
    .then((r) => r.data);

export const fetchGovernanceCommittee = (id: string) =>
  api.get<GovernanceCommittee>(`${base}/committees/${id}`).then((r) => r.data);

export const createGovernanceCommittee = (payload: Partial<GovernanceCommittee>) =>
  api.post<GovernanceCommittee>(`${base}/committees`, payload).then((r) => r.data);

export const updateGovernanceCommittee = (id: string, payload: Partial<GovernanceCommittee>) =>
  api.patch<GovernanceCommittee>(`${base}/committees/${id}`, payload).then((r) => r.data);

// Members
export const fetchGovernanceMembers = (params?: QueryParams) =>
  api
    .get<GovernanceListResponse<GovernanceCommitteeMember>>(`${base}/members`, { params })
    .then((r) => r.data);

export const fetchCommitteeMembers = (committeeId: string) =>
  api
    .get<GovernanceCommitteeMember[]>(`${base}/committees/${committeeId}/members`)
    .then((r) => r.data);

export const createGovernanceMember = (
  committeeId: string,
  payload: Partial<GovernanceCommitteeMember>,
) =>
  api
    .post<GovernanceCommitteeMember>(`${base}/committees/${committeeId}/members`, payload)
    .then((r) => r.data);

export const updateGovernanceMember = (id: string, payload: Partial<GovernanceCommitteeMember>) =>
  api.patch<GovernanceCommitteeMember>(`${base}/members/${id}`, payload).then((r) => r.data);

export const removeGovernanceMember = (id: string) =>
  api.delete(`${base}/members/${id}`).then((r) => r.data);

// Import (Excel recommended; PDF fallback)
export const downloadGovernanceImportTemplate = () =>
  api.get<Blob>(`${base}/imports/template`, { responseType: 'blob' }).then((r) => r.data);

export const uploadGovernanceExcelImport = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api
    .post<GovernanceImportBatch & { drafts?: GovernanceImportDraft[] }>(
      `${base}/imports/excel`,
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    )
    .then((r) => r.data);
};

export const uploadGovernancePdfImport = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api
    .post<GovernanceImportBatch & { drafts?: GovernanceImportDraft[] }>(
      `${base}/imports/pdf`,
      form,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    )
    .then((r) => r.data);
};

export const fetchGovernanceImportBatches = (params?: QueryParams) =>
  api
    .get<GovernanceListResponse<GovernanceImportBatch>>(`${base}/imports`, { params })
    .then((r) => r.data);

export const fetchGovernanceImportDrafts = (batchId: string) =>
  api
    .get<GovernanceImportBatch & { drafts: GovernanceImportDraft[] }>(`${base}/imports/${batchId}`)
    .then((r) => r.data.drafts ?? []);

export const updateGovernanceImportDraft = (
  id: string,
  payload: { parsedJson?: GovernanceImportDraftParsed; reviewStatus?: string },
) => api.patch<GovernanceImportDraft>(`${base}/imports/drafts/${id}`, payload).then((r) => r.data);

export const commitGovernanceImportDraft = (id: string) =>
  api.post<GovernanceCommittee>(`${base}/imports/drafts/${id}/commit`).then((r) => r.data);

export const rejectGovernanceImportDraft = (id: string) =>
  api
    .patch<GovernanceImportDraft>(`${base}/imports/drafts/${id}`, { reviewStatus: 'REJECTED' })
    .then((r) => r.data);

// Meetings
export const fetchGovernanceMeetings = (params?: QueryParams) =>
  api
    .get<GovernanceListResponse<GovernanceMeeting>>(`${base}/meetings`, { params })
    .then((r) => r.data);

export const fetchGovernanceMeeting = (id: string) =>
  api.get<GovernanceMeeting>(`${base}/meetings/${id}`).then((r) => r.data);

export const createGovernanceMeeting = (
  payload: Partial<GovernanceMeeting> & {
    agendaItems?: Array<{ title: string; description?: string }>;
  },
) => api.post<GovernanceMeeting>(`${base}/meetings`, payload).then((r) => r.data);

export const updateGovernanceMeeting = (id: string, payload: Partial<GovernanceMeeting>) =>
  api.patch<GovernanceMeeting>(`${base}/meetings/${id}`, payload).then((r) => r.data);

export const fetchGovernanceMeetingCalendar = (params?: QueryParams) =>
  api.get<GovernanceCalendarEvent[]>(`${base}/meetings/calendar`, { params }).then((r) => r.data);

// Attendance
export const fetchGovernanceMeetingAttendance = (meetingId: string) =>
  api
    .get<GovernanceMeetingAttendance[]>(`${base}/meetings/${meetingId}/attendance`)
    .then((r) => r.data);

export const saveGovernanceMeetingAttendance = (
  meetingId: string,
  rows: Array<{
    memberId?: string;
    userId?: string;
    displayName?: string;
    status: string;
    method?: string;
  }>,
) =>
  api
    .post<GovernanceMeetingAttendance[]>(`${base}/meetings/${meetingId}/attendance`, { rows })
    .then((r) => r.data);

export const generateGovernanceMeetingQr = (meetingId: string) =>
  api
    .post<{ qrToken: string; qrUrl: string }>(`${base}/meetings/${meetingId}/attendance/qr`)
    .then((r) => r.data);

export const fetchGovernanceAttendanceRegister = (params?: QueryParams) =>
  api
    .get<
      GovernanceListResponse<
        GovernanceMeetingAttendance & { meetingTitle?: string; meetingDate?: string }
      >
    >(`${base}/attendance`, { params })
    .then((r) => r.data);

// Minutes
export const fetchGovernanceMeetingMinutes = (meetingId: string) =>
  api.get<GovernanceMeetingMinute>(`${base}/meetings/${meetingId}/minutes`).then((r) => r.data);

export const saveGovernanceMeetingMinutes = (
  meetingId: string,
  payload: Partial<GovernanceMeetingMinute>,
) =>
  api
    .post<GovernanceMeetingMinute>(`${base}/meetings/${meetingId}/minutes`, payload)
    .then((r) => r.data);

export const downloadGovernanceMeetingMinutesPdf = (meetingId: string) =>
  api
    .get<Blob>(`${base}/meetings/${meetingId}/minutes/pdf`, { responseType: 'blob' })
    .then((r) => r.data);

// ATR
export const fetchGovernanceActionItems = (params?: QueryParams) =>
  api
    .get<GovernanceListResponse<GovernanceActionItem>>(`${base}/atr`, { params })
    .then((r) => r.data);

export const createGovernanceActionItem = (payload: Partial<GovernanceActionItem>) =>
  api.post<GovernanceActionItem>(`${base}/atr`, payload).then((r) => r.data);

export const updateGovernanceActionItem = (id: string, payload: Partial<GovernanceActionItem>) =>
  api.patch<GovernanceActionItem>(`${base}/atr/${id}`, payload).then((r) => r.data);

// Tasks
export const fetchGovernanceTasks = (params?: QueryParams) =>
  api.get<GovernanceListResponse<GovernanceTask>>(`${base}/tasks`, { params }).then((r) => r.data);

export const createGovernanceTask = (payload: Partial<GovernanceTask>) =>
  api.post<GovernanceTask>(`${base}/tasks`, payload).then((r) => r.data);

export const updateGovernanceTask = (id: string, payload: Partial<GovernanceTask>) =>
  api.patch<GovernanceTask>(`${base}/tasks/${id}`, payload).then((r) => r.data);

// Notices
export const fetchGovernanceNotices = (params?: QueryParams) =>
  api
    .get<GovernanceListResponse<GovernanceNotice>>(`${base}/notices`, { params })
    .then((r) => r.data);

export const createGovernanceNotice = (payload: Partial<GovernanceNotice>) =>
  api.post<GovernanceNotice>(`${base}/notices`, payload).then((r) => r.data);

export const updateGovernanceNotice = (id: string, payload: Partial<GovernanceNotice>) =>
  api.patch<GovernanceNotice>(`${base}/notices/${id}`, payload).then((r) => r.data);

export const publishGovernanceNotice = (id: string) =>
  api.post<GovernanceNotice>(`${base}/notices/${id}/publish`).then((r) => r.data);

// Documents
export const fetchGovernanceDocuments = (params?: QueryParams) =>
  api
    .get<GovernanceListResponse<GovernanceDocument>>(`${base}/documents`, { params })
    .then((r) => r.data);

export const uploadGovernanceDocument = (form: FormData) =>
  api
    .post<GovernanceDocument>(`${base}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);

// Events
export const fetchGovernanceEvents = (params?: QueryParams) =>
  api
    .get<GovernanceListResponse<GovernanceEvent>>(`${base}/events`, { params })
    .then((r) => r.data);

export const createGovernanceEvent = (payload: Partial<GovernanceEvent>) =>
  api.post<GovernanceEvent>(`${base}/events`, payload).then((r) => r.data);

export const updateGovernanceEvent = (id: string, payload: Partial<GovernanceEvent>) =>
  api.patch<GovernanceEvent>(`${base}/events/${id}`, payload).then((r) => r.data);

// NAAC
export const fetchGovernanceNaacEvidence = (params?: QueryParams) =>
  api
    .get<
      GovernanceListResponse<GovernanceNaacTag & { entityLabel?: string }>
    >(`${base}/naac/evidence`, { params })
    .then((r) => r.data);

export const createGovernanceNaacTag = (payload: Partial<GovernanceNaacTag>) =>
  api.post<GovernanceNaacTag>(`${base}/naac/tags`, payload).then((r) => r.data);

export const exportGovernanceNaacPack = (params?: QueryParams) =>
  api.get<Blob>(`${base}/naac/export`, { params, responseType: 'blob' }).then((r) => r.data);

// Analytics & performance
export const fetchGovernanceAnalytics = (params?: QueryParams) =>
  api.get<GovernanceAnalytics>(`${base}/analytics/performance`, { params }).then((r) => r.data);

export const fetchGovernancePerformanceSnapshots = (params?: QueryParams) =>
  api
    .get<GovernancePerformanceSnapshot[]>(`${base}/analytics/rankings`, { params })
    .then((r) => r.data);

// Reports
export const fetchGovernanceReport = (type: string, params?: QueryParams) =>
  api.get<GovernanceReportResult>(`${base}/reports/${type}`, { params }).then((r) => r.data);

export const exportGovernanceReport = (
  type: string,
  format: 'csv' | 'xlsx' | 'pdf',
  params?: QueryParams,
) =>
  api
    .get<Blob | string>(`${base}/reports/${type}/export`, {
      params: { ...params, format },
      responseType: format === 'csv' ? 'text' : 'blob',
    })
    .then((r) => r.data);

// Settings
export const fetchGovernanceSettings = () =>
  api.get<GovernanceSettings>(`${base}/settings`).then((r) => r.data);

export const updateGovernanceSettings = (payload: Partial<GovernanceSettings>) =>
  api.patch<GovernanceSettings>(`${base}/settings`, payload).then((r) => r.data);

// Staff portal
export const fetchGovernancePortalSummary = () =>
  api.get<GovernancePortalSummary>(`${base}/me/summary`).then((r) => r.data);

export const fetchGovernancePortalMeetings = (params?: QueryParams) =>
  api.get<GovernanceMeeting[]>(`${base}/me/meetings`, { params }).then((r) => r.data);

export const fetchGovernancePortalTasks = (params?: QueryParams) =>
  api.get<GovernanceTask[]>(`${base}/me/tasks`, { params }).then((r) => r.data);

export const fetchGovernancePortalAtr = (params?: QueryParams) =>
  api.get<GovernanceActionItem[]>(`${base}/me/atr`, { params }).then((r) => r.data);

export const fetchGovernancePortalNotices = (params?: QueryParams) =>
  api.get<GovernanceNotice[]>(`${base}/me/notices`, { params }).then((r) => r.data);

// Student portal
export const fetchStudentGovernanceNotices = (params?: QueryParams) =>
  api.get<GovernanceNotice[]>(`${base}/me/notices`, { params }).then((r) => r.data);

export const fetchStudentGovernanceMeetings = (params?: QueryParams) =>
  api.get<GovernanceMeeting[]>(`${base}/me/meetings`, { params }).then((r) => r.data);
