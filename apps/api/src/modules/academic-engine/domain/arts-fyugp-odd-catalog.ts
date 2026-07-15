/**
 * NEHU FYUGP Arts ODD-semester (1 / 3 / 5) course catalog and paper-basket layout.
 * Shared by seed, course import templates, and timetable routine Excel.
 */

import { buildGeographyOddSemCourses } from './geography-fyugp-nehu.util';

export type ArtsFyugpCourseDef = {
  code: string;
  title: string;
  credits: number;
  category: string;
  semesterSequence: number;
  departmentCode: string;
  subjectSlug: string;
  majorPaperIndex?: number;
  deliveryType?: string;
  creditCalculationMode?: string;
  theoryCredits?: number;
  practicalCredits?: number;
  theoryHoursPerWeek?: number;
  practicalHoursPerWeek?: number;
  totalTheoryContactHours?: number;
  totalPracticalContactHours?: number;
  totalContactHours?: number;
  /** When set, curriculum mapping is created only for this BA programme code (e.g. BA-ECO). */
  programCode?: string;
  /** Pool / shared courses mapped to all UG programmes when true. */
  sharedPool?: boolean;
  /** Stable VTC vocational-track group (e.g. DESKTOP_PUBLISHING) for continuity. */
  vtcTrackGroupCode?: string;
  /** VTC stage within the track: 1 (Sem 3), 2 (Sem 4), 3 (Sem 6). */
  vtcTrackStage?: number;
};

export type ArtsPaperBasketRow = {
  semester: number;
  category: string;
  paperCount: number;
  creditsEach: number;
  codePattern: string;
  exampleCode: string;
  exampleTitle: string;
  notes?: string;
};

