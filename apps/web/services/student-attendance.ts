import { api } from '@/services/api';

export type StudentAttendanceSession = {
  id: string;
  sessionDate: string;
  startTime?: string | null;
  endTime?: string | null;
  periodNo?: number | null;
  sessionType: string;
  labBatch?: string | null;
  status: string;
  offeringSectionId?: string | null;
  courseId?: string | null;
  course?: { code?: string; title?: string; courseType?: string } | null;
  subjectGroup?: {
    id?: string;
    code?: string;
    title?: string;
    fyugpCategory?: string;
  } | null;
  linkedPapers?: Array<{ id: string; code: string; title: string }>;
  section?: { sectionCode?: string | null } | null;
  faculty?: { fullName?: string; shortCode?: string | null; employeeCode?: string | null } | null;
  classroom?: { code?: string; name?: string; capacity?: number; status?: string } | null;
  location?: {
    roomCode?: string | null;
    roomName?: string | null;
    campus?: string | null;
    roomType?: string | null;
    buildingId?: string | null;
    floorId?: string | null;
  } | null;
  counts?: { total: number; present: number; absent: number; other: number };
};

export type StudentAttendanceRosterRow = {
  id: string;
  rollNumber?: string | null;
  enrollmentNumber?: string | null;
  admissionNumber?: string | null;
  fullName: string;
  status: string;
  remarks?: string;
};

export type StudentAttendanceRoster = {
  session: StudentAttendanceSession;
  students: StudentAttendanceRosterRow[];
};

export type StudentAttendanceSummary = {
  id: string;
  studentId: string;
  courseId?: string | null;
  offeringSectionId?: string | null;
  semesterNo?: number | null;
  periodKey: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  percentage: string | number;
};

export async function fetchStudentAttendanceDashboard() {
  const { data } = await api.get('/v1/student-attendance/dashboard');
  return data;
}

export async function fetchStudentAttendanceSessions(
  params?: Record<string, string | number | undefined>,
) {
  const { data } = await api.get<StudentAttendanceSession[]>('/v1/student-attendance/sessions', {
    params,
  });
  return data;
}

export async function generateStudentAttendanceSessions(payload: {
  date: string;
  timetablePlanId?: string;
  offeringSectionId?: string;
}) {
  const { data } = await api.post('/v1/student-attendance/sessions/generate', payload);
  return data;
}

export async function fetchFacultyTodayAttendance() {
  const { data } = await api.get<StudentAttendanceSession[]>(
    '/v1/student-attendance/faculty/today',
  );
  return data;
}

export async function fetchStudentAttendanceRoster(sessionId: string) {
  const { data } = await api.get<StudentAttendanceRoster>(
    `/v1/student-attendance/sessions/${sessionId}/roster`,
  );
  return data;
}

export async function markStudentAttendance(
  sessionId: string,
  payload: {
    mode?: 'QUICK_PRESENT' | 'ABSENTEES_ONLY' | 'MANUAL';
    lockAfterSave?: boolean;
    entries: Array<{
      studentId: string;
      status: string;
      remarks?: string;
      minutesPresent?: number;
    }>;
  },
) {
  const { data } = await api.post(`/v1/student-attendance/sessions/${sessionId}/mark`, payload);
  return data;
}

export async function correctStudentAttendance(
  sessionId: string,
  payload: {
    reason: string;
    entries: Array<{ studentId: string; status: string; remarks?: string }>;
  },
) {
  const { data } = await api.post(
    `/v1/student-attendance/sessions/${sessionId}/corrections`,
    payload,
  );
  return data;
}

export async function updateStudentAttendanceSessionState(
  sessionId: string,
  action: 'lock' | 'freeze' | 'reopen',
) {
  const { data } = await api.post(`/v1/student-attendance/sessions/${sessionId}/${action}`);
  return data;
}

export async function fetchStudentAttendanceSummaries(
  params?: Record<string, string | number | undefined>,
) {
  const { data } = await api.get<StudentAttendanceSummary[]>('/v1/student-attendance/summaries', {
    params,
  });
  return data;
}

export async function recalculateStudentAttendanceEligibility(payload: {
  semesterNo?: number;
  courseId?: string;
  studentId?: string;
}) {
  const { data } = await api.post('/v1/student-attendance/eligibility/recalculate', payload);
  return data;
}

export async function fetchStudentAttendanceReport(
  type: string,
  params?: Record<string, string | number | undefined>,
) {
  const { data } = await api.get(`/v1/student-attendance/reports/${type}`, { params });
  return data;
}

export async function fetchMyStudentAttendance() {
  const { data } = await api.get('/v1/student-attendance/portal/me');
  return data;
}
