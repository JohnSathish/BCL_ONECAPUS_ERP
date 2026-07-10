export type UserNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  readAt?: string | null;
  archivedAt?: string | null;
  dismissedAt?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

export const STUDENT_PUSH_CATEGORIES = [
  { key: 'fee', label: 'Fee notifications' },
  { key: 'attendance', label: 'Attendance notifications' },
  { key: 'examination', label: 'Examination notifications' },
  { key: 'assignment', label: 'Assignment notifications' },
  { key: 'circulars', label: 'General announcements' },
  { key: 'timetable', label: 'Timetable changes' },
  { key: 'general', label: 'Other alerts' },
] as const;

export const STAFF_PUSH_CATEGORIES = [
  { key: 'attendance', label: 'Attendance reminders' },
  { key: 'timetable', label: 'Timetable updates' },
  { key: 'examination', label: 'Examination / marks' },
  { key: 'circulars', label: 'Official circulars' },
  { key: 'leave', label: 'Leave updates' },
  { key: 'general', label: 'Other alerts' },
] as const;
