import { api } from '@/services/api';
import type {
  AcademicFeeCycle,
  ExternalFeePayment,
  FeeFinanceSettings,
  FeeHeadListResponse,
  FeeHeadMaster,
  FeePaymentRequest,
  FeeReceiptListItem,
  MonthlyFeePlan,
  PaymentRequestCheckout,
  ScholarshipScheme,
  StudentFeeAccount,
} from '@/types/fee-cycle';

export async function fetchFeeHeads(activeOnly = false) {
  const { data } = await api.get<FeeHeadListResponse>('/v1/fees/masters/heads', {
    params: activeOnly ? { activeOnly: true } : undefined,
  });
  return data;
}

export async function createFeeHead(payload: {
  code: string;
  name: string;
  amount: number;
  category?: string;
  sortOrder?: number;
}) {
  const { data } = await api.post<FeeHeadMaster>('/v1/fees/masters/heads', payload);
  return data;
}

export async function updateFeeHead(
  id: string,
  payload: Partial<{
    name: string;
    amount: number;
    category: string;
    sortOrder: number;
    isActive: boolean;
  }>,
) {
  const { data } = await api.patch<FeeHeadMaster>(`/v1/fees/masters/heads/${id}`, payload);
  return data;
}

export async function deleteFeeHead(id: string) {
  const { data } = await api.delete(`/v1/fees/masters/heads/${id}`);
  return data;
}

export async function reorderFeeHeads(orderedIds: string[]) {
  const { data } = await api.post<FeeHeadListResponse>('/v1/fees/masters/heads/reorder', {
    orderedIds,
  });
  return data;
}

export async function fetchFeeCycles(params?: { status?: string; startSemester?: number }) {
  const { data } = await api.get<AcademicFeeCycle[]>('/v1/fees/cycles', { params });
  return data;
}

export async function fetchFeeCycle(id: string) {
  const { data } = await api.get<AcademicFeeCycle>(`/v1/fees/cycles/${id}`);
  return data;
}

export async function createFeeCycle(payload: Record<string, unknown>) {
  const { data } = await api.post<AcademicFeeCycle>('/v1/fees/cycles', payload);
  return data;
}

export async function updateFeeCycle(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch<AcademicFeeCycle>(`/v1/fees/cycles/${id}`, payload);
  return data;
}

export async function activateFeeCycle(id: string) {
  const { data } = await api.post<AcademicFeeCycle>(`/v1/fees/cycles/${id}/activate`, {});
  return data;
}

export async function deactivateFeeCycle(id: string) {
  const { data } = await api.post<AcademicFeeCycle>(`/v1/fees/cycles/${id}/deactivate`, {});
  return data;
}

export async function deleteFeeCycle(id: string) {
  const { data } = await api.delete(`/v1/fees/cycles/${id}`);
  return data;
}

export async function bulkGenerateCycleDemands(payload: {
  semesterNumber: number;
  studentIds?: string[];
  publish?: boolean;
}) {
  const { data } = await api.post('/v1/fees/cycle-demands/bulk', payload);
  return data;
}

export async function fetchStudentFeeAccount(studentId: string) {
  const { data } = await api.get<StudentFeeAccount>(`/v1/fees/students/${studentId}/fee-account`);
  return data;
}

export async function fetchMyFeeAccount() {
  const { data } = await api.get<StudentFeeAccount>('/v1/fees/me/fee-account');
  return data;
}

export async function fetchFeeSettings() {
  const { data } = await api.get('/v1/fees/settings');
  return data as FeeFinanceSettings;
}

export async function fetchMyFeeSummary() {
  const { data } = await api.get('/v1/fees/me/summary');
  return data as {
    studentId: string;
    totalOutstanding: number;
    totalPaid: number;
    totalOverdue: number;
    feeStatus: 'CLEAR' | 'DUE' | 'OVERDUE';
    admissionOutstanding: number;
    monthlyOutstanding: number;
    lastPaymentAt?: string | null;
  };
}

export async function updateFeeSettings(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/fees/settings', payload);
  return data as FeeFinanceSettings;
}

export async function fetchMonthlyPlans() {
  const { data } = await api.get('/v1/fees/monthly-plans');
  return data as MonthlyFeePlan[];
}

