import type { AuthSession } from '@/types/auth';
import { getLoginRequestHeaders } from '@/lib/login-host';
import { publicClient } from '@/lib/http/public-client';
import { api } from './api';

export type PortalInfo = {
  isOpen: boolean;
  cycle?: {
    id: string;
    title: string;
    code: string;
    registrationOpensAt?: string | null;
    registrationClosesAt?: string | null;
    applicationDeadline?: string | null;
    paymentDeadline?: string | null;
    settings?: Record<string, unknown>;
  } | null;
  message?: string;
  settings?: Record<string, unknown>;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  applicationDeadline?: string | null;
  paymentDeadline?: string | null;
  branding?: {
    displayName: string;
    shortName: string;
    portalSubtitle: string;
    primaryColor: string;
    accentColor: string;
    logoUrl?: string | null;
  };
};

export type ApplicantCatalogContext = {
  programId: string;
  programName: string;
  programCode: string;
  programVersionId: string | null;
  semesterSequence: number;
  shifts: { id: string; code: string; name: string }[];
};

export type ApplicantMe = {
  application: {
    id: string;
    applicationNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    status: string;
    progressPercent: number;
    currentStep: number;
    paymentStatus: string;
    documentVerificationStatus: string;
    meritScore?: number | string | null;
    formData: Record<string, unknown>;
    lastSavedAt?: string | null;
    cycle?: { title: string; status: string; settings?: Record<string, unknown> } | null;
    documents?: {
      id: string;
      slotCode: string;
      fileUrl: string;
      verificationStatus: string;
    }[];
  };
  meritRank: number | null;
  meritRound: number | null;
  readOnly: boolean;
  cycleArchived: boolean;
  catalogContext?: ApplicantCatalogContext | null;
};

export async function fetchPortalInfo(): Promise<PortalInfo> {
  const { data } = await publicClient.get<PortalInfo>('/v1/admissions/portal/info', {
    headers: getLoginRequestHeaders(),
  });
  return data;
}

export async function registerApplicant(payload: {
  fullName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  acceptedPolicies?: boolean;
  password?: string;
}) {
  const { data } = await publicClient.post('/v1/admissions/portal/register', payload, {
    headers: getLoginRequestHeaders(),
  });
  return data as {
    applicationNumber: string;
    email: string;
    generatedPassword?: string;
  };
}

export async function loginApplicant(payload: {
  applicationNumber: string;
  password: string;
  rememberMe?: boolean;
}): Promise<AuthSession> {
  const { data } = await publicClient.post<AuthSession>('/v1/admissions/portal/login', payload, {
    headers: getLoginRequestHeaders(),
  });
  return data;
}

export async function fetchApplicantMe(): Promise<ApplicantMe> {
  const { data } = await api.get<ApplicantMe>('/v1/admissions/portal/me');
  return data;
}

export type ApplicantStatusTimeline = {
  steps: { key: string; label: string; done: boolean; at?: string | null }[];
  application?: { status: string };
  meritRank: number | null;
  meritRound: number | null;
  meritScore: number | null;
  admissionFeeStatus?: string | null;
  admissionFeeAmount?: number | null;
  waitingList: boolean;
  allocation: {
    status: string;
    shiftName: string | null;
    allocatedAt: string | null;
  } | null;
};

export async function fetchApplicantStatus(): Promise<ApplicantStatusTimeline> {
  const { data } = await api.get<ApplicantStatusTimeline>('/v1/admissions/portal/status');
  return data;
}

export async function saveFormDraft(payload: {
  currentStep?: number;
  formData?: Record<string, unknown>;
  progressPercent?: number;
}) {
  const { data } = await api.patch('/v1/admissions/portal/form/save-draft', payload);
  return data;
}

export async function submitApplication() {
  const { data } = await api.post('/v1/admissions/portal/form/submit');
  return data;
}

export async function uploadApplicantDocument(slotCode: string, file: File) {
  const form = new FormData();
  form.append('slotCode', slotCode);
  form.append('file', file);
  const { data } = await api.post('/v1/admissions/portal/documents/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export type PaymentInfo = {
  configured: boolean;
  applicationFee: number;
  currency: string;
  paymentStatus: string;
  amountPaid: number | null;
  paymentReference: string | null;
  paymentDeadline: string | null;
  canPay: boolean;
};

export type PaymentOrderResponse =
  | { configured: false; message: string }
  | {
      configured: true;
      keyId: string;
      orderId: string;
      amount: number;
      currency: string;
      applicationFee: number;
      description: string;
      prefill: { name: string; email: string; contact: string };
    };

export async function fetchPaymentInfo(): Promise<PaymentInfo> {
  const { data } = await api.get<PaymentInfo>('/v1/admissions/portal/payment/info');
  return data;
}

export async function createAdmissionPaymentOrder(): Promise<PaymentOrderResponse> {
  const { data } = await api.post<PaymentOrderResponse>(
    '/v1/admissions/portal/payment/create-order',
  );
  return data;
}

export async function verifyAdmissionPayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  const { data } = await api.post('/v1/admissions/portal/payment/verify', payload);
  return data as {
    success: boolean;
    paymentStatus: string;
    paymentReference: string;
    amountPaid: number;
  };
}

export async function changeApplicantPassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const { data } = await api.post('/v1/auth/change-password', payload);
  return data as { success: boolean };
}

export async function requestApplicantPasswordReset(payload: {
  email?: string;
  applicationNumber?: string;
}) {
  const { data } = await publicClient.post<{ accepted: boolean; devResetLink?: string }>(
    '/v1/admissions/portal/password-reset/request',
    payload,
    { headers: getLoginRequestHeaders() },
  );
  return data;
}

export async function confirmApplicantPasswordReset(payload: {
  token: string;
  newPassword: string;
  confirmPassword: string;
}) {
  const { data } = await publicClient.post<{ success: boolean }>(
    '/v1/admissions/portal/password-reset/confirm',
    payload,
    { headers: getLoginRequestHeaders() },
  );
  return data;
}
