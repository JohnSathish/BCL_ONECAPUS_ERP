import { api } from '@/services/api';
import type {
  ClearanceBulkResult,
  ClearanceDecision,
  ClearanceDetail,
  ClearanceList,
  ClearanceOptions,
  ClearancePreview,
  ClearanceStudentHit,
} from '@/types/library-clearance';

const base = '/v1/library/clearance';

export type ClearanceListParams = {
  page?: number;
  limit?: number;
  search?: string;
  academicYear?: string;
  examinationName?: string;
  semester?: number;
  departmentId?: string;
  programId?: string;
  status?: string;
};

export const fetchClearanceOptions = () =>
  api.get<ClearanceOptions>(`${base}/options`).then((r) => r.data);

export const fetchClearanceRecords = (params: ClearanceListParams) =>
  api.get<ClearanceList>(`${base}/records`, { params }).then((r) => r.data);

export const searchClearanceStudents = (q: string) =>
  api.get<ClearanceStudentHit[]>(`${base}/students/search`, { params: { q } }).then((r) => r.data);

export const fetchClearancePreview = (
  studentId: string,
  params: { academicYear?: string; examinationName?: string; semester?: number },
) =>
  api
    .get<ClearancePreview>(`${base}/students/${studentId}/preview`, { params })
    .then((r) => r.data);

export const fetchClearanceHistory = (studentId: string) =>
  api
    .get<{ cards: ClearanceList['rows'] }>(`${base}/students/${studentId}/history`)
    .then((r) => r.data);

export const fetchClearanceCard = (id: string) =>
  api.get<ClearanceDetail>(`${base}/${id}`).then((r) => r.data);

export const createClearanceCard = (
  payload: ClearanceDecision & {
    studentId: string;
    academicYear: string;
    examinationName: string;
    semester: number;
  },
) => api.post<ClearanceDetail>(base, payload).then((r) => r.data);

export const updateClearanceCard = (id: string, payload: ClearanceDecision) =>
  api.patch<ClearanceDetail>(`${base}/${id}`, payload).then((r) => r.data);

export const recheckClearanceCard = (id: string) =>
  api.post<ClearanceDetail>(`${base}/${id}/recheck`).then((r) => r.data);

export const regenerateClearanceCard = (id: string) =>
  api.post<ClearanceDetail>(`${base}/${id}/regenerate`).then((r) => r.data);

export const bulkClearanceCards = (payload: {
  academicYear: string;
  examinationName: string;
  semester: number;
  studentIds?: string[];
  departmentId?: string;
  programId?: string;
  librarianName?: string;
}) => api.post<ClearanceBulkResult>(`${base}/bulk`, payload).then((r) => r.data);

export const fetchClearancePrintHtml = (payload: {
  ids: string[];
  layout: 'single' | 'pair';
  autoPrint?: boolean;
}) => api.post<{ html: string }>(`${base}/print`, payload).then((r) => r.data);

export const downloadClearancePdf = (payload: { ids: string[]; layout: 'single' | 'pair' }) =>
  api.post(`${base}/pdf`, payload, { responseType: 'blob' }).then((r) => r.data as Blob);
