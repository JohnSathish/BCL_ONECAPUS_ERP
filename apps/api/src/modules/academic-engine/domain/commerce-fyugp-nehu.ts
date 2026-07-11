/**
 * NEHU FYUGP Commerce — official syllabus reference (doc_CommerceSyllabus.pdf).
 * Single source of truth for Commerce department course codes and titles.
 *
 * Architecture:
 * - One global course row per NEHU code (no Morning/Day duplicates).
 * - Major vs Minor = registration role; COM-100, COM-150, COM-302 are dual-listed.
 * - Sem 1–3: THEORY (4 credits, 60 contact hours); Sem 4–6: THEORY (4 credits, 45h).
 */

import { formatNehuCourseCode } from './course-code.util';

export const COMMERCE_NEHU_META = {
  departmentCode: 'COM',
  programCode: 'BCOM',
  subjectSlug: 'commerce',
  programmeName: 'FYUP in Commerce',
} as const;

/** Commerce major allowed minors (DBC official matrix). */
export const COMMERCE_MAJOR_ALLOWED_MINORS = [
  'Economics',
  'Mathematics',
  'Geography',
] as const;

export type CommerceDeliveryKind = 'THEORY' | 'INTERNSHIP';

export type CommerceNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  deliveryKind: CommerceDeliveryKind;
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
  contactHours: number,
  extra?: Partial<CommerceNehuPaper>,
): CommerceNehuPaper {
  return {
    code: formatNehuCourseCode('COM', paper),
    title,
    semester,
    category: 'MAJOR',
    deliveryKind: TH,
    credits: 4,
    theoryCredits: 4,
    practicalCredits: 0,
    contactHours,
    ...extra,
  };
}

export const COMMERCE_NEHU_PAPERS: CommerceNehuPaper[] = [
  theory(100, 'Accounting for Business', 1, 60, {
    notes: 'Also offered as MINOR (same code).',
  }),
  theory(150, 'Principles of Management', 2, 60, {
    notes: 'Also offered as MINOR via COM-151 cross-programme slot.',
  }),
  theory(200, 'Business Environment', 3, 60),
  theory(201, 'Corporate Accounting', 3, 60),
  theory(250, 'Business Economics', 4, 45),
  theory(251, 'Cost Accounting', 4, 45),
  theory(252, 'Marketing Management', 4, 45),
  theory(253, 'Financial Management', 4, 45),
  theory(300, 'Business Statistics', 5, 45),
  theory(301, 'Auditing', 5, 45),
  theory(302, 'Human Resource Management', 5, 45, {
    notes: 'Also offered as MINOR (same code and title).',
  }),
  {
    code: formatNehuCourseCode('COM', 303),
    title: 'Internship',
    semester: 5,
    category: 'INTERNSHIP',
    deliveryKind: INT,
    credits: 4,
    theoryCredits: 0,
    practicalCredits: 4,
    contactHours: 120,
  },
  theory(350, 'Business Law', 6, 45),
  theory(351, 'Financial Market & Institution', 6, 45),
  theory(352, 'Direct Tax', 6, 45),
  theory(353, 'Service Management', 6, 45),
];
