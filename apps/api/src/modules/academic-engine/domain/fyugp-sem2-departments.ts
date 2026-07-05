/**
 * NEHU FYUGP Semester 2 department/program definitions across Arts, Science, and Commerce.
 */

export type FyugpSem2Department = {
  code: string;
  programCode: string;
  programName: string;
  subjectSlug: string;
  stream: 'ARTS' | 'SCIENCE' | 'COMMERCE';
  sem2MajorTitle: string;
};

export const SEM2_MAJOR_TITLES: Record<string, string> = {
  ECO: 'Macroeconomics I',
  EDN: 'Foundation to Education',
  ENG: 'British Poetry: Milton To the Present',
  GAR: 'Oral Narratives and Folklore',
  GEO: 'Introduction to Physical Geography',
  HIS: 'History of India: Maurya to Post Gupta Period',
  PHI: 'Ethics',
  POL: 'Indian Political System',
  SOC: 'Principles of Sociology',
  BOT: 'Plant Diversity -II: Gymnosperm and Paleobotany, Angiosperm Morphology, Plant Anatomy',
  CHE: 'Introductory Chemistry II',
  MTH: 'Fundamental Mathematics-II',
  PHY: 'Electricity & Magnetism, Optics I and Electronics I',
  ZOO: 'Functional and Comparative Anatomy',
  COM: 'Principles of Management',
};

const ARTS_PROGRAMS: Omit<FyugpSem2Department, 'sem2MajorTitle'>[] = [
  {
    code: 'ECO',
    programCode: 'BA-ECO',
    programName: 'FYUP in Economics',
    subjectSlug: 'economics',
    stream: 'ARTS',
  },
  {
    code: 'EDN',
    programCode: 'BA-EDU',
    programName: 'FYUP in Education',
    subjectSlug: 'education',
    stream: 'ARTS',
  },
  {
    code: 'ENG',
    programCode: 'BA-ENG',
    programName: 'FYUP in English',
    subjectSlug: 'english',
    stream: 'ARTS',
  },
  {
    code: 'GAR',
    programCode: 'BA-GAR',
    programName: 'FYUP in Garo',
    subjectSlug: 'garo',
    stream: 'ARTS',
  },
  {
    code: 'GEO',
    programCode: 'BA-GEO',
    programName: 'FYUP in Geography',
    subjectSlug: 'geography',
    stream: 'ARTS',
  },
  {
    code: 'HIS',
    programCode: 'BA-HIS',
    programName: 'FYUP in History',
    subjectSlug: 'history',
    stream: 'ARTS',
  },
  {
    code: 'PHI',
    programCode: 'BA-PHI',
    programName: 'FYUP in Philosophy',
    subjectSlug: 'philosophy',
    stream: 'ARTS',
  },
  {
    code: 'POL',
    programCode: 'BA-POL',
    programName: 'FYUP in Political Science',
    subjectSlug: 'political-science',
    stream: 'ARTS',
  },
  {
    code: 'SOC',
    programCode: 'BA-SOC',
    programName: 'FYUP in Sociology',
    subjectSlug: 'sociology',
    stream: 'ARTS',
  },
];

const SCIENCE_PROGRAMS: Omit<FyugpSem2Department, 'sem2MajorTitle'>[] = [
  {
    code: 'BOT',
    programCode: 'BSC-BOT',
    programName: 'FYUP in Botany',
    subjectSlug: 'botany',
    stream: 'SCIENCE',
  },
  {
    code: 'CHE',
    programCode: 'BSC-CHE',
    programName: 'FYUP in Chemistry',
    subjectSlug: 'chemistry',
    stream: 'SCIENCE',
  },
  {
    code: 'MTH',
    programCode: 'BSC-MTH',
    programName: 'FYUP in Mathematics',
    subjectSlug: 'mathematics',
    stream: 'SCIENCE',
  },
  {
    code: 'PHY',
    programCode: 'BSC-PHY',
    programName: 'FYUP in Physics',
    subjectSlug: 'physics',
    stream: 'SCIENCE',
  },
  {
    code: 'ZOO',
    programCode: 'BSC-ZOO',
    programName: 'FYUP in Zoology',
    subjectSlug: 'zoology',
    stream: 'SCIENCE',
  },
];

const COMMERCE_PROGRAMS: Omit<FyugpSem2Department, 'sem2MajorTitle'>[] = [
  {
    code: 'COM',
    programCode: 'BCOM',
    programName: 'FYUP in Commerce',
    subjectSlug: 'commerce',
    stream: 'COMMERCE',
  },
];

function withTitles(
  rows: Omit<FyugpSem2Department, 'sem2MajorTitle'>[],
): FyugpSem2Department[] {
  return rows
    .map((row) => {
      const sem2MajorTitle = SEM2_MAJOR_TITLES[row.code];
      if (!sem2MajorTitle) return null;
      return { ...row, sem2MajorTitle };
    })
    .filter((row): row is FyugpSem2Department => row != null);
}

export const FYUGP_SEM2_PROGRAM_DEPARTMENTS: FyugpSem2Department[] = [
  ...withTitles(ARTS_PROGRAMS),
  ...withTitles(SCIENCE_PROGRAMS),
  ...withTitles(COMMERCE_PROGRAMS),
];

export function fyugpProgramFamily(
  programCode: string,
): 'BA' | 'BSC' | 'BCOM' | 'OTHER' {
  const code = programCode.toUpperCase();
  if (code.startsWith('BA-')) return 'BA';
  if (code.startsWith('BSC-')) return 'BSC';
  if (code.startsWith('BCOM') || code === 'B.COM') return 'BCOM';
  return 'OTHER';
}
