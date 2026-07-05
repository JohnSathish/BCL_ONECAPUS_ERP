/**
 * NEHU FYUGP Philosophy — official syllabus reference.
 * Course codes use standard DEPT-### form (PHI-100, not PHI:100).
 */

import { formatNehuCourseCode } from './course-code.util';

export const PHILOSOPHY_NEHU_META = {
  departmentCode: 'PHI',
  programCode: 'BA-PHI',
  subjectSlug: 'philosophy',
  programmeName: 'FYUP in Philosophy',
} as const;

/** Philosophy major allowed minors (Morning + Day arts matrix). */
export const PHILOSOPHY_MAJOR_ALLOWED_MINORS = [
  'Education',
  'Garo',
  'Geography',
] as const;

export type PhilosophyNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  credits: number;
  contactHours?: number;
  notes?: string;
};

export const PHILOSOPHY_NEHU_PAPERS: PhilosophyNehuPaper[] = [
  {
    code: formatNehuCourseCode('PHI', 100),
    title: 'Understanding Philosophy',
    semester: 1,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'Also offered as MINOR (same code).',
  },
  {
    code: formatNehuCourseCode('PHI', 150),
    title: 'Ethics',
    semester: 2,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'Also offered as MINOR via PHI-151 cross-programme slot.',
  },
  {
    code: formatNehuCourseCode('PHI', 200),
    title: 'Logic',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('PHI', 201),
    title: 'Indian Philosophy-1',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('PHI', 250),
    title: 'Social and Political Philosophy',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('PHI', 251),
    title: 'History of Modern Western Philosophy',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('PHI', 252),
    title: 'Indian Philosophy-2',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('PHI', 253),
    title: 'Greek and Medieval Philosophy',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('PHI', 300),
    title: 'Epistemology and Metaphysics',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('PHI', 301),
    title: 'Existentialism',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('PHI', 302),
    title: 'Philosophy of Value',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes:
      'PHI-302 also serves as MINOR (Philosophical Understanding of Culture) for other majors.',
  },
  {
    code: formatNehuCourseCode('PHI', 303),
    title:
      'Internship / Apprenticeship / Community Engagement and Service / Field Based Learning or Minor Project',
    semester: 5,
    category: 'INTERNSHIP',
    credits: 4,
    contactHours: 120,
  },
  {
    code: formatNehuCourseCode('PHI', 350),
    title: 'Philosophy of Religion',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('PHI', 351),
    title: 'Philosophy of Mind',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('PHI', 352),
    title: 'Applied Ethics',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('PHI', 353),
    title: 'Contemporary Indian Philosophy',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
];

/** Sem 5 minor subtitle for PHI-302 on other BA programmes. */
export const PHILOSOPHY_SEM5_MINOR_SUBTITLE =
  'Philosophical Understanding of Culture';