export const ARTS_FYUGP_DEPARTMENTS = [
  {
    code: 'ECO',
    programCode: 'BA-ECO',
    programName: 'FYUP in Economics',
    subjectSlug: 'economics',
    papers: {
      sem1: 'Microeconomics I',
      sem3: [
        'Economics of Growth and Development',
        'Mathematical Methods for Economics I',
      ],
      sem5: [
        'Statistical Methods for Economics',
        'Microeconomics II',
        'Indian Economy',
      ],
      sem5Minor: 'Indian Economy',
      sem5MinorCode: '302',
      internship: 'Internship',
      internshipCode: '303',
    },
  },
  {
    code: 'EDN',
    programCode: 'BA-EDU',
    programName: 'FYUP in Education',
    subjectSlug: 'education',
    papers: {
      sem1: 'Introduction to Education',
      sem3: [
        'Development of Education in India-I (Pre-Independence Period)',
        'Development of Education in India-II (Post-Independence Period)',
      ],
      sem5: [
        'Educational Management',
        'Curriculum Development',
        'Education for Sustainable Development',
      ],
      sem5Minor: 'Inclusive Education I',
      sem5MinorCode: '302',
      internship: 'Internship',
      internshipCode: '303',
    },
  },
  {
    code: 'ENG',
    programCode: 'BA-ENG',
    programName: 'FYUP in English',
    subjectSlug: 'english',
    papers: {
      sem1: 'Introduction to English Literature',
      sem3: [
        'British Fiction (19th and 20th Century)',
        'British Drama (16th Century to the Present)',
      ],
      sem5: [
        'Classical Indian Literature',
        'Contemporary Literary Theory & Criticism-I',
        'Indian Writings in English',
      ],
      sem5Minor: 'Indian Writings in English',
      sem5MinorCode: '302',
      internship: 'Internship',
      internshipCode: '303',
    },
  },
  {
    code: 'GAR',
    programCode: 'BA-GAR',
    programName: 'FYUP in Garo',
    subjectSlug: 'garo',
    papers: {
      sem1: 'Introduction to Garo Prose and Poetry',
      sem3: ['History of Garo Language', 'History of Garo Literature'],
      sem5: [
        'Prabandher Rupriti O Nirbachito Prabandhaboli',
        'Kothasahityer Rupriti O Bangla Kotha Sahitya',
        'Rabindra Sahitya',
      ],
      sem5Minor: 'Rabindra Sahitya',
      sem5MinorCode: '302',
      internship: 'Internship',
      internshipCode: '303',
    },
  },
  {
    code: 'GEO',
    programCode: 'BA-GEO',
    programName: 'FYUP in Geography',
    subjectSlug: 'geography',
    papers: {
      sem1: 'Introduction to Human Geography',
      sem3: [
        'Regional Geography of India',
        'Historical Development of Geography',
      ],
      sem5: [
        'Thematic Cartography and Survey Techniques II',
        'Population Geography',
        'Introduction to Remote Sensing and GIS',
      ],
      sem5Minor: 'Geography and Environment',
      sem5MinorCode: '302',
      internship: 'Internship',
      internshipCode: '303',
    },
  },
  {
    code: 'HIS',
    programCode: 'BA-HIS',
    programName: 'FYUP in History',
    subjectSlug: 'history',
    papers: {
      sem1: 'History of India (Ancient to 1200 CE)',
      sem3: [
        'History of Early Medieval India (650–1206 C.E.)',
        'History of World Civilizations',
      ],
      sem5: [
        'History of Modern India (1757-1857 C.E.)',
        'Contemporary North East India (1947-1987 C.E.)',
        'Modern World (1815 to 1945 C.E.)',
      ],
      sem5Minor: 'Modern World (1815 to 1945 C.E.)',
      sem5MinorCode: '302',
      internship: 'Internship',
      internshipCode: '303',
    },
  },
  {
    code: 'PHI',
    programCode: 'BA-PHI',
    programName: 'FYUP in Philosophy',
    subjectSlug: 'philosophy',
    papers: {
      sem1: 'Understanding Philosophy',
      sem3: ['Logic', 'Indian Philosophy-1'],
      sem5: [
        'Epistemology and Metaphysics',
        'Existentialism',
        'Philosophy of Value',
      ],
      sem5Minor: 'Philosophy of Value',
      sem5MinorCode: '302',
      internship: 'Internship',
      internshipCode: '303',
    },
  },
  {
    code: 'POL',
    programCode: 'BA-POL',
    programName: 'FYUP in Political Science',
    subjectSlug: 'political-science',
    papers: {
      sem1: 'Political Theory',
      sem3: [
        'Introduction to International Relations',
        'Public Administration',
      ],
      sem5: [
        'Socialist Political Thought',
        'State and Democracy in India',
        'Government and Politics in Northeast India',
      ],
      sem5Minor: 'Government and Politics in Northeast India',
      sem5MinorCode: '302',
      internship: 'Internship',
      internshipCode: '303',
    },
  },
  {
    code: 'SOC',
    programCode: 'BA-SOC',
    programName: 'FYUP in Sociology',
    subjectSlug: 'sociology',
    papers: {
      sem1: 'Introduction to Sociology',
      sem3: ['Society in India', 'Social Change'],
      sem5: [
        'Economic Sociology',
        'Political Sociology',
        'Sociology of Environment',
      ],
      sem5Minor: 'Sociology of Environment',
      sem5MinorCode: '302',
      internship: 'Internship',
      internshipCode: '303',
    },
  },
] as const;

const MDC_SEM1_TITLES: Record<number, string> = {
  110: 'Commercial Arithmetic & Elementary Statistics',
  111: 'Culture and Society',
  112: 'Fundamentals of Computer Systems',
  113: 'Health and Wellness',
  114: 'Financial Literacy',
  115: 'Introduction to Life Sciences',
  116: 'Introduction to National Cadet Corps',
  117: 'Public Speaking',
  118: 'Mathematics in Daily Life',
  119: 'Philosophy of Culture',
};

const MDC_SEM3_TITLES: Record<number, string> = {
  210: 'English Proficiency and Soft Skill Development',
  211: 'Gender Studies',
  212: 'Financial Literacy',
  213: 'National Service Scheme',
  214: 'Physics Around Us',
  215: 'Development of Education in North-East India',
  216: 'Indian Art and Aesthetics',
  217: 'Human Rights and Duties',
  218: 'Digital Citizenship',
  219: 'Community Development',
};

