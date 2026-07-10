export type DrawerMenuItem = {
  id: string;
  label: string;
  href: string;
  keywords?: string[];
};

export type DrawerMenuSection = {
  id: string;
  title: string;
  icon: string;
  items: DrawerMenuItem[];
};

/** Student drawer — only modules with mobile screens implemented. */
export const DRAWER_MENU_SECTIONS: DrawerMenuSection[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: '🏠',
    items: [{ id: 'home', label: 'Dashboard', href: '/(student)/(tabs)/', keywords: ['home'] }],
  },
  {
    id: 'academics',
    title: 'My Academics',
    icon: '📚',
    items: [
      {
        id: 'my-academics',
        label: 'My Academic Profile',
        href: '/(student)/(tabs)/academics',
        keywords: ['major', 'minor', 'mdc', 'aec', 'sec', 'vtc', 'subjects', 'curriculum'],
      },
      {
        id: 'attendance',
        label: 'Attendance',
        href: '/(student)/attendance',
        keywords: ['attendance', 'present'],
      },
      {
        id: 'timetable',
        label: 'Timetable',
        href: '/(student)/timetable',
        keywords: ['schedule', 'class'],
      },
      {
        id: 'assignments',
        label: 'Assignments',
        href: '/(student)/assignments',
        keywords: ['homework', 'lms'],
      },
    ],
  },
  {
    id: 'examination',
    title: 'Examination',
    icon: '🎓',
    items: [
      {
        id: 'exam-fees',
        label: 'Examination Fees',
        href: '/(student)/examination-fees',
        keywords: ['exam fee', 'back paper', 'nehu'],
      },
      {
        id: 'hall-ticket',
        label: 'Hall Ticket',
        href: '/(student)/exam-schedule',
        keywords: ['exam', 'admit'],
      },
      {
        id: 'results',
        label: 'Results',
        href: '/(student)/results',
        keywords: ['marks'],
      },
      {
        id: 'internal-marks',
        label: 'Internal Marks',
        href: '/(student)/results',
        keywords: ['internals'],
      },
      {
        id: 'exam-schedule',
        label: 'Exam Schedule',
        href: '/(student)/exam-schedule',
        keywords: ['timetable', 'exam'],
      },
    ],
  },
  {
    id: 'finance',
    title: 'Finance',
    icon: '💰',
    items: [
      {
        id: 'fees',
        label: 'Fees',
        href: '/(student)/(tabs)/fees',
        keywords: ['pay', 'due', 'payment'],
      },
      {
        id: 'receipts',
        label: 'Receipts',
        href: '/(student)/(tabs)/fees',
        keywords: ['download', 'receipt'],
      },
    ],
  },
  {
    id: 'campus',
    title: 'Campus',
    icon: '🏫',
    items: [
      { id: 'library', label: 'Library', href: '/(student)/library', keywords: ['books'] },
      {
        id: 'notices',
        label: 'Notices',
        href: '/(student)/(tabs)/notifications',
        keywords: ['announcement'],
      },
      {
        id: 'leave',
        label: 'Apply Leave',
        href: '/(student)/leave',
        keywords: ['absence', 'cl'],
      },
    ],
  },
  {
    id: 'account',
    title: 'Account',
    icon: '👤',
    items: [
      {
        id: 'profile',
        label: 'Profile',
        href: '/(student)/(tabs)/profile',
        keywords: ['account', 'details'],
      },
    ],
  },
];

export type QuickAction = {
  id: string;
  label: string;
  icon: string;
  href: string;
  tone: string;
};

export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'pay-fees',
    label: 'Pay Fees',
    icon: '💳',
    href: '/(student)/(tabs)/fees',
    tone: '#1d4ed8',
  },
  {
    id: 'receipt',
    label: 'Receipt',
    icon: '🧾',
    href: '/(student)/(tabs)/fees',
    tone: '#0d9488',
  },
  {
    id: 'hall-ticket',
    label: 'Hall Ticket',
    icon: '🎫',
    href: '/(student)/exam-schedule',
    tone: '#d97706',
  },
  {
    id: 'timetable',
    label: 'Timetable',
    icon: '📅',
    href: '/(student)/timetable',
    tone: '#2563eb',
  },
  {
    id: 'leave',
    label: 'Apply Leave',
    icon: '📝',
    href: '/(student)/leave',
    tone: '#059669',
  },
  {
    id: 'results',
    label: 'Results',
    icon: '📊',
    href: '/(student)/results',
    tone: '#0f766e',
  },
];
