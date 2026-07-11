/**
 * NEHU FYUGP Chemistry — official syllabus reference (doc_ChemistrySyllabus.pdf).
 * Single source of truth for Chemistry department course codes and titles.
 *
 * Architecture:
 * - One global course row per NEHU code (no Morning/Day duplicates).
 * - Major vs Minor = registration role; CHE-100, CHE-150, CHE-302 are dual-listed.
 * - Sem 1–2: THEORY_PRACTICAL (3+1); Sem 3–6: separate theory and lab papers.
 */

import { formatNehuCourseCode } from './course-code.util';

export const CHEMISTRY_NEHU_META = {
  departmentCode: 'CHE',
  programCode: 'BSC-CHE',
  subjectSlug: 'chemistry',
  programmeName: 'FYUP in Chemistry',
} as const;

/** Chemistry major allowed minors (DBC official matrix). */
export const CHEMISTRY_MAJOR_ALLOWED_MINORS = [
  'Mathematics',
  'Physics',
] as const;

export type ChemistryDeliveryKind =
  | 'THEORY'
  | 'PRACTICAL'
  | 'THEORY_PRACTICAL'
  | 'INTERNSHIP';

export type ChemistryNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  deliveryKind: ChemistryDeliveryKind;
  credits: number;
  theoryCredits: number;
  practicalCredits: number;
  contactHours: number;
  notes?: string;
};

const TP = 'THEORY_PRACTICAL' as const;
const TH = 'THEORY' as const;
const PR = 'PRACTICAL' as const;
const INT = 'INTERNSHIP' as const;

function tp(
  paper: number,
  title: string,
  semester: number,
  extra?: Partial<ChemistryNehuPaper>,
): ChemistryNehuPaper {
  return {
    code: formatNehuCourseCode('CHE', paper),
    title,
    semester,
    category: 'MAJOR',
    deliveryKind: TP,
    credits: 4,
    theoryCredits: 3,
    practicalCredits: 1,
    contactHours: 75,
    ...extra,
  };
}

function theory(
  paper: number,
  title: string,
  semester: number,
  extra?: Partial<ChemistryNehuPaper>,
): ChemistryNehuPaper {
  return {
    code: formatNehuCourseCode('CHE', paper),
    title,
    semester,
    category: 'MAJOR',
    deliveryKind: TH,
    credits: 4,
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours: 60,
    ...extra,
  };
}

function practical(
  paper: number,
  title: string,
  semester: number,
  contactHours: number,
  extra?: Partial<ChemistryNehuPaper>,
): ChemistryNehuPaper {
  return {
    code: formatNehuCourseCode('CHE', paper),
    title,
    semester,
    category: 'MAJOR',
    deliveryKind: PR,
    credits: 4,
    theoryCredits: 0,
    practicalCredits: 4,
    contactHours,
    ...extra,
  };
}

export const CHEMISTRY_NEHU_PAPERS: ChemistryNehuPaper[] = [
  tp(100, 'Introductory Chemistry-I', 1, {
    notes: 'Also offered as MINOR (same code).',
  }),
  tp(150, 'Introductory Chemistry-II', 2, {
    notes: 'Also offered as MINOR via CHE-151 cross-programme slot.',
  }),
  theory(200, 'Chemistry-III', 3),
  practical(201, 'Organic Chemistry Laboratory', 3, 120),
  theory(250, 'Inorganic Chemistry-I', 4),
  theory(251, 'Organic Chemistry-I', 4),
  theory(252, 'Physical Chemistry-I', 4),
  practical(253, 'Inorganic Chemistry Laboratory', 4, 120),
  theory(300, 'Chemistry-IV', 5),
  theory(301, 'Organic Chemistry-II', 5),
  theory(302, 'Chemistry-V', 5, {
    notes:
      'Sem 5 minor for other programmes uses same code with title "General Chemistry – III" (3+1 credits).',
  }),
  {
    code: formatNehuCourseCode('CHE', 303),
    title: 'Internship',
    semester: 5,
    category: 'INTERNSHIP',
    deliveryKind: INT,
    credits: 4,
    theoryCredits: 0,
    practicalCredits: 4,
    contactHours: 120,
  },
  theory(350, 'Inorganic Chemistry-II', 6),
  theory(351, 'Organic Chemistry-III', 6),
  theory(352, 'Physical Chemistry-II', 6),
  practical(353, 'Physical Chemistry Laboratory', 6, 60),
];

export const CHEMISTRY_SEM5_MINOR_CODE = '302';

export const CHEMISTRY_SEM5_MINOR_TITLE = 'General Chemistry – III';