const AEC_SEM3_TITLES: Record<number, string> = {
  220: 'Critical Reading (Science)',
  221: 'Introduction to Academic Writing (Commerce)',
  222: 'Introduction to Academic Writing (Arts)',
  223: 'MIL — Garo (Advanced)',
  224: 'MIL — Hindi (Advanced)',
  225: 'MIL — Bengali (Advanced)',
  226: 'MIL — Assamese (Advanced)',
  227: 'MIL — Nepali (Advanced)',
  228: 'MIL — Khasi (Advanced)',
  229: 'MIL — Kokborok (Advanced)',
};

const SEC_SEM3_TITLES: Record<number, string> = {
  230: 'Introduction to Translation',
  231: 'Web Design Basics',
  232: 'Conflict Resolution',
  233: 'Goods and Service Tax (GST)',
  234: 'Analytical Thinking',
  235: 'Disaster Response Skills',
  236: 'Financial Planning',
  237: 'Content Creation',
  238: 'Social Media Management',
  239: 'Research Methodology Skills',
};

const AEC_SEM1_TITLES: Record<number, string> = {
  120: 'Alternative English',
  121: 'Alternative English',
  122: 'MIL-I: Garo',
  123: 'MIL-I: Garo',
  124: 'MIL — Bengali',
  125: 'MIL — Assamese',
  126: 'MIL — Nepali',
  127: 'MIL — Khasi',
  128: 'MIL — Kokborok',
  129: 'MIL — Other Regional Language',
};

const SEC_SEM1_TITLES: Record<number, string> = {
  130: 'Office Management',
  131: 'Motivation',
  132: 'Personality Development',
  133: 'Public Speaking',
  134: 'Yoga and Wellness',
  135: 'Tourism and Hospitality',
  136: 'Retail Management',
  137: 'Event Management',
  138: 'Photography Basics',
  139: 'Community Service',
};

const VTC_SEM3_TITLES: Record<number, string> = {
  240: 'Bee Keeping-I',
  241: 'Food Processing-I',
  242: 'Tailoring and Garment Making-I',
  243: 'Desktop Publishing-I',
  244: 'Photography and Videography-I',
  245: 'Organic Farming-I',
  246: 'Handicrafts-I',
  247: 'Beauty and Wellness-I',
  248: 'Hospitality Operations-I',
  249: 'IT Skills for Office-I',
};

function theoryCourse(
  partial: Omit<
    ArtsFyugpCourseDef,
    'deliveryType' | 'theoryCredits' | 'practicalCredits'
  >,
): ArtsFyugpCourseDef {
  const theoryCredits = partial.credits;
  return {
    ...partial,
    deliveryType: 'THEORY',
    theoryCredits,
    practicalCredits: 0,
    theoryHoursPerWeek: theoryCredits,
    practicalHoursPerWeek: 0,
    totalTheoryContactHours: theoryCredits * 15,
    totalPracticalContactHours: 0,
    totalContactHours: theoryCredits * 15,
  };
}

function internshipCourse(
  partial: Omit<
    ArtsFyugpCourseDef,
    'deliveryType' | 'creditCalculationMode' | 'totalContactHours'
  >,
): ArtsFyugpCourseDef {
  return {
    ...partial,
    deliveryType: 'INTERNSHIP',
    creditCalculationMode: 'MANUAL_OVERRIDE',
    theoryCredits: 0,
    practicalCredits: 0,
    theoryHoursPerWeek: 0,
    practicalHoursPerWeek: 0,
    totalTheoryContactHours: 0,
    totalPracticalContactHours: 0,
    totalContactHours: 120,
  };
}

function poolCourses(
  prefix: string,
  semesterSequence: number,
  category: string,
  credits: number,
  titles: Record<number, string>,
  departmentCode = 'ENG',
  subjectSlug = 'general',
): ArtsFyugpCourseDef[] {
  return Object.entries(titles).map(([num, title]) =>
    theoryCourse({
      code: `${prefix}-${num}`,
      title,
      credits,
      category,
      semesterSequence,
      departmentCode,
      subjectSlug,
      sharedPool: true,
    }),
  );
}

