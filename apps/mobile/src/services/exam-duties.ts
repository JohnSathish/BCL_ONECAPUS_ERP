import { getApiBase, mobileHeadersAsync } from '@/api/config';
import { apiFetch } from '@/api/client';
import { getAccessToken } from '@/auth/session';
import { refreshAccessTokenString } from '@/auth/token-refresh';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type MyExamDuty = {
  assignmentId: string;
  examName: string;
  date: string;
  session: string;
  time: string;
  reportingTime: string | null;
  hall: string;
  instructions: string | null;
};

export async function fetchMyExamDuties() {
  return apiFetch<{ staff: { fullName: string } | null; duties: MyExamDuty[] }>(
    '/v1/examinations/ia/my-duties',
  );
}

export async function shareMyExamDutySlip() {
  const headers = await mobileHeadersAsync();
  const token = await getAccessToken();
  let res = await fetch(`${getApiBase()}/v1/examinations/ia/my-duties/slip.pdf`, {
    headers: { ...headers, Authorization: token ? `Bearer ${token}` : '' },
  });
  if (res.status === 401) {
    const next = await refreshAccessTokenString();
    res = await fetch(`${getApiBase()}/v1/examinations/ia/my-duties/slip.pdf`, {
      headers: { ...headers, Authorization: next ? `Bearer ${next}` : '' },
    });
  }
  if (!res.ok) throw new Error('Could not download the duty slip.');
  const blob = await res.blob();
  const reader = new FileReader();
  const base64 = await new Promise<string>((resolve, reject) => {
    reader.onloadend = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  const uri = `${FileSystem.cacheDirectory}my-exam-duties.pdf`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'My exam duties' });
  }
}
