/** Semesters where a new fee cycle demand is generated (FYUP Don Bosco model). */
export const FEE_CYCLE_TRIGGER_SEMESTERS = [1, 3, 5, 7] as const;

export type FeeCycleTriggerSemester =
  (typeof FEE_CYCLE_TRIGGER_SEMESTERS)[number];

export function isFeeCycleTriggerSemester(
  semester: number,
): semester is FeeCycleTriggerSemester {
  return (FEE_CYCLE_TRIGGER_SEMESTERS as readonly number[]).includes(semester);
}

export function fyugpYearForSemester(semester: number) {
  return Math.ceil(semester / 2);
}

export function semesterPairLabel(start: number, end: number) {
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  return `Semester ${roman[start - 1] ?? start} & ${roman[end - 1] ?? end}`;
}

/** Reusable fee head catalog (master defaults). */
export const DON_BOSCO_DEFAULT_FEE_HEADS = [
  { code: 'ADMISSION', name: 'Admission Fee', amount: 200, sortOrder: 10 },
  { code: 'EXAM', name: 'Test & Examination', amount: 750, sortOrder: 20 },
  { code: 'LIBRARY', name: 'Library', amount: 900, sortOrder: 30 },
  { code: 'COMPUTER', name: 'Computer', amount: 350, sortOrder: 40 },
  {
    code: 'CO_CURRICULAR',
    name: 'Co-Curricular Activities',
    amount: 450,
    sortOrder: 50,
  },
  { code: 'ID_CARD', name: 'ID Card', amount: 300, sortOrder: 55 },
  { code: 'MAINTENANCE', name: 'Maintenance Fee', amount: 1600, sortOrder: 60 },
  { code: 'DEVELOPMENT', name: 'Development Fee', amount: 1700, sortOrder: 70 },
  {
    code: 'MAGAZINE',
    name: 'Magazine / Handbook / Journal',
    amount: 650,
    sortOrder: 80,
  },
  {
    code: 'ESTABLISHMENT',
    name: 'Establishment Fee',
    amount: 1700,
    sortOrder: 90,
  },
  {
    code: 'FUNCTIONS',
    name: 'Functions / Socials / Orientation',
    amount: 550,
    sortOrder: 100,
  },
  { code: 'CONTINGENCY', name: 'Contingency', amount: 650, sortOrder: 110 },
] as const;

/** Per-cycle line amounts (Sem I–II spec). */
export const CYCLE_1_LINE_AMOUNTS: Record<string, number> = {
  ADMISSION: 200,
  EXAM: 800,
  LIBRARY: 900,
  COMPUTER: 350,
  CO_CURRICULAR: 500,
  ID_CARD: 300,
  MAINTENANCE: 1800,
  DEVELOPMENT: 1850,
  MAGAZINE: 700,
  ESTABLISHMENT: 1850,
  FUNCTIONS: 600,
  CONTINGENCY: 750,
};

/** Per-cycle line amounts (Sem III–IV and later years). */
export const CYCLE_LATER_LINE_AMOUNTS: Record<string, number> = {
  ADMISSION: 200,
  EXAM: 750,
  LIBRARY: 900,
  COMPUTER: 350,
  CO_CURRICULAR: 450,
  MAINTENANCE: 1600,
  DEVELOPMENT: 1700,
  MAGAZINE: 650,
  ESTABLISHMENT: 1700,
  FUNCTIONS: 550,
  CONTINGENCY: 650,
};

export function cycleLineAmounts(cycleCode: string): Record<string, number> {
  if (cycleCode === 'CYCLE_1') return CYCLE_1_LINE_AMOUNTS;
  return CYCLE_LATER_LINE_AMOUNTS;
}

/** Default FYUP admission cycles for Don Bosco College, Tura. */
export const DON_BOSCO_DEFAULT_FEE_CYCLES = [
  {
    code: 'CYCLE_1',
    name: 'Admission Cycle 1',
    fyugpYear: 1,
    startSemester: 1,
    endSemester: 2,
    totalAmount: 10600,
    description: 'Year 1 — Admission & Session Fee covering Semester I & II',
  },
  {
    code: 'CYCLE_2',
    name: 'Admission Cycle 2',
    fyugpYear: 2,
    startSemester: 3,
    endSemester: 4,
    totalAmount: 9500,
    description: 'Year 2 — Admission & Session Fee covering Semester III & IV',
  },
  {
    code: 'CYCLE_3',
    name: 'Admission Cycle 3',
    fyugpYear: 3,
    startSemester: 5,
    endSemester: 6,
    totalAmount: 9500,
    description: 'Year 3 — Admission & Session Fee covering Semester V & VI',
  },
  {
    code: 'CYCLE_4',
    name: 'Admission Cycle 4',
    fyugpYear: 4,
    startSemester: 7,
    endSemester: 8,
    totalAmount: 9500,
    description:
      'Year 4 — Admission & Session Fee covering Semester VII & VIII (configurable)',
  },
] as const;
