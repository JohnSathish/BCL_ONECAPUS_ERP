import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Building2,
  Bus,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileStack,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Library,
  Mail,
  Megaphone,
  MessageSquareWarning,
  School,
  Settings,
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
  /** Soft-hide modules that are not rolled out for all campuses */
  optional?: boolean;
};

export type PrincipalNavGroup = {
  id: string;
  label: string;
  /** When false, section starts collapsed (desktop expanded sidebar). */
  defaultExpanded?: boolean;
  items: PrincipalNavItem[];
};

/**
 * Principal Desk sidebar IA.
 * Mail stays early in Overview (not removed/relocated out of primary access).
 */
export const PRINCIPAL_DESK_NAV: PrincipalNavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    defaultExpanded: true,
    items: [
      {
        href: '/principal-desk',
        label: 'Dashboard',
        icon: LayoutDashboard,
        exact: true,
      },
      {
        href: '/principal-desk/notifications',
        label: 'Notifications',
        icon: Bell,
      },
      {
        href: '/principal-desk/communication-hub',
        label: 'Mail',
        icon: Mail,
        permission: 'principal-comms:access',
        badgeKey: 'unreadEmails',
      },
    ],
  },
  {
    id: 'students',
    label: 'Student Management',
    defaultExpanded: true,
    items: [
      {
        href: '/principal-desk/student-lookup',
        label: 'Student Quick Lookup',
        icon: ScanLine,
      },
    ],
  },
  {
    id: 'staff',
    label: 'Staff Management',
    defaultExpanded: true,
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
    ],
  },
  {
    id: 'academics-ops',
    label: 'Academics & Operations',
    defaultExpanded: true,
    items: [
      {
        href: '/principal-desk/attendance',
        label: 'Attendance Overview',
        icon: ClipboardCheck,
      },
      {
        href: '/principal-desk/fees',
        label: 'Fee & Finance Summary',
        icon: Wallet,
      },
      {
        href: '/principal-desk/academic',
        label: 'Academic Performance',
        icon: BookOpen,
      },
      {
        href: '/principal-desk/examinations',
        label: 'Examination & Results',
        icon: ClipboardList,
      },
      {
        href: '/principal-desk/timetable',
        label: 'Timetable',
        icon: CalendarRange,
      },
    ],
  },
  {
    id: 'campus',
    label: 'Campus Services',
    defaultExpanded: false,
    items: [
      {
        href: '/principal-desk/library',
        label: 'Library Overview',
        icon: Library,
      },
      {
        href: '/principal-desk/hostel',
        label: 'Hostel',
        icon: School,
        optional: true,
      },
      {
        href: '/principal-desk/transport',
        label: 'Transport',
        icon: Bus,
        optional: true,
      },
    ],
  },
  {
    id: 'comms-gov',
    label: 'Communication & Governance',
    defaultExpanded: true,
    items: [
      {
        href: '/principal-desk/notices',
        label: 'Announcements',
        icon: Megaphone,
      },
      {
        href: '/principal-desk/events',
        label: 'Events & Calendar',
        icon: CalendarDays,
      },
      {
        href: '/principal-desk/documents',
        label: 'Documents & Circulars',
        icon: FileStack,
      },
      {
        href: '/principal-desk/grievances',
        label: 'Complaints & Grievances',
        icon: MessageSquareWarning,
      },
      {
        href: '/principal-desk/committees',
        label: 'Committees',
        icon: Building2,
      },
    ],
  },
  {
    id: 'insights',
    label: 'Reports & Insights',
    defaultExpanded: false,
    items: [
      {
        href: '/principal-desk/reports',
        label: 'Reports & Analytics',
        icon: GraduationCap,
      },
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
        href: '/principal-desk/ai-insights',
        label: 'AI Insights',
        icon: Bot,
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    defaultExpanded: false,
    items: [
      {
        href: '/principal-desk/settings',
        label: 'Settings',
        icon: Settings,
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
