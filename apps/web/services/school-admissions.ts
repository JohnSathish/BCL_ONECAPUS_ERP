import type { AuthSession } from '@/types/auth';
import { getLoginRequestHeaders } from '@/lib/login-host';
import { publicClient } from '@/lib/http/public-client';
import { normalizeSchoolDocumentBlob } from '@/lib/school-document-blob';
import { api } from './api';

export type SchoolPortalInfo = {
  isOpen: boolean;
  status?: 'OPEN' | 'CLOSED';
  newAdmissionsEnabled?: boolean;
  closedReason?: 'disabled' | 'not_started' | 'ended' | 'cycle_unavailable' | null;
  lastDateLabel?: string | null;
  message?: string;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  applicationDeadline?: string | null;
  paymentDeadline?: string | null;
  cycle?: {
    id: string;
    title: string;
    code: string;
    registrationOpensAt?: string | null;
    registrationClosesAt?: string | null;
    applicationDeadline?: string | null;
  } | null;
  settings?: {
    classCode?: string;
    sessionLabel?: string;
    censusDate?: string;
    minAgeYears?: number;
    maxAgeYearsExclusive?: number;
    applicationFee?: number;
    newAdmissionsEnabled?: boolean;
    bank?: {
      accountName?: string;
      accountNumber?: string;
      ifsc?: string;
      bankName?: string;
      branch?: string;
      upiId?: string;
      instructions?: string;
    };
    helpDesk?: { phone?: string; email?: string };
    documentRequirements?: {
      rules: Array<{
        id: string;
        slotCode: string;
        label: string;
        helperText: string;
        communities?: string[];
        categories?: string[];
        required: boolean;
      }>;
    };
  } | null;
  branding?: {
    displayName: string;
    shortName: string;
    portalSubtitle: string;
    primaryColor: string;
    accentColor: string;
    logoUrl?: string | null;
  };
};

export type SchoolAdmissionWindow = {
  cycleId?: string;
  title?: string;
  code?: string;
  status: 'OPEN' | 'CLOSED';
  isOpen: boolean;
  newAdmissionsEnabled: boolean;
  message: string;
  lastDateLabel: string | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  closedReason: 'disabled' | 'not_started' | 'ended' | 'cycle_unavailable' | null;
  applicationDeadline?: string | null;
};

export type SchoolApplicantMe = {
  application: {
    id: string;
    applicationNumber: string;
    firstName: string;
    email: string;
    phone?: string | null;
    status: string;
    progressPercent: number;
    paymentStatus: string;
    paymentReference?: string | null;
    submittedAt?: string | null;
    formData: Record<string, unknown>;
    documents?: {
      id: string;
      slotCode: string;
      fileUrl: string;
      mimeType?: string | null;
      sizeBytes?: number | null;
      verificationStatus: string;
      remarks?: string | null;
      createdAt?: string;
      updatedAt?: string;
    }[];
  };
  settings: SchoolPortalInfo['settings'];
  age: {
    eligible: boolean;
    message: string;
    age?: { years: number; months: number; days: number } | null;
  };
  paymentProofStatus:
    | 'NOT_UPLOADED'
    | 'UPLOADED_PENDING'
    | 'UPLOADED'
    | 'VERIFIED'
    | 'REJECTED'
    | 'PENDING';
  readOnly: boolean;
  officeDecision: string | null;
  indexNumber: string | null;
  submission?: {
    pdfFileUrl?: string;
    pdfGeneratedAt?: string;
    pdfError?: string | null;
    email?: {
      status?: 'PENDING' | 'SENT' | 'FAILED';
      sentAt?: string | null;
      error?: string | null;
      providerRef?: string | null;
      lastAttemptAt?: string | null;
    };
  } | null;
};

export async function fetchSchoolPortalInfo(): Promise<SchoolPortalInfo> {
  const { data } = await publicClient.get<SchoolPortalInfo>('/v1/school-admissions/portal/info', {
    headers: getLoginRequestHeaders(),
  });
  return data;
}

