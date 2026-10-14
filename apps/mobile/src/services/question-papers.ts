import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { getApiBase, mobileHeadersAsync } from '@/api/config';
import { apiFetch } from '@/api/client';
import { getAccessToken } from '@/auth/session';
import { refreshAccessTokenString } from '@/auth/token-refresh';

export type QuestionPaper = {
  id: string;
  paperCode: string;
  paperName: string;
  semesterNo?: number | null;
  examYear?: number | null;
  examMonth?: number | null;
  examinationType?: string | null;
  subjectCategory?: string | null;
  fileName?: string | null;
  fileSizeBytes?: number | null;
  currentVersionNo?: number;
  courseLabel?: string | null;
  departmentName?: string | null;
  programmeName?: string | null;
  academicYearName?: string | null;
};

export type QuestionPaperPage = {
  items: QuestionPaper[];
  total: number;
  page: number;
  limit: number;
};

export function fetchMyQuestionPapers(params: {
  q?: string;
  semesterNo?: number | null;
  page?: number;
  limit?: number;
}) {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set('q', params.q.trim());
  if (params.semesterNo) search.set('semesterNo', String(params.semesterNo));
  search.set('page', String(params.page ?? 1));
  search.set('limit', String(params.limit ?? 50));
  return apiFetch<QuestionPaperPage>(`/v1/question-bank/me/papers?${search.toString()}`);
}

export function fetchSavedQuestionPapers() {
  return apiFetch<QuestionPaper[]>('/v1/question-bank/me/bookmarks');
}

export function saveQuestionPaper(paperId: string) {
  return apiFetch(`/v1/question-bank/me/bookmarks/${paperId}`, { method: 'POST' });
}

export function unsaveQuestionPaper(paperId: string) {
  return apiFetch(`/v1/question-bank/me/bookmarks/${paperId}`, { method: 'DELETE' });
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

const PAPER_DIR = `${FileSystem.documentDirectory}question-papers`;

function cachePath(paper: QuestionPaper) {
  const safe =
    (paper.fileName ?? `${paper.paperCode}.pdf`).replace(/[^a-zA-Z0-9._-]/g, '_') ||
    `question-paper-${paper.id}.pdf`;
  return `${PAPER_DIR}/${paper.id}-v${paper.currentVersionNo ?? 1}-${safe}`;
}

export async function isQuestionPaperOnDevice(paper: QuestionPaper) {
  const info = await FileSystem.getInfoAsync(cachePath(paper));
  return info.exists;
}

/** Downloads the PDF once per version; later opens reuse the cached copy. */
export async function downloadQuestionPaper(paper: QuestionPaper) {
  const dest = cachePath(paper);
  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) return dest;

  await FileSystem.makeDirectoryAsync(PAPER_DIR, { intermediates: true }).catch(() => undefined);
  const headers = await authHeaders();
  const apiBase = (await getApiBase()).replace(/\/+$/, '');
  const url = `${apiBase}/v1/question-bank/papers/${paper.id}/download`;
  const result = await FileSystem.downloadAsync(url, dest, { headers });
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => undefined);
    throw new Error(
      result.status === 403
        ? 'This paper is not available for your programme.'
        : `Download failed (${result.status})`,
    );
  }
  return result.uri;
}

function viewFileName(paper: QuestionPaper) {
  const code = (paper.paperCode || 'question-paper').replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${code}.pdf`;
}

/** A readable copy so the viewer title is the paper code, not the storage id. */
async function readablePdfCopy(sourceUri: string, paper: QuestionPaper) {
  const dir = `${FileSystem.cacheDirectory}question-paper-view/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);
  const dest = `${dir}${viewFileName(paper)}`;
  await FileSystem.deleteAsync(dest, { idempotent: true }).catch(() => undefined);
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function openQuestionPaper(paper: QuestionPaper) {
  const downloaded = await downloadQuestionPaper(paper);
  const uri = await readablePdfCopy(downloaded, paper).catch(() => downloaded);

  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(uri);
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: 'application/pdf',
      });
    } catch {
      throw new Error(
        'No PDF viewer is installed on this phone. Install one, then open the paper again.',
      );
    }
    return;
  }

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Opening files is not available on this device');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: paper.paperName,
  });
}
