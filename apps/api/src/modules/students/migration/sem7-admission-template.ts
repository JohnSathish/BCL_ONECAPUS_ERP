/** User-friendly Semester 7 FYUGP lateral / advanced-entry import columns. */

export const SEM7_ADMISSION_TEMPLATE_HEADERS = [
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
  'Admission Type',
  'Major Department',
  'Minor Department',
  'Aggregate % Through Sem 6',
  'Previous College',
  'NEHU Registration Number',
  'NEHU Roll Number',
  'Section Code',
  'Category',
  'Religion',
  'Father Name',
  'Mother Name',
] as const;

export const SEM7_ADMISSION_TEMPLATE_HELPERS: Record<string, string> = {
  'Registration Number': 'College registration / enrollment when assigned',
  'Full Name': 'Required',
  Email: 'Required — used for portal login',
  Mobile: '10-digit mobile number',
  ABC_ID: 'Academic Bank of Credits ID',
  Programme: 'Select from dropdown — e.g. BA-ECO, BA-GEO',
  'Admission Batch': 'BATCH-2026',
  Stream: 'ARTS',
  Shift: 'MORNING or DAY',
  'Academic Session': '2026-27',
  'Current Semester': 'Must be 7',
  'Admission Type':
    'LATERAL for other NEHU colleges; REGULAR if own-college re-entry',
  'Major Department':
    'Department name only — Sem 7 papers (3 Major) assigned at registration',
  'Minor Department':
    'Allowed minor for this major — Sem 7 papers (2 Minor) at registration',
  'Aggregate % Through Sem 6':
    'NEHU-attested aggregate percentage through Semester 6 (required, 0–100)',
  'Previous College': 'Previous NEHU-affiliated college name (lateral entry)',
  'NEHU Registration Number': 'University registration number from NEHU docs',
  'NEHU Roll Number': 'University roll number from NEHU docs',
  'Section Code': 'A, B, or Core',
};

export const SEM7_ADMISSION_SAMPLE_ROW: Record<string, string> = {
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
  'Current Semester': '7',
  'Admission Type': 'LATERAL',
  'Major Department': 'Economics',
  'Minor Department': 'History',
  'Aggregate % Through Sem 6': '78.50',
  'Previous College': 'Don Bosco College Tura',
  'NEHU Registration Number': 'NEHU-REG-001',
  'NEHU Roll Number': 'NEHU-ROLL-001',
  'Section Code': 'A',
  Category: 'GENERAL',
  Religion: 'CHRISTIAN',
  'Father Name': 'John Marak Sr',
  'Mother Name': 'Jane Marak',
};

export const SEM7_STRUCTURE_NOTES = [
  'Semester 7 FYUGP: 3 Major + 2 Minor = 5 papers, 20 credits. Same pattern for all students.',
  'Do not choose Honours vs Research here — that happens at Semester 8 registration.',
  'Aggregate % Through Sem 6 must be attested from NEHU documents (Research needs ≥ 75% later).',
  'Major/Minor departments use the NEHU matrix; Sem 7 papers are auto-assigned at registration.',
  'Admission Type LATERAL for other NEHU-affiliated colleges; verify documents before import.',
];

export const SEM7_HIDDEN_SHEETS = {
  majorDepartments: 'Major Departments',
  minorsByMajor: 'Minors By Major',
  programmes: 'Programmes',
  shifts: 'Shifts',
  admissionTypes: 'Admission Types',
} as const;
