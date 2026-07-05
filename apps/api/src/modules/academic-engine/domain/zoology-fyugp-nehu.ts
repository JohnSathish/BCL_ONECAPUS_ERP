/**
 * NEHU FYUGP Zoology — official syllabus reference (doc_ZoologySyllabus.pdf).
 * Single source of truth for Zoology department course codes and titles.
 *
 * Architecture:
 * - One global course row per NEHU code (no Morning/Day duplicates).
 * - Major vs Minor = registration role; ZOO-100, ZOO-150, ZOO-302 are dual-listed.
 * - Sem 1–2 THEORY_PRACTICAL papers use 60 contact hours; Sem 3+ honours use 75 (except ZOO-350 theory-only).
 */

import { formatNehuCourseCode } from './course-code.util';

export const ZOOLOGY_NEHU_META = {
  departmentCode: 'ZOO',
  programCode: 'BSC-ZOO',
  subjectSlug: 'zoology',
  programmeName: 'FYUP in Zoology',
} as const;

/** Zoology major allowed minors (DBC official matrix). */
export const ZOOLOGY_MAJOR_ALLOWED_MINORS = ['Botany', 'Chemistry'] as const;

export type ZoologyDeliveryKind = 'THEORY' | 'THEORY_PRACTICAL' | 'INTERNSHIP';

export type ZoologyNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  deliveryKind: ZoologyDeliveryKind;
  credits: number;
  theoryCredits: number;
  practicalCredits: number;
  contactHours: number;
  notes?: string;
};

const TH = 'THEORY' as const;
const TP = 'THEORY_PRACTICAL' as const;
const INT = 'INTERNSHIP' as const;

function tp(
  paper: number,
  title: string,
  semester: number,
  contactHours: number,
  extra?: Partial<ZoologyNehuPaper>,
): ZoologyNehuPaper {
  return {
    code: formatNehuCourseCode('ZOO', paper),
    title,
    semester,
    category: 'MAJOR',
    deliveryKind: TP,
    credits: 4,
    theoryCredits: 3,
    practicalCredits: 1,
    contactHours,
    ...extra,
  };
}

function theory(
  paper: number,
  title: string,
  semester: number,
  extra?: Partial<ZoologyNehuPaper>,
): ZoologyNehuPaper {
  return {
    code: formatNehuCourseCode('ZOO', paper),
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

export const ZOOLOGY_NEHU_PAPERS: ZoologyNehuPaper[] = [
  tp(100, 'Taxonomy and Animal Diversity', 1, 60, {
    notes: 'Also offered as MINOR (same code).',
  }),
  tp(150, 'Functional and Comparative Anatomy', 2, 60, {
    notes: 'Also offered as MINOR via ZOO-151 cross-programme slot.',
  }),
  tp(200, 'Introductory Cell Biology and Genetics', 3, 75),
  tp(201, 'Introductory Biochemistry and Immunology', 3, 75),
  tp(250, 'Evolutionary Biology, Adaptation, and Animal Behaviour', 4, 75),
  tp(251, 'Aquatic Biology, Wildlife Biology and Conservation Biology', 4, 75),
  tp(252, 'Ecology and Environmental Biology', 4, 75),
  tp(253, 'Parasitology, Entomology, and Economic Zoology', 4, 75),
  tp(300, 'Animal Physiology', 5, 75),
  tp(301, 'Biochemistry and Immunology', 5, 75),
  tp(302, 'Introductory Developmental Biology and Endocrinology', 5, 75, {
    notes:
      'Sem 5 minor for other programmes uses same code with title "Economic and Applied Zoology".',
  }),
  {
    code: formatNehuCourseCode('ZOO', 303),
    title: 'Internship',
    semester: 5,
    category: 'INTERNSHIP',
    deliveryKind: INT,
    credits: 4,
    theoryCredits: 0,
    practicalCredits: 4,
    contactHours: 120,
  },
  theory(350, 'Bio-techniques, Bioinformatics, and Biostatistics', 6),
  tp(351, 'Cell Biology and Genetics', 6, 75),
  tp(352, 'Developmental Biology and Reproductive Biology', 6, 75),
  tp(353, 'Molecular Biology and Biotechnology', 6, 75),
];

export const ZOOLOGY_SEM5_MINOR_CODE = '302';

export const ZOOLOGY_SEM5_MINOR_TITLE = 'Economic and Applied Zoology';
