import { api } from '@/services/api';
import type {
  NaacAqar,
  NaacCriterion,
  NaacDashboard,
  NaacDepartmentSubmission,
  NaacDvvReadiness,
  NaacEvidenceSearchResult,
  NaacEvidenceTag,
  NaacFacultyAchievement,
  NaacIqacSummary,
  NaacListResponse,
  NaacMetric,
  NaacMou,
  NaacStudentAchievement,
  NaacVaultDocument,
  NaacCalendarEvent,
} from '@/types/naac-iqac';

const base = '/v1/naac-iqac';

type QueryParams = Record<string, string | number | boolean | undefined>;

export const fetchNaacDashboard = () =>
  api.get<NaacDashboard>(`${base}/dashboard`).then((r) => r.data);

export const fetchNaacCriteria = () =>
  api.get<NaacCriterion[]>(`${base}/criteria`).then((r) => r.data);

export const fetchNaacMetrics = (criterion?: number) =>
  api.get<NaacMetric[]>(`${base}/metrics`, { params: { criterion } }).then((r) => r.data);

export const fetchNaacEvidence = (params?: QueryParams) =>
  api.get<NaacEvidenceSearchResult>(`${base}/evidence`, { params }).then((r) => r.data);

export const fetchNaacEvidenceBySource = (sourceType: string, sourceId: string) =>
  api
    .get<NaacEvidenceTag[]>(`${base}/evidence/by-source`, {
      params: { sourceType, sourceId },
    })
    .then((r) => r.data);

export const createNaacEvidenceTag = (payload: Partial<NaacEvidenceTag>) =>
  api.post<NaacEvidenceTag>(`${base}/evidence/tags`, payload).then((r) => r.data);

export const deleteNaacEvidenceTag = (id: string) =>
  api.delete(`${base}/evidence/tags/${id}`).then((r) => r.data);

export const fetchNaacVault = (params?: QueryParams) =>
  api.get<NaacListResponse<NaacVaultDocument>>(`${base}/vault`, { params }).then((r) => r.data);

export const uploadNaacVault = (form: FormData) =>
  api
    .post<NaacVaultDocument>(`${base}/vault/upload`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);

export const fetchNaacAqars = () => api.get<NaacAqar[]>(`${base}/aqar`).then((r) => r.data);

export const fetchNaacAqar = (id: string) =>
  api.get<NaacAqar>(`${base}/aqar/${id}`).then((r) => r.data);

export const createNaacAqar = (payload: { academicYear: string; title: string }) =>
  api.post<NaacAqar>(`${base}/aqar`, payload).then((r) => r.data);

export const syncNaacAqarSection = (aqarId: string, sectionKey: string) =>
  api.post<NaacAqar>(`${base}/aqar/${aqarId}/sync`, { sectionKey }).then((r) => r.data);

export const fetchNaacFacultyAchievements = (params?: QueryParams) =>
  api
    .get<NaacListResponse<NaacFacultyAchievement>>(`${base}/faculty-achievements`, { params })
    .then((r) => r.data);

export const createNaacFacultyAchievement = (form: FormData) =>
  api
    .post<NaacFacultyAchievement>(`${base}/faculty-achievements`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);

export const fetchNaacStudentAchievements = (params?: QueryParams) =>
  api
    .get<NaacListResponse<NaacStudentAchievement>>(`${base}/student-achievements`, { params })
    .then((r) => r.data);

export const createNaacStudentAchievement = (form: FormData) =>
  api
    .post<NaacStudentAchievement>(`${base}/student-achievements`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);

export const fetchNaacMous = () => api.get<NaacMou[]>(`${base}/mous`).then((r) => r.data);

export const createNaacMou = (form: FormData) =>
  api
    .post<NaacMou>(`${base}/mous`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);

export const fetchNaacDepartmentDashboard = (departmentId?: string) =>
  api.get(`${base}/department/dashboard`, { params: { departmentId } }).then((r) => r.data);

