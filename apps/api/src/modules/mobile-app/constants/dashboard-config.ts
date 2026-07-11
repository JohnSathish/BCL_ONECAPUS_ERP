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

/** Module visibility for mobile drawer / screens (student + shared). */
export const DEFAULT_MOBILE_FEATURE_FLAGS: Record<string, boolean> = {
  attendance: true,
  examination: true,
  fees: true,
  library: true,
  assignments: true,
  results: true,
  idCard: false,
  communication: true,
  leave: true,
  bankSection: false,
  profileEdit: true,
  feedback: true,
  certificates: true,
  timetable: true,
  lms: true,
  notifications: true,
};

export type MobileAppType = 'STUDENT' | 'STAFF';