export async function requestSchoolEmailOtp(payload: { email: string; childFullName?: string }) {
  const { data } = await publicClient.post('/v1/school-admissions/portal/otp', payload, {
    headers: getLoginRequestHeaders(),
  });
  return data as { ok: boolean; email: string; expiresInSeconds: number; message: string };
}

export async function registerSchoolApplicant(payload: {
  childFullName: string;
  dateOfBirth: string;
  gender: string;
  email: string;
  phone: string;
  acceptedPolicies: boolean;
  otp: string;
  password?: string;
}) {
  const { data } = await publicClient.post('/v1/school-admissions/portal/register', payload, {
    headers: getLoginRequestHeaders(),
  });
  return data as {
    applicationNumber: string;
    username: string;
    email: string;
    password?: string;
    generatedPassword?: string;
    ageWarning?: string;
    emailSent?: boolean;
  };
}

export async function loginSchoolApplicant(payload: {
  applicationNumber: string;
  password: string;
  rememberMe?: boolean;
}): Promise<AuthSession> {
  const { data } = await publicClient.post<AuthSession>(
    '/v1/school-admissions/portal/login',
    payload,
    {
      headers: getLoginRequestHeaders(),
    },
  );
  return data;
}

export async function fetchSchoolApplicantMe(): Promise<SchoolApplicantMe> {
  const { data } = await api.get<SchoolApplicantMe>('/v1/school-admissions/portal/me');
  return data;
}

export async function saveSchoolFormDraft(payload: {
  formData: Record<string, unknown>;
  currentStep?: number;
}) {
  const { data } = await api.patch('/v1/school-admissions/portal/form/save-draft', payload);
  return data;
}

export async function saveSchoolPaymentTransactionReference(paymentTransactionReference: string) {
  const { data } = await api.patch('/v1/school-admissions/portal/payment/transaction-reference', {
    paymentTransactionReference,
  });
  return data as { id: string; paymentReference: string | null };
}

export async function submitSchoolApplication() {
  const { data } = await api.post('/v1/school-admissions/portal/form/submit');
  return data as {
    id: string;
    applicationNumber: string;
    status: string;
    submittedAt?: string | null;
    submission?: SchoolApplicantMe['submission'];
  };
}

export async function downloadSchoolApplicationPdf() {
  const res = await api.get('/v1/school-admissions/portal/application-pdf', {
    responseType: 'blob',
  });
  return res.data as Blob;
}

export async function downloadSchoolOfficeDocument(id: string, slotCode: string) {
  const res = await api.get(
    `/v1/school-admissions/office/applications/${id}/documents/${encodeURIComponent(slotCode)}/file`,
    { responseType: 'blob' },
  );
  return normalizeSchoolDocumentBlob(
    res.data as Blob,
    typeof res.headers['content-type'] === 'string' ? res.headers['content-type'] : null,
  );
}

export async function downloadSchoolOfficeApplicationPdf(id: string) {
  const res = await api.get(`/v1/school-admissions/office/applications/${id}/pdf`, {
    responseType: 'blob',
  });
  return res.data as Blob;
}

export async function resendSchoolApplicationPdfEmail(id: string) {
  const { data } = await api.post(
    `/v1/school-admissions/office/applications/${id}/resend-pdf-email`,
  );
  return data as {
    ok: boolean;
    email?: SchoolApplicantMe['submission'] extends infer S
      ? S extends { email?: infer E }
        ? E
        : never
      : never;
    error?: string | null;
  };
}

export async function uploadSchoolDocument(slotCode: string, file: File) {
  const form = new FormData();
  form.append('slotCode', slotCode);
  form.append('file', file);
  const { data } = await api.post('/v1/school-admissions/portal/documents/upload', form);
  return data;
}

export async function removeSchoolDocument(slotCode: string) {
  const { data } = await api.delete(
    `/v1/school-admissions/portal/documents/${encodeURIComponent(slotCode)}`,
  );
  return data as { ok: boolean; slotCode: string };
}