export async function updateMonthlyPlan(id: string, payload: Record<string, unknown>) {
  const { data } = await api.patch(`/v1/fees/monthly-plans/${id}`, payload);
  return data as MonthlyFeePlan;
}

export async function generateMonthlyDemands(payload?: {
  period?: string;
  studentId?: string;
  monthsAhead?: number;
}) {
  const { data } = await api.post('/v1/fees/monthly-demands/generate', payload ?? {});
  return data;
}

export async function previewMonthlyDemand(studentId: string, period?: string) {
  const { data } = await api.post<{
    totalAmount?: number;
    billingPeriod?: string;
    reason?: string;
  }>('/v1/fees/monthly-demands/preview', { studentId, period });
  return data;
}

export async function generateMonthlyDemandsForPeriods(studentId: string, periods: string[]) {
  const sorted = [...periods].sort();
  const results = [];
  for (const period of sorted) {
    const result = await generateMonthlyDemands({ studentId, period });
    results.push({ period, result });
  }
  return results;
}

export async function fetchScholarships() {
  const { data } = await api.get('/v1/fees/scholarships');
  return data as ScholarshipScheme[];
}

export async function createScholarship(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/fees/scholarships', payload);
  return data;
}

export async function downloadReceiptPdf(receiptId: string) {
  const res = await api.get(`/v1/fees/receipts/${receiptId}/pdf`, { responseType: 'blob' });
  return res.data as Blob;
}

