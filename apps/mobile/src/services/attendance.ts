import { apiFetch } from '@/api/client';
import type { StudentAttendanceSummary } from '@/types/attendance';

export function fetchMyAttendance() {
  return apiFetch<StudentAttendanceSummary>('/v1/student-attendance/portal/me');
}
