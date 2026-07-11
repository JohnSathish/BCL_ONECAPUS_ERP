/**
 * NEHU FYUGP Physics — official syllabus reference (doc_PhysicsSyllabus.pdf).
 * Single source of truth for Physics department course codes and titles.
 *
 * Architecture:
 * - One global course row per NEHU code (no Morning/Day duplicates).
 * - Major vs Minor = registration role; PHY-100, PHY-150, PHY-302 are dual-listed.
 * - Sem 1–3: THEORY_PRACTICAL (3+1, 75h); Sem 4–6 mix theory and lab papers.
 * - Sem 5 has no practical majors (internship PHY-303 per NEHU note).
 */

import { formatNehuCourseCode } from './course-code.util';

export const PHYSICS_NEHU_META = {
  departmentCode: 'PHY',
  programCode: 'BSC-PHY',
  subjectSlug: 'physics',
  programmeName: 'FYUP in Physics',
} as const;

/** Physics major allowed minors (DBC official matrix). */
export const PHYSICS_MAJOR_ALLOWED_MINORS = [
  'Chemistry',
  'Mathematics',
] as const;

export type PhysicsDeliveryKind =
  | 'THEORY'
  | 'PRACTICAL'
  | 'THEORY_PRACTICAL'
  | 'INTERNSHIP';

export type PhysicsNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  deliveryKind: PhysicsDeliveryKind;
  credits: number;
  theoryCredits: number;
  practicalCredits: number;
  contactHours: number;
  notes?: string;
};

const TH = 'THEORY' as const;
const PR = 'PRACTICAL' as const;
const TP = 'THEORY_PRACTICAL' as const;
const INT = 'INTERNSHIP' as const;

function tp(
  paper: number,
  title: string,
  semester: number,
  extra?: Partial<PhysicsNehuPaper>,
): PhysicsNehuPaper {
  return {
    code: formatNehuCourseCode('PHY', paper),
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
  extra?: Partial<PhysicsNehuPaper>,
): PhysicsNehuPaper {
  return {
    code: formatNehuCourseCode('PHY', paper),
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
  extra?: Partial<PhysicsNehuPaper>,
): PhysicsNehuPaper {
  return {
    code: formatNehuCourseCode('PHY', paper),
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

export const PHYSICS_NEHU_PAPERS: PhysicsNehuPaper[] = [
  tp(100, 'Mathematical Physics I, Properties of Matter and Waves', 1, {
    notes: 'Also offered as MINOR (same code).',
  }),
  tp(150, 'Electricity & Magnetism, Optics I and Electronics I', 2, {
    notes: 'Also offered as MINOR via PHY-151 cross-programme slot.',
  }),
  tp(200, 'Mathematical Physics II and Experimental Physics III', 3),
  tp(201, 'Heat & Thermodynamics and Experimental Physics IV', 3),
  theory(250, 'Optics II and Acoustics', 4),
  theory(251, 'Classical Mechanics I and Special Theory of Relativity', 4),
  theory(252, 'Quantum Mechanics I', 4),
  practical(253, 'Experimental Physics V', 4, 120),
  theory(300, 'Electromagnetic Theory', 5),
  theory(301, 'Electronics II and Computational Physics I', 5),
  theory(302, 'Thermal and Statistical Physics', 5, {
    notes:
      'Sem 5 minor for other programmes uses same code with title "Modern Physics I".',
  }),
  {
    code: formatNehuCourseCode('PHY', 303),
    title: 'Internship',
    semester: 5,
    category: 'INTERNSHIP',
    deliveryKind: INT,
    credits: 4,
    theoryCredits: 0,
    practicalCredits: 4,
    contactHours: 120,
  },
  theory(350, 'Solid State Physics', 6),
  theory(351, 'Atomic and Molecular Physics', 6),
  theory(352, 'Nuclear and Particle Physics', 6),
  practical(353, 'Experimental Physics VI', 6, 120),
];

export const PHYSICS_SEM5_MINOR_CODE = '302';

export const PHYSICS_SEM5_MINOR_TITLE = 'Modern Physics I';
