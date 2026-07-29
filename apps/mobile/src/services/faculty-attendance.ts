import { apiFetch } from '@/api/client';

export type FacultyAttendanceSession = {
  id: string;
  sessionDate?: string;
  startTime?: string;
  endTime?: string;
  periodNo?: number | null;
  sessionType?: string;
  status?: string;
  course?: { code?: string; title?: string };
  paperCourse?: { code?: string; title?: string };
  subjectGroup?: { code?: string; title?: string };
  displayTitle?: string;
  displayHeader?: { title?: string; subtitle?: string; details?: string };
  section?: { sectionCode?: string };
  location?: { roomCode?: string; roomName?: string; campus?: string };
  counts?: { total?: number; present?: number; absent?: number; other?: number };
  rosterSize?: number | null;
  timetableLinked?: boolean;
};

export type AttendanceRosterStudent = {
  id: string;
  rollNumber?: string;
  fullName?: string;
  status?: string;
  remarks?: string;
};

export type AttendanceRoster = {
  session: FacultyAttendanceSession;
  students: AttendanceRosterStudent[];
};

export function fetchFacultyTodaySessions() {
  return apiFetch<FacultyAttendanceSession[]>('/v1/student-attendance/faculty/today');
}

export function fetchAttendanceRoster(sessionId: string) {
  return apiFetch<AttendanceRoster>(`/v1/student-attendance/sessions/${sessionId}/roster`);
}

export function markAttendanceSession(
  sessionId: string,
  payload: {
    entries: { studentId: string; status: string; remarks?: string }[];
    mode?: 'QUICK_PRESENT' | 'ABSENTEES_ONLY' | 'MANUAL';
    lockAfterSave?: boolean;
  },
) {
  return apiFetch<AttendanceRoster>(`/v1/student-attendance/sessions/${sessionId}/mark`, {
    method: 'POST',
    body: JSON.stringify(payload),
    // Large rosters (40+ students) need more than the default 20s.
    timeoutMs: 60_000,
  });
}
