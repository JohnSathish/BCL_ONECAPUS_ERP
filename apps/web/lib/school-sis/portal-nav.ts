import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  BookOpen,
  Bus,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileBarChart2,
  FileText,
  GraduationCap,
  Home,
  Image,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  NotebookPen,
  School,
  Settings,
  Shield,
  Soup,
  Store,
  UserRound,
  Users,
} from 'lucide-react';
import type { SchoolSisPortalKind } from './portal-access';

export type PortalNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  exact?: boolean;
};

export type PortalNavGroup = {
  id: string;
  label: string;
  items: PortalNavItem[];
};

const S = '/school-sis-portal/student';
const T = '/school-sis-portal/staff';
const P = '/school-sis-portal/principal';

export const STUDENT_PORTAL_NAV: PortalNavGroup[] = [
  {
    id: 'home',
    label: 'Home',
    items: [{ id: 'dash', label: 'Dashboard', href: S, icon: Home, exact: true }],
  },
  {
    id: 'academics',
    label: 'Academics',
    items: [
      { id: 'timetable', label: 'Timetable', href: `${S}/timetable`, icon: CalendarDays },
      { id: 'attendance', label: 'Attendance', href: `${S}/attendance`, icon: ClipboardCheck },
      { id: 'homework', label: 'Homework', href: `${S}/homework`, icon: NotebookPen },
      { id: 'materials', label: 'Study materials', href: `${S}/materials`, icon: BookOpen },
      { id: 'exams', label: 'Examinations', href: `${S}/exams`, icon: FileText },
      { id: 'results', label: 'Results', href: `${S}/results`, icon: GraduationCap },
    ],
  },
  {
    id: 'campus',
    label: 'School',
    items: [
      { id: 'fees', label: 'Fees', href: `${S}/fees`, icon: CreditCard },
      { id: 'notices', label: 'Notices', href: `${S}/notices`, icon: Megaphone },
      { id: 'announcements', label: 'Announcements', href: `${S}/announcements`, icon: Bell },
      { id: 'messages', label: 'Messages', href: `${S}/messages`, icon: Inbox },
      { id: 'calendar', label: 'Events', href: `${S}/calendar`, icon: CalendarDays },
      { id: 'leave', label: 'Leave', href: `${S}/leave`, icon: ClipboardList },
      { id: 'transport', label: 'Transport', href: `${S}/transport`, icon: Bus },
      { id: 'lunch', label: 'Lunch menu', href: `${S}/lunch`, icon: Soup },
      { id: 'stationery', label: 'Stationery', href: `${S}/stationery`, icon: Store },
      { id: 'gallery', label: 'Gallery', href: `${S}/gallery`, icon: Image },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'notifications', label: 'Notifications', href: `${S}/notifications`, icon: Bell },
      { id: 'profile', label: 'Profile', href: `${S}/profile`, icon: UserRound },
    ],
  },
];

