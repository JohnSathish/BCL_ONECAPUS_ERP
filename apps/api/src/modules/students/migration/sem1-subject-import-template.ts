/** User-friendly Semester 1 FYUGP subject import — names only, no course codes. VAC auto-registered. */

export const SEM1_SUBJECT_IMPORT_HEADERS = [
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
  'MDC Department',
  'AEC Paper',
  'Skill Enhancement Course',
  'Section Code',
  'Category',
  'Religion',
  'Father Name',
  'Mother Name',
] as const;

export const SEM1_SUBJECT_IMPORT_HELPERS: Record<string, string> = {
  'Registration Number': 'College registration / roll when assigned',
  'Full Name': 'Required',
  Email: 'Required — used for portal login',
  Mobile: '10-digit mobile number',
  ABC_ID: 'Academic Bank of Credits ID (12 digits)',
  Programme: 'Select from dropdown — e.g. BA-ECO, BA-GEO',
  'Admission Batch': 'BATCH-2026',
  Stream: 'ARTS',
  Shift: 'DAY',
  'Academic Session': '2026-27',
  'Current Semester': 'Must be 1',
  'Major Department':
    'Select department — ERP assigns Major/Core paper automatically',
  'Minor Department':
    'Select allowed minor department — ERP maps to Minor paper automatically',
  'MDC Department':
    'Select MDC paper name — ERP maps to MDC code automatically',
  'AEC Paper': 'Select AEC paper name — ERP maps to AEC code automatically',
  'Skill Enhancement Course':
    'Select SEC paper name — ERP maps to SEC code automatically',
  'Section Code': 'A, B, or Core — applies to all papers unless overridden',
};

export const SEM1_SUBJECT_IMPORT_SAMPLE_ROW: Record<string, string> = {
  'Registration Number': 'REG2026001',
  'Full Name': 'John Marak',
  Email: 'student@example.edu',
  Mobile: '9876543210',
  ABC_ID: '123456789012',
  Programme: 'BA-ECO',
  'Admission Batch': 'BATCH-2026',
  Stream: 'ARTS',
  Shift: 'DAY',
  'Academic Session': '2026-27',
  'Current Semester': '1',
  'Major Department': 'Economics',
  'Minor Department': 'History',
  'MDC Department': 'Financial Literacy',
  'AEC Paper': 'Communicative English',
  'Skill Enhancement Course': 'Computer Applications',
  'Section Code': 'A',
  Category: 'GENERAL',
  Religion: 'CHRISTIAN',
  'Father Name': 'John Marak Sr',
  'Mother Name': 'Jane Marak',
};

export const SEM1_STRUCTURE_NOTES = [
  'Semester 1 FYUGP: 1 Major + 1 Minor + MDC + AEC + SEC + VAC (auto) = 6 papers, 20 credits.',
  'VAC — Environment Studies (VAC-140) is compulsory and registered automatically. Do not add a VAC column.',
  'There is no VTC in Semester 1. Do not enter course codes — select names from dropdowns only.',
  'Minor Department options depend on the selected Major Department (NEHU major-minor rules).',
  'Template papers are loaded from the configured Semester 1 curriculum for the selected Programme.',
];

export const SEM1_HIDDEN_SHEETS = {
  programmes: 'Programmes',
  majorDepartments: 'Major Departments',
  majorLookup: 'Major Lookup',
  mdcDepartments: 'MDC Departments',
  aecPapers: 'AEC Papers',
  secPapers: 'SEC Papers',
  minorsByMajor: 'Minors By Major',
} as const;
