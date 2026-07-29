import { apiFetch } from '@/api/client';

export type UpdateFacultyProfilePayload = {
  mobile?: string;
  email?: string;
  qualification?: string;
  specialization?: string;
  experienceYears?: number;
  publicEmail?: string;
  publicPhone?: string;
  officeLocation?: string;
  googleScholarUrl?: string;
  orcidUrl?: string;
  researchAreas?: string;
};

export async function updateFacultyProfile(payload: UpdateFacultyProfilePayload) {
  return apiFetch('/v1/staff/me/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function uploadFacultyPhoto(uri: string, mimeType = 'image/jpeg') {
  const form = new FormData();
  form.append('file', { uri, name: 'photo.jpg', type: mimeType } as unknown as Blob);
  return apiFetch<{ photoUrl: string }>('/v1/staff/me/photo', {
    method: 'POST',
    body: form,
  });
}