/** Authenticated document preview/download (avoids public /uploads IDOR). */
export async function downloadSchoolOwnDocument(slotCode: string) {
  const res = await api.get(
    `/v1/school-admissions/portal/documents/${encodeURIComponent(slotCode)}/file`,
    { responseType: 'blob' },
  );
  return normalizeSchoolDocumentBlob(
    res.data as Blob,
    typeof res.headers['content-type'] === 'string' ? res.headers['content-type'] : null,
  );
}

export async function requestSchoolPasswordReset(emailOrApplicationNumber: string) {
  const { data } = await publicClient.post(
    '/v1/school-admissions/portal/password-reset/request',
    { emailOrApplicationNumber },
    { headers: getLoginRequestHeaders() },
  );
  return data as { ok: boolean; message: string; emailHint?: string; expiresInSeconds?: number };
}

export async function confirmSchoolPasswordReset(input: {
  emailOrApplicationNumber: string;
  otp: string;
  newPassword: string;
}) {
  const { data } = await publicClient.post(
    '/v1/school-admissions/portal/password-reset/confirm',
    input,
    { headers: getLoginRequestHeaders() },
  );
  return data as { ok: boolean; message: string; applicationNumber?: string };
}

export async function fetchSchoolOfficeSummary() {
  const { data } = await api.get('/v1/school-admissions/office/summary');
  return data as {
    total: number;
    draft: number;
    submitted: number;
    underReview: number;
    granted: number;
    notGranted: number;
    paid: number;
    pendingPayment: number;
    pendingPaymentVerification?: number;
    verifiedPayments?: number;
    rejectedPayments?: number;
    pendingDocumentVerification?: number;
    readyForDecision?: number;
    applicationFee?: number;
    amountReceived?: number;
    amountPendingVerification?: number;
    byCategory?: Record<string, number>;
    uncategorised?: number;
    admissionWindow?: SchoolAdmissionWindow;
  };
}

export async function fetchSchoolOfficeApplications(params?: {
  search?: string;
  status?: string;
  category?: string;
  paymentStatus?: string;
  documentVerification?: 'pending' | 'verified' | 'rejected' | 'incomplete';
  decisionQueue?: 'ready' | 'granted' | 'not_granted';
  page?: number;
  limit?: number;
}) {
  const { data } = await api.get('/v1/school-admissions/office/applications', { params });
  return data as {
    data: Array<{
      id: string;
      applicationNumber: string;
      firstName: string;
      email: string;
      phone?: string | null;
      status: string;
      paymentStatus: string;
      paymentReference?: string | null;
      submittedAt?: string | null;
      createdAt: string;
      category?: string | null;
      categoryLabel?: string | null;
      community?: string | null;
      fatherName?: string | null;
      childName?: string | null;
      receiptVerificationStatus?: string | null;
      officeDecision?: string | null;
      indexNumber?: string | null;
      applicationFee?: number;
      readyForDecision?: boolean;
      pdfAvailable?: boolean;
      documentRollup?: {
        filterKey: string;
        pendingCount: number;
        allRequiredVerified: boolean;
        hasRejected: boolean;
      };
      certificateChecklist?: Array<{
        slotCode: string;
        label: string;
        helperText: string;
        required: boolean;
        uploaded: boolean;
        verificationStatus: string;
        fileUrl?: string | null;
        createdAt?: string | null;
        sizeBytes?: number | null;
        remarks?: string | null;
      }>;
      documents?: Array<{
        id?: string;
        slotCode: string;
        verificationStatus: string;
        fileUrl?: string | null;
        createdAt?: string;
        sizeBytes?: number | null;
        remarks?: string | null;
        mimeType?: string | null;
      }>;
      formData?: Record<string, unknown>;
    }>;
    meta: { page: number; limit: number; total: number; totalPages: number };
  };
}

