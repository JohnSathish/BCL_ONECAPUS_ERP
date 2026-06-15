export const DEFAULT_STUDENT_DASHBOARD_CONFIG: Record<string, boolean> = {
  attendance: true,
  fees: true,
  timetable: true,
  results: true,
  library: true,
  hostel: false,
  notifications: true,
  lms: true,
  examinations: true,
};

export const DEFAULT_STAFF_DASHBOARD_CONFIG: Record<string, boolean> = {
  todayClasses: true,
  pendingAttendance: true,
  leaveBalance: true,
  payroll: true,
  notifications: true,
  timetable: true,
};

export type MobileAppType = 'STUDENT' | 'STAFF';