/** Cross-department Sem 5 minor (-302) direct offerings on each BA programme version. */
export function buildArtsFyugpSem5MinorCourseDefs(
  hostProgramCode: string,
): ArtsFyugpCourseDef[] {
  const host = ARTS_FYUGP_DEPARTMENTS.find(
    (dept) => dept.programCode === hostProgramCode,
  );
  if (!host) return [];

  return ARTS_FYUGP_DEPARTMENTS.filter(
    (dept) => dept.programCode !== hostProgramCode,
  ).map((dept) => {
    const minorCode =
      'sem5MinorCode' in dept.papers && dept.papers.sem5MinorCode
        ? dept.papers.sem5MinorCode
        : '302';
    const minorTitle = dept.papers.sem5Minor;
    return theoryCourse({
      code: `${dept.code}-${minorCode}`,
      title: minorTitle,
      credits: 4,
      category: 'MINOR',
      semesterSequence: 5,
      departmentCode: dept.code,
      subjectSlug: dept.subjectSlug,
      programCode: hostProgramCode,
    });
  });
}

export function buildArtsFyugpOddCourses(): ArtsFyugpCourseDef[] {
  const courses: ArtsFyugpCourseDef[] = [];

  for (const dept of ARTS_FYUGP_DEPARTMENTS) {
    if (dept.code === 'GEO') continue;
    courses.push(
      theoryCourse({
        code: `${dept.code}-100`,
        title: dept.papers.sem1,
        credits: 4,
        category: 'MAJOR',
        semesterSequence: 1,
        departmentCode: dept.code,
        subjectSlug: dept.subjectSlug,
        programCode: dept.programCode,
      }),
    );

    dept.papers.sem3.forEach((title, index) => {
      courses.push(
        theoryCourse({
          code: `${dept.code}-20${index}`,
          title,
          credits: 4,
          category: 'MAJOR',
          semesterSequence: 3,
          departmentCode: dept.code,
          subjectSlug: dept.subjectSlug,
          majorPaperIndex: index + 1,
          programCode: dept.programCode,
        }),
      );
    });

    dept.papers.sem5.forEach((title, index) => {
      courses.push(
        theoryCourse({
          code: `${dept.code}-30${index}`,
          title,
          credits: 4,
          category: 'MAJOR',
          semesterSequence: 5,
          departmentCode: dept.code,
          subjectSlug: dept.subjectSlug,
          majorPaperIndex: index + 1,
          programCode: dept.programCode,
        }),
      );
    });

    const internshipCode =
      'internshipCode' in dept.papers && dept.papers.internshipCode
        ? dept.papers.internshipCode
        : '304';
    const sem5MinorCode =
      'sem5MinorCode' in dept.papers && dept.papers.sem5MinorCode
        ? dept.papers.sem5MinorCode
        : '303';
    const sem5MajorCodes = dept.papers.sem5.map(
      (_, index) => `${dept.code}-30${index}`,
    );
    const sem5MinorCourseCode = `${dept.code}-${sem5MinorCode}`;

    if (
      sem5MinorCourseCode !== `${dept.code}-${internshipCode}` &&
      !sem5MajorCodes.includes(sem5MinorCourseCode)
    ) {
      courses.push(
        theoryCourse({
          code: sem5MinorCourseCode,
          title: dept.papers.sem5Minor,
          credits: 4,
          category: 'MINOR',
          semesterSequence: 5,
          departmentCode: dept.code,
          subjectSlug: dept.subjectSlug,
        }),
      );
    }

    courses.push(
      internshipCourse({
        code: `${dept.code}-${internshipCode}`,
        title: dept.papers.internship,
        credits: 4,
        category: 'INTERNSHIP',
        semesterSequence: 5,
        departmentCode: dept.code,
        subjectSlug: dept.subjectSlug,
        programCode: dept.programCode,
      }),
    );
  }

  courses.push(
    ...poolCourses('MDC', 1, 'MDC', 3, MDC_SEM1_TITLES, 'ENG', 'mdc'),
    ...poolCourses('MDC', 3, 'MDC', 3, MDC_SEM3_TITLES, 'ENG', 'mdc'),
    ...poolCourses('AEC', 1, 'AEC', 3, AEC_SEM1_TITLES, 'ENG', 'english'),
    ...poolCourses('AEC', 3, 'AEC', 2, AEC_SEM3_TITLES, 'ENG', 'english'),
    ...poolCourses('SEC', 1, 'SEC', 3, SEC_SEM1_TITLES, 'ENG', 'sec'),
    ...poolCourses('SEC', 3, 'SEC', 3, SEC_SEM3_TITLES, 'ENG', 'sec'),
    theoryCourse({
      code: 'VAC-140',
      title: 'Environmental Studies',
      credits: 3,
      category: 'VAC',
      semesterSequence: 1,
      departmentCode: 'ENG',
      subjectSlug: 'environment',
      sharedPool: true,
    }),
    ...poolCourses('VTC', 3, 'VTC', 4, VTC_SEM3_TITLES, 'ENG', 'vtc'),
    ...buildGeographyOddSemCourses(),
  );

  return courses;
}

