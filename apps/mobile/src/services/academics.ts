import { apiFetch } from '@/api/client';
import type { StudentAcademicsPayload } from '@/types/academics';

export function fetchStudentAcademics() {
  return apiFetch<StudentAcademicsPayload>('/v1/mobile-app/student/academics');
}
