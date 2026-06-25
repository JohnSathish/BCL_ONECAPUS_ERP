/** Admin command palette — real routes for Ctrl+K navigation */
export const ADMIN_COMMAND_LINKS = [
  { label: 'Operations dashboard', href: '/admin', keywords: 'home dashboard command center' },
  { label: 'Institution analytics', href: '/admin/analytics', keywords: 'reports charts kpi' },
  { label: 'Admissions', href: '/admin/admissions', keywords: 'applications intake' },
  { label: 'Students', href: '/admin/students', keywords: 'enrollment directory' },
  {
    label: 'Fee collection desk',
    href: '/admin/fees/collections',
    keywords: 'collect payment cash upi',
  },
  {
    label: 'Day closing report',
    href: '/admin/fees/day-closing',
    keywords: 'closing reconciliation eod',
  },
  { label: 'Cash register', href: '/admin/fees/cash-register', keywords: 'cash book' },
  { label: 'Fee defaulters', href: '/admin/fees/defaulters', keywords: 'outstanding dues pending' },
  {
    label: 'Financial reports',
    href: '/admin/fees/reports',
    keywords: 'finance export collection',
  },
  { label: 'Fee settings', href: '/admin/fees/settings', keywords: 'receipt template monthly' },
  { label: 'Monthly fee plans', href: '/admin/fees/monthly-plans', keywords: 'tuition plans' },
  {
    label: 'Mark attendance',
    href: '/admin/academics/attendance',
    keywords: 'attendance sessions',
  },
  { label: 'Timetable', href: '/admin/academics/timetable', keywords: 'schedule classes' },
  { label: 'Examinations', href: '/admin/academics/examinations', keywords: 'exams marks results' },
  { label: 'HR & staff', href: '/admin/hr', keywords: 'faculty employees leave' },
  { label: 'Library', href: '/admin/library', keywords: 'books circulation' },
  { label: 'Transport', href: '/admin/transport', keywords: 'bus routes' },
  { label: 'Hostel', href: '/admin/hostel', keywords: 'residence rooms' },
  {
    label: 'Staff attendance',
    href: '/admin/staff/attendance',
    keywords: 'biometric punch hr faculty',
  },
  {
    label: 'Live staff attendance',
    href: '/admin/staff/attendance/live',
    keywords: 'punch feed realtime',
  },
  {
    label: 'Biometric devices',
    href: '/admin/staff/attendance/devices',
    keywords: 'essl zk device sync',
  },
  { label: 'Settings', href: '/admin/organization', keywords: 'configuration' },
];

export const AI_QUICK_PROMPTS = [
  'How many students have pending fees?',
  "Show today's attendance summary",
  "Show today's staff absentees",
  'Which department has lowest staff attendance this month?',
  'Show missing OUT punches today',
  'Generate finance report',
  'List admission applications pending',
];
