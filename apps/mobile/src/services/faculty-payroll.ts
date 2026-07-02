import { API_BASE, mobileHeaders } from '@/api/config';
import { getAccessToken } from '@/auth/session';
import { refreshAccessToken } from '@/auth/token-refresh';
import { apiFetch } from '@/api/client';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type StaffPayslip = {
  id: string;
  month: number;
  year: number;
  grossSalary?: number;
  totalDeductions?: number;
  netSalary?: number;
  pdfPath?: string | null;
};

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

export function fetchStaffPayslips() {
  return apiFetch<StaffPayslip[]>('/v1/staff/me/payroll/payslips');
}

export async function downloadAndSharePayslipPdf(payslipId: string, label?: string) {
  const res = await authorizedFetch(`/v1/staff/me/payroll/payslips/${payslipId}/pdf`);
  if (!res.ok) {
    throw new Error('Could not download payslip. Try again from the web portal.');
  }
  const blob = await res.blob();
  const reader = new FileReader();
  const base64 = await new Promise<string>((resolve, reject) => {
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const filename = `${label ?? 'payslip'}.pdf`.replace(/\s+/g, '_');
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Payslip' });
  }
  return uri;
}
