import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BookOpen,
  Bus,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileBarChart2,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  Package,
  Settings,
  Shield,
  Users,
  Wallet,
  Bell,
  FolderOpen,
  UserCog,
} from 'lucide-react';

/** Module availability — keeps future modules visible without looking broken. */
export type SchoolErpNavStatus = 'active' | 'coming_soon';

export type SchoolErpNavLink = {
  id: string;
  label: string;
  href?: string;
  status: SchoolErpNavStatus;
  description?: string;
  children?: SchoolErpNavLink[];
};

export type SchoolErpNavModule = {
  id: string;
  label: string;
  href?: string;
  icon: LucideIcon;
  status: SchoolErpNavStatus;
  /** Highlight as the current primary product focus */
  primary?: boolean;
  children?: SchoolErpNavLink[];
};

/**
 * Modular School ERP navigation.
 * Add future modules here — shell/sidebar render from this config only.
 *
 * Product enablement (which areas are live vs Coming Soon) is owned by
 * `lib/school-erp/modules.ts`. Keep nav labels in sync when activating a module.
 */
export const SCHOOL_ERP_NAV: SchoolErpNavModule[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    status: 'active',
  },
  {
    id: 'admission-2027',
    label: 'Admission 2027',
    href: '/admin/school-admissions',
    icon: GraduationCap,
    status: 'active',
    primary: true,
    children: [
      {
        id: 'kg-applications',
        label: 'K.G. Applications',
        href: '/admin/school-admissions',
        status: 'active',
      },
      {
        id: 'enquiries',
        label: 'Enquiries',
        status: 'coming_soon',
        description: 'Parent enquiry desk',
      },
      {
        id: 'fee-payments',
        label: 'Fee & Payments',
        href: '/admin/school-admissions/payments',
        status: 'active',
        description: 'Application fee receipts',
        children: [
          {
            id: 'payments-dashboard',
            label: 'Payment Dashboard',
            href: '/admin/school-admissions/payments',
            status: 'active',
          },
          {
            id: 'payments-pending',
            label: 'Pending Verification',
            href: '/admin/school-admissions/payments/pending',
            status: 'active',
          },
          {
            id: 'payments-verified',
            label: 'Verified Payments',
            href: '/admin/school-admissions/payments/verified',
            status: 'active',
          },
          {
            id: 'payments-rejected',
            label: 'Rejected Payments',
            href: '/admin/school-admissions/payments/rejected',
            status: 'active',
          },
        ],
      },
      {
        id: 'documents',
        label: 'Documents',
        href: '/admin/school-admissions/documents/pending',
        status: 'active',
        children: [
          {
            id: 'documents-pending',
            label: 'Verification Queue',
            href: '/admin/school-admissions/documents/pending',
            status: 'active',
          },
          {
            id: 'documents-verified',
            label: 'Verified Documents',
            href: '/admin/school-admissions/documents/verified',
            status: 'active',
          },
          {
            id: 'documents-rejected',
            label: 'Rejected Documents',
            href: '/admin/school-admissions/documents/rejected',
            status: 'active',
          },
        ],
      },
      {
        id: 'admission-decisions',
        label: 'Admission Decisions',
        href: '/admin/school-admissions/decisions',
        status: 'active',
      },
      {
        id: 'admission-reports',
        label: 'Application Reports',
        href: '/admin/school-admissions',
        status: 'active',
        description: 'Export Excel / CSV',
      },
      {
        id: 'admission-settings',
        label: 'Admission Settings',
        href: '/admin/school-admissions/admission-settings',
        status: 'active',
      },
      {
        id: 'certificate-settings',
        label: 'Certificate Settings',
        href: '/admin/school-admissions/settings',
        status: 'active',
      },
    ],
  },
  {
    id: 'academics',
    label: 'Academics',
    icon: BookOpen,
    status: 'coming_soon',
    children: [
      { id: 'students', label: 'Students', status: 'coming_soon' },
      { id: 'classes', label: 'Classes & Sections', status: 'coming_soon' },
      { id: 'attendance', label: 'Attendance', status: 'coming_soon' },
      { id: 'examinations', label: 'Examinations', status: 'coming_soon' },
      { id: 'report-cards', label: 'Report Cards', status: 'coming_soon' },
      { id: 'academic-setup', label: 'Academic Setup', status: 'coming_soon' },
    ],
  },
  {
    id: 'school-management',
    label: 'School Management',
    icon: Users,
    status: 'coming_soon',
    children: [
      { id: 'staff', label: 'Staff & Faculty', status: 'coming_soon' },
      { id: 'hr', label: 'Human Resources', status: 'coming_soon' },
      { id: 'timetable', label: 'Timetable', status: 'coming_soon' },
      { id: 'library', label: 'Library', status: 'coming_soon' },
      { id: 'transport', label: 'Transport', status: 'coming_soon' },
      { id: 'inventory', label: 'Inventory', status: 'coming_soon' },
      { id: 'communications', label: 'Communications', status: 'coming_soon' },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: FileBarChart2,
    status: 'coming_soon',
    children: [
      { id: 'student-reports', label: 'Student Reports', status: 'coming_soon' },
      { id: 'attendance-reports', label: 'Attendance Reports', status: 'coming_soon' },
      { id: 'exam-reports', label: 'Examination Reports', status: 'coming_soon' },
      { id: 'fee-reports', label: 'Fee Reports', status: 'coming_soon' },
      {
        id: 'admission-reports-hub',
        label: 'Admission Reports',
        href: '/admin/school-admissions',
        status: 'active',
      },
      { id: 'other-reports', label: 'Other Management Reports', status: 'coming_soon' },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    status: 'active',
    children: [
      { id: 'settings', label: 'Settings', status: 'coming_soon' },
      { id: 'user-management', label: 'User Management', status: 'coming_soon' },
      { id: 'roles', label: 'Roles & Permissions', status: 'coming_soon' },
      { id: 'activity-logs', label: 'Activity Logs', status: 'coming_soon' },
    ],
  },
];

/** Planned school roles for future RBAC (documentation + UI labels). */
export const SCHOOL_ERP_ROLE_LABELS = [
  'Super Admin',
  'Admission Officer',
  'Accountant',
  'Teacher',
  'Principal',
  'HR / Admin Staff',
] as const;

export const SCHOOL_ERP_SESSION_LABEL = 'Academic Session 2027';

export function isSchoolErpNavActive(pathname: string | null | undefined, href?: string): boolean {
  if (!pathname || !href) return false;
  if (href === '/admin') return pathname === '/admin';
  if (href === '/admin/school-admissions') {
    return pathname === '/admin/school-admissions';
  }
  if (href === '/admin/school-admissions/payments') {
    return pathname === '/admin/school-admissions/payments';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Icons reserved for dashboard quick actions / widgets (reusable registry). */
export const SCHOOL_ERP_WIDGET_ICONS = {
  applications: ClipboardList,
  review: ClipboardCheck,
  documents: FolderOpen,
  payments: Wallet,
  reports: FileText,
  settings: Settings,
  users: UserCog,
  calendar: CalendarDays,
  bell: Bell,
  activity: Activity,
  library: Library,
  transport: Bus,
  inventory: Package,
  security: Shield,
} as const;
