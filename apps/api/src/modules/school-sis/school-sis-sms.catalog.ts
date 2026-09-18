export const SMS_CATEGORIES = [
  'GENERAL',
  'ANNOUNCEMENT',
  'FEE_REMINDER',
  'FEE_RECEIPT',
  'ATTENDANCE',
  'EXAMINATION',
  'RESULT',
  'ADMISSION',
  'TRANSPORT',
  'HOLIDAY',
  'EMERGENCY',
  'STAFF',
  'PARENT',
  'STUDENT',
  'MARKETING',
  'OTP',
  'OTHER',
] as const;

export const SMS_KINDS = ['SERVICE', 'PROMOTIONAL'] as const;

export const SMS_PROVIDERS = [
  'APITXT',
  'MSG91',
  'TWILIO',
  'EXOTEL',
  'CUSTOM_HTTP',
  'CUSTOM_SMPP',
] as const;

export const SMS_STATUSES = [
  'QUEUED',
  'SUBMITTED',
  'SENT',
  'DELIVERED',
  'FAILED',
  'UNDELIVERED',
  'REJECTED',
  'EXPIRED',
  'UNKNOWN',
] as const;

export const DLT_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
  'EXPIRED',
] as const;

export const SMS_VARIABLES = [
  'student_name',
  'parent_name',
  'class',
  'class_name',
  'section',
  'admission_no',
  'amount',
  'due_date',
  'school_name',
  'exam_name',
  'exam_date',
  'result',
  'attendance_percentage',
  'route',
  'bus_number',
  'date',
  'otp',
] as const;

export const DEFAULT_SMS_TEMPLATES: Array<{
  key: string;
  name: string;
  category: string;
  smsKind: string;
  body: string;
  variables: string[];
}> = [
  {
    key: 'FEE_REMINDER',
    name: 'Fee Reminder',
    category: 'FEE_REMINDER',
    smsKind: 'SERVICE',
    body: 'Dear {parent_name}, fee of Rs.{amount} for {student_name}, {class_name} is pending. Please pay before {due_date}. - {school_name}',
    variables: [
      'parent_name',
      'amount',
      'student_name',
      'class_name',
      'due_date',
      'school_name',
    ],
  },
  {
    key: 'FEE_PAYMENT_RECEIPT',
    name: 'Fee Receipt',
    category: 'FEE_RECEIPT',
    smsKind: 'SERVICE',
    body: 'Dear {parent_name}, we received Rs.{amount} for {student_name}. Thank you. - {school_name}',
    variables: ['parent_name', 'amount', 'student_name', 'school_name'],
  },
  {
    key: 'STUDENT_ABSENT',
    name: 'Student Absent',
    category: 'ATTENDANCE',
    smsKind: 'SERVICE',
    body: 'Dear {parent_name}, {student_name} was marked absent today ({date}). Please contact the school if needed. - {school_name}',
    variables: ['parent_name', 'student_name', 'date', 'school_name'],
  },
  {
    key: 'EXAM_SCHEDULE',
    name: 'Exam Schedule',
    category: 'EXAMINATION',
    smsKind: 'SERVICE',
    body: 'Dear {parent_name}, {exam_name} for {student_name} is on {exam_date}. - {school_name}',
    variables: [
      'parent_name',
      'exam_name',
      'student_name',
      'exam_date',
      'school_name',
    ],
  },
  {
    key: 'RESULT_PUBLISHED',
    name: 'Result Published',
    category: 'RESULT',
    smsKind: 'SERVICE',
    body: 'Dear {parent_name}, result for {student_name} ({exam_name}): {result}. - {school_name}',
    variables: [
      'parent_name',
      'student_name',
      'exam_name',
      'result',
      'school_name',
    ],
  },
  {
    key: 'OTP',
    name: 'OTP',
    category: 'OTP',
    smsKind: 'SERVICE',
    body: 'Your {school_name} verification code is {otp}. Do not share this code.',
    variables: ['school_name', 'otp'],
  },
  {
    key: 'EMERGENCY',
    name: 'Emergency',
    category: 'EMERGENCY',
    smsKind: 'SERVICE',
    body: 'Emergency notice from {school_name}: please check the school app or contact the office.',
    variables: ['school_name'],
  },
  {
    key: 'TRANSPORT',
    name: 'Transport update',
    category: 'TRANSPORT',
    smsKind: 'SERVICE',
    body: 'Dear {parent_name}, transport update for {student_name}: route {route}, bus {bus_number}. - {school_name}',
    variables: [
      'parent_name',
      'student_name',
      'route',
      'bus_number',
      'school_name',
    ],
  },
];

export function mapProviderStatus(raw: string): string {
  const s = raw.toUpperCase();
  if (['DELIVRD', 'DELIVERED', 'SUCCESS'].includes(s)) return 'DELIVERED';
  if (['FAILED', 'FAIL', 'UNDELIV', 'UNDELIVERED', 'NACK'].includes(s))
    return 'FAILED';
  if (['REJECTED', 'REJECT'].includes(s)) return 'REJECTED';
  if (['EXPIRED', 'EXPD'].includes(s)) return 'EXPIRED';
  if (['SENT', 'SUBMITTED', 'ACCEPTD', 'ACCEPTED', 'QUEUED'].includes(s))
    return 'SENT';
  return 'UNKNOWN';
}
