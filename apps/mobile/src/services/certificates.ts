import { apiFetch } from '@/api/client';

export type CertificateCategory = {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
};

export type CertificateRequest = {
  id: string;
  status: string;
  requestType?: string;
  purpose?: string | null;
  createdAt?: string;
  category?: { id: string; name: string; code?: string } | null;
};

export type CertificateIssue = {
  id: string;
  certificateNo: string;
  status: string;
  category?: { name: string } | null;
};

export function fetchMyCertificateProfile() {
  return apiFetch<{ studentId: string; enrollmentNumber: string; fullName: string }>(
    '/v1/certificates/me/profile',
  );
}

export function fetchCertificateCategories() {
  return apiFetch<CertificateCategory[]>('/v1/certificates/categories');
}

export function fetchMyCertificateRequests() {
  return apiFetch<CertificateRequest[]>('/v1/certificates/me/requests');
}

export function fetchMyCertificateIssues() {
  return apiFetch<CertificateIssue[]>('/v1/certificates/me/issues');
}

export function createMyCertificateRequest(payload: {
  categoryId: string;
  studentId: string;
  requestType: string;
  purpose?: string;
}) {
  return apiFetch<CertificateRequest>('/v1/certificates/me/requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
