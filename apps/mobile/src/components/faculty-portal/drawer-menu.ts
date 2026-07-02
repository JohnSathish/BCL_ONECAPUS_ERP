export type FacultyDrawerItem = {
  id: string;
  label: string;
  icon: string;
  href: string;
  keywords?: string[];
};

export type FacultyDrawerSection = {
  id: string;
  title: string;
  items: FacultyDrawerItem[];
};

/** Faculty drawer — only modules with mobile screens implemented. */
export const FACULTY_DRAWER_SECTIONS: FacultyDrawerSection[] = [
  {
    id: 'workspace',
    title: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/(staff)/(tabs)' },
      { id: 'classes', label: "Today's Classes", icon: '📅', href: '/(staff)/(tabs)' },
      { id: 'timetable', label: 'Weekly Timetable', icon: '🗓', href: '/(staff)/timetable' },
      { id: 'attendance', label: 'Attendance', icon: '✅', href: '/(staff)/(tabs)/attendance' },
      { id: 'students', label: 'Students', icon: '👨‍🎓', href: '/(staff)/(tabs)/students' },
    ],
  },
  {
    id: 'academics',
    title: 'Academics',
    items: [
      { id: 'academics', label: 'My Classes', icon: '📚', href: '/(staff)/(tabs)/academics' },
      {
        id: 'marks',
        label: 'Marks',
        icon: '📝',
        href: '/(staff)/marks',
        keywords: ['ia', 'internal'],
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
        keywords: ['hr', 'cl', 'el'],
      },
      {
        id: 'payroll',
        label: 'Payroll',
        icon: '💰',
        href: '/(staff)/(tabs)/profile',
        keywords: ['salary', 'payslip'],
      },
      { id: 'profile', label: 'Profile & Security', icon: '⚙️', href: '/(staff)/(tabs)/profile' },
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
  { id: 'leave', label: 'Leave', icon: '🏖', tone: '#D97706', href: '/(staff)/leave' },
  {
    id: 'students',
    label: 'Student List',
    icon: '👨‍🎓',
    tone: '#0D9488',
    href: '/(staff)/(tabs)/students',
  },
] as const;
