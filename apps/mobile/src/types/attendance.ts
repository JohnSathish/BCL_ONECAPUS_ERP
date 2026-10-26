export type AttendanceSubject = {
  id: string;
  label?: string;
  studentId?: string;
  courseId?: string | null;
  semesterNo?: number | null;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  percentage: number | string;
  metadata?: Record<string, unknown>;
};

export type AttendanceAlert = {
  courseId?: string;
  percentage: number;
  message: string;
};

export type AttendanceMarkStatus = 'present' | 'absent' | 'leave';

export type AttendanceMark = {
  date: string;
  subjectId: string;
  status: AttendanceMarkStatus;
};

export type StudentAttendanceSummary = {
  subjects: AttendanceSubject[];
  marks?: AttendanceMark[];
  overall: number | null;
  alerts: AttendanceAlert[];
};
