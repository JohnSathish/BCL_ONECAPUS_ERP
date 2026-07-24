import { publicClient } from '@/lib/http/public-client';
import { getLoginRequestHeaders } from '@/lib/login-host';
import { api } from '@/services/api';

export type CenterRegisterPayload = {
  businessName: string;
  ownerName: string;
  gstNumber?: string;
  panNumber?: string;
  aadhaarNumber?: string;
  mobileNumber: string;
  email: string;
  addressLine: string;
  district: string;
  state: string;
  pincode: string;
  username: string;
  password: string;
};

export type CenterStudentDues = {
  studentId: string;
  fullName: string;
  rollNumber: string | null;
  enrollmentNumber: string | null;
  admissionNumber: string | null;
  programme: string | null;
  programmeCode: string | null;
  department: string | null;
  semester: number | null;
  academicYear: string | null;
  feePaid: number;
  pendingFee: number;
  lateFine: number;
  scholarshipAdjustment: number;
  totalPayable: number;
  payableItems: Array<{ demandId: string; label: string; amount: number }>;
};

export type CenterDashboard = {
  center: { id: string; businessName: string; operatorName: string };
  today: {
    collections: number;
    transactions: number;
    successful: number;
    failed: number;
    pending: number;
  };
  recent: CenterTransaction[];
};

export type CenterTransaction = {
  id: string;
  transactionNo: string;
  studentId: string;
  amount: number;
  status: string;
  paymentMode: string;
  provider: string | null;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  paidAt: string | null;
  createdAt: string;
  collectionCenterId: string | null;
  collectionCenterName: string | null;
  operatorName: string | null;
  receipts: Array<{ id: string; receiptNo: string; pdfPath?: string | null }>;
};

export type FeeCollectionCenterRow = {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  mobileNumber: string;
  district: string;
  state: string;
  status: string;
  emailVerifiedAt: string | null;
  mobileVerifiedAt: string | null;
  rejectedReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  operators: Array<{
    id: string;
    userId: string;
    displayName: string;
    isPrimary: boolean;
  }>;
};

export async function registerFeeCollectionCenter(payload: CenterRegisterPayload) {
  const { data } = await publicClient.post('/v1/fee-collection-centers/register', payload, {
    headers: getLoginRequestHeaders(),
  });
  return data as {
    centerId: string;
    status: string;
    message: string;
    emailVerifyToken?: string;
    otp?: string;
  };
}

export async function verifyCenterEmail(centerId: string, token: string) {
  const { data } = await publicClient.post(
    '/v1/fee-collection-centers/verify-email',
    {
      centerId,
      token,
    },
    { headers: getLoginRequestHeaders() },
  );
  return data as { verified: boolean };
}

export async function verifyCenterOtp(centerId: string, otp: string) {
  const { data } = await publicClient.post(
    '/v1/fee-collection-centers/verify-otp',
    {
      centerId,
      otp,
    },
    { headers: getLoginRequestHeaders() },
  );
  return data as { verified: boolean };
}

export async function fetchCenterDashboard() {
  const { data } = await api.get<CenterDashboard>('/v1/fee-collection-centers/me/dashboard');
  return data;
}

export async function searchCenterStudent(q: string) {
  const { data } = await api.get<CenterStudentDues>(
    '/v1/fee-collection-centers/me/students/search',
    {
      params: { q },
    },
  );
  return data;
}

export async function initiateCenterPayment(payload: {
  studentId: string;
  amount: number;
  demandIds?: string[];
}) {
  const { data } = await api.post('/v1/fee-collection-centers/me/payments/initiate', payload);
  return data as { payment: { id: string }; checkout: Record<string, unknown> };
}

export async function verifyCenterRazorpay(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  const { data } = await api.post(
    '/v1/fee-collection-centers/me/payments/verify-razorpay',
    payload,
  );
  return data;
}

export async function simulateCenterPayment(paymentId: string) {
  const { data } = await api.post(
    `/v1/fee-collection-centers/me/payments/${paymentId}/simulate-mock`,
  );
  return data as { receipt?: { receiptNo?: string } };
}

export async function fetchCenterTransactions(params?: {
  from?: string;
  to?: string;
  status?: string;
}) {
  const { data } = await api.get<CenterTransaction[]>(
    '/v1/fee-collection-centers/me/transactions',
    { params },
  );
  return data;
}

export async function listFeeCollectionCenters(params?: { status?: string; search?: string }) {
  const { data } = await api.get<FeeCollectionCenterRow[]>('/v1/fee-collection-centers', {
    params,
  });
  return data;
}

export async function reviewFeeCollectionCenter(
  id: string,
  action: 'APPROVE' | 'REJECT',
  reason?: string,
) {
  const { data } = await api.post(`/v1/fee-collection-centers/${id}/review`, { action, reason });
  return data;
}

export async function suspendFeeCollectionCenter(id: string, reason?: string) {
  const { data } = await api.post(`/v1/fee-collection-centers/${id}/suspend`, { reason });
  return data;
}

export async function blockFeeCollectionCenter(id: string, reason?: string) {
  const { data } = await api.post(`/v1/fee-collection-centers/${id}/block`, { reason });
  return data;
}

export async function reactivateFeeCollectionCenter(id: string) {
  const { data } = await api.post(`/v1/fee-collection-centers/${id}/reactivate`);
  return data;
}

export async function resetFeeCollectionCenterPassword(id: string, newPassword: string) {
  const { data } = await api.post(`/v1/fee-collection-centers/${id}/reset-password`, {
    newPassword,
  });
  return data;
}

export async function fetchAdminCenterTransactions(params?: {
  centerId?: string;
  status?: string;
  from?: string;
  to?: string;
}) {
  const { data } = await api.get<CenterTransaction[]>(
    '/v1/fee-collection-centers/admin/transactions',
    { params },
  );
  return data;
}

export async function fetchCenterReports(
  type: 'daily' | 'monthly' | 'center',
  params?: { from?: string; to?: string },
) {
  const { data } = await api.get(`/v1/fee-collection-centers/admin/reports/${type}`, { params });
  return data as { type: string; rows: Array<Record<string, unknown>> };
}

export async function reconcileCenterPayment(paymentId: string) {
  const { data } = await api.post(`/v1/fee-collection-centers/me/payments/${paymentId}/reconcile`);
  return data;
}

export async function openCenterReceiptPdf(receiptId: string) {
  const res = await api.get(`/v1/fee-collection-centers/me/receipts/${receiptId}/pdf`, {
    responseType: 'blob',
  });
  const blob = res.data as Blob;
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
