import { apiFetch } from '@/api/client';
import { getApiBase, mobileHeadersAsync } from '@/api/config';
import { getAccessToken } from '@/auth/session';
import { refreshAccessTokenString } from '@/auth/token-refresh';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type ExamApplication = {
  id: string;
  applicationNo: string;
  status: string;
  currentSemesterNo: number;
  departmentName?: string | null;
  currentSemesterFee: number | string;
  backPaperFee: number | string;
  processingFee: number | string;
  lateFee: number | string;
  totalFee: number | string;
  declarationAccepted?: boolean;
  currentSubjects?: Array<{
    id: string;
    subjectCode: string;
    subjectName: string;
    examPaperType: string;
    amount: number | string;
  }>;
  backPapers?: Array<{
    id: string;
    semesterNo: number;
    subjectCode: string;
    subjectName: string;
    examPaperType: string;
    amount: number | string;
  }>;
  receipts?: Array<{ id: string; receiptNo: string }>;
  session?: { id: string; name: string; semesterCycle: string };
};

export type ExamFeeSession = {
  id: string;
  name: string;
  status: string;
  semesterCycle: string;
  academicYearLabel?: string | null;
};

export function fetchExamFeeSessions() {
  return apiFetch<ExamFeeSession[]>('/v1/examination-fees/sessions');
}

export function fetchMyExamApplications() {
  return apiFetch<ExamApplication[]>('/v1/examination-fees/applications/mine');
}

export function startExamApplication(sessionId: string) {
  return apiFetch<ExamApplication>('/v1/examination-fees/applications/start', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export function addExamBackPaper(
  id: string,
  payload: {
    semesterNo: number;
    subjectCode: string;
    subjectName: string;
    examPaperType: string;
  },
) {
  return apiFetch<ExamApplication>(`/v1/examination-fees/applications/${id}/back-papers`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function removeExamBackPaper(id: string, backPaperId: string) {
  return apiFetch<ExamApplication>(
    `/v1/examination-fees/applications/${id}/back-papers/${backPaperId}`,
    { method: 'DELETE' },
  );
}

export function submitExamApplication(id: string, declarationAccepted: boolean) {
  return apiFetch<ExamApplication>(`/v1/examination-fees/applications/${id}/submit`, {
    method: 'POST',
    body: JSON.stringify({ declarationAccepted }),
  });
}

export function initiateExamOnlinePayment(id: string) {
  return apiFetch<{
    checkout: {
      mode: string;
      keyId?: string;
      orderId?: string;
      amount: number;
      currency: string;
      paymentId?: string;
      paymentTransactionId?: string;
      provider?: string;
      checkoutUrl?: string;
      paymentSessionId?: string;
    };
    payment: { id: string };
  }>(`/v1/examination-fees/applications/${id}/payments/online`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function completeExamOnlinePayment(id: string, payload: Record<string, unknown>) {
  return apiFetch<{ application: ExamApplication }>(
    `/v1/examination-fees/applications/${id}/payments/online/complete`,
    { method: 'POST', body: JSON.stringify(payload) },
  );
}

async function authorizedFetch(path: string, init?: RequestInit, retried = false) {
  const [apiBase, headers] = await Promise.all([
    getApiBase(),
    mobileHeadersAsync(init?.headers as Record<string, string>),
  ]);
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${apiBase}${path}`, { ...init, headers });
  if (res.status === 401 && !retried) {
    const newToken = await refreshAccessTokenString();
    headers.Authorization = `Bearer ${newToken}`;
    return authorizedFetch(path, { ...init, headers }, true);
  }
  return res;
}

export async function downloadExamReceiptPdf(receiptId: string, receiptNo?: string) {
  const res = await authorizedFetch(`/v1/examination-fees/receipts/${receiptId}/pdf`);
  if (!res.ok) {
    throw new Error(`Could not download receipt (${res.status})`);
  }
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    res.blob().then((blob) => {
      reader.onloadend = () => {
        const dataUrl = String(reader.result ?? '');
        const idx = dataUrl.indexOf(',');
        resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl);
      };
      reader.onerror = () => reject(new Error('Failed to read PDF'));
      reader.readAsDataURL(blob);
    }, reject);
  });
  const fileName = `exam-receipt-${receiptNo ?? receiptId}.pdf`;
  const path = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/pdf',
      dialogTitle: 'Examination fee receipt',
    });
  }
  return path;
}
