import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getApiBase, mobileHeadersAsync } from '@/api/config';
import { getAccessToken } from '@/auth/session';
import { refreshAccessTokenString } from '@/auth/token-refresh';
import { apiFetch } from '@/api/client';

export type SyllabusDocument = {
  id: string;
  paperCode: string;
  paperTitle: string;
  semesterNo?: number | null;
  credits?: number | string | null;
  category?: string | null;
  subjectType?: string | null;
  currentVersionNo?: number;
  status: string;
  fileName?: string | null;
  viewCount?: number;
  downloadCount?: number;
  bookmarked?: boolean;
};

export type SyllabusAskResponse = {
  answer: string;
  sources?: Array<{ pageNo?: number | null; heading?: string | null; excerpt?: string }>;
};

export function fetchMySyllabusDocuments() {
  return apiFetch<SyllabusDocument[] | { items: SyllabusDocument[] }>(
    '/v1/syllabus-repository/me/documents',
  ).then((data) => (Array.isArray(data) ? data : (data.items ?? [])));
}

export function toggleSyllabusBookmark(documentId: string) {
  return apiFetch(`/v1/syllabus-repository/documents/${documentId}/bookmark`, {
    method: 'POST',
  });
}

export function askSyllabusDocument(documentId: string, question: string) {
  return apiFetch<SyllabusAskResponse>(`/v1/syllabus-repository/documents/${documentId}/ask`, {
    method: 'POST',
    body: JSON.stringify({ question }),
  });
}

async function authHeaders() {
  let token = await getAccessToken();
  if (!token) {
    token = await refreshAccessTokenString();
  }
  const mobile = await mobileHeadersAsync();
  return {
    ...mobile,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** Download PDF to cache for offline open/share. */
export async function downloadSyllabusPdfOffline(
  documentId: string,
  fileName?: string | null,
  versionNo?: number,
) {
  const headers = await authHeaders();
  const safe =
    (fileName ?? `syllabus-${documentId}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_') ||
    `syllabus-${documentId}.pdf`;
  const versionKey = versionNo != null ? `v${versionNo}` : 'current';
  const dest = `${FileSystem.documentDirectory}syllabus/${documentId}-${versionKey}-${safe}`;
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}syllabus`, {
    intermediates: true,
  }).catch(() => undefined);

  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) return dest;

  const url = `${getApiBase()}/v1/syllabus-repository/documents/${documentId}/download`;
  const result = await FileSystem.downloadAsync(url, dest, { headers });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Download failed (${result.status})`);
  }
  return result.uri;
}

export async function shareSyllabusPdf(uri: string, fileName?: string) {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle: fileName ?? 'Syllabus',
  });
}

export async function getCachedSyllabusUri(
  documentId: string,
  fileName?: string | null,
  versionNo?: number,
) {
  const safe =
    (fileName ?? `syllabus-${documentId}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_') ||
    `syllabus-${documentId}.pdf`;
  const versionKey = versionNo != null ? `v${versionNo}` : 'current';
  const dest = `${FileSystem.documentDirectory}syllabus/${documentId}-${versionKey}-${safe}`;
  const info = await FileSystem.getInfoAsync(dest);
  return info.exists ? dest : null;
}
