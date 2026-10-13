/** Don Bosco College official NEHU FYUGP major → allowed minors matrix. */
export const DBC_MAJOR_MINOR_MATRIX: Record<string, readonly string[]> = {
  Economics: ['Geography', 'History', 'Political Science', 'Sociology'],
  Education: ['Garo', 'History', 'Philosophy'],
  English: ['Education', 'Geography', 'Philosophy', 'Political Science'],
  Garo: ['Education', 'Geography', 'Philosophy', 'Sociology'],
  Geography: ['Economics', 'Garo'],
  History: ['Economics', 'Philosophy', 'Political Science', 'Sociology'],
  Philosophy: ['Education', 'Garo', 'Geography'],
  'Political Science': ['Economics', 'Education', 'History', 'Sociology'],
  Sociology: ['Economics', 'Garo', 'History', 'Political Science'],
  Botany: ['Zoology', 'Chemistry'],
  Chemistry: ['Mathematics', 'Physics'],
  Mathematics: ['Physics', 'Chemistry'],
  Zoology: ['Botany', 'Chemistry'],
  Physics: ['Chemistry', 'Mathematics'],
  Commerce: ['Economics', 'Mathematics', 'Geography'],
};

export const DBC_MAJOR_MINOR_PROGRAMME_GROUP: Record<string, string> = {
  Economics: 'ARTS',
  Education: 'ARTS',
  English: 'ARTS',
  Garo: 'ARTS',
  Geography: 'ARTS',
  History: 'ARTS',
  Philosophy: 'ARTS',
  'Political Science': 'ARTS',
  Sociology: 'ARTS',
  Botany: 'SCIENCE',
  Chemistry: 'SCIENCE',
  Mathematics: 'SCIENCE',
  Zoology: 'SCIENCE',
  Physics: 'SCIENCE',
  Commerce: 'COMMERCE',
};

export const DBC_MAJOR_PROGRAM_CODE: Record<string, string> = {
  Economics: 'BA-ECO',
  Education: 'BA-EDU',
  English: 'BA-ENG',
  Garo: 'BA-GAR',
  Geography: 'BA-GEO',
  History: 'BA-HIS',
  Philosophy: 'BA-PHI',
  'Political Science': 'BA-POL',
  Sociology: 'BA-SOC',
  Botany: 'BSC-BOT',
  Chemistry: 'BSC-CHE',
  Mathematics: 'BSC-MTH',
  Zoology: 'BSC-ZOO',
  Physics: 'BSC-PHY',
  Commerce: 'BCOM',
};

/** Live catalogues sometimes keep Commerce under COM as well as BCOM. */
export const DBC_EXTRA_MAJOR_PROGRAM_CODES: Record<string, readonly string[]> =
  {
    Commerce: ['COM'],
  };

export function listDbcMajorProgramCodes(): string[] {
  return [
    ...new Set([
      ...Object.values(DBC_MAJOR_PROGRAM_CODE),
      ...Object.values(DBC_EXTRA_MAJOR_PROGRAM_CODES).flat(),
    ]),
  ];
}

export const DBC_MAJOR_MINOR_DEPT_CODE: Record<string, string> = {
  Economics: 'ECO',
  Education: 'EDN',
  English: 'ENG',
  Garo: 'GAR',
  Geography: 'GEO',
  History: 'HIS',
  Philosophy: 'PHI',
  'Political Science': 'POL',
  Sociology: 'SOC',
  Botany: 'BOT',
  Chemistry: 'CHE',
  Mathematics: 'MTH',
  Zoology: 'ZOO',
  Physics: 'PHY',
  Commerce: 'COM',
};

function normalizeMajorMinorLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DBC_MAJOR_NAME_ALIASES: Record<string, string> = {
  'pol science': 'Political Science',
  'political science': 'Political Science',
  'pol sci': 'Political Science',
  bcom: 'Commerce',
  'b com': 'Commerce',
  commerce: 'Commerce',
  'acc for business': 'Commerce',
  'accounting for business': 'Commerce',
  maths: 'Mathematics',
  math: 'Mathematics',
};

export function canonicalDbcMajorName(name: string): string | undefined {
  const normalized = normalizeMajorMinorLabel(name);
  if (!normalized) return undefined;
  const aliased = DBC_MAJOR_NAME_ALIASES[normalized];
  if (aliased) return aliased;
  return Object.keys(DBC_MAJOR_MINOR_MATRIX).find(
    (major) => normalizeMajorMinorLabel(major) === normalized,
  );
}

export function allowedMinorsForDbcMajor(majorName: string): readonly string[] {
  const canonical = canonicalDbcMajorName(majorName);
  return canonical ? (DBC_MAJOR_MINOR_MATRIX[canonical] ?? []) : [];
}

/** Semester 1 minor is the other department's existing -100 major paper. */
export function buildFyugpSem1MinorMappings(hostProgramCode: string): Array<{
  programCode: string;
  courseCode: string;
  minorName: string;
  departmentCode: string;
}> {
  const majorName =
    Object.entries(DBC_MAJOR_PROGRAM_CODE).find(
      ([, code]) => code === hostProgramCode,
    )?.[0] ??
    Object.entries(DBC_EXTRA_MAJOR_PROGRAM_CODES).find(([, codes]) =>
      codes.includes(hostProgramCode),
    )?.[0];
  if (!majorName) return [];
  return (DBC_MAJOR_MINOR_MATRIX[majorName] ?? []).flatMap((minorName) => {
    const departmentCode = DBC_MAJOR_MINOR_DEPT_CODE[minorName];
    if (!departmentCode) return [];
    return [
      {
        programCode: hostProgramCode,
        courseCode: `${departmentCode}-100`,
        minorName,
        departmentCode,
      },
    ];
  });
}

export function isAllowedDbcMajorMinorPair(
  majorName: string,
  minorName: string,
): boolean {
  const allowed = allowedMinorsForDbcMajor(majorName);
  const minorKey = normalizeMajorMinorLabel(minorName);
  return allowed.some((minor) => normalizeMajorMinorLabel(minor) === minorKey);
}
