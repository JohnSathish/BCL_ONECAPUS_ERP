import { API_BASE, mobileHeaders } from '@/api/config';
import { getAccessToken } from '@/auth/session';
import { refreshAccessToken } from '@/auth/token-refresh';
import { apiFetch } from '@/api/client';
import type { FeeFinanceSettings, InitiatePaymentResponse, StudentFeeAccount } from '@/types/fees';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export function fetchMyFeeAccount() {
  return apiFetch<StudentFeeAccount>('/v1/fees/me/fee-account');
}

export function fetchFeeSettings() {
  return apiFetch<FeeFinanceSettings>('/v1/fees/settings');
}

export function initiateMyFeePayment(payload: {
  amount: number;
  provider: string;
  demandIds?: string[];
}) {
  return apiFetch<InitiatePaymentResponse>('/v1/fees/me/payments/initiate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function verifyFeePayment(payload: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return apiFetch<{
    alreadyPaid: boolean;
    receipt?: { id: string; receiptNo: string };
  }>('/v1/fees/payments/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function simulateFeePayment(paymentId: string) {
  return apiFetch<{
    alreadyPaid: boolean;
    receipt?: { id: string; receiptNo: string };
  }>(`/v1/fees/payments/${paymentId}/simulate`, { method: 'POST' });
}

export function pollPaymentStatus(orderId: string) {
  return apiFetch<{
    status: string;
    orderId: string;
    payment?: { status?: string; receiptId?: string };
  }>(`/v1/fees/me/payments/status/${encodeURIComponent(orderId)}`);
}

async function authorizedFetch(
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<Response> {
  const headers: Record<string, string> = mobileHeaders(init?.headers as Record<string, string>);
  const token = await getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401 && !retried) {
    const newToken = await refreshAccessToken();
    headers.Authorization = `Bearer ${newToken}`;
    return authorizedFetch(path, { ...init, headers }, true);
  }
  return res;
}

export async function downloadAndShareReceiptPdf(receiptId: string, receiptNo?: string) {
  const res = await authorizedFetch(`/v1/fees/receipts/${receiptId}/pdf`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message =
      typeof err === 'object' && err && 'message' in err
        ? String((err as { message: string }).message)
        : 'Could not download receipt';
    throw new Error(message);
  }

  const blob = await res.blob();
  const reader = new FileReader();
  const base64 = await new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      const result = reader.result as string;
      const encoded = result.split(',')[1] ?? '';
      resolve(encoded);
    };
    reader.onerror = () => reject(new Error('Failed to read receipt'));
    reader.readAsDataURL(blob);
  });

  const safeName = `${(receiptNo ?? receiptId).replace(/\//g, '_')}.pdf`;
  const fileUri = `${FileSystem.cacheDirectory}${safeName}`;
  await FileSystem.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Receipt ${receiptNo ?? receiptId}`,
    });
  } else {
    throw new Error('Sharing is not available on this device');
  }
}