export const fetchNaacDepartmentSubmissions = (params?: QueryParams) =>
  api
    .get<NaacDepartmentSubmission[]>(`${base}/department/submissions`, { params })
    .then((r) => r.data);

export const createNaacDepartmentSubmission = (
  payload: Partial<NaacDepartmentSubmission> & { submit?: boolean },
) =>
  api.post<NaacDepartmentSubmission>(`${base}/department/submissions`, payload).then((r) => r.data);

export const submitNaacDepartmentDraft = (id: string) =>
  api
    .post<NaacDepartmentSubmission>(`${base}/department/submissions/${id}/submit`)
    .then((r) => r.data);

export const reviewNaacDepartmentSubmission = (
  id: string,
  payload: { status: string; reviewNotes?: string },
) =>
  api
    .patch<NaacDepartmentSubmission>(`${base}/department/submissions/${id}`, payload)
    .then((r) => r.data);

export const fetchNaacPortalDepartment = () => api.get(`${base}/me/department`).then((r) => r.data);

export const downloadNaacEvidencePack = (params?: { criterion?: number; academicYear?: string }) =>
  api.get<Blob>(`${base}/reports/evidence-pack`, {
    params,
    responseType: 'blob',
  });

export const downloadNaacQnmsWorkbook = async (academicYear?: string) => {
  const res = await api.get(`${base}/reports/naac-qnms-workbook`, {
    params: academicYear ? { academicYear } : undefined,
    responseType: 'blob',
  });
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `naac-qnms-${academicYear ?? 'export'}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

export const addNaacDvvEvidenceLink = (
  clarificationId: string,
  payload: { evidenceItemId?: string; vaultDocumentId?: string; note?: string },
) =>
  api
    .post(`${base}/dvv/clarifications/${clarificationId}/evidence-links`, payload)
    .then((r) => r.data);

export const fetchNaacIqacSummary = () =>
  api.get<NaacIqacSummary>(`${base}/iqac/summary`).then((r) => r.data);

export const fetchNaacDvvReadiness = (academicYear?: string) =>
  api
    .get<NaacDvvReadiness>(`${base}/dvv/readiness`, { params: { academicYear } })
    .then((r) => r.data);

export const fetchNaacCalendar = () =>
  api.get<NaacCalendarEvent[]>(`${base}/calendar`).then((r) => r.data);

export const exportNaacReport = (payload: {
  reportType: string;
  format?: string;
  criterion?: number;
  academicYear?: string;
}) => api.post(`${base}/reports/export`, payload).then((r) => r.data);

export const fetchNaacSettings = () => api.get(`${base}/settings`).then((r) => r.data);

export const updateNaacSettings = (payload: Record<string, unknown>) =>
  api.patch(`${base}/settings`, payload).then((r) => r.data);

export const reviewNaacFacultyAchievement = (
  id: string,
  payload: { status: string; reviewNotes?: string },
) =>
  api
    .patch<NaacFacultyAchievement>(`${base}/faculty-achievements/${id}`, payload)
    .then((r) => r.data);

export const bulkReviewNaacFacultyAchievements = (payload: {
  ids: string[];
  status: string;
  reviewNotes?: string;
}) =>
  api
    .post<{
      reviewed: number;
      skipped: number;
      ids: string[];
    }>(`${base}/faculty-achievements/bulk-review`, payload)
    .then((r) => r.data);

export const reviewNaacStudentAchievement = (
  id: string,
  payload: { status: string; reviewNotes?: string },
) =>
  api
    .patch<NaacStudentAchievement>(`${base}/student-achievements/${id}`, payload)
    .then((r) => r.data);

export const fetchNaacPortalStaffContext = () =>
  api
    .get<{
      staff: {
        id: string;
        fullName: string;
        employeeCode: string;
        departmentId: string | null;
      } | null;
    }>(`${base}/me/staff-context`)
    .then((r) => r.data);

export const fetchNaacPortalAchievements = (params?: QueryParams) =>
  api
    .get<NaacListResponse<NaacFacultyAchievement>>(`${base}/me/achievements`, { params })
    .then((r) => r.data);

export const createNaacPortalAchievement = (form: FormData) =>
  api
    .post<NaacFacultyAchievement>(`${base}/me/achievements`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);

export const createNaacCalendarEvent = (payload: {
  title: string;
  eventType: string;
  dueDate: string;
  description?: string;
}) => api.post<NaacCalendarEvent>(`${base}/calendar`, payload).then((r) => r.data);

export const addNaacMouActivity = (
  mouId: string,
  payload: { title: string; activityDate?: string; outcomes?: string; reportNotes?: string },
) => api.post(`${base}/mous/${mouId}/activities`, payload).then((r) => r.data);

export const updateNaacAqar = (
  id: string,
  payload: { title?: string; status?: string; institutionProfile?: Record<string, unknown> },
) => api.patch<NaacAqar>(`${base}/aqar/${id}`, payload).then((r) => r.data);

export const fetchNaacConstants = () => api.get(`${base}/constants`).then((r) => r.data);

export const fetchNaacCriteriaTree = (params?: QueryParams) =>
  api
    .get<import('@/types/naac-iqac').NaacCriteriaTree>(`${base}/criteria/tree`, { params })
    .then((r) => r.data);

export const fetchNaacMyWorkspaces = (academicYear?: string, portal = false) =>
  api
    .get<
      import('@/types/naac-iqac').NaacMyWorkspaces
    >(portal ? `${base}/me/workspaces` : `${base}/my/workspaces`, { params: { academicYear } })
    .then((r) => r.data);

export const fetchNaacMetricWorkspace = (code: string, academicYear?: string, portal = false) =>
  api
    .get<
      import('@/types/naac-iqac').NaacMetricWorkspaceDetail
    >(portal ? `${base}/me/metrics/${code}/workspace` : `${base}/metrics/${code}/workspace`, { params: { academicYear } })
    .then((r) => r.data);

export const patchNaacWorkspace = (
  id: string,
  payload: {
    progressPct?: number;
    deadline?: string | null;
    narrativeDraft?: string;
    status?: string;
  },
) => api.patch(`${base}/workspaces/${id}`, payload).then((r) => r.data);

export const assignNaacWorkspace = (
  workspaceId: string,
  payload: { staffProfileId: string; role: string },
) => api.post(`${base}/workspaces/${workspaceId}/assignments`, payload).then((r) => r.data);

export const unassignNaacWorkspace = (workspaceId: string, assignmentId: string) =>
  api.delete(`${base}/workspaces/${workspaceId}/assignments/${assignmentId}`).then((r) => r.data);

export const addNaacWorkspaceEvidence = (workspaceId: string, form: FormData) =>
  api
    .post(`${base}/workspaces/${workspaceId}/evidence`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);

export const addNaacEvidenceVersion = (evidenceId: string, form: FormData) =>
  api
    .post(`${base}/evidence-items/${evidenceId}/versions`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);

export const verifyNaacEvidenceItem = (
  evidenceId: string,
  payload: { verificationStatus: string; notes?: string },
) => api.patch(`${base}/evidence-items/${evidenceId}/verify`, payload).then((r) => r.data);

export const workflowNaacWorkspace = (
  workspaceId: string,
  action: 'submit' | 'verify' | 'approve' | 'reject' | 'reopen',
  remark?: string,
) => api.post(`${base}/workspaces/${workspaceId}/${action}`, { remark }).then((r) => r.data);

export const fetchNaacWorkspaceComments = (workspaceId: string) =>
  api.get(`${base}/workspaces/${workspaceId}/comments`).then((r) => r.data);

export const addNaacWorkspaceComment = (workspaceId: string, body: string) =>
  api.post(`${base}/workspaces/${workspaceId}/comments`, { body }).then((r) => r.data);

export const fetchNaacExtendedProfile = (academicYear?: string) =>
  api
    .get<{
      academicYear: string;
      exists: boolean;
      profile: {
        id: string;
        sections: Record<string, unknown>;
        lastPulledAt?: string | null;
        pulledById?: string | null;
      } | null;
    }>(`${base}/extended-profile`, { params: { academicYear } })
    .then((r) => r.data);

export const pullNaacExtendedProfile = (academicYear?: string) =>
  api.post(`${base}/extended-profile/pull`, { academicYear }).then((r) => r.data);

export const pullNaacWorkspaceErp = (workspaceId: string) =>
  api.post(`${base}/workspaces/${workspaceId}/pull-erp`).then((r) => r.data);

export const pullNaacErpBulk = (params?: { criterion?: number; academicYear?: string }) =>
  api.post(`${base}/workspaces/pull-erp-bulk`, null, { params }).then((r) => r.data);

export const fetchNaacDvvClarifications = (params?: QueryParams) =>
  api.get(`${base}/dvv/clarifications`, { params }).then((r) => r.data);

export const fetchNaacDvvClarification = (id: string) =>
  api.get(`${base}/dvv/clarifications/${id}`).then((r) => r.data);

export const createNaacDvvClarification = (payload: {
  metricCode: string;
  academicYear?: string;
  queryCode: string;
  title: string;
  naacQueryText: string;
  dueDate?: string;
  assignedFacultyId?: string;
}) => api.post(`${base}/dvv/clarifications`, payload).then((r) => r.data);

export const updateNaacDvvClarification = (id: string, payload: Record<string, unknown>) =>
  api.patch(`${base}/dvv/clarifications/${id}`, payload).then((r) => r.data);

export const addNaacDvvResponse = (id: string, body: string) =>
  api.post(`${base}/dvv/clarifications/${id}/responses`, { body }).then((r) => r.data);

export const addNaacDvvComment = (id: string, body: string) =>
  api.post(`${base}/dvv/clarifications/${id}/comments`, { body }).then((r) => r.data);

export const submitNaacDvvForReview = (id: string, remark?: string) =>
  api.post(`${base}/dvv/clarifications/${id}/submit-for-review`, { remark }).then((r) => r.data);

export const actNaacDvvApproval = (id: string, action: string, note?: string) =>
  api.post(`${base}/dvv/clarifications/${id}/approval/${action}`, { note }).then((r) => r.data);

export type NaacMetricTableColumn = {
  key: string;
  label: string;
  dataType?: string;
  yearScoped?: boolean;
};

export type NaacMetricTableRow = {
  id: string;
  rowIndex: number;
  cells: Record<string, unknown>;
  source: string;
  locked: boolean;
};

export type NaacMetricTableBundle = {
  definition: {
    id: string;
    code: string;
    sheetName: string;
    title: string;
    metricCodes: string[];
    columns: NaacMetricTableColumn[];
  };
  dataset: {
    id: string;
    academicYear: string;
    yearIndex: number;
    lastPulledAt?: string | null;
  };
  rows: NaacMetricTableRow[];
};

export const fetchNaacMetricTables = (metricCode: string, academicYear?: string) =>
  api
    .get<{
      academicYear: string;
      metricCode: string;
      workspaceId: string;
      tables: NaacMetricTableBundle[];
    }>(`${base}/metrics/${encodeURIComponent(metricCode)}/tables`, {
      params: { academicYear },
    })
    .then((r) => r.data);

export const upsertNaacTableRows = (
  datasetId: string,
  rows: Array<{
    id?: string;
    rowIndex?: number;
    cells: Record<string, unknown>;
    source?: string;
    locked?: boolean;
  }>,
) => api.patch(`${base}/datasets/${datasetId}/rows`, { rows }).then((r) => r.data);

export const pullNaacTableErp = (datasetId: string) =>
  api.post(`${base}/datasets/${datasetId}/pull-erp`).then((r) => r.data);

export const importNaacTableXlsx = (datasetId: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api
    .post(`${base}/datasets/${datasetId}/import-xlsx`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    .then((r) => r.data);
};

export const exportNaacTableXlsx = async (datasetId: string, filename?: string) => {
  const res = await api.get(`${base}/datasets/${datasetId}/export-xlsx`, {
    responseType: 'blob',
  });
  const blob = new Blob([res.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `naac-table-${datasetId}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
