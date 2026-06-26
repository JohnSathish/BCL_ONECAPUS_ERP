/** User-friendly Semester 5 FYUGP import columns — names only, no course codes. */

export const SEM5_INTERNSHIP_AREAS = [
  'School Internship',
  'NGO Internship',
  'Industry Internship',
  'Bank Internship',
  'Research Internship',
  'Laboratory Internship',
  'Community Service',
  'Field Survey',
  'Media Internship',
  'Teaching Practice',
] as const;

export const SEM5_ADMISSION_TEMPLATE_HEADERS = [
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
  'Internship Area',
  'Section Code',
  'Category',
  'Religion',
  'Father Name',
  'Mother Name',
] as const;

export const SEM5_ADMISSION_TEMPLATE_HELPERS: Record<string, string> = {
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
  'Current Semester': 'Must be 5',
  'Major Department':
    'Select department — ERP assigns Major Papers 1, 2 & 3 automatically',
  'Minor Department':
    'Select allowed minor department — ERP maps to Minor paper automatically',
  'Internship Area':
    'Select internship type — ERP maps to Internship paper automatically',
  'Section Code': 'A, B, or Core — applies to all papers unless overridden',
};

export const SEM5_ADMISSION_SAMPLE_ROW: Record<string, string> = {
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
  'Current Semester': '5',
  'Major Department': 'Economics',
  'Minor Department': 'History',
  'Internship Area': 'Bank Internship',
  'Section Code': 'A',
  Category: 'GENERAL',
  Religion: 'CHRISTIAN',
  'Father Name': 'John Marak Sr',
  'Mother Name': 'Jane Marak',
};

export const SEM5_STRUCTURE_NOTES = [
  'Semester 5 FYUGP: 3 Major/Core (auto from Major Department) + 1 Minor/Core + 1 Internship = 5 papers, 20 credits.',
  'There is no MDC, AEC, SEC, or VTC in Semester 5. Do not enter course codes — select names from dropdowns only.',
  'Major Papers 1, 2 and 3 are assigned automatically when you choose Major Department.',
  'Minor Department options depend on the selected Major Department (NEHU major-minor rules).',
  'Internship Area selects the internship category; the ERP maps it to the major department internship course.',
];

export const SEM5_HIDDEN_SHEETS = {
  majorDepartments: 'Major Departments',
  majorLookup: 'Major Lookup',
  internshipAreas: 'Internship Areas',
  minorsByMajor: 'Minors By Major',
  programmes: 'Programmes',
} as const;
