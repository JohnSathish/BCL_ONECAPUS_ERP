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

/** Short Excel/import label for every *-303 internship slot (full NEHU title stays in course master). */
export const SEM5_INTERNSHIP_COURSE_SHORT_TITLE = 'Internship';

export const SEM5_ADMISSION_TEMPLATE_HEADERS = [
  'Registration Number',
  'Roll Number',
  'University Roll Number',
  'University Registration Number',
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
  'Roll Number': 'College roll number (same as registration when assigned)',
  'University Roll Number': 'NEHU roll number from the office register',
  'University Registration Number':
    'NEHU registration / Regd. No. from the office register',
  'Full Name': 'Required',
  Email: 'Required — used for portal login',
  Mobile: '10-digit mobile number',
  ABC_ID: 'Academic Bank of Credits ID (12 digits)',
  Programme: 'Select from dropdown — e.g. BA-ECO, BA-GEO',
  'Admission Batch': 'BATCH-2026',
  Stream: 'ARTS',
  Shift: 'MORNING or DAY — Semester 5 curriculum is identical for both shifts',
  'Academic Session': '2026-27',
  'Current Semester': 'Must be 5',
  'Major Department':
    'Department name only — ERP assigns Major Papers 1–3 automatically',
  'Minor Department': 'Allowed minor department for this major',
  'Internship Area':
    'Select registered internship course (e.g. ECO-303 — Internship)',
  'Section Code': 'A, B, or Core',
};

export const SEM5_ADMISSION_SAMPLE_ROW: Record<string, string> = {
  'Registration Number': 'REG2026001',
  'Roll Number': 'REG2026001',
  'University Roll Number': '24313101',
  'University Registration Number': '24013773',
  'Full Name': 'John Marak',
  Email: 'student@example.edu',
  Mobile: '9876543210',
  ABC_ID: '123456789012',
  Programme: 'BA-ECO',
  'Admission Batch': 'BATCH-2026',
  Stream: 'ARTS',
  Shift: 'MORNING',
  'Academic Session': '2026-27',
  'Current Semester': '5',
  'Major Department': 'Economics',
  'Minor Department': 'History',
  'Internship Area': 'ECO-303 — Internship',
  'Section Code': 'A',
  Category: 'GENERAL',
  Religion: 'CHRISTIAN',
  'Father Name': 'John Marak Sr',
  'Mother Name': 'Jane Marak',
};

export const SEM5_STRUCTURE_NOTES = [
  'Semester 5 FYUGP: 3 Major papers + 1 Minor + 1 Internship course = 5 papers, 20 credits.',
  'Major Department auto-assigns Major Papers 1–3. Internship Area must be the registered internship course for that major (XXX-303).',
  'Minor Department uses the NEHU major–minor matrix (XXX-302 minor papers only — never internship codes).',
  'Internship Area dropdown lists registered courses (e.g. ECO-303 — Internship, GAR-303 — Internship).',
  'Pick the internship course that matches the Major Department (Economics → ECO-303, Garo → GAR-303, etc.).',
  'Minor Department options depend on the selected Major Department (NEHU major-minor rules).',
  'Shift: MORNING or DAY — Semester 5 curriculum is identical for both shifts.',
];

export const SEM5_HIDDEN_SHEETS = {
  majorDepartments: 'Major Departments',
  majorLookup: 'Major Lookup',
  internshipAreas: 'Internship Areas',
  minorsByMajor: 'Minors By Major',
  programmes: 'Programmes',
  shifts: 'Shifts',
} as const;
