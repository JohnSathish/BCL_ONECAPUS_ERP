export const WA_OPT_IN_CATEGORIES = [
  'ACADEMIC',
  'FEES',
  'ATTENDANCE',
  'TRANSPORT',
  'EVENTS',
  'MARKETING',
  'GENERAL',
  'EMERGENCY',
] as const;

export const WA_TEMPLATE_CATEGORIES = [
  'UTILITY',
  'MARKETING',
  'AUTHENTICATION',
] as const;

export const WA_LIBRARY_TEMPLATES: Array<{
  key: string;
  name: string;
  category: string;
  module: string;
  body: string;
  variables: Array<{
    position: number;
    token: string;
    erpField: string;
    sample: string;
  }>;
}> = [
  {
    key: 'fee_reminder',
    name: 'fee_reminder',
    category: 'UTILITY',
    module: 'FEES',
    body: 'Dear {{1}}, the fee of {{2}} for {{3}} is due on {{4}}. Please pay before the due date. — {{5}}',
    variables: [
      {
        position: 1,
        token: '{{1}}',
        erpField: 'parent_name',
        sample: 'Parent',
      },
      { position: 2, token: '{{2}}', erpField: 'fee_amount', sample: '₹3,600' },
      {
        position: 3,
        token: '{{3}}',
        erpField: 'fee_month',
        sample: 'September 2026',
      },
      {
        position: 4,
        token: '{{4}}',
        erpField: 'due_date',
        sample: '10 Sep 2026',
      },
      {
        position: 5,
        token: '{{5}}',
        erpField: 'school_name',
        sample: 'St. Luke’s',
      },
    ],
  },
  {
    key: 'fee_overdue',
    name: 'fee_overdue',
    category: 'UTILITY',
    module: 'FEES',
    body: 'Dear {{1}}, the fee of {{2}} for {{3}} is overdue. Please clear the outstanding amount. — {{4}}',
    variables: [
      {
        position: 1,
        token: '{{1}}',
        erpField: 'parent_name',
        sample: 'Parent',
      },
      { position: 2, token: '{{2}}', erpField: 'fee_amount', sample: '₹3,600' },
      {
        position: 3,
        token: '{{3}}',
        erpField: 'fee_month',
        sample: 'September 2026',
      },
      {
        position: 4,
        token: '{{4}}',
        erpField: 'school_name',
        sample: 'St. Luke’s',
      },
    ],
  },
  {
    key: 'payment_confirmation',
    name: 'payment_confirmation',
    category: 'UTILITY',
    module: 'FEES',
    body: 'Payment received. Student: {{1}}. Amount: {{2}}. Receipt: {{3}}. Thank you. — {{4}}',
    variables: [
      { position: 1, token: '{{1}}', erpField: 'student_name', sample: 'John' },
      { position: 2, token: '{{2}}', erpField: 'fee_amount', sample: '₹3,600' },
      {
        position: 3,
        token: '{{3}}',
        erpField: 'receipt_no',
        sample: 'RCPT/2026/001',
      },
      {
        position: 4,
        token: '{{4}}',
        erpField: 'school_name',
        sample: 'St. Luke’s',
      },
    ],
  },
  {
    key: 'student_absent',
    name: 'student_absent',
    category: 'UTILITY',
    module: 'ATTENDANCE',
    body: 'Dear {{1}}, {{2}} (Class {{3}}) was marked absent today ({{4}}). Please contact the school if this is unexpected.',
    variables: [
      {
        position: 1,
        token: '{{1}}',
        erpField: 'parent_name',
        sample: 'Parent',
      },
      { position: 2, token: '{{2}}', erpField: 'student_name', sample: 'John' },
      {
        position: 3,
        token: '{{3}}',
        erpField: 'class_section',
        sample: 'VIII A',
      },
      { position: 4, token: '{{4}}', erpField: 'date', sample: '16 Sep 2026' },
    ],
  },
  {
    key: 'exam_reminder',
    name: 'exam_reminder',
    category: 'UTILITY',
    module: 'EXAMS',
    body: 'Reminder: {{1}} for {{2}} starts on {{3}}. Please ensure {{4}} is prepared.',
    variables: [
      {
        position: 1,
        token: '{{1}}',
        erpField: 'exam_name',
        sample: 'First Term',
      },
      {
        position: 2,
        token: '{{2}}',
        erpField: 'class_section',
        sample: 'VIII A',
      },
      {
        position: 3,
        token: '{{3}}',
        erpField: 'exam_date',
        sample: '20 Sep 2026',
      },
      { position: 4, token: '{{4}}', erpField: 'student_name', sample: 'John' },
    ],
  },
  {
    key: 'result_published',
    name: 'result_published',
    category: 'UTILITY',
    module: 'EXAMS',
    body: 'Results for {{1}} are published. Student: {{2}}. Please view the report card in the parent portal.',
    variables: [
      {
        position: 1,
        token: '{{1}}',
        erpField: 'exam_name',
        sample: 'First Term',
      },
      { position: 2, token: '{{2}}', erpField: 'student_name', sample: 'John' },
    ],
  },
  {
    key: 'application_received',
    name: 'application_received',
    category: 'UTILITY',
    module: 'ADMISSIONS',
    body: 'We have received application {{1}} for {{2}}. We will update you on the next steps. — {{3}}',
    variables: [
      {
        position: 1,
        token: '{{1}}',
        erpField: 'application_no',
        sample: 'APP/2026/0001',
      },
      {
        position: 2,
        token: '{{2}}',
        erpField: 'applicant_name',
        sample: 'Jane',
      },
      {
        position: 3,
        token: '{{3}}',
        erpField: 'school_name',
        sample: 'St. Luke’s',
      },
    ],
  },
  {
    key: 'bus_delay',
    name: 'bus_delay',
    category: 'UTILITY',
    module: 'TRANSPORT',
    body: 'Transport update: Route {{1}} is delayed. Expected at {{2}} around {{3}}. — {{4}}',
    variables: [
      {
        position: 1,
        token: '{{1}}',
        erpField: 'route_name',
        sample: 'Route 03',
      },
      {
        position: 2,
        token: '{{2}}',
        erpField: 'stop_name',
        sample: 'Araimile',
      },
      { position: 3, token: '{{3}}', erpField: 'eta', sample: '7:50 AM' },
      {
        position: 4,
        token: '{{4}}',
        erpField: 'school_name',
        sample: 'St. Luke’s',
      },
    ],
  },
  {
    key: 'holiday_announcement',
    name: 'holiday_announcement',
    category: 'UTILITY',
    module: 'CALENDAR',
    body: '{{1}} will remain closed on {{2}} ({{3}}). Classes resume on {{4}}.',
    variables: [
      {
        position: 1,
        token: '{{1}}',
        erpField: 'school_name',
        sample: 'St. Luke’s',
      },
      {
        position: 2,
        token: '{{2}}',
        erpField: 'holiday_date',
        sample: '2 Oct 2026',
      },
      {
        position: 3,
        token: '{{3}}',
        erpField: 'holiday_name',
        sample: 'Gandhi Jayanti',
      },
      {
        position: 4,
        token: '{{4}}',
        erpField: 'resume_date',
        sample: '3 Oct 2026',
      },
    ],
  },
  {
    key: 'school_announcement',
    name: 'school_announcement',
    category: 'UTILITY',
    module: 'GENERAL',
    body: '{{1}}: {{2}}',
    variables: [
      {
        position: 1,
        token: '{{1}}',
        erpField: 'school_name',
        sample: 'St. Luke’s',
      },
      {
        position: 2,
        token: '{{2}}',
        erpField: 'announcement',
        sample: 'Please attend PTM on Friday.',
      },
    ],
  },
];

