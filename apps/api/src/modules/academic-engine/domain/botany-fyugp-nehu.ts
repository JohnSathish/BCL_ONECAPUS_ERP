/**
 * NEHU FYUGP Botany — official syllabus reference (doc_BotanySyllabus.pdf).
 * Single source of truth for Botany department course codes and titles.
 *
 * Architecture:
 * - One global course row per NEHU code (no Morning/Day duplicates).
 * - Major vs Minor = registration role; BOT-100, BOT-150, BOT-302 are dual-listed.
 * - All honours papers are THEORY_PRACTICAL (3 theory + 1 practical credits).
 */

import { formatNehuCourseCode } from './course-code.util';

export const BOTANY_NEHU_META = {
  departmentCode: 'BOT',
  programCode: 'BSC-BOT',
  subjectSlug: 'botany',
  programmeName: 'FYUP in Botany',
} as const;

/** Botany major allowed minors (DBC official matrix). */
export const BOTANY_MAJOR_ALLOWED_MINORS = ['Zoology', 'Chemistry'] as const;

export type BotanyDeliveryKind = 'THEORY_PRACTICAL' | 'INTERNSHIP';

export type BotanyNehuPaper = {
  code: string;
  title: string;
  semester: number;
  category: 'MAJOR' | 'MINOR' | 'INTERNSHIP';
  deliveryKind: BotanyDeliveryKind;
  credits: number;
  theoryCredits: number;
  practicalCredits: number;
  contactHours: number;
  notes?: string;
};

const TP = 'THEORY_PRACTICAL' as const;
const INT = 'INTERNSHIP' as const;

/** Standard NEHU Botany honours paper: 3 theory + 1 practical = 4 credits, 75 contact hours. */
function tp(
  paper: number,
  title: string,
  semester: number,
  extra?: Partial<BotanyNehuPaper>,
): BotanyNehuPaper {
  return {
    code: formatNehuCourseCode('BOT', paper),
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

export const BOTANY_NEHU_PAPERS: BotanyNehuPaper[] = [
  tp(100, 'Plant Diversity I: Algae, Bryophytes and Pteridophytes', 1, {
    notes: 'Also offered as MINOR (same code).',
  }),
  tp(
    150,
    'Plant Diversity II: Gymnosperms and Paleobotany, Angiosperm Morphology, Plant Anatomy',
    2,
    { notes: 'Also offered as MINOR via BOT-151 cross-programme slot.' },
  ),
  tp(200, 'Economic Botany and Ethnobotany and Phytogeography', 3),
  tp(201, 'Angiosperm Taxonomy', 3),
  tp(250, 'Mycology and Plant Pathology', 4),
  tp(251, 'Microbiology', 4),
  tp(252, 'Reproductive Biology of Angiosperms', 4),
  tp(253, 'Biodiversity and Conservation Biology', 4),
  tp(300, 'Plant Physiology', 5),
  tp(301, 'Plant Biochemistry', 5),
  tp(302, 'Plant Ecology', 5, {
    notes:
      'Sem 5 minor for other programmes uses same code with title "Angiosperm Taxonomy, Ecology and Economic Botany".',
  }),
  {
    code: formatNehuCourseCode('BOT', 303),
    title: 'Internship',
    semester: 5,
    category: 'INTERNSHIP',
    deliveryKind: INT,
    credits: 4,
    theoryCredits: 0,
    practicalCredits: 4,
    contactHours: 120,
  },
  tp(350, 'Genetics and Plant Breeding', 6),
  tp(351, 'Molecular Biology', 6),
  tp(352, 'Plant Stress Biology', 6),
  tp(353, 'Plant Biotechnology', 6),
];

/** Sem 5 minor paper code when Botany is the minor department. */
export const BOTANY_SEM5_MINOR_CODE = '302';

export const BOTANY_SEM5_MINOR_TITLE =
  'Angiosperm Taxonomy, Ecology and Economic Botany';
