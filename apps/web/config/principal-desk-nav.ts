import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BarChart3,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Mail,
  Megaphone,
  ScanLine,
  Users,
  Wallet,
} from 'lucide-react';

export type PrincipalNavBadgeKey = 'leavePending' | 'unreadEmails';

export type PrincipalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  permission?: string;
  badgeKey?: PrincipalNavBadgeKey;
};

export type PrincipalNavGroup = {
  id: string;
  label: string;
  items: PrincipalNavItem[];
};

/** Grouped Principal Desk nav — only routes that exist today. */
export const PRINCIPAL_DESK_NAV: PrincipalNavGroup[] = [
  {
    id: 'executive',
    label: 'Executive',
    items: [
      {
        href: '/principal-desk',
        label: 'Dashboard',
        icon: LayoutDashboard,
        exact: true,
      },
    ],
  },
  {
    id: 'students',
    label: 'Student Management',
    items: [
      {
        href: '/principal-desk/student-lookup',
        label: 'Student Lookup',
        icon: ScanLine,
      },
    ],
  },
  {
    id: 'staff',
    label: 'Staff Management',
    items: [
      {
        href: '/principal-desk/staff',
        label: 'Staff Center',
        icon: Users,
      },
      {
        href: '/principal-desk/leave',
        label: 'Leave Approvals',
        icon: CalendarDays,
        badgeKey: 'leavePending',
      },
      {
        href: '/principal-desk/attendance',
        label: 'Attendance',
        icon: ClipboardCheck,
      },
    ],
  },
  {
    id: 'academics',
    label: 'Academics',
    items: [
      {
        href: '/principal-desk/academic',
        label: 'Academic',
        icon: BookOpen,
      },
      {
        href: '/principal-desk/examinations',
        label: 'Examinations',
        icon: ClipboardList,
      },
      {
        href: '/principal-desk/events',
        label: 'Events',
        icon: Megaphone,
      },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      {
        href: '/principal-desk/fees',
        label: 'Fee Monitor',
        icon: Wallet,
      },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      {
        href: '/principal-desk/communication-hub',
        label: 'Mail Center',
        icon: Mail,
        permission: 'principal-comms:access',
        badgeKey: 'unreadEmails',
      },
      {
        href: '/principal-desk/notices',
        label: 'Notices',
        icon: FileText,
      },
    ],
  },
  {
    id: 'committees',
    label: 'Committees',
    items: [
      {
        href: '/principal-desk/committees',
        label: 'Committee Activity',
        icon: Building2,
      },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    items: [
      {
        href: '/principal-desk/health',
        label: 'Institutional Health',
        icon: BarChart3,
      },
      {
        href: '/principal-desk/naac',
        label: 'NAAC Readiness',
        icon: Award,
      },
      {
        href: '/principal-desk/reports',
        label: 'Reports',
        icon: GraduationCap,
      },
    ],
  },
];

export function isPrincipalNavItemActive(
  pathname: string | null | undefined,
  item: PrincipalNavItem,
) {
  if (!pathname) return false;
  if (item.exact) {
    return pathname === item.href || pathname === `${item.href}/`;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function principalPageTitle(pathname: string | null | undefined): string {
  if (!pathname) return 'Principal Command Center';
  if (pathname === '/principal-desk' || pathname === '/principal-desk/') {
    return 'Principal Command Center';
  }
  for (const group of PRINCIPAL_DESK_NAV) {
    for (const item of group.items) {
      if (isPrincipalNavItemActive(pathname, item)) return item.label;
    }
  }
  return 'Principal Command Center';
}

export const PRINCIPAL_FAB_ACTIONS = [
  {
    id: 'leave',
    label: 'Approve Leave',
    href: '/principal-desk/leave',
    icon: CalendarDays,
  },
  {
    id: 'lookup',
    label: 'Student Lookup',
    href: '/principal-desk/student-lookup',
    icon: ScanLine,
  },
  {
    id: 'mail',
    label: 'Compose Email',
    href: '/principal-desk/communication-hub',
    icon: Mail,
    permission: 'principal-comms:access',
  },
  {
    id: 'notice',
    label: 'Send Notice',
    href: '/principal-desk/notices',
    icon: FileText,
  },
  {
    id: 'events',
    label: 'Create Meeting',
    href: '/principal-desk/events',
    icon: Megaphone,
  },
] as const;
