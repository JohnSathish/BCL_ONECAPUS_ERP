export type FacultyDrawerItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  keywords?: string[];
  /** Show unread badge from home snapshot when true */
  badgeFrom?: 'notifications' | 'attendancePending' | 'marksPending';
};

export type FacultyDrawerSection = {
  id: string;
  title: string;
  items: FacultyDrawerItem[];
};

/** Faculty drawer — modules with dedicated mobile screens or home-backed views. */
export const FACULTY_DRAWER_SECTIONS: FacultyDrawerSection[] = [
  {
    id: 'workspace',
    title: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/(staff)/(tabs)' },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: '🔔',
        href: '/(staff)/(tabs)/notifications',
        keywords: ['alerts', 'inbox'],
        badgeFrom: 'notifications',
      },
      {
        id: 'calendar',
        label: 'My Calendar',
        icon: '📆',
        href: '/(staff)/calendar',
        keywords: ['events', 'schedule'],
      },
      {
        id: 'classes',
        label: "Today's Classes",
        icon: '📅',
        href: '/(staff)/(tabs)',
        keywords: ['today'],
      },
      {
        id: 'timetable',
        label: 'Weekly Timetable',
        icon: '🗓',
        href: '/(staff)/timetable',
        keywords: ['schedule', 'periods'],
      },
      {
        id: 'attendance',
        label: 'Attendance',
        icon: '✅',
        href: '/(staff)/(tabs)/attendance',
        keywords: ['mark', 'present'],
        badgeFrom: 'attendancePending',
      },
      {
        id: 'students',
        label: 'Students',
        icon: '👨‍🎓',
        href: '/(staff)/(tabs)/students',
        keywords: ['roster', 'class list'],
      },
    ],
  },
  {
    id: 'academics',
    title: 'Academics',
    items: [
      {
        id: 'academics',
        label: 'My Classes',
        icon: '📚',
        href: '/(staff)/(tabs)/academics',
        keywords: ['subjects', 'sections'],
      },
      {
        id: 'teaching-load',
        label: 'Teaching Load',
        icon: '📊',
        href: '/(staff)/teaching-load',
        keywords: ['workload', 'hours', 'credits'],
      },
      {
        id: 'marks',
        label: 'Marks / IA',
        icon: '📝',
        href: '/(staff)/marks',
        keywords: ['ia', 'internal', 'assessment'],
        badgeFrom: 'marksPending',
      },
      {
        id: 'notices',
        label: 'Department Notices',
        icon: '📢',
        href: '/(staff)/notices',
        keywords: ['announcement', 'circular'],
      },
    ],
  },
  {
    id: 'administration',
    title: 'Administration',
    items: [
      {
        id: 'leave',
        label: 'Leave',
        icon: '🏖',
        href: '/(staff)/leave',
        keywords: ['hr', 'cl', 'el', 'sl'],
      },
      {
        id: 'payroll',
        label: 'Payroll & Payslips',
        icon: '💰',
        href: '/(staff)/payroll',
        keywords: ['salary', 'payslip', 'pay'],
      },
      {
        id: 'profile',
        label: 'Profile & Security',
        icon: '⚙️',
        href: '/(staff)/(tabs)/profile',
        keywords: ['password', 'account'],
      },
    ],
  },
];

export const FACULTY_QUICK_ACTIONS = [
  {
    id: 'attendance',
    label: 'Take Attendance',
    icon: '✅',
    tone: '#107C10',
    href: '/(staff)/(tabs)/attendance',
  },
  { id: 'marks', label: 'Enter Marks', icon: '📝', tone: '#0078D4', href: '/(staff)/marks' },
  { id: 'timetable', label: 'Timetable', icon: '📅', tone: '#2563EB', href: '/(staff)/timetable' },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: '🔔',
    tone: '#7C3AED',
    href: '/(staff)/(tabs)/notifications',
  },
  { id: 'leave', label: 'Leave', icon: '🏖', tone: '#D97706', href: '/(staff)/leave' },
  {
    id: 'payroll',
    label: 'Payslips',
    icon: '💰',
    tone: '#0F766E',
    href: '/(staff)/payroll',
  },
  {
    id: 'students',
    label: 'Student List',
    icon: '👨‍🎓',
    tone: '#0D9488',
    href: '/(staff)/(tabs)/students',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: '📆',
    tone: '#0284C7',
    href: '/(staff)/calendar',
  },
] as const;
