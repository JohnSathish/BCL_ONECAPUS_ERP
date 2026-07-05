/**
 * NEHU FYUGP Sociology — official syllabus reference.
 * Course codes use standard DEPT-### form (SOC-100, not SOC : 100).
 */

import { formatNehuCourseCode } from './course-code.util';

export const SOCIOLOGY_NEHU_META = {
  departmentCode: 'SOC',
  programCode: 'BA-SOC',
  subjectSlug: 'sociology',
  programmeName: 'FYUP in Sociology',
} as const;

/** Sociology major allowed minors (Morning + Day arts matrix). */
export const SOCIOLOGY_MAJOR_ALLOWED_MINORS = [
  'Economics',
  'Garo',
  'History',
  'Political Science',
] as const;

export type SociologyNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  credits: number;
  contactHours?: number;
  notes?: string;
};

export const SOCIOLOGY_NEHU_PAPERS: SociologyNehuPaper[] = [
  {
    code: formatNehuCourseCode('SOC', 100),
    title: 'Introduction to Sociology',
    semester: 1,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'Also offered as MINOR (same code).',
  },
  {
    code: formatNehuCourseCode('SOC', 150),
    title: 'Principles of Sociology',
    semester: 2,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'Also offered as MINOR via SOC-151 cross-programme slot.',
  },
  {
    code: formatNehuCourseCode('SOC', 200),
    title: 'Society in India',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('SOC', 201),
    title: 'Social Change',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('SOC', 250),
    title: 'Classical Sociological Thinkers',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('SOC', 251),
    title: 'Sociology of Family and Kinship',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('SOC', 252),
    title: 'Rural Sociology',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('SOC', 253),
    title: 'Urban Sociology',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('SOC', 300),
    title: 'Economic Sociology',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('SOC', 301),
    title: 'Political Sociology',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('SOC', 302),
    title: 'Sociology of Environment',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'SOC-302 also serves as MINOR for other majors.',
  },
  {
    code: formatNehuCourseCode('SOC', 303),
    title:
      'Internship / Apprenticeship / Community Engagement and Service / Field Based Learning or Minor Project',
    semester: 5,
    category: 'INTERNSHIP',
    credits: 4,
    contactHours: 120,
  },
  {
    code: formatNehuCourseCode('SOC', 350),
    title: 'Sociology of Religion',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('SOC', 351),
    title: 'Sociology of Gender',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('SOC', 352),
    title: 'Modern Sociological Thinkers',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('SOC', 353),
    title: 'Research Methodology',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
];
