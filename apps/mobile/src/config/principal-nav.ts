import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type PrincipalMobileIcon = ComponentProps<typeof Ionicons>['name'];

export type PrincipalMobileNavBadgeKey = 'leavePending' | 'unreadEmails';

export type PrincipalMobileNavItem = {
  id: string;
  label: string;
  icon: PrincipalMobileIcon;
  /** Expo-router href */
  href: string;
  badgeKey?: PrincipalMobileNavBadgeKey;
  optional?: boolean;
  /** Match exact path for active state */
  exact?: boolean;
};

export type PrincipalMobileNavGroup = {
  id: string;
  label: string;
  defaultExpanded?: boolean;
  items: PrincipalMobileNavItem[];
};

/**
 * Principal mobile drawer IA — mirrors web Principal Desk.
 * Mail stays in Overview after Notifications.
 */
export const PRINCIPAL_MOBILE_NAV: PrincipalMobileNavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    defaultExpanded: true,
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        icon: 'grid-outline',
        href: '/(principal)/(tabs)',
        exact: true,
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: 'notifications-outline',
        href: '/(principal)/(tabs)/notifications',
      },
      {
        id: 'mail',
        label: 'Mail',
        icon: 'mail-outline',
        href: '/(principal)/(tabs)/inbox',
        badgeKey: 'unreadEmails',
      },
    ],
  },
  {
    id: 'people',
    label: 'People',
    defaultExpanded: true,
    items: [
      {
        id: 'students',
        label: 'Student Management',
        icon: 'school-outline',
        href: '/(principal)/student-lookup',
      },
      {
        id: 'staff',
        label: 'Staff Management',
        icon: 'people-outline',
        href: '/(principal)/module/staff',
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    defaultExpanded: true,
    items: [
      {
        id: 'attendance',
        label: 'Attendance Overview',
        icon: 'checkbox-outline',
        href: '/(principal)/module/attendance',
      },
      {
        id: 'fees',
        label: 'Fee & Finance Summary',
        icon: 'wallet-outline',
        href: '/(principal)/module/fees',
      },
      {
        id: 'academic',
        label: 'Academic Performance',
        icon: 'book-outline',
        href: '/(principal)/module/academic',
      },
      {
        id: 'examinations',
        label: 'Examination & Results',
        icon: 'clipboard-outline',
        href: '/(principal)/module/examinations',
      },
      {
        id: 'timetable',
        label: 'Timetable',
        icon: 'calendar-outline',
        href: '/(principal)/module/timetable',
      },
      {
        id: 'leave',
        label: 'Leave Approvals',
        icon: 'calendar-number-outline',
        href: '/(principal)/(tabs)/approvals',
        badgeKey: 'leavePending',
      },
    ],
  },
  {
    id: 'insights-comms',
    label: 'Reports & Communication',
    defaultExpanded: true,
    items: [
      {
        id: 'reports',
        label: 'Reports & Analytics',
        icon: 'bar-chart-outline',
        href: '/(principal)/module/reports',
      },
      {
        id: 'announcements',
        label: 'Announcements',
        icon: 'megaphone-outline',
        href: '/(principal)/module/announcements',
      },
      {
        id: 'events',
        label: 'Events & Calendar',
        icon: 'calendar-outline',
        href: '/(principal)/module/events',
      },
      {
        id: 'documents',
        label: 'Documents & Circulars',
        icon: 'document-text-outline',
        href: '/(principal)/module/documents',
      },
      {
        id: 'grievances',
        label: 'Complaints & Grievances',
        icon: 'alert-circle-outline',
        href: '/(principal)/module/grievances',
      },
    ],
  },
  {
    id: 'campus',
    label: 'Campus Services',
    defaultExpanded: false,
    items: [
      {
        id: 'transport',
        label: 'Transport',
        icon: 'bus-outline',
        href: '/(principal)/module/transport',
        optional: true,
      },
      {
        id: 'hostel',
        label: 'Hostel',
        icon: 'home-outline',
        href: '/(principal)/module/hostel',
        optional: true,
      },
      {
        id: 'library',
        label: 'Library Overview',
        icon: 'library-outline',
        href: '/(principal)/module/library',
      },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    defaultExpanded: false,
    items: [
      {
        id: 'ai',
        label: 'AI Insights / Principal Assistant',
        icon: 'sparkles-outline',
        href: '/(principal)/module/ai-insights',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    defaultExpanded: false,
    items: [
      {
        id: 'settings',
        label: 'Settings',
        icon: 'settings-outline',
        href: '/(principal)/(tabs)/profile',
      },
    ],
  },
];

export function isPrincipalMobileNavActive(
  pathname: string | null | undefined,
  item: PrincipalMobileNavItem,
) {
  if (!pathname) return false;
  const path = pathname.replace(/\/$/, '');

  if (item.exact || item.id === 'dashboard') {
    return (
      path === '/' ||
      path.endsWith('/(tabs)') ||
      path.endsWith('/(tabs)/index') ||
      /\/\(principal\)\/\(tabs\)$/.test(path)
    );
  }

  if (item.id === 'mail') {
    return path.includes('/inbox') || path.includes('/mail/');
  }
  if (item.id === 'settings') {
    return path.includes('/profile');
  }
  if (item.id === 'leave') {
    return path.includes('/approvals') || path.includes('/leave/');
  }

  const slug = item.href.split('/').filter(Boolean).pop() ?? '';
  return slug ? path.includes(`/${slug}`) : false;
}
