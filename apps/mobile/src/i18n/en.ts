export const en = {
  greetingMorning: 'Good morning',
  greetingAfternoon: 'Good afternoon',
  greetingEvening: 'Good evening',
  attendance: 'Attendance',
  fees: 'Fees',
  timetable: 'Timetable',
  exams: 'Examinations',
  notices: 'Notices',
  homework: 'Homework',
  library: 'Library',
  transport: 'Transport',
  profile: 'Profile',
  notifications: 'Notifications',
  emptyGeneric: 'Nothing to show yet.',
  retry: 'Retry',
  offline: 'Offline',
  logout: 'Log out',
} as const;

export type MessageKey = keyof typeof en;
