/** User-friendly Semester 2 FYUGP subject import — department names and paper titles only. */

export const SEM2_SUBJECT_IMPORT_HEADERS = [
  'Registration Number',
  'Full Name',
  'Email',
  'Mobile',
  'ABC_ID',
  'Programme',
  'Admission Batch',
  'Stream',
  'Shift',
  'Academic Session',
  'Current Semester',
  'Major Department',
  'Minor Department',
  'MDC Paper',
  'AEC Paper',
  'Skill Enhancement Course',
  'VAC Paper',
  'Section Code',
  'Category',
  'Religion',
  'Father Name',
  'Mother Name',
] as const;

export const SEM2_SUBJECT_IMPORT_HELPERS: Record<string, string> = {
  'Registration Number': 'College registration / roll when assigned',
  'Full Name': 'Required',
  Email: 'Required — used for portal login',
  Mobile: '10-digit mobile number',
  ABC_ID: 'Academic Bank of Credits ID (12 digits)',
  Programme: 'Select from dropdown — e.g. BA-ECO, BA-GEO',
  'Admission Batch': 'BATCH-2026',
  Stream: 'ARTS',
  Shift: 'MORNING or DAY — determines Semester 2 paper pool',
  'Academic Session': '2026-27',
  'Current Semester': 'Must be 2',
  'Major Department':
    'Select department — ERP assigns Semester 2 Major paper ({DEPT}-150) automatically',
  'Minor Department':
    'Select allowed minor department — ERP maps to Semester 2 Minor paper automatically',
  'MDC Paper': 'Select MDC paper title from shift-specific Semester 2 pool',
  'AEC Paper': 'Select AEC paper title from shift-specific Semester 2 pool',
  'Skill Enhancement Course':
    'Select SEC paper title from shift-specific Semester 2 pool',
  'VAC Paper': 'Select VAC paper title from shift-specific Semester 2 pool',
  'Section Code': 'A, B, or Core — applies to all papers unless overridden',
};

export const SEM2_SUBJECT_IMPORT_SAMPLE_ROW: Record<string, string> = {
  'Registration Number': 'REG2026001',
  'Full Name': 'John Marak',
  Email: 'student@example.edu',
  Mobile: '9876543210',
  ABC_ID: '123456789012',
  Programme: 'BA-ECO',
  'Admission Batch': 'BATCH-2026',
  Stream: 'ARTS',
  Shift: 'MORNING',
  'Academic Session': '2026-27',
  'Current Semester': '2',
  'Major Department': 'Economics',
  'Minor Department': 'History',
  'MDC Paper': 'Environmental Ethics',
  'AEC Paper': 'Communicative English',
  'Skill Enhancement Course': 'Communication Skills',
  'VAC Paper': 'Life Skills Education',
  'Section Code': 'A',
  Category: 'GENERAL',
  Religion: 'CHRISTIAN',
  'Father Name': 'John Marak Sr',
  'Mother Name': 'Jane Marak',
};

export const SEM2_STRUCTURE_NOTES = [
  'Semester 2 FYUGP: 1 Major + 1 Minor + MDC + AEC + SEC + VAC = 6 papers, 20 credits.',
  'Major and Minor departments carry forward from Semester 1 — only paper codes advance to {DEPT}-150.',
  'MDC, AEC, SEC, and VAC options depend on Shift (Morning vs Day). Do not enter course codes.',
  'Minor Department options depend on the selected Major Department (NEHU major-minor rules).',
  'Template papers are loaded from the configured Semester 2 shift curriculum for the selected Programme.',
];

export const SEM2_HIDDEN_SHEETS = {
  programmes: 'Programmes',
  shifts: 'Shifts',
  majorDepartments: 'Major Departments',
  majorLookup: 'Major Lookup',
  mdcPapers: 'MDC Papers',
  aecPapers: 'AEC Papers',
  secPapers: 'SEC Papers',
  vacPapers: 'VAC Papers',
  minorsByMajor: 'Minors By Major',
} as const;
