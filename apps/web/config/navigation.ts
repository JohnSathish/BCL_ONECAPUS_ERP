import type { LucideIcon } from 'lucide-react';
import { IA_ADMIT_CARDS_ADMIN_ENABLED } from '@/lib/examinations/ia-feature-flags';
import { MODULE_PERMISSIONS } from '@/lib/permissions/permission-registry';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Fingerprint,
  GraduationCap,
  HelpCircle,
  Home,
  LayoutDashboard,
  Library,
  Mail,
  Megaphone,
  MessageSquare,
  Package,
  Settings,
  Shield,
  Ticket,
  TrendingUp,
  User,
  UserCheck,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';

export type NavChild = {
  label: string;
  href: string;
  /** Any-of permission slugs required to see this menu item */
  permissions?: string[];
  requireAllPermissions?: string[];
  /** RegExp source — marks item active for detail/sub-routes (e.g. student profile) */
  activePattern?: string;
};

export type NavItem = {
  label: string;
  href?: string;
  icon: LucideIcon;
  badge?: string;
  children?: NavChild[];
  soon?: boolean;
  module?: string;
  permissions?: string[];
  requireAllPermissions?: string[];
  /** RegExp source for top-level items without children */
  activePattern?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
  /** @deprecated Layout uses one scroll region; zone is ignored but kept for nav grouping docs */
  zone?: 'pin-top' | 'scroll' | 'pin-bottom';
};

export function isNavChildActive(pathname: string, child: NavChild, siblings: NavChild[]): boolean {
  if (pathname === child.href) return true;
  if (child.activePattern && new RegExp(child.activePattern).test(pathname)) {
    const ownedBySibling = siblings.some(
      (s) => s.href !== child.href && pathname.startsWith(s.href),
    );
    return !ownedBySibling;
  }
  return false;
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (item.href && pathname === item.href) return true;
  if (item.activePattern && new RegExp(item.activePattern).test(pathname)) return true;
  if (item.children?.length) {
    return item.children.some((c) => isNavChildActive(pathname, c, item.children ?? []));
  }
  return false;
}

const P = MODULE_PERMISSIONS;
const QB = P.questionBank;

