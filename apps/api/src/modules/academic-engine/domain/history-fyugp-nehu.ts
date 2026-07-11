/**
 * NEHU FYUGP History — official syllabus reference.
 * Course codes use standard DEPT-### form (HIS-200, not HIS : 200).
 *
 * Semesters 1–2 titles are provisional (NEHU PDF starts at Semester III).
 * Semesters 3–6 match doc_HistorySyllabus.pdf.
 */

import { formatNehuCourseCode } from './course-code.util';

export const HISTORY_NEHU_META = {
  departmentCode: 'HIS',
  programCode: 'BA-HIS',
  subjectSlug: 'history',
  programmeName: 'FYUP in History',
} as const;

/** History major allowed minors (Morning + Day arts matrix). */
export const HISTORY_MAJOR_ALLOWED_MINORS = [
  'Economics',
  'Philosophy',
  'Political Science',
  'Sociology',
] as const;

export type HistoryNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  credits: number;
  contactHours?: number;
  notes?: string;
};

export const HISTORY_NEHU_PAPERS: HistoryNehuPaper[] = [
  {
    code: formatNehuCourseCode('HIS', 100),
    title: 'History of India (Ancient to 1200 CE)',
    semester: 1,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes:
      'Provisional Sem I title — NEHU History PDF begins at Semester III; update when official Sem I syllabus is published.',
  },
  {
    code: formatNehuCourseCode('HIS', 150),
    title: 'History of India: Maurya to Post Gupta Period',
    semester: 2,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes:
      'Provisional Sem II title — update when official Sem II syllabus is published.',
  },
  {
    code: formatNehuCourseCode('HIS', 200),
    title: 'History of Early Medieval India (650–1206 C.E.)',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('HIS', 201),
    title: 'History of World Civilizations',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('HIS', 250),
    title: 'History of Medieval India (13th-18th century C.E.)',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('HIS', 251),
    title: 'History and Culture of Meghalaya',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('HIS', 252),
    title: 'Modern North East India (1824-1947 C.E.)',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('HIS', 253),
    title: 'Modern Europe (mid-15th century to 1815 C.E.)',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('HIS', 300),
    title: 'History of Modern India (1757-1857 C.E.)',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('HIS', 301),
    title: 'Contemporary North East India (1947-1987 C.E.)',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('HIS', 302),
    title: 'Modern World (1815 to 1945 C.E.)',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes: 'HIS-302 also serves as MINOR for other majors.',
  },
  {
    code: formatNehuCourseCode('HIS', 303),
    title: 'Internship',
    semester: 5,
    category: 'INTERNSHIP',
    credits: 4,
    contactHours: 120,
  },
  {
    code: formatNehuCourseCode('HIS', 350),
    title: 'History of Indian Nationalism (1858-1950 C.E.)',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('HIS', 351),
    title: 'Contemporary World (1945-1991 C.E.)',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('HIS', 352),
    title: 'Historiography',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: formatNehuCourseCode('HIS', 353),
    title: 'History of East-Asia (1839-1949 C.E.)',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
];
