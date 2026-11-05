import { apiFetch } from '@/api/client';
import type { StudentAcademicsPayload } from '@/types/academics';

export function fetchStudentAcademics() {
  return apiFetch<StudentAcademicsPayload>('/v1/mobile-app/student/academics');
}

export function applyFyugpReadmission() {
  return apiFetch<{ status: string; previousRollNumber?: string | null }>(
    '/v1/mobile-app/student/fyugp-readmission',
    { method: 'POST' },
  );
}
