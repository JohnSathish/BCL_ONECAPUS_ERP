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
      {
        id: 'syllabus',
        label: 'My Syllabus',
        href: '/(student)/syllabus',
        keywords: ['syllabus', 'pdf', 'paper', 'curriculum'],
      },
      {
        id: 'short-term-courses',
        label: 'Short-Term Courses',
        href: '/(student)/short-term-courses',
        keywords: ['cafa', 'bccs', 'certificate', 'course', 'short-term'],
      },
      {
        id: 'department-activities',
        label: 'Department Activities',
        href: '/(student)/department-activities',
        keywords: ['seminar', 'workshop', 'activity', 'department', 'event'],
      },
      {
        id: 'activity-transcript',
        label: 'Activity transcript',
        href: '/(student)/department-activities',
        keywords: ['transcript', 'achievement', 'certificate', 'share'],
      },
      {
        id: 'campus-competitions',
        label: 'Campus Competitions',
        href: '/(student)/campus-competitions',
        keywords: ['house', 'sports', 'meet', 'competition', 'leaderboard'],
      },
    ],
  },
  {
    id: 'short-term',
    title: 'Short-Term Courses',
    icon: '📚',
    items: [
      {
        id: 'stc-available',
        label: 'Available Courses',
        href: '/(student)/short-term-courses',
        keywords: ['available', 'apply'],
      },
      {
        id: 'stc-my',
        label: 'My Courses',
        href: '/(student)/short-term-courses?tab=mine',
        keywords: ['registered'],
      },
      {
        id: 'stc-attendance',
        label: 'Attendance',
        href: '/(student)/short-term-courses?tab=attendance',
        keywords: ['attendance'],
      },
      {
        id: 'stc-certificate',
        label: 'Certificate',
        href: '/(student)/short-term-courses?tab=certificate',
        keywords: ['certificate', 'download'],
      },
    ],
  },
  {
    id: 'examination',
    title: 'Examination',
    icon: '🎓',
    items: [
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
        id: 'exam-fees',
        label: 'Semester Exam Fees',
        href: '/(student)/examination-fees',
        keywords: ['exam fee', 'back paper', 'nehu'],
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
    id: 'services',
    title: 'Services',
    icon: '🧾',
    items: [
      {
        id: 'feedback',
        label: 'Feedback',
        href: '/(student)/feedback',
        keywords: ['survey', 'naac', 'sss', 'rating'],
      },
      {
        id: 'certificates',
        label: 'Certificates',
        href: '/(student)/certificates',
        keywords: ['bonafide', 'tc', 'character'],
      },
      {
        id: 'registration-web',
        label: 'Subject renewal',
        href: '/(student)/registration-web',
        keywords: ['subject', 'elective', 'fyugp'],
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
        label: 'Alerts',
        href: '/(student)/(tabs)/notifications',
        keywords: ['announcement', 'notification'],
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

/** Maps drawer item ids → remote featureFlags keys. Missing key = always visible. */
export const DRAWER_ITEM_FEATURE_FLAGS: Record<string, string> = {
  attendance: 'attendance',
  timetable: 'timetable',
  assignments: 'assignments',
  'hall-ticket': 'examination',
  results: 'results',
  'internal-marks': 'examination',
  'exam-schedule': 'examination',
  fees: 'fees',
  'exam-fees': 'fees',
  receipts: 'fees',
  feedback: 'feedback',
  certificates: 'certificates',
  library: 'library',
  notices: 'notifications',
  leave: 'leave',
};

export function filterDrawerByFeatureFlags(
  sections: DrawerMenuSection[],
  flags: Record<string, boolean> | undefined,
): DrawerMenuSection[] {
  if (!flags || Object.keys(flags).length === 0) return sections;
  return sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        const flagKey = DRAWER_ITEM_FEATURE_FLAGS[item.id];
        if (!flagKey) return true;
        return flags[flagKey] !== false;
      }),
    }))
    .filter((section) => section.items.length > 0);
}

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