export async function exportSchoolOfficeApplications(params?: {
  search?: string;
  status?: string;
  category?: string;
}) {
  const res = await api.get('/v1/school-admissions/office/applications/export', {
    params,
    responseType: 'blob',
  });
  return res.data as Blob;
}

export async function fetchSchoolOfficeApplication(id: string) {
  const { data } = await api.get(`/v1/school-admissions/office/applications/${id}`);
  return data as {
    application: SchoolApplicantMe['application'] & {
      formData: Record<string, unknown>;
      documents?: Array<{
        id: string;
        slotCode: string;
        fileUrl: string;
        mimeType?: string | null;
        sizeBytes?: number | null;
        verificationStatus: string;
        remarks?: string | null;
        createdAt?: string;
        updatedAt?: string;
      }>;
      paymentReference?: string | null;
    };
    age?: SchoolApplicantMe['age'];
    settings?: SchoolPortalInfo['settings'] & { applicationFee?: number };
    category?: string | null;
    categoryLabel?: string | null;
    community?: string | null;
    certificateChecklist?: Array<{
      slotCode: string;
      label: string;
      helperText: string;
      required: boolean;
      uploaded: boolean;
      verificationStatus: string;
      fileUrl?: string | null;
      createdAt?: string | null;
      sizeBytes?: number | null;
      remarks?: string | null;
    }>;
    submission?: SchoolApplicantMe['submission'];
  };
}

export async function fetchSchoolOfficeSettings() {
  const { data } = await api.get('/v1/school-admissions/office/settings');
  return data as {
    cycleId: string;
    title: string;
    code: string;
    settings: SchoolPortalInfo['settings'];
    documentRequirements: NonNullable<
      NonNullable<SchoolPortalInfo['settings']>['documentRequirements']
    >;
    admissionWindow?: SchoolAdmissionWindow;
  };
}

export async function fetchSchoolAdmissionWindow() {
  const { data } = await api.get('/v1/school-admissions/office/settings/admission-window');
  return data as SchoolAdmissionWindow & { cycleId: string; title: string; code: string };
}

export async function updateSchoolAdmissionWindow(payload: {
  newAdmissionsEnabled: boolean;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
}) {
  const { data } = await api.patch(
    '/v1/school-admissions/office/settings/admission-window',
    payload,
  );
  return data as SchoolAdmissionWindow & { cycleId: string; title: string; code: string };
}

export async function updateSchoolDocumentRequirements(
  documentRequirements: NonNullable<
    NonNullable<SchoolPortalInfo['settings']>['documentRequirements']
  >,
) {
  const { data } = await api.patch('/v1/school-admissions/office/settings/document-requirements', {
    documentRequirements,
  });
  return data;
}

export async function verifySchoolPayment(
  id: string,
  payload?: { remarks?: string; paymentReference?: string },
) {
  const { data } = await api.post(
    `/v1/school-admissions/office/applications/${id}/verify-payment`,
    payload ?? {},
  );
  return data;
}

export async function rejectSchoolPayment(id: string, remarks: string) {
  const { data } = await api.post(
    `/v1/school-admissions/office/applications/${id}/reject-payment`,
    { remarks },
  );
  return data;
}

export async function verifySchoolDocument(
  id: string,
  slotCode: string,
  payload?: { remarks?: string },
) {
  const { data } = await api.post(
    `/v1/school-admissions/office/applications/${id}/documents/${slotCode}/verify`,
    payload ?? {},
  );
  return data;
}

export async function rejectSchoolDocument(id: string, slotCode: string, remarks: string) {
  const { data } = await api.post(
    `/v1/school-admissions/office/applications/${id}/documents/${slotCode}/reject`,
    { remarks },
  );
  return data;
}

export async function decideSchoolAdmission(
  id: string,
  payload: { decision: 'GRANTED' | 'NOT_GRANTED'; indexNumber?: string; remarks?: string },
) {
  const { data } = await api.post(
    `/v1/school-admissions/office/applications/${id}/decision`,
    payload,
  );
  return data;
}