export const ARTS_ODD_PAPER_BASKET: ArtsPaperBasketRow[] = [
  {
    semester: 1,
    category: 'MAJOR',
    paperCount: 1,
    creditsEach: 4,
    codePattern: '{DEPT}-100',
    exampleCode: 'ECO-100',
    exampleTitle: 'Microeconomics I',
  },
  {
    semester: 1,
    category: 'MINOR',
    paperCount: 1,
    creditsEach: 4,
    codePattern: '{OTHER-DEPT}-100',
    exampleCode: 'POL-100',
    exampleTitle: 'Introduction to Political Science',
    notes: 'Minor uses another department Sem 1 major paper.',
  },
  {
    semester: 1,
    category: 'MDC',
    paperCount: 1,
    creditsEach: 3,
    codePattern: 'MDC-110 … MDC-119',
    exampleCode: 'MDC-111',
    exampleTitle: 'Culture and Society',
  },
  {
    semester: 1,
    category: 'AEC',
    paperCount: 1,
    creditsEach: 3,
    codePattern: 'AEC-120 … AEC-129',
    exampleCode: 'AEC-120',
    exampleTitle: 'Alternative English',
  },
  {
    semester: 1,
    category: 'SEC',
    paperCount: 1,
    creditsEach: 3,
    codePattern: 'SEC-130 … SEC-139',
    exampleCode: 'SEC-132',
    exampleTitle: 'Computer Applications',
  },
  {
    semester: 1,
    category: 'VAC',
    paperCount: 1,
    creditsEach: 3,
    codePattern: 'VAC-140',
    exampleCode: 'VAC-140',
    exampleTitle: 'Environmental Studies',
  },
  {
    semester: 3,
    category: 'MAJOR',
    paperCount: 2,
    creditsEach: 4,
    codePattern: '{DEPT}-200, {DEPT}-201',
    exampleCode: 'ECO-200',
    exampleTitle: 'Economics of Growth and Development',
  },
  {
    semester: 3,
    category: 'MDC',
    paperCount: 1,
    creditsEach: 3,
    codePattern: 'MDC-210 … MDC-219',
    exampleCode: 'MDC-210',
    exampleTitle: 'Earth Sciences',
  },
  {
    semester: 3,
    category: 'AEC',
    paperCount: 1,
    creditsEach: 2,
    codePattern: 'AEC-220 … AEC-229',
    exampleCode: 'AEC-220',
    exampleTitle: 'Advanced English Communication',
  },
  {
    semester: 3,
    category: 'SEC',
    paperCount: 1,
    creditsEach: 3,
    codePattern: 'SEC-230 … SEC-239',
    exampleCode: 'SEC-230',
    exampleTitle: 'Data Analysis with Spreadsheets',
  },
  {
    semester: 3,
    category: 'VTC',
    paperCount: 1,
    creditsEach: 4,
    codePattern: 'VTC-240 … VTC-249',
    exampleCode: 'VTC-240',
    exampleTitle: 'Bee Keeping-I',
    notes: 'Replaces VAC from Semester 1.',
  },
  {
    semester: 5,
    category: 'MAJOR',
    paperCount: 3,
    creditsEach: 4,
    codePattern: '{DEPT}-300, {DEPT}-301, {DEPT}-302',
    exampleCode: 'ECO-300',
    exampleTitle: 'Statistical Methods for Economics',
  },
  {
    semester: 5,
    category: 'MINOR',
    paperCount: 1,
    creditsEach: 4,
    codePattern:
      '{OTHER-DEPT}-303 or {DEPT}-302 when minor paper matches major (e.g. ECO-302)',
    exampleCode: 'ECO-302',
    exampleTitle: 'Indian Economy',
  },
  {
    semester: 5,
    category: 'INTERNSHIP',
    paperCount: 1,
    creditsEach: 4,
    codePattern: '{DEPT}-303 or {DEPT}-304',
    exampleCode: 'ECO-303',
    exampleTitle: 'Internship',
  },
];

