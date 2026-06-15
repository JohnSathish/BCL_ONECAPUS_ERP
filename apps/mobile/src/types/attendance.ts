export type AttendanceSubject = {
  id: string;
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

export type StudentAttendanceSummary = {
  subjects: AttendanceSubject[];
  overall: number | null;
  alerts: AttendanceAlert[];
};
