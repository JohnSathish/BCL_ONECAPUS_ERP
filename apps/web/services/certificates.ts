import { api } from '@/services/api';
import type {
  CertificateCategory,
  CertificateDashboard,
  CertificateIssue,
  CertificateRequest,
  CertificateTemplate,
  CertificateVerificationResult,
} from '@/types/certificates';

const base = '/v1/certificates';

export const fetchCertificateDashboard = () =>
  api.get<CertificateDashboard>(`${base}/dashboard`).then((res) => res.data);
export const seedCertificateDefaults = () =>
  api.post<CertificateCategory[]>(`${base}/seed-defaults`).then((res) => res.data);
export const seedDbcOfficialCertificateTemplates = () =>
  api.post<CertificateTemplate[]>(`${base}/seed-dbc-official`).then((res) => res.data);
export const fetchCertificateCategories = () =>
  api.get<CertificateCategory[]>(`${base}/categories`).then((res) => res.data);
export const createCertificateCategory = (payload: Partial<CertificateCategory>) =>
  api.post<CertificateCategory>(`${base}/categories`, payload).then((res) => res.data);

export const fetchCertificateTemplates = (params?: Record<string, string | undefined>) =>
  api.get<CertificateTemplate[]>(`${base}/templates`, { params }).then((res) => res.data);
export const createCertificateTemplate = (payload: Record<string, unknown>) =>
  api.post<CertificateTemplate>(`${base}/templates`, payload).then((res) => res.data);
export const publishCertificateTemplate = (id: string) =>
  api.post<CertificateTemplate>(`${base}/templates/${id}/publish`).then((res) => res.data);
export const cloneCertificateTemplate = (id: string) =>
  api.post<CertificateTemplate>(`${base}/templates/${id}/clone`).then((res) => res.data);

export const fetchCertificateRequests = (params?: Record<string, string | undefined>) =>
  api.get<CertificateRequest[]>(`${base}/requests`, { params }).then((res) => res.data);
export const createCertificateRequest = (payload: Record<string, unknown>) =>
  api.post<CertificateRequest>(`${base}/requests`, payload).then((res) => res.data);
export const actOnCertificateApproval = (
  id: string,
  payload: { action: 'APPROVE' | 'REJECT'; comments?: string },
) => api.post(`${base}/approvals/${id}/action`, payload).then((res) => res.data);

export const fetchCertificateIssues = (params?: Record<string, string | undefined>) =>
  api.get<CertificateIssue[]>(`${base}/issues`, { params }).then((res) => res.data);
export const fetchCertificateIssue = (id: string) =>
  api.get<CertificateIssue>(`${base}/issues/${id}`).then((res) => res.data);
export const issueCertificate = (payload: Record<string, unknown>) =>
  api.post<CertificateIssue>(`${base}/issues`, payload).then((res) => res.data);
export const bulkIssueCertificates = (payload: Record<string, unknown>) =>
  api
    .post<{ issuedCount: number; issued: CertificateIssue[] }>(`${base}/issues/bulk`, payload)
    .then((res) => res.data);
export const revokeCertificate = (id: string, reason?: string) =>
  api.post<CertificateIssue>(`${base}/issues/${id}/revoke`, { reason }).then((res) => res.data);

export const verifyCertificate = (token: string) =>
  api.get<CertificateVerificationResult>(`${base}/verify/${token}`).then((res) => res.data);

export const fetchCertificateAuditLogs = () =>
  api.get(`${base}/audit-logs`).then((res) => res.data);
export const fetchCertificateSequences = () =>
  api.get(`${base}/settings/sequences`).then((res) => res.data);
export const fetchCertificateSignatures = () =>
  api.get(`${base}/settings/signatures`).then((res) => res.data);
export const upsertCertificateSignature = (payload: Record<string, unknown>) =>
  api.post(`${base}/settings/signatures`, payload).then((res) => res.data);
export const uploadCertificateSignatureAsset = (form: FormData) =>
  api.post<{ path: string }>(`${base}/settings/signatures/upload`, form).then((res) => res.data);
export const previewCertificate = (payload: Record<string, unknown>) =>
  api
    .post<{
      renderedHtml: string;
      variableSnapshot: Record<string, unknown>;
    }>(`${base}/preview`, payload)
    .then((res) => res.data);
export const downloadCertificateIssue = (id: string) =>
  api
    .get(`${base}/issues/${id}/download`, { responseType: 'blob' })
    .then((res) => res.data as Blob);
export const fetchCertificateRegister = (params?: Record<string, string | undefined>) =>
  api
    .get<{
      summary: { total: number; issued: number; revoked: number };
      byCategory: { label: string; value: number }[];
      byMonth: { month: string; issued: number }[];
      rows: Array<{
        id: string;
        certificateNo: string;
        categoryName: string;
        studentName: string;
        enrollmentNumber: string;
        programme: string;
        status: string;
        issuedAt: string;
      }>;
    }>(`${base}/reports/register`, { params })
    .then((res) => res.data);

export const fetchMyCertificateProfile = () =>
  api
    .get<{ studentId: string; enrollmentNumber: string; fullName: string }>(`${base}/me/profile`)
    .then((res) => res.data);
export const fetchMyCertificateRequests = () =>
  api.get<CertificateRequest[]>(`${base}/me/requests`).then((res) => res.data);
export const createMyCertificateRequest = (payload: Record<string, unknown>) =>
  api.post<CertificateRequest>(`${base}/me/requests`, payload).then((res) => res.data);
export const fetchMyCertificateIssues = () =>
  api.get<CertificateIssue[]>(`${base}/me/issues`).then((res) => res.data);
export const previewMyCertificate = (payload: Record<string, unknown>) =>
  api
    .post<{
      renderedHtml: string;
      variableSnapshot: Record<string, unknown>;
    }>(`${base}/me/preview`, payload)
    .then((res) => res.data);
export const downloadMyCertificateIssue = (id: string) =>
  api
    .get(`${base}/me/issues/${id}/download`, { responseType: 'blob' })
    .then((res) => res.data as Blob);
export const upsertCertificateSequence = (payload: Record<string, unknown>) =>
  api.post(`${base}/settings/sequences`, payload).then((res) => res.data);
