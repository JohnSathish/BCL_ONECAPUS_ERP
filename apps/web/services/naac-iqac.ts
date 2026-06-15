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

export const createNaacDepartmentSubmission = (payload: Partial<NaacDepartmentSubmission>) =>
  api.post<NaacDepartmentSubmission>(`${base}/department/submissions`, payload).then((r) => r.data);

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

export const fetchNaacConstants = () => api.get(`${base}/constants`).then((r) => r.data);
