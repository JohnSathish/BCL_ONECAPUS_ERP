import type { CommunicationTemplateDto } from '../dto/communication.dto';
import {
  emailCtaButton,
  emailGreeting,
  emailInfoRows,
} from '../utils/email-template-helpers';

function studentCard() {
  return emailInfoRows([
    { label: 'Student Name', value: '{{student_name}}' },
    { label: 'Roll Number', value: '{{roll_number}}' },
    { label: 'Department', value: '{{department}}' },
    { label: 'Semester', value: '{{semester}}' },
    { label: 'Academic Year', value: '{{academic_year}}' },
  ]);
}

const V = {
  student: [
    'student_name',
    'roll_number',
    'department',
    'programme',
    'semester',
    'academic_year',
    'institution_name',
    'login_url',
  ],
  fee: [
    'student_name',
    'roll_number',
    'fee_amount',
    'receipt_number',
    'payment_date',
    'institution_name',
    'login_url',
  ],
  staff: ['staff_name', 'department', 'institution_name', 'login_url'],
  parent: [
    'parent_name',
    'student_name',
    'roll_number',
    'department',
    'institution_name',
    'login_url',
  ],
  admin: ['institution_name', 'login_url'],
};

/** Default catalog — codes are stable; bodyHtml is card/CTA style for branded shell. */
export const DEFAULT_COMMUNICATION_TEMPLATES: CommunicationTemplateDto[] = [
  // —— Existing admissions / recruitment / system (upgraded HTML) ——
  {
    code: 'ADMISSION_SUBMITTED',
    name: 'Admission Application Submitted',
    category: 'ADMISSIONS',
    subject: 'Application received — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">We have received your admission application.</p>
${emailInfoRows([
  { label: 'Application No.', value: '{{application_number}}' },
  { label: 'Programme', value: '{{program_name}}' },
])}
${emailCtaButton('Track Application')}`,
    bodyText:
      'Dear {{student_name}}, your application {{application_number}} for {{program_name}} has been received.',
    variables: [
      'student_name',
      'application_number',
      'program_name',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'ADMISSION_REJECTED',
    name: 'Admission Application Rejected',
    category: 'ADMISSIONS',
    subject: 'Application update — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">We regret to inform you that your application was not successful at this time.</p>
${emailInfoRows([{ label: 'Application No.', value: '{{application_number}}' }])}
${emailCtaButton('View Details')}`,
    bodyText:
      'Dear {{student_name}}, your application {{application_number}} was not successful.',
    variables: [
      'student_name',
      'application_number',
      'program_name',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'ADMISSION_CONFIRMATION',
    name: 'Admission Confirmation',
    category: 'ADMISSIONS',
    subject: 'Admission confirmed — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Your admission has been confirmed. Welcome to {{institution_name}}.</p>
${emailInfoRows([
  { label: 'Programme', value: '{{program_name}}' },
  { label: 'Application No.', value: '{{application_number}}' },
])}
${emailCtaButton('Login to ERP')}`,
    bodyText:
      'Dear {{student_name}}, your admission to {{program_name}} has been confirmed.',
    variables: [
      'student_name',
      'program_name',
      'application_number',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'APPLICANT_REGISTERED',
    name: 'Applicant Registration',
    category: 'ADMISSIONS',
    subject: 'Your application number — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Your applicant account is ready.</p>
${emailInfoRows([
  { label: 'Application No.', value: '{{application_number}}' },
  { label: 'Temporary Password', value: '{{temp_password}}' },
])}
${emailCtaButton('Complete Application')}`,
    bodyText:
      'Dear {{student_name}}, application number {{application_number}}. Password: {{temp_password}}',
    variables: [
      'student_name',
      'application_number',
      'temp_password',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'SMS', 'IN_APP'],
  },
  {
    code: 'APPLICATION_SUBMITTED',
    name: 'Application Submitted',
    category: 'ADMISSIONS',
    subject: 'Application submitted — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Your application has been submitted successfully.</p>
${emailInfoRows([{ label: 'Application No.', value: '{{application_number}}' }])}
${emailCtaButton('View Status')}`,
    bodyText:
      'Dear {{student_name}}, application {{application_number}} was submitted.',
    variables: [
      'student_name',
      'application_number',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'APPLICANT_PASSWORD_RESET',
    name: 'Applicant Password Reset',
    category: 'ADMISSIONS',
    subject: 'Password reset — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Use the link below to reset your password. If you did not request this, ignore this email.</p>
${emailCtaButton('Reset Password', '{{login_url}}')}`,
    bodyText: 'Reset your password: {{login_url}}',
    variables: ['student_name', 'institution_name', 'login_url'],
    channels: ['EMAIL'],
  },
  {
    code: 'APPLICATION_STATUS_CHANGED',
    name: 'Application Status Changed',
    category: 'ADMISSIONS',
    subject: 'Application status update — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Your application status has been updated.</p>
${emailInfoRows([{ label: 'Application No.', value: '{{application_number}}' }])}
${emailCtaButton('View Application')}`,
    bodyText: 'Application {{application_number}} status updated.',
    variables: [
      'student_name',
      'application_number',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'FEE_REMINDER',
    name: 'Fee Reminder',
    category: 'FEES',
    subject: 'Fee payment reminder — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">This is a reminder for your pending fee payment.</p>
${emailInfoRows([
  { label: 'Amount Due', value: '{{fee_amount}}' },
  { label: 'Due Date', value: '{{due_date}}' },
  { label: 'Roll Number', value: '{{roll_number}}' },
])}
${emailCtaButton('Pay Fee')}`,
    bodyText:
      'Fee reminder: {{fee_amount}} due by {{due_date}} for {{student_name}}.',
    variables: [
      'student_name',
      'roll_number',
      'fee_amount',
      'due_date',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'SMS', 'IN_APP'],
  },
  {
    code: 'FEE_RECEIPT',
    name: 'Fee Payment Receipt',
    category: 'FEES',
    subject: 'Fee receipt {{receipt_number}} — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Your fee payment was successful. Please find the receipt details below.</p>
${emailInfoRows([
  { label: 'Receipt No.', value: '{{receipt_number}}' },
  { label: 'Amount Paid', value: '{{fee_amount}}' },
  { label: 'Payment Date', value: '{{payment_date}}' },
  { label: 'Roll Number', value: '{{roll_number}}' },
])}
${emailCtaButton('View Receipt')}`,
    bodyText:
      'Payment of {{fee_amount}} received. Receipt {{receipt_number}} dated {{payment_date}}.',
    variables: V.fee,
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'TIMETABLE_PUBLISHED',
    name: 'Timetable Published',
    category: 'ACADEMICS',
    subject: 'Timetable update — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">A new timetable has been published for your class.</p>
${studentCard()}
${emailCtaButton('View Timetable')}`,
    bodyText: 'Timetable published for {{student_name}} ({{roll_number}}).',
    variables: V.student,
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'EXAM_RESULTS_PUBLISHED',
    name: 'Examination Result Published',
    category: 'EXAMINATIONS',
    subject: 'Results published — {{examination_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Examination results are now available.</p>
${emailInfoRows([
  { label: 'Examination', value: '{{examination_name}}' },
  { label: 'Roll Number', value: '{{roll_number}}' },
])}
${emailCtaButton('View Result')}`,
    bodyText: 'Results for {{examination_name}} are available.',
    variables: [
      'student_name',
      'roll_number',
      'examination_name',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'EXAM_NOTICE',
    name: 'Examination Notice',
    category: 'EXAMINATIONS',
    subject: 'Examination notice — {{examination_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Please note the following examination announcement.</p>
${emailInfoRows([{ label: 'Examination', value: '{{examination_name}}' }])}
${emailCtaButton('View Details')}`,
    bodyText: 'Examination notice: {{examination_name}}.',
    variables: [
      'student_name',
      'examination_name',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'CERTIFICATE_READY',
    name: 'Certificate Ready',
    category: 'GENERAL',
    subject: 'Certificate ready — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Your requested certificate is ready.</p>
${studentCard()}
${emailCtaButton('Download Certificate')}`,
    bodyText: 'Your certificate is ready for download.',
    variables: V.student,
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LIBRARY_OVERDUE',
    name: 'Library Due Reminder',
    category: 'LIBRARY',
    subject: 'Library overdue reminder — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">You have overdue library items.</p>
${emailInfoRows([
  { label: 'Fine', value: '{{library_fine}}' },
  { label: 'Due Date', value: '{{due_date}}' },
])}
${emailCtaButton('View Library Account')}`,
    bodyText: 'Library overdue. Fine {{library_fine}}. Due {{due_date}}.',
    variables: [
      'student_name',
      'library_fine',
      'due_date',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LIBRARY_RESERVATION_READY',
    name: 'Library Reservation Ready',
    category: 'LIBRARY',
    subject: 'Reserved book ready — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Your reserved item is ready for pickup.</p>
${emailCtaButton('View Reservation')}`,
    bodyText: 'Your library reservation is ready.',
    variables: ['student_name', 'institution_name', 'login_url'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'TRANSPORT_ASSIGNED',
    name: 'Transport Assigned',
    category: 'TRANSPORT',
    subject: 'Transport assignment — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Transport has been assigned to your account.</p>
${emailCtaButton('View Transport')}`,
    bodyText: 'Transport assigned.',
    variables: ['student_name', 'institution_name', 'login_url'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'TRANSPORT_CANCELLED',
    name: 'Transport Cancelled',
    category: 'TRANSPORT',
    subject: 'Transport cancelled — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Your transport assignment has been cancelled.</p>
${emailCtaButton('Login to ERP')}`,
    bodyText: 'Transport cancelled.',
    variables: ['student_name', 'institution_name', 'login_url'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'TRANSPORT_CAPACITY_WARNING',
    name: 'Transport Capacity Warning',
    category: 'TRANSPORT',
    subject: 'Transport capacity warning — {{institution_name}}',
    bodyHtml: `<p style="margin:0 0 12px;color:#334155;">Dear administrator,</p>
<p style="margin:0 0 12px;color:#334155;">A transport route is nearing capacity.</p>
${emailCtaButton('Open Transport Module')}`,
    bodyText: 'Transport capacity warning.',
    variables: V.admin,
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'GENERAL_ANNOUNCEMENT',
    name: 'General Announcement',
    category: 'GENERAL',
    subject: 'Announcement — {{institution_name}}',
    bodyHtml: `${emailGreeting('{{student_name}}')}
<p style="margin:0 0 12px;color:#334155;">Please read this important announcement from {{institution_name}}.</p>
${emailCtaButton('Open Portal')}`,
    bodyText: 'Announcement from {{institution_name}}.',
    variables: ['student_name', 'institution_name', 'login_url'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'BACKUP_SUCCESS',
    name: 'Backup Success',
    category: 'ADMIN',
    subject: 'Backup completed - {{institution_name}}',
    bodyHtml: `<p style="margin:0 0 12px;color:#334155;">Dear administrator,</p>
<p style="margin:0 0 12px;color:#334155;">The scheduled backup completed successfully.</p>
${emailInfoRows([
  { label: 'Type', value: '{{backup_type}}' },
  { label: 'Completed', value: '{{completed_at}}' },
  { label: 'Size (bytes)', value: '{{size_bytes}}' },
  { label: 'Run ID', value: '{{run_id}}' },
])}
${emailCtaButton('View Backup Status')}`,
    bodyText:
      'Backup {{backup_type}} completed at {{completed_at}}. Size: {{size_bytes}}. Run: {{run_id}}',
    variables: [
      'institution_name',
      'backup_type',
      'completed_at',
      'size_bytes',
      'run_id',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'BACKUP_FAILED',
    name: 'Backup Failed',
    category: 'ADMIN',
    subject: 'Backup failed - {{institution_name}}',
    bodyHtml: `<p style="margin:0 0 12px;color:#334155;">Dear administrator,</p>
<p style="margin:0 0 12px;color:#b91c1c;font-weight:600;">The scheduled backup failed.</p>
${emailInfoRows([
  { label: 'Type', value: '{{backup_type}}' },
  { label: 'Error', value: '{{error_message}}' },
  { label: 'Run ID', value: '{{run_id}}' },
])}
${emailCtaButton('Investigate')}`,
    bodyText:
      'Backup {{backup_type}} failed at {{completed_at}}. Error: {{error_message}}. Run: {{run_id}}',
    variables: [
      'institution_name',
      'backup_type',
      'completed_at',
      'error_message',
      'run_id',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LICENSE_EXPIRY_60',
    name: 'License Expiry (60 days)',
    category: 'ADMIN',
    subject: 'License expires in 60 days — {{institution_name}}',
    bodyHtml: `<p style="margin:0 0 12px;color:#334155;">Dear administrator,</p>
<p style="margin:0 0 12px;color:#334155;">Your ERP license expires on {{expiry_date}} ({{days_remaining}} days remaining).</p>
${emailCtaButton('Manage License')}`,
    bodyText: 'License expires {{expiry_date}} ({{days_remaining}} days).',
    variables: [
      'institution_name',
      'expiry_date',
      'days_remaining',
      'renewal_contact',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LICENSE_EXPIRY_30',
    name: 'License Expiry (30 days)',
    category: 'ADMIN',
    subject: 'License expires in 30 days — {{institution_name}}',
    bodyHtml: `<p style="margin:0 0 12px;color:#334155;">Dear administrator,</p>
<p style="margin:0 0 12px;color:#334155;">Your ERP license expires on {{expiry_date}} ({{days_remaining}} days remaining).</p>
${emailCtaButton('Manage License')}`,
    bodyText: 'License expires {{expiry_date}} ({{days_remaining}} days).',
    variables: [
      'institution_name',
      'expiry_date',
      'days_remaining',
      'renewal_contact',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LICENSE_EXPIRY_15',
    name: 'License Expiry (15 days)',
    category: 'ADMIN',
    subject: 'License expires in 15 days — {{institution_name}}',
    bodyHtml: `<p style="margin:0 0 12px;color:#334155;">Dear administrator,</p>
<p style="margin:0 0 12px;color:#b45309;font-weight:600;">Your ERP license expires on {{expiry_date}} ({{days_remaining}} days remaining).</p>
${emailCtaButton('Renew Now')}`,
    bodyText: 'License expires {{expiry_date}} ({{days_remaining}} days).',
    variables: [
      'institution_name',
      'expiry_date',
      'days_remaining',
      'renewal_contact',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LICENSE_EXPIRY_7',
    name: 'License Expiry (7 days)',
    category: 'ADMIN',
    subject: 'Critical: ERP license expires in 7 days — {{institution_name}}',
    bodyHtml: `<p style="margin:0 0 12px;color:#334155;">Dear administrator,</p>
<p style="margin:0 0 12px;color:#b91c1c;font-weight:700;">Critical: license expires on {{expiry_date}} ({{days_remaining}} days). Contact {{renewal_contact}}.</p>
${emailCtaButton('Contact Support')}`,
    bodyText:
      'Critical: License for {{institution_name}} expires {{expiry_date}}. Contact {{renewal_contact}}.',
    variables: [
      'institution_name',
      'expiry_date',
      'days_remaining',
      'renewal_contact',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'LICENSE_EXPIRY_0',
    name: 'License Expired',
    category: 'ADMIN',
    subject: 'ERP license expired — {{institution_name}}',
    bodyHtml: `<p style="margin:0 0 12px;color:#334155;">Dear administrator,</p>
<p style="margin:0 0 12px;color:#b91c1c;font-weight:700;">Your ERP license expired on {{expiry_date}}. Contact {{renewal_contact}} immediately.</p>
${emailCtaButton('Restore Access')}`,
    bodyText:
      'License for {{institution_name}} has expired. Contact {{renewal_contact}}.',
    variables: [
      'institution_name',
      'expiry_date',
      'days_remaining',
      'renewal_contact',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },

  // —— STUDENT catalog ——
  {
    code: 'STUDENT_WELCOME',
    name: 'Student Welcome Email',
    category: 'STUDENT',
    subject: 'Welcome to {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Welcome to the OneCampus student portal. Your account is ready.</p>
${studentCard()}
${emailCtaButton('Login to ERP')}`,
    bodyText:
      'Welcome {{student_name}}. Login with roll number {{roll_number}}.',
    variables: V.student,
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STUDENT_ACCOUNT_CREATED',
    name: 'Student Account Created',
    category: 'STUDENT',
    subject: 'Your student account — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Your student login has been created. Use your college roll number as username. Default password is your roll number until you change it.</p>
${studentCard()}
${emailCtaButton('Complete First Login')}`,
    bodyText:
      'Account created for {{student_name}}. Username/password: {{roll_number}}.',
    variables: V.student,
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STUDENT_PASSWORD_RESET',
    name: 'Student Password Reset',
    category: 'STUDENT',
    subject: 'Password reset — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Your password was reset by the college office. Sign in and set a new password immediately.</p>
${emailInfoRows([{ label: 'Roll Number', value: '{{roll_number}}' }])}
${emailCtaButton('Login to ERP')}`,
    bodyText: 'Password reset for {{roll_number}}. Login and change password.',
    variables: ['student_name', 'roll_number', 'institution_name', 'login_url'],
    channels: ['EMAIL'],
  },
  {
    code: 'STUDENT_PROFILE_REMINDER',
    name: 'Profile Update Reminder',
    category: 'STUDENT',
    subject: 'Complete your profile — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Please complete your student profile to unlock full portal services.</p>
${studentCard()}
${emailCtaButton('Complete Profile')}`,
    bodyText: 'Please complete your profile, {{student_name}}.',
    variables: V.student,
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STUDENT_SEMESTER_REGISTRATION',
    name: 'Semester Registration',
    category: 'STUDENT',
    subject: 'Semester registration open — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Semester registration is now open.</p>
${studentCard()}
${emailCtaButton('Register Now')}`,
    bodyText: 'Semester registration is open for {{student_name}}.',
    variables: V.student,
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STUDENT_EXAM_REGISTRATION',
    name: 'Examination Registration',
    category: 'STUDENT',
    subject: 'Exam registration — {{examination_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Examination registration is available.</p>
${emailInfoRows([
  { label: 'Examination', value: '{{examination_name}}' },
  { label: 'Roll Number', value: '{{roll_number}}' },
])}
${emailCtaButton('Register for Exam')}`,
    bodyText: 'Register for {{examination_name}}.',
    variables: [
      'student_name',
      'roll_number',
      'examination_name',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STUDENT_HALL_TICKET',
    name: 'Hall Ticket Ready',
    category: 'STUDENT',
    subject: 'Hall ticket ready — {{examination_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Your hall ticket is ready to download.</p>
${emailInfoRows([
  { label: 'Examination', value: '{{examination_name}}' },
  { label: 'Roll Number', value: '{{roll_number}}' },
])}
${emailCtaButton('Download Hall Ticket')}`,
    bodyText: 'Hall ticket ready for {{examination_name}}.',
    variables: [
      'student_name',
      'roll_number',
      'examination_name',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STUDENT_ATTENDANCE_WARNING',
    name: 'Attendance Warning',
    category: 'STUDENT',
    subject: 'Attendance alert — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#b45309;font-weight:600;">Your attendance requires attention.</p>
${emailInfoRows([
  { label: 'Attendance', value: '{{attendance_percent}}' },
  { label: 'Roll Number', value: '{{roll_number}}' },
  { label: 'Department', value: '{{department}}' },
])}
${emailCtaButton('View Attendance')}`,
    bodyText: 'Attendance alert for {{student_name}}: {{attendance_percent}}.',
    variables: [
      'student_name',
      'roll_number',
      'department',
      'attendance_percent',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STUDENT_HOLIDAY_NOTICE',
    name: 'Holiday Notice',
    category: 'STUDENT',
    subject: 'Holiday notice — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Please note the holiday announcement from the college.</p>
${emailInfoRows([{ label: 'Notice', value: '{{circular_title}}' }])}
${emailCtaButton('View Notice')}`,
    bodyText: 'Holiday notice: {{circular_title}}.',
    variables: [
      'student_name',
      'circular_title',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STUDENT_EVENT_INVITATION',
    name: 'Event Invitation',
    category: 'STUDENT',
    subject: 'You are invited — {{circular_title}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">You are invited to an upcoming campus event.</p>
${emailInfoRows([{ label: 'Event', value: '{{circular_title}}' }])}
${emailCtaButton('View Event')}`,
    bodyText: 'Event invitation: {{circular_title}}.',
    variables: [
      'student_name',
      'circular_title',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STUDENT_ID_CARD_READY',
    name: 'ID Card Ready',
    category: 'STUDENT',
    subject: 'ID card ready — {{institution_name}}',
    bodyHtml: `${emailGreeting()}
<p style="margin:0 0 12px;color:#334155;">Your student ID card is ready.</p>
${studentCard()}
${emailCtaButton('View ID Card')}`,
    bodyText: 'ID card ready for {{student_name}}.',
    variables: V.student,
    channels: ['EMAIL', 'IN_APP'],
  },

  // —— STAFF ——
  {
    code: 'STAFF_ACCOUNT_CREATED',
    name: 'Staff Account Created',
    category: 'STAFF',
    subject: 'Staff portal account — {{institution_name}}',
    bodyHtml: `${emailGreeting('{{staff_name}}')}
<p style="margin:0 0 12px;color:#334155;">Your staff portal account has been created.</p>
${emailInfoRows([{ label: 'Department', value: '{{department}}' }])}
${emailCtaButton('Login to ERP')}`,
    bodyText: 'Staff account created for {{staff_name}}.',
    variables: V.staff,
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STAFF_PASSWORD_RESET',
    name: 'Staff Password Reset',
    category: 'STAFF',
    subject: 'Password reset — {{institution_name}}',
    bodyHtml: `${emailGreeting('{{staff_name}}')}
<p style="margin:0 0 12px;color:#334155;">Your password was reset. Sign in and choose a new password.</p>
${emailCtaButton('Login to ERP')}`,
    bodyText: 'Password reset for {{staff_name}}.',
    variables: V.staff,
    channels: ['EMAIL'],
  },
  {
    code: 'STAFF_LEAVE_APPROVAL',
    name: 'Leave Approval',
    category: 'STAFF',
    subject: 'Leave {{leave_status}} — {{institution_name}}',
    bodyHtml: `${emailGreeting('{{staff_name}}')}
<p style="margin:0 0 12px;color:#334155;">Your leave request status has been updated.</p>
${emailInfoRows([{ label: 'Status', value: '{{leave_status}}' }])}
${emailCtaButton('View Leave')}`,
    bodyText: 'Leave {{leave_status}} for {{staff_name}}.',
    variables: [
      'staff_name',
      'leave_status',
      'department',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STAFF_SALARY_SLIP',
    name: 'Salary Slip',
    category: 'STAFF',
    subject: 'Salary slip available — {{institution_name}}',
    bodyHtml: `${emailGreeting('{{staff_name}}')}
<p style="margin:0 0 12px;color:#334155;">Your salary slip is available in the staff portal.</p>
${emailCtaButton('View Salary Slip')}`,
    bodyText: 'Salary slip available for {{staff_name}}.',
    variables: V.staff,
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STAFF_TIMETABLE_UPDATE',
    name: 'Staff Timetable Update',
    category: 'STAFF',
    subject: 'Timetable update — {{institution_name}}',
    bodyHtml: `${emailGreeting('{{staff_name}}')}
<p style="margin:0 0 12px;color:#334155;">Your teaching timetable has been updated.</p>
${emailCtaButton('View Timetable')}`,
    bodyText: 'Timetable updated for {{staff_name}}.',
    variables: V.staff,
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STAFF_MEETING_NOTIFICATION',
    name: 'Meeting Notification',
    category: 'STAFF',
    subject: 'Meeting: {{meeting_title}}',
    bodyHtml: `${emailGreeting('{{staff_name}}')}
<p style="margin:0 0 12px;color:#334155;">You have a meeting invitation.</p>
${emailInfoRows([
  { label: 'Meeting', value: '{{meeting_title}}' },
  { label: 'When', value: '{{meeting_datetime}}' },
])}
${emailCtaButton('View Meeting')}`,
    bodyText: 'Meeting {{meeting_title}} at {{meeting_datetime}}.',
    variables: [
      'staff_name',
      'meeting_title',
      'meeting_datetime',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STAFF_CIRCULAR',
    name: 'Staff Circular',
    category: 'STAFF',
    subject: 'Circular — {{circular_title}}',
    bodyHtml: `${emailGreeting('{{staff_name}}')}
<p style="margin:0 0 12px;color:#334155;">A new circular has been published.</p>
${emailInfoRows([{ label: 'Circular', value: '{{circular_title}}' }])}
${emailCtaButton('Read Circular')}`,
    bodyText: 'Circular: {{circular_title}}.',
    variables: [
      'staff_name',
      'circular_title',
      'institution_name',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'STAFF_ATTENDANCE_SUMMARY',
    name: 'Staff Attendance Summary',
    category: 'STAFF',
    subject: 'Attendance summary — {{institution_name}}',
    bodyHtml: `${emailGreeting('{{staff_name}}')}
<p style="margin:0 0 12px;color:#334155;">Your attendance summary is ready.</p>
${emailCtaButton('View Summary')}`,
    bodyText: 'Attendance summary for {{staff_name}}.',
    variables: V.staff,
    channels: ['EMAIL', 'IN_APP'],
  },

  // —— PARENT ——
  {
    code: 'PARENT_ATTENDANCE_ALERT',
    name: 'Student Attendance Alert',
    category: 'PARENT',
    subject: 'Attendance alert for {{student_name}}',
    bodyHtml: `${emailGreeting('{{parent_name}}')}
<p style="margin:0 0 12px;color:#334155;">This is an attendance update for your ward.</p>
${emailInfoRows([
  { label: 'Student', value: '{{student_name}}' },
  { label: 'Roll Number', value: '{{roll_number}}' },
  { label: 'Attendance', value: '{{attendance_percent}}' },
])}
${emailCtaButton('View Details')}`,
    bodyText:
      'Attendance for {{student_name}} ({{roll_number}}): {{attendance_percent}}.',
    variables: [...V.parent, 'attendance_percent'],
    channels: ['EMAIL', 'SMS', 'IN_APP'],
  },
  {
    code: 'PARENT_FEE_REMINDER',
    name: 'Parent Fee Reminder',
    category: 'PARENT',
    subject: 'Fee reminder for {{student_name}}',
    bodyHtml: `${emailGreeting('{{parent_name}}')}
<p style="margin:0 0 12px;color:#334155;">A fee payment is pending for your ward.</p>
${emailInfoRows([
  { label: 'Student', value: '{{student_name}}' },
  { label: 'Amount', value: '{{fee_amount}}' },
  { label: 'Due Date', value: '{{due_date}}' },
])}
${emailCtaButton('Pay Fee')}`,
    bodyText: 'Fee {{fee_amount}} due for {{student_name}} by {{due_date}}.',
    variables: [...V.parent, 'fee_amount', 'due_date'],
    channels: ['EMAIL', 'SMS', 'IN_APP'],
  },
  {
    code: 'PARENT_EXAM_NOTICE',
    name: 'Parent Examination Notice',
    category: 'PARENT',
    subject: 'Exam notice — {{examination_name}}',
    bodyHtml: `${emailGreeting('{{parent_name}}')}
<p style="margin:0 0 12px;color:#334155;">Examination information for your ward.</p>
${emailInfoRows([
  { label: 'Student', value: '{{student_name}}' },
  { label: 'Examination', value: '{{examination_name}}' },
])}
${emailCtaButton('View Notice')}`,
    bodyText: 'Exam notice for {{student_name}}: {{examination_name}}.',
    variables: [...V.parent, 'examination_name'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'PARENT_RESULT_NOTIFICATION',
    name: 'Parent Result Notification',
    category: 'PARENT',
    subject: 'Result published for {{student_name}}',
    bodyHtml: `${emailGreeting('{{parent_name}}')}
<p style="margin:0 0 12px;color:#334155;">Examination results are available for your ward.</p>
${emailInfoRows([
  { label: 'Student', value: '{{student_name}}' },
  { label: 'Examination', value: '{{examination_name}}' },
])}
${emailCtaButton('View Result')}`,
    bodyText: 'Results published for {{student_name}}.',
    variables: [...V.parent, 'examination_name'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'PARENT_MEETING_INVITATION',
    name: 'Parent Meeting Invitation',
    category: 'PARENT',
    subject: 'Parent meeting — {{meeting_title}}',
    bodyHtml: `${emailGreeting('{{parent_name}}')}
<p style="margin:0 0 12px;color:#334155;">You are invited to a parent meeting.</p>
${emailInfoRows([
  { label: 'Meeting', value: '{{meeting_title}}' },
  { label: 'When', value: '{{meeting_datetime}}' },
  { label: 'Student', value: '{{student_name}}' },
])}
${emailCtaButton('View Invitation')}`,
    bodyText: 'Parent meeting {{meeting_title}} on {{meeting_datetime}}.',
    variables: [...V.parent, 'meeting_title', 'meeting_datetime'],
    channels: ['EMAIL', 'IN_APP'],
  },

  // —— ADMIN ——
  {
    code: 'ADMIN_DAILY_REPORT',
    name: 'Daily Reports',
    category: 'ADMIN',
    subject: 'Daily report — {{institution_name}}',
    bodyHtml: `<p style="margin:0 0 12px;color:#334155;">Dear administrator,</p>
<p style="margin:0 0 12px;color:#334155;">Here is today's operational summary.</p>
${emailInfoRows([{ label: 'Summary', value: '{{report_summary}}' }])}
${emailCtaButton('Open Dashboard')}`,
    bodyText: 'Daily report: {{report_summary}}',
    variables: ['institution_name', 'report_summary', 'login_url'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'ADMIN_PAYMENT_SUCCESS',
    name: 'Payment Success',
    category: 'ADMIN',
    subject: 'Payment success — {{receipt_number}}',
    bodyHtml: `<p style="margin:0 0 12px;color:#334155;">Dear administrator,</p>
<p style="margin:0 0 12px;color:#15803d;font-weight:600;">A payment completed successfully.</p>
${emailInfoRows([
  { label: 'Receipt', value: '{{receipt_number}}' },
  { label: 'Amount', value: '{{fee_amount}}' },
  { label: 'Date', value: '{{payment_date}}' },
])}
${emailCtaButton('View Payments')}`,
    bodyText: 'Payment success {{receipt_number}} {{fee_amount}}.',
    variables: [
      'institution_name',
      'receipt_number',
      'fee_amount',
      'payment_date',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'ADMIN_PAYMENT_FAILED',
    name: 'Failed Payments',
    category: 'ADMIN',
    subject: 'Payment failed — {{institution_name}}',
    bodyHtml: `<p style="margin:0 0 12px;color:#334155;">Dear administrator,</p>
<p style="margin:0 0 12px;color:#b91c1c;font-weight:600;">A payment attempt failed.</p>
${emailInfoRows([
  { label: 'Amount', value: '{{fee_amount}}' },
  { label: 'Date', value: '{{payment_date}}' },
])}
${emailCtaButton('Review Failed Payments')}`,
    bodyText: 'Payment failed {{fee_amount}} on {{payment_date}}.',
    variables: ['institution_name', 'fee_amount', 'payment_date', 'login_url'],
    channels: ['EMAIL', 'IN_APP'],
  },
  {
    code: 'ADMIN_SERVER_ALERT',
    name: 'Server Alerts',
    category: 'ADMIN',
    subject: 'Server alert — {{institution_name}}',
    bodyHtml: `<p style="margin:0 0 12px;color:#334155;">Dear administrator,</p>
<p style="margin:0 0 12px;color:#b91c1c;font-weight:700;">A server alert requires attention.</p>
${emailInfoRows([{ label: 'Details', value: '{{report_summary}}' }])}
${emailCtaButton('Open Admin')}`,
    bodyText: 'Server alert: {{report_summary}}',
    variables: ['institution_name', 'report_summary', 'login_url'],
    channels: ['EMAIL', 'IN_APP'],
  },

  // —— SHORT-TERM COURSES ——
  {
    code: 'SHORT_TERM_REGISTRATION_CONFIRMED',
    name: 'Short-Term Course Registration Confirmed',
    category: 'ACADEMIC',
    subject: 'Registration confirmed — {{course_name}}',
    bodyHtml: `${emailGreeting('{{student_name}}')}
<p style="margin:0 0 12px;color:#15803d;font-weight:600;">Your short-term course registration is confirmed.</p>
${emailInfoRows([
  { label: 'Course', value: '{{course_name}}' },
  { label: 'Batch', value: '{{batch_code}}' },
  { label: 'Status', value: '{{status}}' },
])}
${emailCtaButton('View My Learning')}`,
    bodyText:
      'Registration confirmed for {{course_name}} ({{batch_code}}). Status: {{status}}.',
    variables: [
      'institution_name',
      'student_name',
      'course_name',
      'batch_code',
      'status',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP', 'PUSH'],
  },
  {
    code: 'SHORT_TERM_CERTIFICATE_READY',
    name: 'Short-Term Course Certificate Ready',
    category: 'ACADEMIC',
    subject: 'Certificate ready — {{course_name}}',
    bodyHtml: `${emailGreeting('{{student_name}}')}
<p style="margin:0 0 12px;color:#15803d;font-weight:600;">Your completion certificate is ready to download.</p>
${emailInfoRows([
  { label: 'Course', value: '{{course_name}}' },
  { label: 'Certificate No.', value: '{{certificate_number}}' },
])}
${emailCtaButton('Download Certificate')}`,
    bodyText:
      'Certificate {{certificate_number}} for {{course_name}} is ready.',
    variables: [
      'institution_name',
      'student_name',
      'course_name',
      'certificate_number',
      'login_url',
    ],
    channels: ['EMAIL', 'IN_APP', 'PUSH'],
  },
];

export function findDefaultTemplateByCode(code: string) {
  return DEFAULT_COMMUNICATION_TEMPLATES.find(
    (t) => t.code === code.toUpperCase(),
  );
}
