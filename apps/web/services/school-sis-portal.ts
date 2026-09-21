import { api } from './api';

function childQuery(childId?: string | null) {
  return childId ? { params: { childId } } : undefined;
}

export async function fetchSchoolPortalMe(childId?: string | null) {
  const { data } = await api.get('/v1/school-mobile/me', childQuery(childId));
  return data as Record<string, unknown>;
}

export async function fetchSchoolPortalHome(childId?: string | null) {
  const { data } = await api.get('/v1/school-mobile/home', childQuery(childId));
  return data as Record<string, unknown>;
}

export async function fetchSchoolPortalAttendance(childId?: string | null) {
  const { data } = await api.get('/v1/school-mobile/attendance', childQuery(childId));
  return data as Record<string, unknown>;
}

export async function fetchSchoolPortalFees(childId?: string | null) {
  const { data } = await api.get('/v1/school-mobile/fees', childQuery(childId));
  return data as Record<string, unknown>;
}

export async function fetchSchoolPortalTimetable(childId?: string | null) {
  const { data } = await api.get('/v1/school-mobile/timetable', childQuery(childId));
  return data as Record<string, unknown>;
}

export async function fetchSchoolPortalExams(childId?: string | null) {
  const { data } = await api.get('/v1/school-mobile/exams', childQuery(childId));
  return data;
}

export async function fetchSchoolPortalNotices() {
  const { data } = await api.get('/v1/school-mobile/notices');
  return data as unknown[];
}

export async function fetchSchoolPortalEvents() {
  const { data } = await api.get('/v1/school-mobile/events');
  return data as unknown[];
}

export async function fetchSchoolPortalGallery() {
  const { data } = await api.get('/v1/school-mobile/gallery');
  return data as Record<string, unknown>;
}

export async function fetchSchoolPortalInbox() {
  const { data } = await api.get('/v1/school-mobile/inbox');
  return data as { unreadCount?: number; items?: unknown[] };
}

export async function markSchoolPortalInboxReadAll() {
  const { data } = await api.post('/v1/school-mobile/inbox/read-all');
  return data;
}

export async function fetchSchoolPortalCalendar(year: number, month: number) {
  const { data } = await api.get('/v1/school-mobile/calendar', { params: { year, month } });
  return data as Record<string, unknown>;
}

export async function fetchSchoolPortalTransport(childId?: string | null) {
  const { data } = await api.get('/v1/school-mobile/transport/parent', childQuery(childId));
  return data;
}

export async function fetchSchoolPortalLeaveTypes() {
  const { data } = await api.get('/v1/school-mobile/leave-types');
  return data as Array<Record<string, unknown>>;
}

export async function fetchSchoolPortalLeaves(childId?: string | null) {
  const { data } = await api.get('/v1/school-mobile/leave', childQuery(childId));
  return data as unknown[];
}

export async function applySchoolPortalLeave(payload: {
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  reason?: string;
  childId?: string;
}) {
  const { data } = await api.post('/v1/school-mobile/leave', payload);
  return data;
}

export async function fetchSchoolTeacherToday(date?: string) {
  const { data } = await api.get('/v1/school-mobile/teacher/today', {
    params: date ? { date } : undefined,
  });
  return data as Record<string, unknown>;
}

export async function fetchSchoolAttendanceHistory(month?: string) {
  const { data } = await api.get('/v1/school-mobile/attendance/history', {
    params: month ? { month } : undefined,
  });
  return data as {
    month: string;
    workingDays: number;
    classCount: number;
    studentCount: number;
    avgAttendance: number;
    classes: Array<{
      id: string;
      label: string;
      students: number;
      present: number;
      absent: number;
      late: number;
      percent: number;
    }>;
  };
}

export async function fetchSchoolPortalRoster(input: {
  date: string;
  sectionId: string;
  mode?: string;
  periodKey?: string;
}) {
  const { data } = await api.get('/v1/school-mobile/attendance/roster', { params: input });
  return data as Record<string, unknown>;
}

export async function submitSchoolPortalAttendance(body: Record<string, unknown>) {
  const { data } = await api.post('/v1/school-mobile/attendance/submit', body);
  return data;
}