export type ArtsRoutineSampleRow = {
  stream: string;
  shift: string;
  semester: number;
  day: string;
  period: string;
  subjectCode: string;
  category: string;
  section: string;
};

/** Example routine rows for Arts ODD paper basket (Economics major illustration). */
export function buildArtsRoutineSampleRows(
  stream = 'ARTS',
  shift = 'Day Shift',
  section = 'Core',
): ArtsRoutineSampleRow[] {
  const sem1: ArtsRoutineSampleRow[] = [
    {
      stream,
      shift,
      semester: 1,
      day: 'Monday',
      period: 'P1',
      subjectCode: 'ECO-100',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Monday',
      period: 'P2',
      subjectCode: 'POL-100',
      category: 'MINOR',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Monday',
      period: 'P3',
      subjectCode: 'MDC-111',
      category: 'MDC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Tuesday',
      period: 'P1',
      subjectCode: 'AEC-120',
      category: 'AEC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Tuesday',
      period: 'P2',
      subjectCode: 'SEC-132',
      category: 'SEC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Tuesday',
      period: 'P3',
      subjectCode: 'VAC-140',
      category: 'VAC',
      section,
    },
  ];
  const sem3: ArtsRoutineSampleRow[] = [
    {
      stream,
      shift,
      semester: 3,
      day: 'Wednesday',
      period: 'P1',
      subjectCode: 'ECO-200',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 3,
      day: 'Wednesday',
      period: 'P2',
      subjectCode: 'ECO-201',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 3,
      day: 'Wednesday',
      period: 'P3',
      subjectCode: 'MDC-210',
      category: 'MDC',
      section,
    },
    {
      stream,
      shift,
      semester: 3,
      day: 'Thursday',
      period: 'P1',
      subjectCode: 'AEC-220',
      category: 'AEC',
      section,
    },
    {
      stream,
      shift,
      semester: 3,
      day: 'Thursday',
      period: 'P2',
      subjectCode: 'SEC-230',
      category: 'SEC',
      section,
    },
    {
      stream,
      shift,
      semester: 3,
      day: 'Thursday',
      period: 'P3',
      subjectCode: 'VTC-240',
      category: 'VTC',
      section,
    },
  ];
  const sem5: ArtsRoutineSampleRow[] = [
    {
      stream,
      shift,
      semester: 5,
      day: 'Friday',
      period: 'P1',
      subjectCode: 'ECO-300',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 5,
      day: 'Friday',
      period: 'P2',
      subjectCode: 'ECO-301',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 5,
      day: 'Friday',
      period: 'P3',
      subjectCode: 'ECO-302',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 5,
      day: 'Saturday',
      period: 'P1',
      subjectCode: 'POL-303',
      category: 'MINOR',
      section,
    },
    {
      stream,
      shift,
      semester: 5,
      day: 'Saturday',
      period: 'P2',
      subjectCode: 'ECO-303',
      category: 'INTERNSHIP',
      section,
    },
  ];
  return [...sem1, ...sem3, ...sem5];
}

