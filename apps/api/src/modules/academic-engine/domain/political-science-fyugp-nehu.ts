/**
 * NEHU FYUGP Political Science — official syllabus reference.
 * Course codes use standard DEPT-### form (POL-100, not POL:100).
 * Department code POL matches NEHU (not PSC).
 */

import { formatNehuCourseCode } from './course-code.util';

export const POLITICAL_SCIENCE_NEHU_META = {
  departmentCode: 'POL',
  programCode: 'BA-POL',
  subjectSlug: 'political-science',
  programmeName: 'FYUP in Political Science',
} as const;

/** Political Science major allowed minors (Morning + Day arts matrix). */
export const POLITICAL_SCIENCE_MAJOR_ALLOWED_MINORS = [
  'Economics',
  'Education',
  'History',
  'Sociology',
] as const;

export type PoliticalScienceNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  credits: number;
  contactHours?: number;
  notes?: string;
};

export const POLITICAL_SCIENCE_NEHU_PAPERS: PoliticalScienceNehuPaper[] = [
  {
    code: formatNehuCourseCode('POL', 100),
    title: 'Political Theory',
    semester: 1,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'Also offered as MINOR (same code).',
  },
  {
    code: formatNehuCourseCode('POL', 150),
    title: 'Indian Political System',
    semester: 2,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'Also offered as MINOR via POL-151 cross-programme slot.',
  },
  {
    code: formatNehuCourseCode('POL', 200),
    title: 'Introduction to International Relations',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('POL', 201),
    title: 'Public Administration',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('POL', 250),
    title: 'Classical Traditions in Western Political Thought',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('POL', 251),
    title: 'Political Systems of Select Countries',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('POL', 252),
    title: 'Indian Administration',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('POL', 253),
    title: 'Political Sociology',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('POL', 300),
    title: 'Socialist Political Thought',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('POL', 301),
    title: 'State and Democracy in India',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('POL', 302),
    title: 'Government and Politics in Northeast India',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'POL-302 also serves as MINOR for other majors.',
  },
  {
    code: formatNehuCourseCode('POL', 303),
    title: 'Internship',
    semester: 5,
    category: 'INTERNSHIP',
    credits: 4,
    contactHours: 120,
  },
  {
    code: formatNehuCourseCode('POL', 350),
    title: 'Modern Indian Political Thought',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('POL', 351),
    title: 'Feminist Theory and Practice',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('POL', 352),
    title: 'Introduction to Public Policy',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('POL', 353),
    title: 'The United Nations',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
];
