/**
 * NEHU FYUGP Economics — official syllabus reference (Academic Council May/June 2024).
 * Single source of truth for Economics department course codes and titles.
 *
 * Architecture:
 * - One global course row per NEHU code (no Morning/Day duplicates).
 * - Major vs Minor = registration role; ECO-100, ECO-150, ECO-302 are dual-listed.
 * - Morning shift = same syllabi; shift controls offering sections only.
 */

export const ECONOMICS_NEHU_META = {
  departmentCode: 'ECO',
  programCode: 'BA-ECO',
  subjectSlug: 'economics',
  programmeName: 'FYUP in Economics',
  compulsoryCoreCount: 15,
  creditsPerSemester: 20,
} as const;

/** Economics major allowed minors (Morning + Day arts matrix). */
export const ECONOMICS_MAJOR_ALLOWED_MINORS = [
  'Geography',
  'History',
  'Political Science',
  'Sociology',
] as const;

/** Majors that may take Economics as minor (includes Commerce on Day shift). */
export const MAJORS_ALLOWING_ECONOMICS_MINOR = [
  'Geography',
  'History',
  'Political Science',
  'Sociology',
  'Commerce',
] as const;

export type EconomicsNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  credits: number;
  contactHours?: number;
  notes?: string;
};

export const ECONOMICS_NEHU_PAPERS: EconomicsNehuPaper[] = [
  {
    code: 'ECO-100',
    title: 'Microeconomics I',
    semester: 1,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes:
      'Also offered as MINOR (same code) for students with Economics as minor department.',
  },
  {
    code: 'ECO-150',
    title: 'Macroeconomics I',
    semester: 2,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes:
      'Also offered as MINOR via ECO-151 cross-programme slot for other BA programmes.',
  },
  {
    code: 'ECO-200',
    title: 'Economics of Growth and Development',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: 'ECO-201',
    title: 'Mathematical Methods for Economics I',
    semester: 3,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: 'ECO-250',
    title: 'Public Economics',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: 'ECO-251',
    title: 'Mathematical Methods for Economics II',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: 'ECO-252',
    title: 'Environmental Economics',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: 'ECO-253',
    title: 'Macroeconomics II',
    semester: 4,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: 'ECO-300',
    title: 'Statistical Methods for Economics',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: 'ECO-301',
    title: 'Microeconomics II',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: 'ECO-302',
    title: 'Indian Economy',
    semester: 5,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
    notes:
      'Also MINOR for students with Economics as minor department at Semester V.',
  },
  {
    code: 'ECO-303',
    title: 'Internship',
    semester: 5,
    category: 'INTERNSHIP',
    credits: 4,
    contactHours: 120,
  },
  {
    code: 'ECO-350',
    title: 'International Economics',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: 'ECO-351',
    title: 'History of Economic Thought',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: 'ECO-352',
    title: 'Financial Economics',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
  {
    code: 'ECO-353',
    title: 'Economics of Education and Health / Introductory Econometrics',
    semester: 6,
    category: 'MAJOR',
    credits: 4,
    contactHours: 60,
  },
];

/** Sem 1 / 2 minor slot uses the other department's -100 / -151 paper (NEHU pattern). */
export const ECONOMICS_MINOR_SEMESTER_PAPERS = [
  { semester: 1, code: 'ECO-100', title: 'Microeconomics I' },
  { semester: 2, code: 'ECO-151', title: 'Macroeconomics I' },
  { semester: 5, code: 'ECO-302', title: 'Indian Economy' },
] as const;
