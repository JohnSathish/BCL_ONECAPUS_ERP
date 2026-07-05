/**
 * NEHU FYUGP Mathematics — official syllabus reference (doc_MathematicsSyllabus.pdf).
 * Single source of truth for Mathematics department course codes and titles.
 *
 * Architecture:
 * - One global course row per NEHU code (no Morning/Day duplicates).
 * - Major vs Minor = registration role; MTH-100, MTH-150, MTH-302 are dual-listed.
 * - NEHU lists MTH-352 twice (Discrete Mathematics + Operations Research); ERP uses
 *   MTH-353 for Operations Research so Sem 6 has four distinct major codes like other sciences.
 * - All honours papers are pure THEORY (4 credits, 60 contact hours).
 */

import { formatNehuCourseCode } from './course-code.util';

export const MATHEMATICS_NEHU_META = {
  departmentCode: 'MTH',
  programCode: 'BSC-MTH',
  subjectSlug: 'mathematics',
  programmeName: 'FYUP in Mathematics',
} as const;

/** Mathematics major allowed minors (DBC official matrix). */
export const MATHEMATICS_MAJOR_ALLOWED_MINORS = [
  'Physics',
  'Chemistry',
] as const;

export type MathematicsDeliveryKind = 'THEORY' | 'INTERNSHIP';

export type MathematicsNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  deliveryKind: MathematicsDeliveryKind;
  credits: number;
  theoryCredits: number;
  practicalCredits: number;
  contactHours: number;
  notes?: string;
};

const TH = 'THEORY' as const;
const INT = 'INTERNSHIP' as const;

function theory(
  paper: number,
  title: string,
  semester: number,
  extra?: Partial<MathematicsNehuPaper>,
): MathematicsNehuPaper {
  return {
    code: formatNehuCourseCode('MTH', paper),
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

export const MATHEMATICS_NEHU_PAPERS: MathematicsNehuPaper[] = [
  theory(100, 'Fundamental Mathematics-I', 1, {
    notes: 'Also offered as MINOR (same code).',
  }),
  theory(150, 'Fundamental Mathematics-II', 2, {
    notes: 'Also offered as MINOR via MTH-151 cross-programme slot.',
  }),
  theory(200, 'Calculus-I and Statics', 3),
  theory(201, 'Group Theory', 3),
  theory(250, 'Calculus-II', 4),
  theory(251, 'Differential Equations', 4),
  theory(252, 'Dynamics – I', 4),
  theory(253, 'Matrix Theory and Vector Spaces', 4),
  theory(300, 'Calculus-III', 5),
  theory(301, 'Number Theory and Ring Theory', 5),
  theory(302, 'Numerical Methods and Optimization Techniques', 5, {
    notes:
      'Sem 5 minor for other programmes uses same code with title "Elementary Algebra".',
  }),
  {
    code: formatNehuCourseCode('MTH', 303),
    title: 'Internship',
    semester: 5,
    category: 'INTERNSHIP',
    deliveryKind: INT,
    credits: 4,
    theoryCredits: 0,
    practicalCredits: 4,
    contactHours: 120,
  },
  theory(350, 'Complex Analysis', 6),
  theory(351, 'Dynamics – II', 6),
  theory(352, 'Discrete Mathematics', 6),
  theory(353, 'Operations Research', 6, {
    notes:
      'NEHU syllabus dual-lists Operations Research on MTH-352; DBC ERP uses MTH-353 for a distinct Sem 6 major slot.',
  }),
];

export const MATHEMATICS_SEM5_MINOR_CODE = '302';

export const MATHEMATICS_SEM5_MINOR_TITLE = 'Elementary Algebra';

/** Sem 6 minor slot when Mathematics is the minor department (maps to MTH-353). */
export const MATHEMATICS_SEM6_MINOR_CODE = '353';

export const MATHEMATICS_SEM6_MINOR_TITLE = 'Operations Research';
