import { api } from '@/services/api';
import type {
  BulkPreviewResponse,
  QuestionBankDashboard,
  QuestionBankSettings,
  QuestionPaper,
  QuestionPaperApproval,
  QuestionPaperListResponse,
} from '@/types/question-bank';

const base = '/v1/question-bank';

export const fetchQuestionBankDashboard = () =>
  api.get<QuestionBankDashboard>(`${base}/dashboard`).then((r) => r.data);

export const fetchQuestionPapers = (params?: Record<string, string | number | undefined>) =>
  api.get<QuestionPaperListResponse>(`${base}/papers`, { params }).then((r) => r.data);

export const fetchQuestionPaper = (id: string) =>
  api.get<QuestionPaper>(`${base}/papers/${id}`).then((r) => r.data);

export const createQuestionPaper = (form: FormData) =>
  api.post<QuestionPaper>(`${base}/papers`, form).then((r) => r.data);

export const updateQuestionPaper = (id: string, form: FormData) =>
  api.patch<QuestionPaper>(`${base}/papers/${id}`, form).then((r) => r.data);

export const submitQuestionPaper = (id: string) =>
  api.post<QuestionPaper>(`${base}/papers/${id}/submit`).then((r) => r.data);

export const publishQuestionPaper = (id: string) =>
  api.post<QuestionPaper>(`${base}/papers/${id}/publish`).then((r) => r.data);

export const archiveQuestionPaper = (id: string) =>
  api.delete<QuestionPaper>(`${base}/papers/${id}`).then((r) => r.data);

export const actOnQuestionPaperApproval = (
  id: string,
  payload: { action: 'APPROVE' | 'REJECT'; comments?: string },
) => api.post(`${base}/approvals/${id}/action`, payload).then((r) => r.data);

export const fetchPendingQuestionApprovals = (roleSlug?: string) =>
  api
    .get<QuestionPaperApproval[]>(`${base}/approvals/pending`, { params: { roleSlug } })
    .then((r) => r.data);

export const downloadQuestionPaper = (id: string) =>
  api.get<Blob>(`${base}/papers/${id}/download`, { responseType: 'blob' }).then((r) => r.data);

export const previewQuestionPaperUrl = (id: string) =>
  `${process.env.NEXT_PUBLIC_API_URL ?? ''}${base}/papers/${id}/preview`;

export const fetchMyQuestionPapers = (params?: Record<string, string | number | undefined>) =>
  api.get<QuestionPaperListResponse>(`${base}/me/papers`, { params }).then((r) => r.data);

export const fetchMyQuestionBookmarks = () =>
  api.get<QuestionPaper[]>(`${base}/me/bookmarks`).then((r) => r.data);

export const addQuestionBookmark = (paperId: string) =>
  api.post(`${base}/me/bookmarks/${paperId}`).then((r) => r.data);

export const removeQuestionBookmark = (paperId: string) =>
  api.delete(`${base}/me/bookmarks/${paperId}`).then((r) => r.data);

export const previewQuestionBankBulk = (form: FormData) =>
  api.post<BulkPreviewResponse>(`${base}/bulk/preview`, form).then((r) => r.data);

export const commitQuestionBankBulk = (rows: Record<string, unknown>[], zip?: File) => {
  const form = new FormData();
  form.append('rows', JSON.stringify(rows));
  if (zip) form.append('zip', zip);
  return api
    .post<{ imported: number; paperIds: string[] }>(`${base}/bulk/commit`, form)
    .then((r) => r.data);
};

export const downloadQuestionBankTemplate = () =>
  api.get<Blob>(`${base}/bulk/template`, { responseType: 'blob' }).then((r) => r.data);

export const fetchQuestionBankReports = () =>
  api
    .get<{ views: number; downloads: number; publishedPapers: number }>(`${base}/reports/summary`)
    .then((r) => r.data);

export const fetchQuestionBankSettings = () =>
  api.get<QuestionBankSettings>(`${base}/settings`).then((r) => r.data);

export const updateQuestionBankSettings = (payload: Partial<QuestionBankSettings>) =>
  api.patch<QuestionBankSettings>(`${base}/settings`, payload).then((r) => r.data);

export const fetchQuestionBankAuditLogs = () => api.get(`${base}/audit-logs`).then((r) => r.data);
