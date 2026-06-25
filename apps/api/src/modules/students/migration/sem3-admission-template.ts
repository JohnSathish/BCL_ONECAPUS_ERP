/** User-friendly Semester 3 FYUGP import columns — names only, no course codes. */

export const SEM3_ADMISSION_TEMPLATE_HEADERS = [
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

  'MDC Paper',

  'AEC Paper',

  'SEC Paper',

  'VTC Paper',

  'Section Code',

  'Category',

  'Religion',

  'Father Name',

  'Mother Name',
] as const;

export const SEM3_ADMISSION_TEMPLATE_HELPERS: Record<string, string> = {
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

  'Current Semester': 'Must be 3',

  'Major Department':
    'Select department — ERP assigns Major Paper 1 & 2 automatically',

  'MDC Paper': 'Select paper name — ERP maps to MDC code automatically',

  'AEC Paper': 'Select paper name — ERP maps to AEC code automatically',

  'SEC Paper': 'Select paper name — ERP maps to SEC code automatically',

  'VTC Paper': 'Select paper name — ERP maps to VTC code automatically',

  'Section Code': 'A, B, or Core — applies to all papers unless overridden',
};

export const SEM3_ADMISSION_SAMPLE_ROW: Record<string, string> = {
  'Registration Number': 'REG2026001',

  'Full Name': 'Priangshuman Marak',

  Email: 'student@example.edu',

  Mobile: '9876543210',

  ABC_ID: '123456789012',

  Programme: 'BA-ECO',

  'Admission Batch': 'BATCH-2026',

  Stream: 'ARTS',

  Shift: 'DAY',

  'Academic Session': '2026-27',

  'Current Semester': '3',

  'Major Department': 'Economics',

  'MDC Paper': 'Environmental Studies',

  'AEC Paper': 'Communicative English',

  'SEC Paper': 'Office Automation',

  'VTC Paper': 'Graphic Design',

  'Section Code': 'A',

  Category: 'GENERAL',

  Religion: 'CHRISTIAN',

  'Father Name': 'John Marak',

  'Mother Name': 'Jane Marak',
};

export const SEM3_STRUCTURE_NOTES = [
  'Semester 3 FYUGP: 2 Major/Core (auto from Major Department) + MDC + AEC + SEC + VTC = 6 papers, 20 credits.',

  'There is no Minor or VAC in Semester 3. Do not enter course codes — select names from dropdowns only.',

  'Major Paper 1 and Major Paper 2 are assigned automatically when you choose Major Department.',

  'Template papers are loaded from the configured Semester 3 curriculum for the selected Programme.',
];

export const SEM3_HIDDEN_SHEETS = {
  majorDepartments: 'Major Departments',

  majorLookup: 'Major Lookup',

  mdcPapers: 'MDC Papers',

  aecPapers: 'AEC Papers',

  secPapers: 'SEC Papers',

  vtcPapers: 'VTC Papers',

  programmes: 'Programmes',
} as const;
