export type UserNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string | null;
  campaignId?: string | null;
  readAt?: string | null;
  archivedAt?: string | null;
  dismissedAt?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

export const STUDENT_PUSH_CATEGORIES = [
  {
    key: 'fee',
    label: 'Fee notifications',
    description: 'Get alerts about fee due dates, payments and receipts.',
    icon: '₹',
    tint: '#D1FAE5',
  },
  {
    key: 'attendance',
    label: 'Attendance notifications',
    description: 'Receive alerts for attendance updates and low attendance warnings.',
    icon: '🗓️',
    tint: '#DBEAFE',
  },
  {
    key: 'examination',
    label: 'Examination notifications',
    description: 'Get exam schedules, hall tickets, results and related updates.',
    icon: '📝',
    tint: '#EDE9FE',
  },
  {
    key: 'assignment',
    label: 'Assignment notifications',
    description: 'Receive alerts for new assignments, submissions and deadlines.',
    icon: '📖',
    tint: '#FFEDD5',
  },
  {
    key: 'circulars',
    label: 'General announcements',
    description: 'Get important announcements from the college.',
    icon: '📣',
    tint: '#FCE7F3',
  },
  {
    key: 'timetable',
    label: 'Timetable changes',
    description: 'Receive alerts for class and exam timetable changes.',
    icon: '🕒',
    tint: '#E0F2FE',
  },
  {
    key: 'birthday',
    label: 'Birthday wishes',
    description: 'Get birthday wishes from the college community.',
    icon: '🎁',
    tint: '#FCE7F3',
  },
  {
    key: 'general',
    label: 'Other alerts',
    description: 'Receive other important notifications and updates.',
    icon: '🔔',
    tint: '#EDE9FE',
  },
] as const;

export const STAFF_PUSH_CATEGORIES = [
  {
    key: 'attendance',
    label: 'Attendance reminders',
    description: 'Reminders to mark attendance and alerts about pending classes.',
    icon: '🗓️',
    tint: '#DBEAFE',
  },
  {
    key: 'timetable',
    label: 'Timetable updates',
    description: 'Alerts when your teaching timetable changes.',
    icon: '🕒',
    tint: '#E0F2FE',
  },
  {
    key: 'examination',
    label: 'Examination / marks',
    description: 'Exam duties, marks entry and result updates.',
    icon: '📝',
    tint: '#EDE9FE',
  },
  {
    key: 'circulars',
    label: 'Official circulars',
    description: 'Official circulars and announcements from the college.',
    icon: '📣',
    tint: '#FCE7F3',
  },
  {
    key: 'leave',
    label: 'Leave updates',
    description: 'Updates on leave applications and balances.',
    icon: '🏖️',
    tint: '#D1FAE5',
  },
  {
    key: 'birthday',
    label: 'Birthday wishes',
    description: 'Birthday wishes from the college community.',
    icon: '🎁',
    tint: '#FCE7F3',
  },
  {
    key: 'general',
    label: 'Other alerts',
    description: 'Other important notifications and updates.',
    icon: '🔔',
    tint: '#EDE9FE',
  },
] as const;