export async function fetchSchoolPortalHrMe() {
  const { data } = await api.get('/v1/school-mobile/hr/me');
  return data as Record<string, unknown>;
}

export async function fetchSchoolPrincipalDesk() {
  const { data } = await api.get('/v1/school-mobile/principal/desk');
  return data as Record<string, unknown>;
}

export async function fetchSchoolPrincipalStudents(q?: string, gradeId?: string) {
  const { data } = await api.get('/v1/school-mobile/principal/students', {
    params: { q: q || undefined, gradeId: gradeId || undefined },
  });
  return data as Record<string, unknown>;
}

export async function fetchSchoolPrincipalTeachers(q?: string) {
  const { data } = await api.get('/v1/school-mobile/principal/teachers', {
    params: q ? { q } : undefined,
  });
  return data as Record<string, unknown>;
}

export async function fetchSchoolPrincipalAcademics() {
  const { data } = await api.get('/v1/school-mobile/principal/academics');
  return data as Record<string, unknown>;
}

export async function fetchSchoolPrincipalExams() {
  const { data } = await api.get('/v1/school-mobile/principal/examinations');
  return data as Record<string, unknown>;
}

export async function fetchSchoolPrincipalAttendance() {
  const { data } = await api.get('/v1/school-mobile/principal/attendance');
  return data as Record<string, unknown>;
}

export async function fetchSchoolPrincipalFees() {
  const { data } = await api.get('/v1/school-mobile/principal/fees');
  return data as Record<string, unknown>;
}

export async function fetchSchoolPrincipalNotices() {
  const { data } = await api.get('/v1/school-mobile/principal/notices');
  return data as Record<string, unknown>;
}

export async function fetchSchoolPortalBootstrap() {
  const { data } = await api.get('/v1/school-mobile/bootstrap');
  return data as Record<string, unknown>;
}

export async function logoutSchoolPortalAll() {
  const { data } = await api.post('/v1/school-mobile/auth/logout-all');
  return data;
}

export async function fetchSchoolHomeworkOptions() {
  const { data } = await api.get('/v1/school-mobile/homework/options');
  return data as Record<string, unknown>;
}

export async function fetchSchoolHomeworkList() {
  const { data } = await api.get('/v1/school-mobile/homework');
  return data as Record<string, unknown>;
}

export async function fetchSchoolHomeworkReports() {
  const { data } = await api.get('/v1/school-mobile/homework/reports');
  return data as Record<string, unknown>;
}

export async function saveSchoolHomework(body: FormData, id?: string) {
  const { data } = id
    ? await api.patch(`/v1/school-mobile/homework/${id}`, body)
    : await api.post('/v1/school-mobile/homework', body);
  return data as Record<string, unknown>;
}

export async function duplicateSchoolHomework(id: string) {
  const { data } = await api.post(`/v1/school-mobile/homework/${id}/duplicate`);
  return data as Record<string, unknown>;
}

export async function deleteSchoolHomework(id: string) {
  const { data } = await api.delete(`/v1/school-mobile/homework/${id}`);
  return data as Record<string, unknown>;
}

export async function fetchSchoolExamMarkOptions() {
  const { data } = await api.get('/v1/school-mobile/exams/marks/options');
  return data as Record<string, unknown>;
}

export async function fetchSchoolExamMarkRoster(params: {
  examId: string;
  sectionId: string;
  componentId: string;
}) {
  const { data } = await api.get('/v1/school-mobile/exams/marks/roster', { params });
  return data as Record<string, unknown>;
}

export async function fetchSchoolExamMarkHistory(params: {
  examId: string;
  sectionId: string;
  componentId: string;
}) {
  const { data } = await api.get('/v1/school-mobile/exams/marks/history', { params });
  return data as Record<string, unknown>;
}

export async function saveSchoolPortalExamMarks(payload: {
  examId: string;
  componentId: string;
  submit?: boolean;
  rows: Array<{
    studentId: string;
    marks?: number | null;
    status?: string;
    remarks?: string;
  }>;
}) {
  const { data } = await api.post('/v1/school-mobile/exams/marks', payload);
  return data as Record<string, unknown>;
}
