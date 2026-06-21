import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Megaphone,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

/** Accent colors for module icons (matches premium ERP mockup). */
export const MODULE_COLORS: Record<string, string> = {
  dashboard: '#3b82f6',
  analytics: '#6366f1',
  students: '#22c55e',
  admissions: '#06b6d4',
  academics: '#8b5cf6',
  staff: '#f59e0b',
  hr: '#f97316',
  timetable: '#a855f7',
  lms: '#7c3aed',
  questionBank: '#ec4899',
  studentAttendance: '#14b8a6',
  staffAttendance: '#0ea5e9',
  examinations: '#ef4444',
  certificates: '#eab308',
  finance: '#f59e0b',
  library: '#10b981',
  governance: '#64748b',
  naacIqac: '#8b5cf6',
  communication: '#3b82f6',
  cams: '#06b6d4',
  transport: '#84cc16',
  inventory: '#78716c',
  frontOffice: '#d946ef',
  infrastructure: '#64748b',
  reports: '#6366f1',
  administration: '#475569',
  settings: '#94a3b8',
  students_module: '#22c55e',
};

export type QuickCreateAction = {
  id: string;
  label: string;
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
  color: string;
  permissions?: string[];
  keywords?: string[];
};

/** @deprecated Use QUICK_CREATE_ACTIONS — kept for imports during migration */
export type SidebarQuickAction = QuickCreateAction;

export const QUICK_CREATE_ACTIONS: QuickCreateAction[] = [
  {
    id: 'add-student',
    label: 'Add Student',
    shortLabel: 'Student',
    href: '/admin/students/new',
    icon: UserPlus,
    color: '#22c55e',
    permissions: ['students:manage'],
    keywords: ['add student', 'new student', 'admit'],
  },
  {
    id: 'add-staff',
    label: 'Add Staff',
    shortLabel: 'Staff',
    href: '/admin/staff/new',
    icon: Users,
    color: '#f59e0b',
    permissions: ['staff:manage'],
    keywords: ['add staff', 'new staff', 'hire'],
  },
  {
    id: 'collect-fee',
    label: 'Collect Fee',
    shortLabel: 'Fee Collection',
    href: '/admin/fees/collections',
    icon: Wallet,
    color: '#f97316',
    permissions: ['fees:manage', 'fees:read'],
    keywords: ['collect fee', 'fee collection', 'payment'],
  },
  {
    id: 'create-notice',
    label: 'Create Notice',
    shortLabel: 'Notice',
    href: '/admin/communication/compose',
    icon: Megaphone,
    color: '#8b5cf6',
    permissions: ['communication:read', 'communication:manage'],
    keywords: ['notice', 'announcement', 'circular'],
  },
  {
    id: 'mark-attendance',
    label: 'Mark Attendance',
    href: '/admin/academics/attendance',
    icon: ClipboardList,
    color: '#14b8a6',
    permissions: ['student-attendance:read', 'student-attendance:manage'],
    keywords: ['attendance', 'mark attendance'],
  },
  {
    id: 'create-event',
    label: 'Event',
    href: '/admin/governance/events',
    icon: CalendarDays,
    color: '#6366f1',
    permissions: ['governance:read', 'governance:manage'],
    keywords: ['event', 'calendar'],
  },
  {
    id: 'new-admission',
    label: 'Admission',
    href: '/admin/admissions/applications',
    icon: GraduationCap,
    color: '#06b6d4',
    permissions: ['admissions:read', 'admissions:manage'],
    keywords: ['admission', 'application', 'apply'],
  },
];

/** @deprecated Use QUICK_CREATE_ACTIONS */
export const SIDEBAR_QUICK_ACTIONS = QUICK_CREATE_ACTIONS;

export const DEFAULT_FAVORITE_HREFS = [
  '/admin/students',
  '/admin/fees/collections',
  '/admin/academics/attendance',
  '/admin/library',
  '/admin/governance',
] as const;

export type NavSearchAction = {
  label: string;
  href: string;
  keywords: string[];
  permissions?: string[];
};

export const NAV_SEARCH_ACTIONS: NavSearchAction[] = [
  {
    label: 'Add Student',
    href: '/admin/students/new',
    keywords: ['add student', 'new student', 'admit student'],
    permissions: ['students:manage'],
  },
  {
    label: 'Add Staff',
    href: '/admin/staff/new',
    keywords: ['add staff', 'new staff'],
    permissions: ['staff:manage'],
  },
  {
    label: 'Collect Fee',
    href: '/admin/fees/collections',
    keywords: ['collect fee', 'fee payment'],
    permissions: ['fees:manage', 'fees:read'],
  },
  {
    label: 'Student Directory',
    href: '/admin/students',
    keywords: ['students', 'student directory', 'find student'],
    permissions: ['students:read'],
  },
  {
    label: 'Fee Reports',
    href: '/admin/fees/reports',
    keywords: ['fee reports', 'finance reports'],
    permissions: ['fees:read', 'reports:read'],
  },
];

export function moduleColor(module?: string, fallback = '#3b82f6') {
  if (!module) return fallback;
  return MODULE_COLORS[module] ?? fallback;
}