const QUESTION_BANK_CHILDREN: NavChild[] = [
  { label: 'Dashboard', href: '/admin/academics/question-bank', permissions: [...QB] },
  {
    label: 'Previous Year Papers',
    href: '/admin/academics/question-bank/papers',
    permissions: [...QB],
  },
  {
    label: 'Upload Center',
    href: '/admin/academics/question-bank/upload',
    permissions: ['question-bank:contribute', 'question-bank:manage'],
  },
  {
    label: 'Faculty Workspace',
    href: '/admin/academics/question-bank/faculty',
    permissions: ['question-bank:contribute', 'question-bank:read'],
  },
  {
    label: 'Approval Workflow',
    href: '/admin/academics/question-bank/workflow',
    permissions: ['question-bank:approve', 'question-bank:publish', 'question-bank:manage'],
  },
  {
    label: 'Student Access',
    href: '/admin/academics/question-bank/student-access',
    permissions: ['question-bank:manage'],
  },
  {
    label: 'Reports',
    href: '/admin/academics/question-bank/reports',
    permissions: ['question-bank:reports', 'question-bank:manage'],
  },
  {
    label: 'Settings',
    href: '/admin/academics/question-bank/settings',
    permissions: ['question-bank:manage'],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    label: 'Dashboard',
    zone: 'pin-top',
    items: [
      {
        label: 'Dashboard',
        href: '/admin',
        icon: LayoutDashboard,
        module: 'dashboard',
        permissions: [...P.dashboard],
      },
      {
        label: 'Analytics',
        href: '/admin/analytics',
        icon: BarChart3,
        module: 'analytics',
        permissions: [...P.dashboard, 'reports:read'],
      },
    ],
  },
  {
    label: 'Student Lifecycle',
    zone: 'scroll',
    items: [
      {
        label: 'Students',
        icon: Users,
        href: '/admin/students',
        module: 'students',
        permissions: [...P.students],
        activePattern: '^/admin/students(?!/certificates)(?:/.*)?$',
        children: [
          {
            label: 'Student Directory',
            href: '/admin/students',
            permissions: ['students:read'],
            activePattern: '^/admin/students(?:/[0-9a-f-]{36}(?:/academic)?)?$',
          },
          {
            label: 'Admission Management',
            href: '/admin/admissions',
            permissions: [...P.admissions],
            activePattern: '^/admin/admissions',
          },
          { label: 'Add Student', href: '/admin/students/new', permissions: ['students:manage'] },
          {
            label: 'Academic Records',
            href: '/admin/students/subject-registration',
            permissions: ['students:manage-academic', 'students:manage'],
          },
          {
            label: 'Attendance',
            href: '/admin/academics/attendance',
            permissions: [...P.studentAttendance],
          },
          {
            label: 'Fee Management',
            href: '/admin/fees',
            permissions: [...P.finance],
          },
          {
            label: 'Certificates',
            href: '/admin/certificates',
            permissions: [...P.certificates],
          },
          {
            label: 'RFID / ABC ID',
            href: '/admin/students/rfid',
            permissions: ['students:manage'],
          },
          {
            label: 'Student Promotion',
            href: '/admin/students/promotion',
            permissions: ['students:manage', 'academic-lifecycle:manage'],
          },
          {
            label: 'Bulk Import',
            href: '/admin/students/import',
            permissions: ['students:import', 'students:manage'],
          },
          {
            label: 'Bulk Export',
            href: '/admin/students/export',
            permissions: ['students:export', 'students:manage'],
          },
          {
            label: 'Audit Logs',
            href: '/admin/students/audit',
            permissions: ['students:read', 'audit:read'],
          },
        ],
      },
      {
        label: 'Admissions',
        icon: UserCheck,
        module: 'admissions',
        permissions: [...P.admissions],
        activePattern: '^/admin/admissions',
        children: [
          { label: 'Control center', href: '/admin/admissions' },
          { label: 'Application form', href: '/admin/admissions/applications' },
          { label: 'Document verification', href: '/admin/admissions/documents' },
          { label: 'Payment verification', href: '/admin/admissions/payments' },
          { label: 'Admission fee verification', href: '/admin/admissions/admission-fees' },
          { label: 'Merit & selection', href: '/admin/admissions/merit' },
          { label: 'Admitted students', href: '/admin/admissions/admitted' },
          {
            label: 'Intakes',
            href: '/admin/admissions/intakes',
            permissions: ['admissions:manage', 'admissions:configure'],
          },
          {
            label: 'Cycles & settings',
            href: '/admin/admissions/cycles',
            permissions: ['admissions:configure', 'admissions:manage'],
          },
          {
            label: 'Analytics',
            href: '/admin/admissions/analytics',
            permissions: ['admissions:read', 'admissions:manage'],
          },
          {
            label: 'Archive',
            href: '/admin/admissions/archive',
            permissions: ['admissions:read', 'admissions:manage'],
          },
        ],
      },
    ],
  },
  {
    label: 'Staff & HR',
    zone: 'scroll',
    items: [
      {
        label: 'Staff',
        icon: UserCog,
        href: '/admin/staff',
        module: 'staff',
        permissions: [...P.staff],
        activePattern: '^/admin/staff(?!/attendance)(?:/.*)?$',
        children: [
          { label: 'Add Staff', href: '/admin/staff/new', permissions: ['staff:manage'] },
          {
            label: 'Bulk Import',
            href: '/admin/staff/import',
            permissions: ['staff:import', 'staff:manage'],
          },
          {
            label: 'Bulk Update',
            href: '/admin/staff/bulk-update',
            permissions: ['staff:bulk-update'],
          },
          {
            label: 'Teaching Assignments',
            href: '/admin/staff/assignments',
            permissions: ['staff:assign-subjects', 'staff:manage'],
          },
          {
            label: 'Portal Users',
            href: '/admin/staff/portal-users',
            permissions: ['staff:portal', 'users:manage'],
          },
          {
            label: 'Reports',
            href: '/admin/staff/reports',
            permissions: ['staff:read', 'reports:read'],
          },
          { label: 'Roles', href: '/admin/staff/roles', permissions: ['staff:manage'] },
          {
            label: 'Audit Logs',
            href: '/admin/staff/audit',
            permissions: ['staff:read', 'audit:read'],
          },
        ],
      },
      {
        label: 'Identity & ID Cards',
        icon: Fingerprint,
        href: '/admin/id-cards',
        module: 'students',
        permissions: ['students:read', 'students:manage', 'staff:read'],
        activePattern: '^/admin/id-cards(?:/.*)?$',
        children: [
          {
            label: 'Dashboard',
            href: '/admin/id-cards',
            permissions: ['students:read', 'students:manage'],
          },
          {
            label: 'Template Gallery',
            href: '/admin/id-cards/templates',
            permissions: ['students:manage'],
          },
          {
            label: 'Card Designer',
            href: '/admin/id-cards/templates/designer',
            permissions: ['students:manage'],
          },
          {
            label: 'ID Card Production',
            href: '/admin/id-cards/students',
            permissions: ['students:read', 'students:manage'],
          },
          {
            label: 'Staff Production',
            href: '/admin/id-cards/staff',
            permissions: ['staff:read', 'staff:manage'],
          },
          {
            label: 'Bulk Generation',
            href: '/admin/id-cards/bulk',
            permissions: ['students:manage'],
          },
          {
            label: 'Verification Report',
            href: '/admin/id-cards/verification-report',
            permissions: ['students:read', 'students:manage'],
          },
          {
            label: 'Print Queue',
            href: '/admin/id-cards/print-queue',
            permissions: ['students:read', 'students:manage'],
          },
          {
            label: 'RFID Mapping',
            href: '/admin/id-cards/rfid',
            permissions: ['students:manage', 'staff:read'],
          },
          {
            label: 'Card Reissue',
            href: '/admin/id-cards/reissue',
            permissions: ['students:manage'],
          },
          {
            label: 'Verification Portal',
            href: '/admin/id-cards/verification',
            permissions: ['students:read'],
          },
          { label: 'Reports', href: '/admin/id-cards/reports', permissions: ['students:read'] },
          { label: 'Settings', href: '/admin/id-cards/settings', permissions: ['students:manage'] },
        ],
      },
      {
        label: 'Human Resources',
        icon: Briefcase,
        href: '/admin/hr',
        module: 'hr',
        permissions: [...P.hr],
        activePattern:
          '^/admin/hr(?:/.*)?$|^/admin/staff(?:/(?:$|departments|documents|workload|[0-9a-f-]{36}))(?:\\?.*)?$|^/admin/staff/attendance(?:/.*)?$',
        children: [
          { label: 'HR Dashboard', href: '/admin/hr', permissions: ['payroll:read'] },
          {
            label: 'Staff Directory',
            href: '/admin/staff',
            permissions: ['staff:read', 'payroll:read'],
            activePattern: '^/admin/staff(?:/[0-9a-f-]{36})?$',
          },
          {
            label: 'Departments',
            href: '/admin/staff/departments',
            permissions: ['staff:read', 'org:read', 'payroll:read'],
          },
          {
            label: 'Designations',
            href: '/admin/hr/designations',
            permissions: ['staff:read', 'payroll:manage'],
          },
          {
            label: 'Attendance',
            href: '/admin/staff/attendance',
            permissions: ['staff:read', 'payroll:read'],
          },
          {
            label: 'Leave Management',
            href: '/admin/hr/leave',
            permissions: ['staff:read', 'payroll:read'],
          },
          {
            label: 'Substitute Staff',
            href: '/admin/hr/substitute-staff',
            permissions: ['staff:read', 'payroll:read'],
          },
          {
            label: 'Recruitment',
            href: '/admin/hr/recruitment',
            permissions: ['staff:manage', 'payroll:read'],
          },
          {
            label: 'Salary Components',
            href: '/admin/hr/salary-components',
            permissions: ['payroll:manage'],
          },
          {
            label: 'Pay Structures',
            href: '/admin/hr/pay-structures',
            permissions: ['payroll:manage'],
          },
          {
            label: 'Pay Assignments',
            href: '/admin/hr/assignments',
            permissions: ['payroll:manage'],
          },
          {
            label: 'Salary Revisions',
            href: '/admin/hr/revisions',
            permissions: ['payroll:manage'],
          },
          { label: 'Increments', href: '/admin/hr/increments', permissions: ['payroll:manage'] },
          {
            label: 'Payroll Runs',
            href: '/admin/hr/payroll/runs',
            permissions: ['payroll:process', 'payroll:read'],
          },
          {
            label: 'Loans & Advances',
            href: '/admin/hr/loans',
            permissions: ['payroll:manage', 'loans:read', 'loans:manage'],
          },
          {
            label: 'Staff Accommodation',
            href: '/admin/hr/accommodation',
            permissions: ['accommodation:read', 'accommodation:manage'],
          },
          {
            label: 'PF / CPF / NPS',
            href: '/admin/hr/pf-cpf',
            permissions: ['payroll:read', 'payroll:reports'],
          },
          { label: 'Pension', href: '/admin/hr/pension', permissions: ['payroll:read'] },
          { label: 'Payslips', href: '/admin/hr/payslips', permissions: ['payroll:read'] },
          {
            label: 'Documents',
            href: '/admin/staff/documents',
            permissions: ['staff:read', 'payroll:read'],
          },
          {
            label: 'Performance Appraisal',
            href: '/admin/hr/appraisal',
            permissions: ['staff:read', 'payroll:read'],
          },
          {
            label: 'Faculty Workload',
            href: '/admin/staff/workload',
            permissions: ['staff:read', 'payroll:read'],
          },
          { label: 'Reports', href: '/admin/hr/reports', permissions: ['payroll:reports'] },
          { label: 'Settings', href: '/admin/hr/settings', permissions: ['payroll:manage'] },
        ],
      },
    ],
  },
  {
    label: 'Academic Operations',
    zone: 'scroll',
    items: [
      {
        label: 'Academics',
        icon: BookOpen,
        href: '/admin/programs',
        module: 'academics',
        permissions: [...P.academics],
        activePattern: '^/admin/(?:programs|academic-engine|academic-lifecycle|shifts)(?:/.*)?$',
        children: [
          { label: 'Programmes', href: '/admin/programs', permissions: [...P.academics] },
          {
            label: 'Curriculum',
            href: '/admin/academic-engine',
            permissions: ['academic-engine:read', 'academic-engine:manage'],
          },
          {
            label: 'Course Master',
            href: '/admin/programs',
            permissions: [...P.academics],
          },
          {
            label: 'Subject Mapping',
            href: '/admin/academic-engine/curriculum-completion',
            permissions: ['academic-engine:manage'],
          },
          {
            label: 'Academic Sessions',
            href: '/admin/academic-lifecycle',
            permissions: ['academic-lifecycle:read', 'academic-lifecycle:manage'],
          },
          {
            label: 'Shift Management',
            href: '/admin/shifts',
            permissions: [...P.shifts, ...P.academics],
          },
        ],
      },
      {
        label: 'Timetable',
        href: '/admin/academics/timetable',
        icon: CalendarDays,
        module: 'timetable',
        permissions: [...P.timetable],
        activePattern:
          '^/admin/academics/(?:timetable|teaching-allocation|teaching-subject-groups)(?:/.*)?$',
        children: [
          { label: 'Dashboard', href: '/admin/academics/timetable', permissions: [...P.timetable] },
          {
            label: 'Timetable Plans',
            href: '/admin/academics/timetable/plans',
            permissions: [...P.timetable],
          },
          {
            label: 'Subject Groups',
            href: '/admin/academics/teaching-subject-groups',
            permissions: [...P.timetable],
          },
          {
            label: 'Teaching Allocation',
            href: '/admin/academics/teaching-allocation',
            permissions: [...P.timetable],
          },
          {
            label: 'Bulk Import / Export',
            href: '/admin/academics/timetable/bulk',
            permissions: ['academic:timetable:manage'],
          },
          {
            label: 'Validation Center',
            href: '/admin/academics/timetable/validation',
            permissions: [...P.timetable],
          },
          {
            label: 'Generation Engine',
            href: '/admin/academics/timetable/generate',
            permissions: ['academic:timetable:manage'],
          },
          {
            label: 'Conflict Resolution',
            href: '/admin/academics/timetable/conflicts',
            permissions: [...P.timetable],
          },
          {
            label: 'Draft Review',
            href: '/admin/academics/timetable/review',
            permissions: [...P.timetable],
          },
          {
            label: 'Publish',
            href: '/admin/academics/timetable/publish',
            permissions: ['academic:timetable:manage'],
          },
          {
            label: 'Reports',
            href: '/admin/academics/timetable/reports',
            permissions: ['reports:read', ...P.timetable],
          },
          {
            label: 'Settings',
            href: '/admin/academics/timetable/settings',
            permissions: ['academic:timetable:manage'],
          },
        ],
      },
      {
        label: 'LMS',
        href: '/admin/academics/lms',
        icon: GraduationCap,
        module: 'lms',
        permissions: [...P.lms],
        activePattern: '^/admin/academics/lms(?:/.*)?$',
        children: [
          { label: 'Dashboard', href: '/admin/academics/lms', permissions: [...P.lms] },
          {
            label: 'Subject Workspaces',
            href: '/admin/academics/lms/workspaces',
            permissions: ['lms:workspace:manage', 'lms:manage'],
          },
          {
            label: 'Learning Materials',
            href: '/admin/academics/lms/materials',
            permissions: ['lms:materials:upload', 'lms:read'],
          },
          {
            label: 'Assignments',
            href: '/admin/academics/lms/assignments',
            permissions: ['lms:assignments:manage', 'lms:read'],
          },
          {
            label: 'Quizzes',
            href: '/admin/academics/lms/quizzes',
            permissions: ['lms:manage', 'lms:read'],
          },
          {
            label: 'Discussions',
            href: '/admin/academics/lms/discussions',
            permissions: [...P.lms],
          },
          {
            label: 'Lesson Plans',
            href: '/admin/academics/lms/lesson-plans',
            permissions: ['lms:lesson-plans:manage', 'lms:read'],
          },
          {
            label: 'Settings',
            href: '/admin/academics/lms/settings',
            permissions: ['lms:settings:manage', 'lms:manage'],
          },
        ],
      },
      {
        label: 'Question Bank',
        href: '/admin/academics/question-bank',
        icon: HelpCircle,
        module: 'questionBank',
        permissions: [...QB],
        activePattern: '^/admin/academics/question-bank(?:/.*)?$',
        children: QUESTION_BANK_CHILDREN,
      },
      {
        label: 'Lesson Plans',
        href: '/admin/academics/lms/lesson-plans',
        icon: FileText,
        module: 'lms',
        permissions: ['lms:lesson-plans:manage', 'lms:read'],
        activePattern: '^/admin/academics/lms/lesson-plans(?:/.*)?$',
      },
      {
        label: 'Student Attendance',
        icon: ClipboardCheck,
        href: '/admin/academics/attendance',
        module: 'studentAttendance',
        permissions: [...P.studentAttendance],
        activePattern: '^/admin/academics/attendance(?:/.*)?$',
      },
      {
        label: 'Staff Attendance',
        icon: Fingerprint,
        href: '/admin/staff/attendance',
        module: 'staffAttendance',
        permissions: [...P.staffAttendance],
        activePattern: '^/admin/staff/attendance(?:/.*)?$',
        children: [
          {
            label: 'Dashboard',
            href: '/admin/staff/attendance',
            permissions: [...P.staffAttendance],
          },
          {
            label: 'Live Attendance',
            href: '/admin/staff/attendance/live',
            permissions: [...P.staffAttendance],
          },
          {
            label: 'Processing · Pull Logs',
            href: '/admin/staff/attendance/pull-logs',
            permissions: ['staff-attendance:reprocess', 'staff-attendance:edit'],
          },
          {
            label: 'Processing · Process Attendance',
            href: '/admin/staff/attendance/process',
            permissions: ['staff-attendance:reprocess', 'staff-attendance:edit'],
          },
          {
            label: 'Daily Register',
            href: '/admin/staff/attendance/daily',
            permissions: [...P.staffAttendance],
          },
          {
            label: 'Monthly Register',
            href: '/admin/staff/attendance/monthly',
            permissions: [...P.staffAttendance],
          },
          {
            label: 'Biometric · Devices',
            href: '/admin/staff/attendance/devices',
            permissions: ['staff-biometric:device-admin', 'staff-biometric:admin'],
          },
          {
            label: 'Settings',
            href: '/admin/staff/attendance/settings',
            permissions: ['staff-attendance:settings:edit', 'staff-attendance:settings:view'],
          },
          {
            label: 'Audit Logs',
            href: '/admin/staff/attendance/audit',
            permissions: ['staff-attendance:view', 'audit:read'],
          },
        ],
      },
    ],
  },
  {
    label: 'Examination',
    zone: 'scroll',
    items: [
      {
        label: 'Examinations',
        icon: ClipboardList,
        href: '/admin/academics/examinations',
        module: 'examinations',
        permissions: [...P.examinations],
        activePattern: '^/admin/academics/examinations(?:/.*)?$',
        children: [
          {
            label: 'Dashboard',
            href: '/admin/academics/examinations',
            permissions: [...P.examinations],
          },
          {
            label: 'IA Exams',
            href: '/admin/academics/examinations/ia-exams',
            permissions: [...P.examinations],
          },
          {
            label: 'IA Timetable',
            href: '/admin/academics/examinations/timetable',
            permissions: [...P.examinations],
          },
          ...(IA_ADMIT_CARDS_ADMIN_ENABLED
            ? [
                {
                  label: 'Admit Cards',
                  href: '/admin/academics/examinations/admit-cards',
                  permissions: [...P.examinations],
                },
              ]
            : []),
          {
            label: 'Mark Entry',
            href: '/admin/academics/examinations/mark-entry',
            permissions: [...P.examinations, 'ia:marks:enter'],
          },
          {
            label: 'Defaulters',
            href: '/admin/academics/examinations/defaulters',
            permissions: [...P.examinations],
          },
          {
            label: 'Analytics',
            href: '/admin/academics/examinations/analytics',
            permissions: [...P.examinations],
          },
          {
            label: 'Reports',
            href: '/admin/academics/examinations/reports',
            permissions: [...P.examinations],
          },
          {
            label: 'University Submission',
            href: '/admin/academics/examinations/nehu-submission',
            permissions: [...P.examinations, 'ia:export:nehu'],
          },
          {
            label: 'Settings',
            href: '/admin/academics/examinations/settings',
            permissions: ['ia:manage', 'exam:admin'],
          },
        ],
      },
      {
        label: 'Certificates',
        icon: Award,
        href: '/admin/certificates',
        module: 'certificates',
        permissions: [...P.certificates],
        activePattern: '^/admin/certificates(?:/.*)?$',
        children: [
          { label: 'Dashboard', href: '/admin/certificates', permissions: [...P.certificates] },
          {
            label: 'Templates',
            href: '/admin/certificates/templates',
            permissions: ['certificates:manage'],
          },
          {
            label: 'Certificate Generator',
            href: '/admin/certificates/generator',
            permissions: ['certificates:manage'],
          },
          {
            label: 'Requests',
            href: '/admin/certificates/requests',
            permissions: [...P.certificates],
          },
          {
            label: 'Bulk Issue',
            href: '/admin/certificates/bulk',
            permissions: ['certificates:manage'],
          },
          {
            label: 'Verification',
            href: '/admin/certificates/verification',
            permissions: [...P.certificates],
          },
          {
            label: 'Approval Workflow',
            href: '/admin/certificates/workflow',
            permissions: ['certificates:approve', 'certificates:manage'],
          },
          {
            label: 'Analytics',
            href: '/admin/certificates/analytics',
            permissions: ['certificates:read', 'reports:read'],
          },
          {
            label: 'Audit Logs',
            href: '/admin/certificates/audit',
            permissions: ['certificates:read', 'audit:read'],
          },
          {
            label: 'Settings',
            href: '/admin/certificates/settings',
            permissions: ['certificates:manage'],
          },
        ],
      },
    ],
  },
  {
    label: 'Finance',
    zone: 'scroll',
    items: [
      {
        label: 'Finance',
        href: '/admin/fees',
        icon: Wallet,
        module: 'finance',
        permissions: [...P.finance],
        activePattern: '^/admin/fees(?:/.*)?$',
        children: [
          { label: 'Fee Dashboard', href: '/admin/fees', permissions: [...P.finance] },
          {
            label: 'Admission Fee Structure',
            href: '/admin/fees/admission-structure',
            permissions: ['fees:manage'],
          },
          {
            label: 'Monthly Fee Plans',
            href: '/admin/fees/monthly-plans',
            permissions: ['fees:manage'],
          },
          { label: 'Fee Settings', href: '/admin/fees/settings', permissions: ['fees:manage'] },
          { label: 'Fee Head Master', href: '/admin/fees/masters', permissions: ['fees:manage'] },
          {
            label: 'Fee Cycle Configuration',
            href: '/admin/fees/cycles',
            permissions: ['fees:manage'],
          },
          {
            label: 'Payment Facilitation Desk',
            href: '/admin/fees/collections',
            permissions: ['fees:manage', 'fees:read'],
          },
          {
            label: 'External Payment Entry',
            href: '/admin/fees/external-payments',
            permissions: ['fees:manage'],
          },
          {
            label: 'Day Closing Report',
            href: '/admin/fees/day-closing',
            permissions: ['fees:read', 'fees:manage'],
          },
          {
            label: 'Cash Register',
            href: '/admin/fees/cash-register',
            permissions: ['fees:read', 'fees:manage'],
          },
          {
            label: 'Scholarships & Concessions',
            href: '/admin/fees/scholarships',
            permissions: ['fees:manage'],
          },
          {
            label: 'Student Ledger Explorer',
            href: '/admin/fees/ledger',
            permissions: [...P.finance],
          },
          {
            label: 'Financial Reports Center',
            href: '/admin/fees/reports',
            permissions: ['fees:read', 'reports:read'],
          },
          {
            label: 'Defaulter Intelligence',
            href: '/admin/fees/defaulters',
            permissions: [...P.finance],
          },
          {
            label: 'Fee Structure Studio (Advanced)',
            href: '/admin/fees/structures',
            permissions: ['fees:manage'],
          },
          { label: 'Renewal Center', href: '/admin/fees/renewals', permissions: ['fees:manage'] },
          { label: 'Demand Generator', href: '/admin/fees/demands', permissions: ['fees:manage'] },
        ],
      },
    ],
  },
  {
    label: 'Library',
    zone: 'scroll',
    items: [
      {
        label: 'Library',
        icon: Library,
        href: '/admin/library',
        module: 'library',
        permissions: [...P.library],
        activePattern: '^/admin/library(?:/.*)?$',
        children: [
          { label: 'Library Dashboard', href: '/admin/library', permissions: [...P.library] },
          {
            label: 'Library Entry System',
            href: '/admin/library/visits',
            permissions: ['library:access-desk', 'library:circulate', 'library:manage'],
          },
          {
            label: 'Catalog',
            href: '/admin/library/catalogue',
            permissions: ['library:read', 'library:manage'],
          },
          {
            label: 'Book Accession',
            href: '/admin/library/accession',
            permissions: ['library:manage'],
          },
          {
            label: 'Circulation Desk',
            href: '/admin/library/circulation',
            permissions: ['library:circulate', 'library:manage'],
          },
          {
            label: 'Members',
            href: '/admin/library/members',
            permissions: ['library:read', 'library:manage'],
          },
          {
            label: 'Reservations',
            href: '/admin/library/reservations',
            permissions: ['library:circulate', 'library:manage'],
          },
          {
            label: 'Fine Management',
            href: '/admin/library/circulation',
            permissions: ['library:circulate', 'library:manage'],
          },
          {
            label: 'Incidents',
            href: '/admin/library/incidents',
            permissions: ['library:circulate', 'library:manage'],
          },
          {
            label: 'Visitors',
            href: '/admin/library/visitors',
            permissions: ['library:read', 'library:manage'],
          },
          {
            label: 'Digital Library',
            href: '/admin/library/digital',
            permissions: ['library:digital:read', 'library:digital:manage'],
          },
          {
            label: 'Question Papers',
            href: '/admin/library/digital',
            permissions: ['library:digital:read', 'library:digital:manage'],
          },
          {
            label: 'Research Repository',
            href: '/admin/library/research',
            permissions: ['library:research:read', 'library:research:manage'],
          },
          { label: 'Search', href: '/admin/library/search', permissions: [...P.library] },
          {
            label: 'Reading Analytics',
            href: '/admin/library/analytics',
            permissions: ['library:reports', 'library:manage'],
          },
          {
            label: 'Reports',
            href: '/admin/library/reports',
            permissions: ['library:reports', 'library:manage'],
          },
          {
            label: 'NAAC Reports',
            href: '/admin/library/naac-reports',
            permissions: ['library:reports', 'library:manage'],
          },
          {
            label: 'Settings',
            href: '/admin/library/settings',
            permissions: ['library:settings', 'library:manage'],
          },
        ],
      },
    ],
  },
  {
    label: 'Governance',
    zone: 'scroll',
    items: [
      {
        label: 'Principal Desk',
        href: '/principal-desk',
        icon: Building2,
        module: 'governance',
        permissions: ['principal-desk:access'],
      },
      {
        label: 'Governance',
        icon: Shield,
        href: '/admin/governance',
        module: 'governance',
        permissions: [...P.governance],
        activePattern: '^/admin/governance(?:/.*)?$',
        children: [
          { label: 'Dashboard', href: '/admin/governance', permissions: [...P.governance] },
          {
            label: 'Committees',
            href: '/admin/governance/committees',
            permissions: ['governance:read', 'governance:manage'],
          },
          {
            label: 'Committee Members',
            href: '/admin/governance/members',
            permissions: ['governance:read', 'governance:manage'],
          },
          {
            label: 'Meetings',
            href: '/admin/governance/meetings',
            permissions: ['governance:read', 'governance:manage'],
          },
          {
            label: 'Meeting Calendar',
            href: '/admin/governance/calendar',
            permissions: ['governance:read'],
          },
          {
            label: 'Action Taken Reports',
            href: '/admin/governance/atr',
            permissions: ['governance:read', 'governance:manage'],
          },
          {
            label: 'Notices & Circulars',
            href: '/admin/governance/notices',
            permissions: ['governance:read', 'governance:publish'],
          },
          {
            label: 'Documents',
            href: '/admin/governance/documents',
            permissions: ['governance:read', 'governance:manage'],
          },
          {
            label: 'Reports',
            href: '/admin/governance/reports',
            permissions: ['governance:reports'],
          },
          {
            label: 'Settings',
            href: '/admin/governance/settings',
            permissions: ['governance:manage'],
          },
        ],
      },
      {
        label: 'IQAC / NAAC',
        icon: Award,
        href: '/admin/naac',
        module: 'naacIqac',
        permissions: [...P.naacIqac],
        activePattern: '^/admin/naac(?:/.*)?$',
        children: [
          { label: 'Dashboard', href: '/admin/naac', permissions: [...P.naacIqac] },
          {
            label: 'Criteria & Metrics',
            href: '/admin/naac/criteria',
            permissions: ['naac-iqac:read', 'naac-iqac:manage'],
          },
          {
            label: 'Evidence Repository',
            href: '/admin/naac/evidence',
            permissions: ['naac-iqac:read'],
          },
          { label: 'Document Vault', href: '/admin/naac/vault', permissions: ['naac-iqac:manage'] },
          { label: 'AQAR', href: '/admin/naac/aqar', permissions: ['naac-iqac:manage'] },
          { label: 'SSR', href: '/admin/naac/reports', permissions: ['naac-iqac:reports'] },
          { label: 'IQAC Activities', href: '/admin/naac/iqac', permissions: ['naac-iqac:read'] },
          { label: 'Compliance', href: '/admin/naac/dvv', permissions: ['naac-iqac:reports'] },
          { label: 'Settings', href: '/admin/naac/settings', permissions: ['naac-iqac:manage'] },
        ],
      },
    ],
  },
  {
    label: 'Communication',
    zone: 'scroll',
    items: [
      {
        label: 'Communication',
        href: '/admin/communication',
        icon: MessageSquare,
        module: 'communication',
        permissions: [...P.communication],
        activePattern: '^/admin/communication(?:/.*)?$',
        children: [
          {
            label: 'Notifications',
            href: '/admin/communication',
            permissions: [...P.communication],
          },
          {
            label: 'Compose',
            href: '/admin/communication/compose',
            permissions: [...P.communication],
          },
          {
            label: 'Campaigns',
            href: '/admin/communication/campaigns',
            permissions: [...P.communication],
          },
          {
            label: 'Templates',
            href: '/admin/communication/templates',
            permissions: [...P.communication],
          },
          {
            label: 'Audience Builder',
            href: '/admin/communication/audience',
            permissions: [...P.communication],
          },
          {
            label: 'Analytics',
            href: '/admin/communication/analytics',
            permissions: [...P.communication],
          },
          {
            label: 'Settings',
            href: '/admin/communication/settings',
            permissions: [...P.communication],
          },
        ],
      },
    ],
  },
  {
    label: 'Campus Operations',
    zone: 'scroll',
    items: [
      {
        label: 'In-Out Management',
        href: '/admin/campus-access/dashboard',
        icon: Fingerprint,
        module: 'cams',
        permissions: [...P.cams],
        activePattern: '^/admin/campus-access(?:/.*)?$',
        children: [
          {
            label: 'Live Dashboard',
            href: '/admin/campus-access/dashboard',
            permissions: [...P.cams],
          },
          {
            label: 'Access Points',
            href: '/admin/campus-access',
            permissions: ['cams:manage', 'cams:read'],
          },
        ],
      },
      {
        label: 'Infrastructure',
        href: '/admin/organization/infrastructure',
        icon: Building2,
        module: 'infrastructure',
        permissions: [...P.infrastructure],
        activePattern: '^/admin/organization/infrastructure(?:/.*)?$',
        children: [
          {
            label: 'Dashboard',
            href: '/admin/organization/infrastructure',
            permissions: [...P.infrastructure],
          },
          {
            label: 'Buildings',
            href: '/admin/organization/infrastructure/buildings',
            permissions: [...P.infrastructure],
          },
          {
            label: 'Floors',
            href: '/admin/organization/infrastructure/floors',
            permissions: [...P.infrastructure],
          },
          {
            label: 'Rooms',
            href: '/admin/organization/infrastructure/rooms',
            permissions: [...P.infrastructure],
          },
          {
            label: 'Labs',
            href: '/admin/organization/infrastructure/labs',
            permissions: [...P.infrastructure],
          },
          {
            label: 'Shared Halls',
            href: '/admin/organization/infrastructure/shared-halls',
            permissions: [...P.infrastructure],
          },
          {
            label: 'Room Calendar',
            href: '/admin/organization/infrastructure/calendar',
            permissions: [...P.infrastructure],
          },
          {
            label: 'Availability',
            href: '/admin/organization/infrastructure/availability',
            permissions: [...P.infrastructure],
          },
          {
            label: 'Import / Export',
            href: '/admin/organization/infrastructure/import',
            permissions: ['org:manage'],
          },
          {
            label: 'Reports',
            href: '/admin/organization/infrastructure/reports',
            permissions: ['org:read', 'reports:read'],
          },
          {
            label: 'Settings',
            href: '/admin/organization/infrastructure/settings',
            permissions: ['org:manage'],
          },
        ],
      },
      {
        label: 'Front Office',
        icon: Home,
        href: '/admin/front-office',
        module: 'frontOffice',
        permissions: [...P.frontOffice],
        activePattern: '^/admin/front-office(?:/.*)?$',
        children: [
          { label: 'Dashboard', href: '/admin/front-office', permissions: [...P.frontOffice] },
          {
            label: 'Enquiries',
            href: '/admin/front-office/enquiries',
            permissions: ['front-office:read', 'front-office:desk'],
          },
          {
            label: 'Gate Pass',
            href: '/admin/front-office/gate-passes',
            permissions: ['front-office:read', 'front-office:desk'],
          },
          {
            label: 'Kiosk Desk',
            href: '/admin/front-office/kiosk',
            permissions: ['front-office:desk', 'front-office:manage'],
          },
          {
            label: 'Complaints',
            href: '/admin/front-office/complaints',
            permissions: ['front-office:read', 'front-office:desk'],
          },
        ],
      },
      {
        label: 'Transport',
        icon: Bus,
        href: '/admin/transport',
        module: 'transport',
        permissions: [...P.transport],
        activePattern: '^/admin/transport(?:/.*)?$',
        children: [
          { label: 'Dashboard', href: '/admin/transport', permissions: [...P.transport] },
          {
            label: 'Routes & Stops',
            href: '/admin/transport/routes',
            permissions: ['transport:manage', 'transport:read'],
          },
          {
            label: 'Vehicles',
            href: '/admin/transport/vehicles',
            permissions: ['transport:manage', 'transport:read'],
          },
          {
            label: 'Assignments',
            href: '/admin/transport/assignments',
            permissions: ['transport:assign', 'transport:manage'],
          },
          {
            label: 'Capacity Alerts',
            href: '/admin/transport/alerts',
            permissions: [...P.transport],
          },
        ],
      },
      {
        label: 'Inventory',
        icon: Package,
        href: '/admin/inventory',
        module: 'inventory',
        permissions: [...P.inventory],
        activePattern: '^/admin/inventory(?:/.*)?$',
        children: [
          { label: 'Dashboard', href: '/admin/inventory', permissions: [...P.inventory] },
          {
            label: 'Stores',
            href: '/admin/inventory/stores',
            permissions: ['inventory:manage', 'inventory:read'],
          },
          { label: 'Items & Stock', href: '/admin/inventory/items', permissions: [...P.inventory] },
          {
            label: 'Issue & Return',
            href: '/admin/inventory/transactions',
            permissions: ['inventory:issue', 'inventory:manage'],
          },
          { label: 'Vendors', href: '/admin/inventory/vendors', permissions: ['inventory:manage'] },
          {
            label: 'Purchase Orders',
            href: '/admin/inventory/purchase-orders',
            permissions: ['inventory:manage'],
          },
          {
            label: 'Barcode Labels',
            href: '/admin/inventory/labels',
            permissions: ['inventory:manage'],
          },
          {
            label: 'Requisitions',
            href: '/admin/inventory/requisitions',
            permissions: ['inventory:issue', 'inventory:manage'],
          },
          {
            label: 'Restock Suggestions',
            href: '/admin/inventory/restock',
            permissions: ['inventory:manage'],
          },
        ],
      },
    ],
  },
  {
    label: 'Analytics',
    zone: 'pin-bottom',
    items: [
      {
        label: 'Reports',
        icon: BarChart3,
        href: '/admin/reports',
        module: 'reports',
        permissions: [...P.reports],
        activePattern: '^/admin/reports(?:/.*)?$',
        children: [
          { label: 'Reports Hub', href: '/admin/reports', permissions: ['reports:read'] },
          {
            label: 'Student Reports',
            href: '/admin/reports/students',
            permissions: ['students:read', 'reports:read'],
            activePattern: '^/admin/reports/students(?:/.*)?$',
          },
          {
            label: 'Admission Reports',
            href: '/admin/reports/students/admission',
            permissions: ['students:read', 'reports:read'],
          },
          {
            label: 'Academic Reports',
            href: '/admin/reports/students/academic',
            permissions: ['students:read', 'reports:read'],
          },
          {
            label: 'Demographic Reports',
            href: '/admin/reports/students/demographic',
            permissions: ['students:read', 'reports:read'],
          },
          {
            label: 'Department Reports',
            href: '/admin/reports/students/department',
            permissions: ['students:read', 'reports:read'],
          },
          {
            label: 'Contact Reports',
            href: '/admin/reports/students/contact',
            permissions: ['students:read', 'reports:read'],
          },
          {
            label: 'Government Reports',
            href: '/admin/reports/students/government',
            permissions: ['students:read', 'reports:read'],
          },
          {
            label: 'Export Center',
            href: '/admin/reports/students/export',
            permissions: ['students:read', 'reports:read'],
          },
          {
            label: 'Attendance Reports',
            href: '/admin/academics/attendance',
            permissions: [...P.studentAttendance],
          },
          {
            label: 'Examination Reports',
            href: '/admin/academics/examinations/reports',
            permissions: [...P.examinations],
          },
          {
            label: 'Fee Reports',
            href: '/admin/fees/reports',
            permissions: ['fees:read', 'reports:read'],
          },
          {
            label: 'Certificate Reports',
            href: '/admin/certificates/analytics',
            permissions: ['certificates:read', 'reports:read'],
          },
          {
            label: 'Academic Reports',
            href: '/admin/academics/timetable/reports',
            permissions: ['reports:read', ...P.timetable],
          },
          {
            label: 'Admission Register',
            href: '/admin/reports/admissions',
            permissions: ['admissions:read', 'reports:read'],
          },
          {
            label: 'Attendance Defaulters',
            href: '/admin/reports/attendance/defaulters',
            permissions: ['reports:read', ...P.studentAttendance],
          },
          {
            label: 'Fee Outstanding',
            href: '/admin/reports/fees/outstanding',
            permissions: ['fees:read', 'reports:read'],
          },
          {
            label: 'Compliance Reports',
            href: '/admin/reports/compliance',
            permissions: ['reports:read'],
          },
        ],
      },
      {
        label: 'Analytics',
        icon: TrendingUp,
        soon: true,
        module: 'reports',
        permissions: [...P.reports],
      },
    ],
  },
  {
    label: 'System Administration',
    zone: 'pin-bottom',
    items: [
      {
        label: 'Administration',
        icon: Shield,
        module: 'administration',
        permissions: [...P.administration],
        children: [
          {
            label: 'Dashboard',
            href: '/admin/administration',
            permissions: ['users:read', 'rbac:manage'],
          },
          {
            label: 'Portal Users',
            href: '/admin/administration/portal-users',
            permissions: ['users:read', 'users:manage'],
          },
          {
            label: 'Roles & Permissions',
            href: '/admin/administration/roles',
            permissions: ['rbac:manage'],
          },
          {
            label: 'User Permissions',
            href: '/admin/administration/user-permissions',
            permissions: ['rbac:manage', 'users:read'],
          },
          {
            label: 'User Activation',
            href: '/admin/administration/activation',
            permissions: ['users:manage'],
          },
          {
            label: 'Support Data',
            href: '/admin/administration/support-data',
            permissions: ['lookups:read', 'lookups:manage'],
          },
          {
            label: 'Roll Number Settings',
            href: '/admin/administration/roll-number-settings',
            permissions: ['students:manage'],
          },
          {
            label: 'Roll Number Generation',
            href: '/admin/administration/roll-number-generation',
            permissions: ['students:manage'],
          },
          {
            label: 'Roll Number History',
            href: '/admin/administration/roll-number-history',
            permissions: ['students:manage'],
          },
          {
            label: 'Roll Number Reports',
            href: '/admin/administration/roll-number-reports',
            permissions: ['students:manage'],
          },
          {
            label: 'Shift Transfer',
            href: '/admin/administration/roll-number-shift-transfer',
            permissions: ['students:manage', 'shift:students:manage'],
          },
          {
            label: 'Security & Sessions',
            href: '/admin/administration/security',
            permissions: ['sessions:manage', 'audit:read'],
          },
          {
            label: 'Audit Logs',
            href: '/admin/administration/audit-logs',
            permissions: ['audit:read'],
          },
          {
            label: 'License',
            href: '/admin/administration/license',
            permissions: ['license:read', 'license:activate', 'tenant:manage', 'users:manage'],
          },
          {
            label: 'Theme Studio',
            href: '/admin/administration/theme-branding',
            permissions: ['tenant:manage'],
          },
          {
            label: 'Mobile App Control',
            href: '/admin/administration/mobile-app',
            permissions: ['mobile:settings:read', 'mobile:settings:manage'],
          },
          {
            label: 'Import / Export',
            href: '/admin/administration/import-export',
            permissions: ['imports:manage'],
          },
          {
            label: 'Backup & DR Center',
            href: '/admin/administration/backups',
            permissions: ['backup:read', 'backup:manage'],
          },
          {
            label: 'Backup Schedule',
            href: '/admin/administration/backups/schedule',
            permissions: ['backup:manage'],
          },
          {
            label: 'Backup Repository',
            href: '/admin/administration/backups/repository',
            permissions: ['backup:read'],
          },
          {
            label: 'Restore Center',
            href: '/admin/administration/backups/restore',
            permissions: ['backup:restore'],
          },
        ],
      },
      {
        label: 'Settings',
        icon: Settings,
        module: 'settings',
        permissions: [...P.settings],
        children: [
          {
            label: 'Organization',
            href: '/admin/organization',
            permissions: ['org:read', 'org:manage'],
          },
        ],
      },
    ],
  },
];