export const STAFF_PORTAL_NAV: PortalNavGroup[] = [
  {
    id: 'home',
    label: 'Home',
    items: [{ id: 'dash', label: 'Dashboard', href: T, icon: LayoutDashboard, exact: true }],
  },
  {
    id: 'class',
    label: 'Teaching',
    items: [
      { id: 'timetable', label: 'Timetable', href: `${T}/timetable`, icon: CalendarDays },
      { id: 'attendance', label: 'Attendance', href: `${T}/attendance`, icon: ClipboardCheck },
      { id: 'mark', label: 'Mark attendance', href: `${T}/attendance/mark`, icon: ClipboardList },
      { id: 'homework', label: 'Homework', href: `${T}/homework`, icon: NotebookPen },
      { id: 'materials', label: 'Teaching materials', href: `${T}/materials`, icon: BookOpen },
      { id: 'exams', label: 'Examinations', href: `${T}/exams`, icon: FileText },
      { id: 'marks', label: 'Mark entry', href: `${T}/marks`, icon: GraduationCap },
      { id: 'performance', label: 'Class performance', href: `${T}/performance`, icon: Users },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    items: [
      {
        id: 'reports',
        label: 'Reports & Analytics',
        href: `${T}/reports`,
        icon: FileBarChart2,
      },
    ],
  },
  {
    id: 'comms',
    label: 'Communication',
    items: [
      { id: 'notices', label: 'Notices', href: `${T}/notices`, icon: Megaphone },
      { id: 'messages', label: 'Messages', href: `${T}/messages`, icon: MessageSquare },
    ],
  },
  {
    id: 'hr',
    label: 'Leave & HR',
    items: [
      { id: 'leave', label: 'Apply leave', href: `${T}/leave`, icon: ClipboardList },
      {
        id: 'leave-history',
        label: 'Leave history',
        href: `${T}/leave#history`,
        icon: CalendarDays,
      },
    ],
  },
  {
    id: 'events',
    label: 'Events',
    items: [
      { id: 'calendar', label: 'Events', href: `${T}/calendar`, icon: CalendarDays },
      { id: 'calendar-month', label: 'Calendar', href: `${T}/calendar#month`, icon: CalendarDays },
    ],
  },
  {
    id: 'account',
    label: 'Account',
    items: [
      { id: 'profile', label: 'Profile', href: `${T}/profile`, icon: UserRound },
      { id: 'password', label: 'Password', href: `${T}/password`, icon: KeyRound },
    ],
  },
];

export const PRINCIPAL_PORTAL_NAV: PortalNavGroup[] = [
  {
    id: 'home',
    label: 'Home',
    items: [{ id: 'dash', label: 'Dashboard', href: P, icon: Shield, exact: true }],
  },
  {
    id: 'people',
    label: 'People',
    items: [
      { id: 'students', label: 'Students', href: `${P}/students`, icon: GraduationCap },
      { id: 'staff', label: 'Staff', href: `${P}/staff`, icon: Users },
      { id: 'admissions', label: 'Admissions', href: `${P}/admissions`, icon: School },
      { id: 'leave', label: 'Leave approvals', href: `${P}/leave`, icon: ClipboardList },
    ],
  },
  {
    id: 'ops',
    label: 'Operations',
    items: [
      { id: 'attendance', label: 'Attendance', href: `${P}/attendance`, icon: ClipboardCheck },
      { id: 'fees', label: 'Fees', href: `${P}/fees`, icon: CreditCard },
      { id: 'exams', label: 'Examinations', href: `${P}/exams`, icon: FileText },
      { id: 'communication', label: 'Communication', href: `${P}/communication`, icon: Megaphone },
      { id: 'reports', label: 'Reports', href: `${P}/reports`, icon: LayoutDashboard },
    ],
  },
];

export const STUDENT_BOTTOM_NAV: PortalNavItem[] = [
  { id: 'home', label: 'Home', href: S, icon: Home, exact: true },
  { id: 'attendance', label: 'Attendance', href: `${S}/attendance`, icon: ClipboardCheck },
  { id: 'fees', label: 'Fees', href: `${S}/fees`, icon: CreditCard },
  { id: 'messages', label: 'Inbox', href: `${S}/messages`, icon: Inbox },
  { id: 'profile', label: 'Me', href: `${S}/profile`, icon: UserRound },
];

export const STAFF_BOTTOM_NAV: PortalNavItem[] = [
  { id: 'home', label: 'Home', href: T, icon: Home, exact: true },
  { id: 'attendance', label: 'Attendance', href: `${T}/attendance/mark`, icon: ClipboardCheck },
  { id: 'marks', label: 'Marks', href: `${T}/marks`, icon: GraduationCap },
  { id: 'messages', label: 'Inbox', href: `${T}/messages`, icon: Inbox },
  { id: 'more', label: 'More', href: `${T}/profile`, icon: Settings },
];

export const PRINCIPAL_BOTTOM_NAV: PortalNavItem[] = [
  { id: 'home', label: 'Home', href: P, icon: Home, exact: true },
  { id: 'attendance', label: 'Attendance', href: `${P}/attendance`, icon: ClipboardCheck },
  { id: 'fees', label: 'Fees', href: `${P}/fees`, icon: CreditCard },
  { id: 'admissions', label: 'Admissions', href: `${P}/admissions`, icon: School },
  { id: 'more', label: 'More', href: `${P}/communication`, icon: Megaphone },
];

export function portalNavFor(kind: Exclude<SchoolSisPortalKind, 'admin' | 'none'>) {
  if (kind === 'principal') {
    return { groups: PRINCIPAL_PORTAL_NAV, bottom: PRINCIPAL_BOTTOM_NAV, title: 'Principal' };
  }
  if (kind === 'staff') {
    return { groups: STAFF_PORTAL_NAV, bottom: STAFF_BOTTOM_NAV, title: 'Staff' };
  }
  return { groups: STUDENT_PORTAL_NAV, bottom: STUDENT_BOTTOM_NAV, title: 'Student' };
}

export function isPortalNavActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