/** Open receipt PDF in a new browser tab (print-friendly). */
export async function openFeeReceiptPdf(receiptId: string) {
  const blob = await downloadReceiptPdf(receiptId);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Download receipt PDF to disk. */
export async function saveFeeReceiptPdf(receiptId: string, receiptNo?: string) {
  const { downloadBlob } = await import('@/utils/download-blob');
  const blob = await downloadReceiptPdf(receiptId);
  const filename = `${(receiptNo ?? receiptId).replace(/\//g, '_')}.pdf`;
  downloadBlob(blob, filename);
}

export async function fetchRecentFeeReceipts(params?: { date?: string; limit?: number }) {
  const { data } = await api.get<FeeReceiptListItem[]>('/v1/fees/receipts/recent', { params });
  return data;
}

export async function downloadBulkReceiptPdf(
  receiptIds: string[],
  layout: 'single' | 'two_per_page' = 'two_per_page',
) {
  const res = await api.post(
    '/v1/fees/receipts/bulk-pdf',
    { receiptIds, layout },
    { responseType: 'blob' },
  );
  return res.data as Blob;
}

export async function openBulkFeeReceiptPdf(
  receiptIds: string[],
  layout: 'single' | 'two_per_page' = 'two_per_page',
) {
  const blob = await downloadBulkReceiptPdf(receiptIds, layout);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function saveBulkFeeReceiptPdf(
  receiptIds: string[],
  layout: 'single' | 'two_per_page' = 'two_per_page',
) {
  const { downloadBlob } = await import('@/utils/download-blob');
  const blob = await downloadBulkReceiptPdf(receiptIds, layout);
  const suffix = layout === 'two_per_page' ? '2up' : 'single';
  downloadBlob(blob, `fee-receipts-bulk-${suffix}.pdf`);
}

export async function sendDueReminders() {
  const { data } = await api.post('/v1/fees/reminders/send', {});
  return data as { demandsNotified: number; studentsNotified: number; message: string };
}

export async function sendReceiptNotification(
  receiptId: string,
  channels: Array<'EMAIL' | 'SMS' | 'WHATSAPP'>,
) {
  const { data } = await api.post(`/v1/fees/receipts/${receiptId}/send`, { channels });
  return data as { receiptNo: string; channels: string[]; queued: boolean; message: string };
}

export async function cancelFeeReceipt(receiptId: string, reason: string) {
  const { data } = await api.post(`/v1/fees/receipts/${receiptId}/cancel`, { reason });
  return data as { receiptId: string; receiptNo: string; status: string; message: string };
}

export async function refundFeePayment(payload: {
  receiptId?: string;
  paymentId?: string;
  amount: number;
  reason: string;
  refundMode?: string;
}) {
  const { data } = await api.post('/v1/fees/refunds', payload);
  return data as {
    refundTransactionNo: string;
    refundPaymentId: string;
    amount: number;
    message: string;
  };
}

export async function createMonthlyPlan(payload: {
  code: string;
  name: string;
  majorSlug?: string;
  streamCode?: string;
  lines?: Array<{ code: string; name: string; amount: number }>;
}) {
  const { data } = await api.post('/v1/fees/monthly-plans', payload);
  return data as MonthlyFeePlan;
}

export async function fetchFeeAuditLogs() {
  const { data } = await api.get('/v1/fees/audit-logs');
  return data as Array<{
    id: string;
    action: string;
    reason?: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }>;
}

export async function downloadFeeReportExport(
  type: string,
  format: 'csv' | 'xlsx' | 'pdf' = 'csv',
  params?: Record<string, string | undefined>,
) {
  const res = await api.get(`/v1/fees/reports/${type}/export`, {
    params: { format, ...params },
    responseType: format === 'csv' ? 'json' : 'blob',
    headers:
      format === 'pdf'
        ? { Accept: 'application/pdf' }
        : format === 'xlsx'
          ? { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
          : undefined,
  });
  if (format === 'csv') return res.data as { format: string; content: string; filename: string };
  const blob = res.data as Blob;
  if (!(blob instanceof Blob) || blob.size < 500) {
    throw new Error('Export failed — the server returned an empty or invalid file.');
  }
  return blob;
}

export async function downloadDayClosingExport(
  date: string,
  format: 'csv' | 'xlsx' | 'pdf' = 'csv',
) {
  const res = await api.get('/v1/fees/reports/day-closing/export', {
    params: { date, format },
    responseType: format === 'csv' ? 'json' : 'blob',
    headers:
      format === 'pdf'
        ? { Accept: 'application/pdf' }
        : format === 'xlsx'
          ? { Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
          : undefined,
  });
  if (format === 'csv') return res.data as { format: string; content: string; filename: string };
  const blob = res.data as Blob;
  if (!(blob instanceof Blob) || blob.size < 500) {
    throw new Error('Export failed — the server returned an empty or invalid file.');
  }
  return blob;
}

export async function fetchDayClosingReport(date?: string) {
  const { data } = await api.get('/v1/fees/reports/day-closing', {
    params: date ? { date } : undefined,
  });
  return data as DayClosingReport;
}

export type DayClosingReport = {
  date: string;
  summary: {
    totalCollected: number;
    transactionCount: number;
    receiptCount: number;
    admissionCollected: number;
    monthlyCollected: number;
    outstandingEndOfDay: number;
  };
  byPaymentMode: Array<{ mode: string; count: number; amount: number }>;
  byCashier: Array<{
    cashierId: string | null;
    cashierName: string;
    count: number;
    amount: number;
  }>;
  transactions: Array<{
    id: string;
    transactionNo: string;
    studentId: string;
    studentName?: string;
    enrollmentNumber?: string;
    paymentMode: string;
    amount: number;
    paidAt: string;
    receiptNo?: string;
  }>;
};

export async function exportFeeReport(
  type: string,
  format: 'csv' | 'json' | 'xlsx' | 'pdf' = 'csv',
  params?: Record<string, string | undefined>,
) {
  if (format === 'xlsx' || format === 'pdf') {
    return downloadFeeReportExport(type, format, params);
  }
  const { data } = await api.get(`/v1/fees/reports/${type}/export`, {
    params: { format, ...params },
  });
  return data;
}

export async function requestFeeConcession(payload: {
  studentId: string;
  demandId?: string;
  concessionType: string;
  calculationType: string;
  value: number;
  reason?: string;
  schemeId?: string;
}) {
  const { data } = await api.post('/v1/fees/concessions', payload);
  return data;
}

export async function approveFeeConcession(id: string) {
  const { data } = await api.post(`/v1/fees/concessions/${id}/approve`, {});
  return data;
}

export async function initiateMyFeePayment(payload: {
  amount: number;
  provider: string;
  demandIds?: string[];
}) {
  const { data } = await api.post('/v1/fees/me/payments/initiate', payload);
  return data as {
    payment: { id: string; transactionNo: string; amount: number };
    checkout: {
      provider: string;
      orderId: string;
      amount: number;
      currency: string;
      keyId?: string;
      mode: 'LIVE' | 'SAFE_MOCK';
      paymentId?: string;
    };
  };
}

export async function verifyFeePayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  const { data } = await api.post('/v1/fees/payments/verify', payload);
  return data as {
    alreadyPaid: boolean;
    receipt?: { id: string; receiptNo: string };
    payment?: { id: string };
  };
}

export async function simulateFeePayment(paymentId: string) {
  const { data } = await api.post(`/v1/fees/payments/${paymentId}/simulate`, {});
  return data as {
    alreadyPaid: boolean;
    receipt?: { id: string; receiptNo: string };
  };
}

export async function createMyPaymentRequest(payload: {
  demandIds: string[];
  channel?: 'OFFICE_QR' | 'PAYMENT_LINK' | 'STUDENT_PORTAL';
}) {
  const { data } = await api.post('/v1/fees/me/payment-requests', payload);
  return data as {
    request: FeePaymentRequest;
    payment: { id: string };
    checkout: PaymentRequestCheckout;
  };
}

export async function submitMyExternalPayment(payload: {
  paymentSource: string;
  externalReference?: string;
  transactionDate: string;
  amount: number;
  demandIds?: string[];
  remarks?: string;
  attachmentUrls?: string[];
}) {
  const { data } = await api.post('/v1/fees/me/external-payments', payload);
  return data;
}

export async function fetchMyExternalPayments(status?: string) {
  const { data } = await api.get<ExternalFeePayment[]>('/v1/fees/me/external-payments', {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function createPaymentRequest(payload: {
  studentId: string;
  demandIds: string[];
  channel?: 'OFFICE_QR' | 'PAYMENT_LINK' | 'STUDENT_PORTAL';
}) {
  const { data } = await api.post('/v1/fees/payment-requests', payload);
  return data as {
    request: FeePaymentRequest;
    payment: { id: string };
    checkout: PaymentRequestCheckout;
  };
}

export async function fetchPaymentRequests(params?: { studentId?: string; status?: string }) {
  const { data } = await api.get<FeePaymentRequest[]>('/v1/fees/payment-requests', { params });
  return data;
}

export async function fetchPaymentRequest(id: string) {
  const { data } = await api.get<FeePaymentRequest>(`/v1/fees/payment-requests/${id}`);
  return data;
}

export async function cancelPaymentRequest(id: string, reason?: string) {
  const { data } = await api.post(`/v1/fees/payment-requests/${id}/cancel`, { reason });
  return data;
}

export async function fetchExternalPaymentSources() {
  const { data } = await api.get<Array<{ value: string; label: string }>>(
    '/v1/fees/external-payments/sources',
  );
  return data;
}

export async function fetchExternalPayments(params?: {
  status?: string;
  studentId?: string;
  paymentSource?: string;
  limit?: number;
}) {
  const { data } = await api.get<import('@/types/fee-cycle').ExternalFeePayment[]>(
    '/v1/fees/external-payments',
    { params },
  );
  return data;
}

export async function submitExternalPayment(payload: {
  studentId: string;
  paymentSource: string;
  externalReference?: string;
  transactionDate: string;
  amount: number;
  demandIds?: string[];
  remarks?: string;
  attachmentUrls?: string[];
  approveImmediately?: boolean;
}) {
  const { data } = await api.post('/v1/fees/external-payments', payload);
  return data;
}

export async function approveExternalPayment(id: string) {
  const { data } = await api.post(`/v1/fees/external-payments/${id}/approve`);
  return data;
}

export async function rejectExternalPayment(id: string, reason: string) {
  const { data } = await api.post(`/v1/fees/external-payments/${id}/reject`, { reason });
  return data;
}

export async function uploadExternalPaymentAttachment(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ key: string; url: string; fileName: string }>(
    '/v1/fees/me/external-payments/attachments',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
}

export async function fetchFeeReconciliationReport(params?: { from?: string; to?: string }) {
  const { data } = await api.get('/v1/fees/reports/reconciliation', { params });
  return data as {
    totals: Record<string, number>;
    grandTotal: number;
    pendingVerification: {
      count: number;
      amount: number;
      rows: import('@/types/fee-cycle').ExternalFeePayment[];
    };
    rows: Array<Record<string, unknown>>;
  };
}
