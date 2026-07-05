/**
 * NEHU FYUGP Garo — official syllabus reference (2024).
 * Course codes use standard DEPT-### form (GAR-100, not GAR:100).
 */

import { formatNehuCourseCode } from './course-code.util';

export const GARO_NEHU_META = {
  departmentCode: 'GAR',
  programCode: 'BA-GAR',
  subjectSlug: 'garo',
  programmeName: 'FYUP in Garo',
} as const;

/** Garo major allowed minors (Morning + Day arts matrix). */
export const GARO_MAJOR_ALLOWED_MINORS = [
  'Education',
  'Geography',
  'Philosophy',
  'Sociology',
] as const;

export type GaroNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  credits: number;
  contactHours?: number;
  notes?: string;
};

export const GARO_NEHU_PAPERS: GaroNehuPaper[] = [
  {
    code: formatNehuCourseCode('GAR', 100),
    title: 'Introduction to Garo Prose and Poetry',
    semester: 1,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'Also offered as MINOR (same code).',
  },
  {
    code: formatNehuCourseCode('GAR', 150),
    title: 'Oral Narratives and Folklore',
    semester: 2,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'Also offered as MINOR via GAR-151 cross-programme slot.',
  },
  {
    code: formatNehuCourseCode('GAR', 200),
    title: 'History of Garo Language',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GAR', 201),
    title: 'History of Garo Literature',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GAR', 250),
    title: 'Bhasha Bigyan O Binsho Sataker Prabandhaboli',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GAR', 251),
    title: 'Madya Juger Nirbachito Bangla Sahitya',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GAR', 252),
    title: 'Loko Sanskriti Parichay',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GAR', 253),
    title: 'Bangla Rangamancher Itihas O Adhunik Bangla Natak',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GAR', 300),
    title: 'Prabandher Rupriti O Nirbachito Prabandhaboli',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GAR', 301),
    title: 'Kothasahityer Rupriti O Bangla Kotha Sahitya',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GAR', 302),
    title: 'Rabindra Sahitya',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'GAR-302 also serves as MINOR for other majors.',
  },
  {
    code: formatNehuCourseCode('GAR', 303),
    title:
      'Internship / Apprenticeship / Community Engagement and Service / Field Based Learning or Minor Project',
    semester: 5,
    category: 'INTERNSHIP',
    credits: 4,
    contactHours: 120,
  },
  {
    code: formatNehuCourseCode('GAR', 350),
    title: 'Nataker Rupriti O Bangla Natak Path',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GAR', 351),
    title: 'Kavyer Rupbhed O Bangla Kavya-Kabita',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GAR', 352),
    title: 'Pratibeshi Sahitya O Sanskriti',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('GAR', 353),
    title: 'Bangla Sahitye Mohila Lekhakder Abodan',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
];
