import { apiFetch } from '@/api/client';

function q(childId?: string | null) {
  return childId ? `?childId=${encodeURIComponent(childId)}` : '';
}

export type SchoolPersona =
  | 'student'
  | 'parent'
  | 'teacher'
  | 'admin'
  | 'accountant'
  | 'librarian'
  | 'transport';

export async function fetchSchoolMe(childId?: string | null) {
  return apiFetch<Record<string, unknown>>(`/v1/school-mobile/me${q(childId)}`);
}

export async function fetchSchoolHome(childId?: string | null) {
  return apiFetch<Record<string, unknown>>(`/v1/school-mobile/home${q(childId)}`);
}

export async function fetchSchoolAttendance(childId?: string | null) {
  return apiFetch<Record<string, unknown>>(`/v1/school-mobile/attendance${q(childId)}`);
}

export async function fetchSchoolFees(childId?: string | null) {
  return apiFetch<Record<string, unknown>>(`/v1/school-mobile/fees${q(childId)}`);
}

export async function fetchSchoolTimetable(childId?: string | null) {
  return apiFetch<Record<string, unknown>>(`/v1/school-mobile/timetable${q(childId)}`);
}

export async function fetchSchoolExams(childId?: string | null) {
  return apiFetch<unknown>(`/v1/school-mobile/exams${q(childId)}`);
}

export async function fetchSchoolNotices() {
  return apiFetch<unknown[]>('/v1/school-mobile/notices');
}

export async function fetchSchoolInbox() {
  return apiFetch<{ unreadCount?: number; items?: unknown[] }>('/v1/school-mobile/inbox');
}

export async function markSchoolInboxReadAll() {
  return apiFetch('/v1/school-mobile/inbox/read-all', { method: 'POST' });
}

export async function fetchTeacherToday(date?: string) {
  const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
  return apiFetch<Record<string, unknown>>(`/v1/school-mobile/teacher/today${suffix}`);
}

export async function fetchAttendanceRoster(input: {
  date: string;
  sectionId: string;
  mode?: string;
  periodKey?: string;
}) {
  const params = new URLSearchParams({
    date: input.date,
    sectionId: input.sectionId,
  });
  if (input.mode) params.set('mode', input.mode);
  if (input.periodKey) params.set('periodKey', input.periodKey);
  return apiFetch<Record<string, unknown>>(
    `/v1/school-mobile/attendance/roster?${params.toString()}`,
  );
}

export async function submitAttendanceRoster(body: Record<string, unknown>) {
  return apiFetch('/v1/school-mobile/attendance/submit', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchSchoolHrMe() {
  return apiFetch<Record<string, unknown>>('/v1/school-mobile/hr/me');
}

export async function fetchActivePaymentGateway() {
  return apiFetch<{
    provider: string | null;
    name: string | null;
    available: boolean;
  }>('/v1/school-mobile/payment-gateways/active');
}

export async function fetchSchoolCalendar(year: number, month: number) {
  return apiFetch<Record<string, unknown>>(
    `/v1/school-mobile/calendar?year=${year}&month=${month}`,
  );
}

export async function fetchSchoolTransportMyTrip() {
  return apiFetch<Record<string, unknown>>('/v1/school-mobile/transport/my-trip');
}

export async function fetchSchoolTransportRoster(tripId: string) {
  return apiFetch<Record<string, unknown>>(
    `/v1/school-mobile/transport/students?tripId=${encodeURIComponent(tripId)}`,
  );
}

export async function postSchoolTransportBoarding(body: Record<string, unknown>) {
  return apiFetch('/v1/school-mobile/transport/boarding', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function postSchoolTransportSos(body: Record<string, unknown>) {
  return apiFetch('/v1/school-mobile/transport/sos', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchSchoolParentTransport(childId?: string | null) {
  return apiFetch<unknown[]>(`/v1/school-mobile/transport/parent${q(childId)}`);
}

export async function fetchSchoolBootstrap() {
  return apiFetch<Record<string, unknown>>('/v1/school-mobile/bootstrap', { skipAuth: true });
}
