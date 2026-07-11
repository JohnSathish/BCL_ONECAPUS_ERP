import { apiFetch } from '@/api/client';

export type ProfileCompletion = {
  percent: number;
  filledCount: number;
  totalCount: number;
  missing: Array<{ key: string; label: string }>;
  checks?: Array<{ key: string; label: string; filled: boolean }>;
};

export type ProfileBootstrap = {
  student: {
    id: string;
    fullName?: string | null;
    rollNumber?: string | null;
    programme?: string | null;
    semester?: number | null;
  };
  sections: Record<string, any>;
  completion: ProfileCompletion;
  verificationStatus: string;
  profileUpdate?: {
    enabled: boolean;
    canEdit: boolean;
    startsAt?: string | null;
    endsAt?: string | null;
    message?: string | null;
    closedMessage?: string;
    reopenUntil?: string | null;
  };
  visibleSections?: { bank?: boolean };
  staticOptions?: {
    board?: string[];
    stream?: Array<{ value: string; label: string } | string>;
    yearOfPassing?: number[];
  };
};

export type ClassXiiPayload = {
  boardName?: string | null;
  schoolName?: string | null;
  boardRollNumber?: string | null;
  registrationNumber?: string | null;
  examYear?: number | null;
  stream?: string | null;
  totalMarks?: number | null;
  maximumMarks?: number | null;
  grade?: string | null;
  division?: string | null;
  subjects?: Array<{
    subjectName: string;
    marksObtained?: number | null;
    maxMarks?: number | null;
    grade?: string | null;
  }>;
};

export function fetchMyProfileCompletion() {
  return apiFetch<ProfileCompletion>('/v1/students/me/profile/completion');
}

export function fetchMyProfileBootstrap() {
  return apiFetch<ProfileBootstrap>('/v1/students/me/profile/bootstrap');
}

export function fetchMyProfileSection(section: string) {
  return apiFetch<{ section: string; data: Record<string, unknown> }>(
    `/v1/students/me/profile/sections/${section}`,
  );
}

export function submitMyProfileChanges(
  changes: Array<{ sectionKey: string; fieldKey: string; newValue: unknown }>,
) {
  return apiFetch('/v1/students/me/profile/submissions', {
    method: 'POST',
    body: JSON.stringify({ changes }),
  });
}

export function upsertMyClassXii(payload: ClassXiiPayload) {
  return apiFetch('/v1/students/me/profile/class-xii', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export type Class12SubjectOption = {
  id: string;
  subjectName: string;
  sortOrder: number;
  boardCode: string;
  streamCode: string;
};

export function normalizeClass12Stream(stream?: string | null): string {
  const raw = String(stream ?? '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (!raw) return '';
  if (raw.includes('HUMANITIES') || raw.includes('ARTS')) return 'ARTS';
  if (raw.includes('SCIENCE')) return 'SCIENCE';
  if (raw.includes('COMMERCE')) return 'COMMERCE';
  return raw.replace(/[^A-Z0-9]+/g, '_');
}

export function fetchClass12Subjects(board: string, stream: string) {
  const params = new URLSearchParams({
    board,
    stream: normalizeClass12Stream(stream),
  });
  return apiFetch<Class12SubjectOption[]>(`/v1/class12/subjects?${params.toString()}`);
}

export function uploadMyDocument(
  documentType: string,
  file: {
    uri: string;
    name: string;
    mimeType: string;
  },
) {
  const form = new FormData();
  form.append('documentType', documentType);
  form.append('file', {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as unknown as Blob);
  return apiFetch('/v1/students/me/documents', {
    method: 'POST',
    body: form,
  });
}
