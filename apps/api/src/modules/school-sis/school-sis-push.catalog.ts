export const PUSH_CATEGORIES = [
  'GENERAL',
  'ANNOUNCEMENT',
  'FEE',
  'ATTENDANCE',
  'EXAMINATION',
  'RESULT',
  'HOMEWORK',
  'HOLIDAY',
  'ACADEMIC_CALENDAR',
  'TRANSPORT',
  'EMERGENCY',
  'EVENT',
  'MEETING',
  'ADMISSION',
  'LIBRARY',
  'BIRTHDAY',
  'SYSTEM',
] as const;

export const PUSH_CHANNELS: Record<string, string> = {
  GENERAL: 'stlukes_general',
  ANNOUNCEMENT: 'stlukes_announcements',
  FEE: 'stlukes_fees',
  ATTENDANCE: 'stlukes_attendance',
  EXAMINATION: 'stlukes_examination',
  RESULT: 'stlukes_examination',
  HOMEWORK: 'stlukes_homework',
  TRANSPORT: 'stlukes_transport',
  EMERGENCY: 'stlukes_emergency',
};

export const PUSH_DEEP_LINKS = [
  'NONE',
  'DASHBOARD',
  'FEES',
  'ATTENDANCE',
  'EXAMINATION',
  'RESULT',
  'HOMEWORK',
  'NOTICES',
  'HOLIDAY',
  'ACADEMIC_CALENDAR',
  'TRANSPORT',
  'LIBRARY',
  'EVENT',
  'STUDENT',
  'DOCUMENT',
  'CUSTOM',
] as const;

export const PUSH_AUDIENCES = [
  'MY_DEVICES',
  'INDIVIDUAL_STUDENT',
  'PARENT',
  'TEACHER',
  'STAFF',
  'CLASS',
  'SECTION',
  'MULTI_CLASS',
  'MULTI_SECTION',
  'ALL_STUDENTS',
  'ALL_PARENTS',
  'ALL_TEACHERS',
  'ALL_STAFF',
  'CUSTOM',
] as const;

export function deepLinkHref(type?: string | null, value?: string | null) {
  if (!type || type === 'NONE') return null;
  if (type === 'CUSTOM' && value) return value;
  if (value) return `notification://${type.toLowerCase()}/${value}`;
  return `notification://${type.toLowerCase()}`;
}

export const DEFAULT_PUSH_TEMPLATES = [
  {
    name: 'Fee Reminder',
    category: 'FEE',
    title: 'Fee Payment Reminder',
    body: 'Dear {{parent_name}}, the school fee for {{student_name}} for {{month}} is pending. Please pay before {{due_date}}.',
    deepLinkType: 'FEES',
  },
  {
    name: 'Payment Successful',
    category: 'FEE',
    title: 'Payment received',
    body: 'Fee payment of {{amount}} was received for {{student_name}}. Receipt: {{receipt_no}}.',
    deepLinkType: 'FEES',
  },
  {
    name: 'Student Absent',
    category: 'ATTENDANCE',
    title: 'Attendance update',
    body: '{{student_name}} was marked absent today, {{date}}.',
    deepLinkType: 'ATTENDANCE',
  },
  {
    name: 'Result Published',
    category: 'RESULT',
    title: 'Examination result',
    body: 'Your child’s examination result is now available. Tap to view.',
    deepLinkType: 'RESULT',
  },
  {
    name: 'Holiday Published',
    category: 'HOLIDAY',
    title: 'Holiday announcement',
    body: '{{school_name}} will remain closed on {{date}} ({{holiday_name}}).',
    deepLinkType: 'HOLIDAY',
  },
  {
    name: 'Homework Assigned',
    category: 'HOMEWORK',
    title: 'New homework',
    body: '{{subject}}: {{title}} for {{class_label}}. Due {{due_date}}.',
    deepLinkType: 'HOMEWORK',
  },
];

export const DEFAULT_PUSH_RULES = [
  { eventType: 'FEE_DUE', name: 'Fee due', pushEnabled: true },
  { eventType: 'FEE_PAID', name: 'Payment successful', pushEnabled: true },
  {
    eventType: 'STUDENT_ABSENT',
    name: 'Student absent',
    pushEnabled: true,
    digestOnly: false,
  },
  {
    eventType: 'RESULT_PUBLISHED',
    name: 'Result published',
    pushEnabled: true,
  },
  {
    eventType: 'HOLIDAY_PUBLISHED',
    name: 'Holiday published',
    pushEnabled: true,
  },
  {
    eventType: 'HOMEWORK_ASSIGNED',
    name: 'Homework assigned',
    pushEnabled: true,
  },
  { eventType: 'TRANSPORT_ALERT', name: 'Transport alert', pushEnabled: true },
];
