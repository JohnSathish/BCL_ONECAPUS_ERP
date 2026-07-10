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
