/**
 * NEHU FYUGP English — official syllabus reference (Academic Council May 2024).
 * Course codes use standard DEPT-### form (ENG-100, not ENG:100).
 */

import { formatNehuCourseCode } from './course-code.util';

export const ENGLISH_NEHU_META = {
  departmentCode: 'ENG',
  programCode: 'BA-ENG',
  subjectSlug: 'english',
  programmeName: 'FYUP in English',
} as const;

/** English major allowed minors (Morning + Day arts matrix). */
export const ENGLISH_MAJOR_ALLOWED_MINORS = [
  'Education',
  'Geography',
  'Philosophy',
  'Political Science',
] as const;

export type EnglishNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  credits: number;
  contactHours?: number;
  notes?: string;
};

export const ENGLISH_NEHU_PAPERS: EnglishNehuPaper[] = [
  {
    code: formatNehuCourseCode('ENG', 100),
    title: 'Introduction to English Literature',
    semester: 1,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'Also offered as MINOR (same code).',
  },
  {
    code: formatNehuCourseCode('ENG', 150),
    title: 'British Poetry: Milton To the Present',
    semester: 2,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'Also offered as MINOR via ENG-151 cross-programme slot.',
  },
  {
    code: formatNehuCourseCode('ENG', 200),
    title: 'British Fiction (19th and 20th Century)',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('ENG', 201),
    title: 'British Drama (16th Century to the Present)',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('ENG', 250),
    title: 'British Prose',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('ENG', 251),
    title: 'European Classical Literature',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('ENG', 252),
    title: 'Classical Literature Criticism',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('ENG', 253),
    title: 'Introduction to General Linguistics & Phonetics',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('ENG', 300),
    title: 'Classical Indian Literature',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('ENG', 301),
    title: 'Contemporary Literary Theory & Criticism-I',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('ENG', 302),
    title: 'Indian Writings in English',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'ENG-302 also serves as MINOR for other majors.',
  },
  {
    code: formatNehuCourseCode('ENG', 303),
    title:
      'Internship / Apprenticeship / Community Engagement and Service / Field Based Learning or Minor Project',
    semester: 5,
    category: 'INTERNSHIP',
    credits: 4,
    contactHours: 120,
  },
  {
    code: formatNehuCourseCode('ENG', 350),
    title: 'American Literature-I',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('ENG', 351),
    title: 'World Literature',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('ENG', 352),
    title: 'Literature from North-East India / Folk Literature',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('ENG', 353),
    title: 'Popular Literature / Gender Studies / Semiotics & Stylistics',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
];