export const STAFF_NAV: NavGroup[] = [
  {
    label: 'Home',
    items: [
      { label: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
      { label: 'Notifications', href: '/staff/notifications', icon: Bell },
      { label: 'My Calendar', href: '/staff/calendar', icon: CalendarDays },
    ],
  },
  {
    label: 'Academic',
    items: [
      {
        label: 'Academic',
        icon: GraduationCap,
        children: [
          { label: 'My Subjects', href: '/staff/academic/subjects' },
          { label: 'Teaching Load', href: '/staff/academic/teaching-load' },
          { label: 'Timetable', href: '/staff/academic/timetable' },
          { label: 'LMS Workspace', href: '/staff/academic/lms' },
          { label: 'Lesson Plans', href: '/staff/academic/lms' },
          { label: 'Homework / Assignments', href: '/staff/academic/lms' },
          { label: 'Question Bank', href: '/staff/academic/question-bank' },
          { label: 'Internal Assessment', href: '/staff/academic/ia' },
          { label: 'Examinations (Legacy)', href: '/staff/academic/examinations' },
          { label: 'Student Lists', href: '/staff/academic/students' },
          { label: 'Marks Entry', href: '/staff/academic/marks' },
          { label: 'Attendance Entry', href: '/staff/academic/attendance-entry' },
        ],
      },
    ],
  },
  {
    label: 'Staff Operations',
    items: [
      {
        label: 'Operations',
        icon: Briefcase,
        children: [
          { label: 'My Profile', href: '/staff/profile' },
          { label: 'Employment Details', href: '/staff/profile?tab=employment' },
          { label: 'Attendance', href: '/staff/attendance' },
          { label: 'Leave Management', href: '/staff/leave' },
          { label: 'Salary & Payslips', href: '/staff/salary' },
          { label: 'Documents', href: '/staff/documents' },
          { label: 'Portal Settings', href: '/staff/settings' },
        ],
      },
    ],
  },
  {
    label: 'Communication',
    items: [
      {
        label: 'Communication',
        icon: Mail,
        children: [
          { label: 'Announcements', href: '/staff/communication/announcements' },
          { label: 'Internal Messages', href: '/staff/communication/messages' },
          { label: 'Email', href: '/staff/communication/email' },
          { label: 'Circulars', href: '/staff/communication/circulars' },
          { label: 'Events', href: '/staff/communication/events' },
        ],
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Administration',
        icon: Shield,
        children: [
          { label: 'Approvals', href: '/staff/administration/approvals' },
          { label: 'Department Tasks', href: '/staff/administration/department-tasks' },
          { label: 'Department Workspace', href: '/staff/department' },
          { label: 'Reports', href: '/staff/administration/reports' },
          { label: 'My Committees', href: '/staff/governance' },
          { label: 'NAAC & IQAC', href: '/staff/naac' },
        ],
      },
    ],
  },
];

export const ROLE_NAV: Record<string, { label: string; href: string; icon: LucideIcon }[]> = {
  faculty: [
    { label: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
    { label: 'Attendance', href: '/staff/attendance', icon: ClipboardList },
    { label: 'Timetable', href: '/staff/academic/timetable', icon: BookOpen },
  ],
  staff: [
    { label: 'Dashboard', href: '/staff/dashboard', icon: LayoutDashboard },
    { label: 'Attendance', href: '/staff/attendance', icon: ClipboardList },
    { label: 'Profile', href: '/staff/profile', icon: User },
  ],
  student: [
    { label: 'Dashboard', href: '/student', icon: LayoutDashboard },
    { label: 'Results', href: '/student/results', icon: BarChart3 },
    { label: 'Fees', href: '/student/fees', icon: Wallet },
    { label: 'Certificates', href: '/student/certificates', icon: FileText },
    { label: 'Timetable', href: '/student/timetable', icon: BookOpen },
    { label: 'LMS', href: '/student/lms', icon: GraduationCap },
    { label: 'Question Bank', href: '/student/question-bank', icon: HelpCircle },
    { label: 'Library', href: '/student/library', icon: Library },
    { label: 'Registration', href: '/student/registration', icon: ClipboardList },
    { label: 'Attendance', href: '/student/attendance', icon: ClipboardList },
    { label: 'Examinations', href: '/student/examinations', icon: Ticket },
    { label: 'Committee Notices', href: '/student/governance/notices', icon: Megaphone },
    { label: 'Committee Meetings', href: '/student/governance/meetings', icon: CalendarDays },
  ],
  parent: [{ label: 'Dashboard', href: '/parent', icon: LayoutDashboard }],
  accountant: [
    { label: 'Dashboard', href: '/admin/fees', icon: LayoutDashboard },
    { label: 'Fees', href: '/admin/fees', icon: Wallet },
  ],
  librarian: [
    { label: 'Dashboard', href: '/admin/library', icon: LayoutDashboard },
    { label: 'Library', href: '/admin/library', icon: BookOpen },
  ],
  shift: [
    { label: 'Dashboard', href: '/shift', icon: LayoutDashboard },
    { label: 'Students', href: '/shift/students', icon: Users },
    { label: 'Offerings', href: '/shift/offerings', icon: BookOpen },
    { label: 'Timetable', href: '/shift/timetable', icon: ClipboardList },
    { label: 'Attendance', href: '/shift/attendance', icon: ClipboardList },
    { label: 'Examinations', href: '/shift/examinations', icon: ClipboardList },
  ],
};

export const CAMPUSES = [{ id: 'tura', name: 'Don Bosco College Tura', city: 'Tura, Meghalaya' }];
