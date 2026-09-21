import { getApiBase, schoolHeaders } from '@/api/config';
import { getAccessToken, accessTokenLooksExpired } from '@/auth/session';
import { refreshAccessToken } from '@/auth/token-refresh';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type HomeworkFile = {
  id: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export type HomeworkItem = {
  id: string;
  title: string;
  body?: string | null;
  assignDate?: string;
  dueDate: string;
  listStatus?: string;
  status?: string;
  subjectName: string;
  subjectId?: string;
  sectionId?: string;
  classLabel?: string;
  visibleTo?: string;
  submitted?: number;
  enrolled?: number;
  files?: HomeworkFile[];
};

export type HomeworkOptions = {
  academicYearId?: string;
  classes: {
    name: string;
    gradeId: string;
    sections: { id: string; name: string }[];
  }[];
  subjects: { id: string; name: string; gradeId?: string }[];
};

export function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isoPlusDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatHomeworkDay(iso?: string) {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function stripHtml(value?: string | null) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function homeworkStatusTone(status?: string) {
  switch (status) {
    case 'pending':
      return { bg: '#ffedd5', ink: '#c2410c', label: 'Due soon' };
    case 'completed':
      return { bg: '#e2e8f0', ink: '#475569', label: 'Past due' };
    case 'draft':
      return { bg: '#fef3c7', ink: '#a16207', label: 'Draft' };
    case 'active':
    default:
      return { bg: '#dcfce7', ink: '#15803d', label: 'Active' };
  }
}

async function authHeader() {
  let token = await getAccessToken();
  if (token && accessTokenLooksExpired(token)) {
    try {
      token = (await refreshAccessToken()).accessToken;
    } catch {
      /* keep expired token; server may still accept briefly */
    }
  }
  const headers = await schoolHeaders();
  delete (headers as { 'Content-Type'?: string })['Content-Type'];
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export async function assignHomework(input: {
  sectionId: string;
  subjectId?: string;
  title: string;
  body: string;
  assignDate: string;
  dueDate: string;
  visibleTo: 'STUDENTS' | 'STUDENTS_PARENTS';
  asDraft?: boolean;
  files?: { uri: string; name: string; mimeType: string }[];
}) {
  const form = new FormData();
  form.append('sectionId', input.sectionId);
  if (input.subjectId) form.append('subjectId', input.subjectId);
  form.append('title', input.title.trim());
  form.append('body', input.body);
  form.append('assignDate', input.assignDate);
  form.append('dueDate', input.dueDate);
  form.append('visibleTo', input.visibleTo);
  form.append('asDraft', input.asDraft ? 'true' : 'false');
  for (const file of input.files ?? []) {
    form.append('files', {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || 'application/octet-stream',
    } as unknown as Blob);
  }
  const headers = await authHeader();
  const res = await fetch(`${getApiBase()}/v1/school-mobile/homework`, {
    method: 'POST',
    headers,
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (json && typeof json === 'object' && 'message' in json
        ? String((json as { message?: string }).message || '')
        : '') || 'Could not assign homework.';
    throw new Error(msg);
  }
  return json;
}

export async function openHomeworkAttachment(
  homeworkId: string,
  file: HomeworkFile,
  childId?: string | null,
) {
  const headers = await authHeader();
  const q = childId ? `?childId=${encodeURIComponent(childId)}` : '';
  const url = `${getApiBase()}/v1/school-mobile/homework/${homeworkId}/files/${file.id}${q}`;
  const safe = file.fileName.replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'attachment';
  const dest = `${FileSystem.cacheDirectory ?? FileSystem.documentDirectory}hw-${file.id}-${safe}`;
  const result = await FileSystem.downloadAsync(url, dest, { headers });
  if (result.status < 200 || result.status >= 300) {
    throw new Error('Could not download the attachment.');
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: file.mimeType || undefined,
      dialogTitle: file.fileName,
    });
    return;
  }
  throw new Error('Sharing is not available on this device.');
}