/** Full demo population for Arts ODD plan seed (paper basket + consolidated majors). */
export function buildArtsOddTimetableSeedEntries(
  stream = 'ARTS',
  shift = 'Day Shift',
  section = 'Core',
): ArtsRoutineSampleRow[] {
  const base = buildArtsRoutineSampleRows(stream, shift, section);
  const sem1Majors: ArtsRoutineSampleRow[] = [
    {
      stream,
      shift,
      semester: 1,
      day: 'Monday',
      period: 'P4',
      subjectCode: 'GEO-100',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Monday',
      period: 'P5',
      subjectCode: 'HIS-100',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Monday',
      period: 'P6',
      subjectCode: 'ENG-100',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Tuesday',
      period: 'P4',
      subjectCode: 'EDN-100',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Tuesday',
      period: 'P5',
      subjectCode: 'GAR-100',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Tuesday',
      period: 'P6',
      subjectCode: 'SOC-100',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Wednesday',
      period: 'P4',
      subjectCode: 'PHI-100',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Thursday',
      period: 'P4',
      subjectCode: 'GEO-100',
      category: 'MAJOR',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Friday',
      period: 'P4',
      subjectCode: 'HIS-100',
      category: 'MAJOR',
      section,
    },
  ];

  /** Sem 1 admission sample (APP-2026-0001…0006) — pool MDC / AEC / SEC variants. */
  const sem1SamplePool: ArtsRoutineSampleRow[] = [
    {
      stream,
      shift,
      semester: 1,
      day: 'Wednesday',
      period: 'P1',
      subjectCode: 'MDC-110',
      category: 'MDC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Wednesday',
      period: 'P2',
      subjectCode: 'MDC-112',
      category: 'MDC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Wednesday',
      period: 'P3',
      subjectCode: 'MDC-113',
      category: 'MDC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Wednesday',
      period: 'P5',
      subjectCode: 'MDC-114',
      category: 'MDC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Wednesday',
      period: 'P6',
      subjectCode: 'MDC-116',
      category: 'MDC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Thursday',
      period: 'P1',
      subjectCode: 'AEC-122',
      category: 'AEC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Thursday',
      period: 'P2',
      subjectCode: 'SEC-131',
      category: 'SEC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Thursday',
      period: 'P3',
      subjectCode: 'SEC-133',
      category: 'SEC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Thursday',
      period: 'P5',
      subjectCode: 'SEC-134',
      category: 'SEC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Thursday',
      period: 'P6',
      subjectCode: 'SEC-135',
      category: 'SEC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Friday',
      period: 'P1',
      subjectCode: 'SEC-136',
      category: 'SEC',
      section,
    },
    {
      stream,
      shift,
      semester: 1,
      day: 'Friday',
      period: 'P2',
      subjectCode: 'POL-100',
      category: 'MAJOR',
      section,
    },
  ];

  return [...base, ...sem1Majors, ...sem1SamplePool];
}

/** Rows for Course Master Excel import (no NEP category columns). */
export function buildArtsCourseImportRows(): Array<{
  courseCode: string;
  courseTitle: string;
  deliveryType: string;
  totalCredits: number;
  theoryCredits: number;
  practicalCredits: number;
  theoryHoursPerWeek: number;
  practicalHoursPerWeek: number;
  totalTheoryContactHours: number;
  totalPracticalContactHours: number;
  totalContactHours: number;
  cbcsType: string;
  departmentCode: string;
}> {
  return buildArtsFyugpOddCourses().map((course) => ({
    courseCode: course.code,
    courseTitle: course.title,
    deliveryType: course.deliveryType ?? 'THEORY',
    totalCredits: course.credits,
    theoryCredits: course.theoryCredits ?? course.credits,
    practicalCredits: course.practicalCredits ?? 0,
    theoryHoursPerWeek: course.theoryHoursPerWeek ?? course.credits,
    practicalHoursPerWeek: course.practicalHoursPerWeek ?? 0,
    totalTheoryContactHours:
      course.totalTheoryContactHours ?? course.credits * 15,
    totalPracticalContactHours: course.totalPracticalContactHours ?? 0,
    totalContactHours: course.totalContactHours ?? course.credits * 15,
    cbcsType: course.category === 'INTERNSHIP' ? 'SKILL' : 'CORE',
    departmentCode: course.departmentCode,
  }));
}
