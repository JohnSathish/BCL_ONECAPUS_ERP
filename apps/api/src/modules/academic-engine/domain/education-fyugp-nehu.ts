/**
 * NEHU FYUGP Education — official syllabus reference.
 * Course codes use standard DEPT-### form (EDN-100, not EDN:100).
 */

import { formatNehuCourseCode } from './course-code.util';

export const EDUCATION_NEHU_META = {
  departmentCode: 'EDN',
  programCode: 'BA-EDU',
  subjectSlug: 'education',
  programmeName: 'FYUP in Education',
} as const;

/** Education major allowed minors (Morning + Day arts matrix). */
export const EDUCATION_MAJOR_ALLOWED_MINORS = [
  'Garo',
  'History',
  'Philosophy',
] as const;

export type EducationNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  credits: number;
  contactHours?: number;
  notes?: string;
};

export const EDUCATION_NEHU_PAPERS: EducationNehuPaper[] = [
  {
    code: formatNehuCourseCode('EDN', 100),
    title: 'Introduction to Education',
    semester: 1,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'Also offered as MINOR (same code).',
  },
  {
    code: formatNehuCourseCode('EDN', 150),
    title: 'Foundation to Education',
    semester: 2,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'Also offered as MINOR via EDN-151 cross-programme slot.',
  },
  {
    code: formatNehuCourseCode('EDN', 200),
    title: 'Development of Education in India-I (Pre-Independence Period)',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('EDN', 201),
    title: 'Development of Education in India-II (Post-Independence Period)',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('EDN', 250),
    title: 'Philosophical Foundations of Education',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('EDN', 251),
    title: 'Sociological Foundations of Education',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('EDN', 252),
    title: 'Psychological Foundations of Education',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('EDN', 253),
    title: 'Educational Technology',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('EDN', 300),
    title: 'Educational Management',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('EDN', 301),
    title: 'Curriculum Development',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('EDN', 302),
    title: 'Education for Sustainable Development',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes:
      'EDN-302 also serves as MINOR (Inclusive Education I) for other majors.',
  },
  {
    code: formatNehuCourseCode('EDN', 303),
    title:
      'Internship / Apprenticeship / Community Engagement and Service / Field Based Learning or Minor Project',
    semester: 5,
    category: 'INTERNSHIP',
    credits: 4,
    contactHours: 120,
  },
  {
    code: formatNehuCourseCode('EDN', 350),
    title: 'Introduction to Educational Research',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('EDN', 351),
    title: 'Methods & Techniques of Teaching',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('EDN', 352),
    title: 'Teaching-Learning Process',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('EDN', 353),
    title: 'Great Educators: Thoughts and Practices',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
];
