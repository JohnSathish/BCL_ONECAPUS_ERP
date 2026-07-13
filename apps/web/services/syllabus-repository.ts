import { api } from '@/services/api';
import type {
  AskSyllabusResponse,
  SyllabusApproval,
  SyllabusBulkPreviewResponse,
  SyllabusCourseLookup,
  SyllabusCourseSearchResponse,
  SyllabusDashboard,
  SyllabusDocument,
  SyllabusExtractHintsResponse,
  SyllabusListResponse,
  SyllabusPreflightResponse,
  SyllabusSettings,
  SyllabusVersion,
} from '@/types/syllabus-repository';

const base = '/v1/syllabus-repository';

export const fetchSyllabusDashboard = () =>
  api.get<SyllabusDashboard>(`${base}/dashboard`).then((r) => r.data);

export const fetchSyllabusSettings = () =>
  api.get<SyllabusSettings>(`${base}/settings`).then((r) => r.data);

export const updateSyllabusSettings = (payload: Partial<SyllabusSettings>) =>
  api.patch<SyllabusSettings>(`${base}/settings`, payload).then((r) => r.data);

export const lookupSyllabusCourse = (code: string) =>
  api
    .get<SyllabusCourseLookup | SyllabusCourseSearchResponse>(`${base}/courses/lookup`, {
      params: { code },
    })
    .then((r) => {
      const data = r.data;
      if (data && typeof data === 'object' && 'items' in data) {
        const first = data.items[0];
        if (!first) throw new Error('Course not found');
        return first;
      }
      return data as SyllabusCourseLookup;
    });

export const searchSyllabusCourses = (params: {
  q?: string;
  code?: string;
  departmentId?: string;
  semesterNo?: number;
  subjectType?: string;
  limit?: number;
}) =>
  api
    .get<SyllabusCourseLookup | SyllabusCourseSearchResponse>(`${base}/courses/lookup`, {
      params,
    })
    .then((r) => {
      const data = r.data;
      if (data && typeof data === 'object' && 'items' in data) return data;
      return { items: data ? [data as SyllabusCourseLookup] : [] };
    });

export const preflightSyllabusDocument = (params: {
  courseId: string;
  academicYearId?: string;
  semesterNo?: number;
  category?: string;
}) =>
  api.get<SyllabusPreflightResponse>(`${base}/documents/preflight`, { params }).then((r) => r.data);

export const extractSyllabusHints = (form: FormData) =>
  api
    .post<SyllabusExtractHintsResponse>(`${base}/documents/extract-hints`, form)
    .then((r) => r.data);

export const fetchSyllabusDocuments = (params?: Record<string, string | number | undefined>) =>
  api.get<SyllabusListResponse>(`${base}/documents`, { params }).then((r) => r.data);

export const fetchSyllabusDocument = (id: string) =>
  api.get<SyllabusDocument>(`${base}/documents/${id}`).then((r) => r.data);

export const createSyllabusDocument = (form: FormData) =>
  api
    .post<
      SyllabusDocument | { document: SyllabusDocument; version: SyllabusVersion }
    >(`${base}/documents`, form)
    .then((r) => r.data);

export const updateSyllabusDocument = (id: string, form: FormData) =>
  api.patch<SyllabusDocument>(`${base}/documents/${id}`, form).then((r) => r.data);

export const archiveSyllabusDocument = (id: string) =>
  api.delete<SyllabusDocument>(`${base}/documents/${id}`).then((r) => r.data);

export const submitSyllabusDocument = (id: string) =>
  api.post<SyllabusDocument>(`${base}/documents/${id}/submit`).then((r) => r.data);

export const publishSyllabusDocument = (id: string) =>
  api.post<SyllabusDocument>(`${base}/documents/${id}/publish`).then((r) => r.data);

export const fetchPendingSyllabusApprovals = (roleSlug?: string) =>
  api
    .get<SyllabusApproval[]>(`${base}/approvals/pending`, { params: { roleSlug } })
    .then((r) => r.data);

export const actOnSyllabusApproval = (
  id: string,
  payload: { action: 'APPROVE' | 'REJECT'; comments?: string },
) => api.post(`${base}/approvals/${id}/action`, payload).then((r) => r.data);

export const fetchSyllabusVersions = (documentId: string) =>
  api.get<SyllabusVersion[]>(`${base}/documents/${documentId}/versions`).then((r) => r.data);

export const addSyllabusVersion = (documentId: string, form: FormData) =>
  api
    .post<{
      document: SyllabusDocument;
      version: SyllabusVersion;
    }>(`${base}/documents/${documentId}/versions`, form)
    .then((r) => r.data);

export const downloadSyllabusDocument = (id: string) =>
  api.get<Blob>(`${base}/documents/${id}/download`, { responseType: 'blob' }).then((r) => r.data);

export const previewSyllabusDocument = (id: string) =>
  api.get<Blob>(`${base}/documents/${id}/preview`, { responseType: 'blob' }).then((r) => r.data);

export const fetchMySyllabusDocuments = (params?: Record<string, string | number | undefined>) =>
  api.get<SyllabusListResponse>(`${base}/me/documents`, { params }).then((r) => r.data);

export const fetchMySyllabusBookmarks = () =>
  api.get<SyllabusDocument[]>(`${base}/me/bookmarks`).then((r) => r.data);

export const toggleSyllabusBookmark = (documentId: string) =>
  api.post(`${base}/documents/${documentId}/bookmark`).then((r) => r.data);

export const askSyllabusDocument = (id: string, question: string) =>
  api.post<AskSyllabusResponse>(`${base}/documents/${id}/ask`, { question }).then((r) => r.data);

export const downloadSyllabusBulkTemplate = () =>
  api.get<Blob>(`${base}/bulk/template`, { responseType: 'blob' }).then((r) => r.data);

export const previewSyllabusBulk = (form: FormData) =>
  api.post<SyllabusBulkPreviewResponse>(`${base}/bulk/preview`, form).then((r) => r.data);

export const commitSyllabusBulk = (rows: Record<string, unknown>[], zip?: File) => {
  const form = new FormData();
  form.append('rows', JSON.stringify(rows));
  if (zip) form.append('zip', zip);
  return api
    .post<{
      imported: number;
      versioned?: number;
      documentIds: string[];
    }>(`${base}/bulk/commit`, form)
    .then((r) => r.data);
};