export const WA_DEFAULT_AUTOMATIONS = [
  {
    name: 'Fees enquiry',
    trigger: 'KEYWORD',
    matchValue: 'fees',
    action: 'REPLY_TEXT',
    replyText:
      'For fee dues and receipts, please visit the school office or use the Pay Fees button when a fee reminder is sent. Type OFFICE to speak with a staff member.',
    escalateTo: 'ACCOUNTS',
    category: 'FEES',
  },
  {
    name: 'Receipt enquiry',
    trigger: 'KEYWORD',
    matchValue: 'receipt',
    action: 'ERP_RECEIPT',
    replyText:
      'We will look up the latest receipt. Type OFFICE for a staff member.',
    escalateTo: 'ACCOUNTS',
    category: 'FEES',
  },
  {
    name: 'Attendance enquiry',
    trigger: 'KEYWORD',
    matchValue: 'attendance',
    action: 'REPLY_TEXT',
    replyText:
      'Attendance summaries are shared by the class teacher. Type OFFICE to reach the school office.',
    escalateTo: 'OFFICE',
    category: 'ATTENDANCE',
  },
  {
    name: 'Human escalation',
    trigger: 'KEYWORD',
    matchValue: 'office',
    action: 'ESCALATE',
    replyText:
      'A staff member will follow up. You can also call the school office during working hours.',
    escalateTo: 'OFFICE',
    category: 'GENERAL',
  },
];

export const WA_FLOW_KINDS = [
  'PARENT_FEEDBACK',
  'PTM_CONFIRMATION',
  'ADMISSION_INFO',
  'TRANSPORT_REQUEST',
  'CONTACT_UPDATE',
  'APPOINTMENT_REQUEST',
] as const;
