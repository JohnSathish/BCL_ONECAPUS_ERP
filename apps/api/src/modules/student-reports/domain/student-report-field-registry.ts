export type StudentReportFieldGroup =
  | 'identity'
  | 'personal'
  | 'contact'
  | 'guardian'
  | 'address'
  | 'admission'
  | 'programme'
  | 'academic'
  | 'board'
  | 'class12'
  | 'subjects'
  | 'cuet'
  | 'abc'
  | 'fees'
  | 'attendance'
  | 'residence'
  | 'documents'
  | 'exams'
  | 'library'
  | 'system'
  | 'banking';

export type StudentReportFieldDef = {
  key: string;
  label: string;
  group: StudentReportFieldGroup;
  description?: string;
  /** Hidden unless the user may see Aadhaar and bank fields. */
  sensitive?: boolean;
  /** Selecting this field adds a one-to-many worksheet. The master sheet stays one row per student. */
  detailSheet?: string;
};

export const STUDENT_REPORT_FIELD_GROUPS: Record<
  StudentReportFieldGroup,
  string
> = {
  identity: 'Identity',
  personal: 'Personal information',
  contact: 'Contact information',
  guardian: 'Parent / guardian',
  address: 'Address',
  admission: 'Admission information',
  programme: 'Programme and academic information',
  academic: 'Academic standing',
  board: 'Class XII / board examination',
  class12: 'Class XII subject-wise marks',
  subjects: 'NEP / FYUGP subject registration',
  cuet: 'CUET information',
  abc: 'ABC / APAAR information',
  fees: 'Fee information',
  attendance: 'Attendance information',
  residence: 'Residence / hostel',
  documents: 'Documents',
  exams: 'Examination information',
  library: 'Library information',
  system: 'System information',
  banking: 'Banking',
};

export const STUDENT_REPORT_GROUP_ORDER: StudentReportFieldGroup[] = [
  'identity',
  'personal',
  'contact',
  'guardian',
  'address',
  'admission',
  'programme',
  'academic',
  'board',
  'class12',
  'subjects',
  'cuet',
  'abc',
  'fees',
  'attendance',
  'residence',
  'documents',
  'exams',
  'library',
  'system',
  'banking',
];

const field = (
  key: string,
  label: string,
  group: StudentReportFieldGroup,
  extra?: Pick<
    StudentReportFieldDef,
    'description' | 'sensitive' | 'detailSheet'
  >,
): StudentReportFieldDef => ({ key, label, group, ...extra });

const sheetNote =
  'One row per related record on a separate worksheet. The student sheet stays one row per student.';

export const STUDENT_REPORT_FIELDS: StudentReportFieldDef[] = [
  field('studentId', 'Student ID', 'identity', {
    description: 'Internal student identifier.',
  }),
  field('admissionNumber', 'Admission Number', 'identity'),
  field('applicationNumber', 'Application Number', 'identity'),
  field('rollNumber', 'Roll Number', 'identity'),
  field('enrollmentNumber', 'Registration Number', 'identity'),
  field('universityRollNumber', 'NEHU Roll Number', 'identity'),
  field('universityRegistrationNumber', 'NEHU Registration Number', 'identity'),
  field('formNumber', 'Form Number', 'identity'),
  field('rfidNumber', 'RFID', 'identity'),
  field('libraryCardNumber', 'Library Card Number', 'identity'),
  field('fullName', 'Full Name', 'identity'),
  field('firstName', 'First Name', 'identity', {
    description: 'Derived from the stored full name.',
  }),
  field('middleName', 'Middle Name', 'identity', {
    description: 'Derived from the stored full name.',
  }),
  field('lastName', 'Last Name', 'identity', {
    description: 'Derived from the stored full name.',
  }),
  field('studentStatus', 'Student Status', 'identity'),
  field('admissionStatus', 'Admission Status', 'identity'),

  field('dateOfBirth', 'Date of Birth', 'personal'),
  field('age', 'Age', 'personal'),
  field('gender', 'Gender', 'personal'),
  field('bloodGroup', 'Blood Group', 'personal'),
  field('nationality', 'Nationality', 'personal'),
  field('religion', 'Religion', 'personal'),
  field('category', 'Category', 'personal'),
  field('tribe', 'Tribe', 'personal'),
  field('denomination', 'Denomination', 'personal'),
  field('maritalStatus', 'Marital Status', 'personal'),
  field('nationalId', 'National ID', 'personal', {
    sensitive: true,
    description: 'Aadhaar or other national identifier.',
  }),
  field('panNumber', 'PAN', 'personal', { sensitive: true }),
  field('differentlyAbled', 'Differently Abled', 'personal'),
  field('ews', 'EWS', 'personal'),

  field('mobileNumber', 'Primary Mobile Number', 'contact'),
  field('alternateMobile', 'Alternate Mobile Number', 'contact'),
  field('whatsappNumber', 'WhatsApp Number', 'contact'),
  field('email', 'Email Address', 'contact'),
  field('emergencyContactName', 'Emergency Contact Name', 'contact'),
  field(
    'emergencyContactRelation',
    'Emergency Contact Relationship',
    'contact',
  ),
  field('emergencyContactMobile', 'Emergency Contact Number', 'contact'),

  field('fatherName', "Father's Name", 'guardian'),
  field('fatherMobile', "Father's Mobile Number", 'guardian'),
  field('fatherOccupation', "Father's Occupation", 'guardian'),
  field('motherName', "Mother's Name", 'guardian'),
  field('motherMobile', "Mother's Mobile Number", 'guardian'),
  field('motherOccupation', "Mother's Occupation", 'guardian'),
  field('guardianName', 'Guardian Name', 'guardian'),
  field('guardianMobile', 'Guardian Mobile', 'guardian'),

  field('presentAddress', 'Present Address', 'address'),
  field('permanentAddress', 'Permanent Address', 'address'),
  field('presentVillage', 'Present Village / City', 'address'),
  field('permanentVillage', 'Permanent Village / City', 'address'),
  field('district', 'District', 'address'),
  field('state', 'State', 'address'),
  field('pincode', 'PIN Code', 'address'),
  field('presentDistrict', 'Present District', 'address'),
  field('presentState', 'Present State', 'address'),
  field('presentPincode', 'Present PIN Code', 'address'),

  field('admissionDate', 'Admission Date', 'admission'),
  field('admissionType', 'Admission Type', 'admission'),
  field('admissionSource', 'Admission Source', 'admission'),
  field('admissionCategory', 'Admission Category', 'admission'),
  field('session', 'Admission Session', 'admission'),
  field('applicationStatus', 'Application Status', 'admission'),
  field('applicationSubmittedAt', 'Application Date', 'admission'),
  field('previousCollegeName', 'Previous Institution', 'admission'),
  field(
    'applicationDocumentStatus',
    'Application Document Status',
    'admission',
  ),

  field('programme', 'Programme', 'programme'),
  field('programmeVersion', 'Programme Version', 'programme'),
  field('department', 'Department', 'programme'),
  field('majorSubject', 'Major Subject', 'programme'),
  field('minorSubject', 'Minor Subject', 'programme'),
  field('majorDepartment', 'Major Department', 'programme'),
  field('minorDepartment', 'Minor Department', 'programme'),
  field('stream', 'Stream', 'programme'),
  field('shift', 'Shift', 'programme'),
  field('preferredShift', 'Preferred Shift', 'programme'),
  field('batch', 'Batch', 'programme'),
  field('nccEnrolled', 'NCC Enrolled', 'programme'),

  field('currentSemester', 'Current Semester', 'academic'),
  field('academicStatus', 'Academic Status', 'academic'),
  field('programmeStatus', 'Programme Status', 'academic'),
  field('admissionYear', 'Admission Year', 'academic'),
  field(
    'semesterRegistrationStatus',
    'Semester Registration Status',
    'academic',
  ),
  field('profileCompletionPercent', 'Profile Completion %', 'academic'),
  field('profileVerificationStatus', 'Profile Verification Status', 'academic'),

  field('boardName', 'Board Name', 'board'),
  field('boardNameOther', 'Other Board Name', 'board'),
  field('boardReportName', 'Actual Board Name', 'board'),
  field('schoolName', 'School Name', 'board'),
  field('boardRollNumber', 'Board Roll Number', 'board'),
  field('boardRegistrationNumber', 'Board Registration Number', 'board'),
  field('boardYear', 'Examination Year', 'board'),
  field('boardStream', 'Class XII Stream', 'board'),
  field('boardTotalMarks', 'Total Marks', 'board'),
  field('boardMaximumMarks', 'Maximum Marks', 'board'),
  field('boardPercentage', 'Percentage', 'board'),
  field('boardGrade', 'Grade', 'board'),
  field('boardDivision', 'Division', 'board'),
  field('boardVerificationStatus', 'Verification Status', 'board'),

  field('class12SubjectList', 'Class XII Subjects and Marks', 'class12', {
    detailSheet: 'Class XII Marks',
    description:
      'Excel export creates one numeric column per Class XII subject found in the selected students. A blank cell means that student has no mark for that subject. The Class XII Marks sheet still lists each subject on its own row.',
  }),

  field('registeredSubjects', 'Registered Subjects', 'subjects', {
    detailSheet: 'Subject Registration',
    description: sheetNote,
  }),

  field('cuetApplied', 'CUET Applied', 'cuet'),
  field('cuetRoll', 'CUET Roll Number', 'cuet'),
  field('cuetScore', 'CUET Score', 'cuet'),
  field('cuetSubjects', 'CUET Subjects', 'cuet'),

  field('abcId', 'ABC ID', 'abc'),
  field('abcVerified', 'ABC Verified', 'abc'),
  field('abcVerificationStatus', 'ABC Verification Status', 'abc'),
  field('abcStatus', 'ABC Account Status', 'abc'),

  field('feeStatus', 'Fee Status', 'fees'),
  field('feeDueAmount', 'Pending Amount', 'fees'),
  field('feePaidAmount', 'Total Amount Paid', 'fees'),
  field('lastPaymentDate', 'Payment Date', 'fees'),
  field('lastPaymentMode', 'Payment Mode', 'fees'),
  field('lastPaymentReference', 'Transaction Reference', 'fees'),
  field('feeTransactions', 'Fee Transactions', 'fees', {
    detailSheet: 'Fee Transactions',
    description: sheetNote,
  }),

  field('attendanceWorkingDays', 'Total Working Days', 'attendance'),
  field('attendancePresent', 'Total Present', 'attendance'),
  field('attendanceAbsent', 'Total Absent', 'attendance'),
  field('attendancePercent', 'Attendance Percentage', 'attendance'),
  field('attendanceStatus', 'Attendance Status', 'attendance'),
  field('attendanceDetail', 'Attendance by Semester', 'attendance', {
    detailSheet: 'Attendance',
    description: sheetNote,
  }),

  field('residenceType', 'Residence Type', 'residence'),
  field('hostelBlock', 'Hostel Block', 'residence'),
  field('hostelRoom', 'Hostel Room', 'residence'),

  field('photoAvailable', 'Photograph Available', 'documents'),
  field('documentSummary', 'Uploaded Documents', 'documents', {
    detailSheet: 'Documents',
    description:
      'Document type, file name, and verification status. File contents are not exported.',
  }),

  field('examResultStatus', 'Result', 'exams'),
  field('examPercentage', 'Examination Percentage', 'exams'),
  field('examSgpa', 'SGPA', 'exams'),
  field('examCgpa', 'CGPA', 'exams'),
  field('examSummary', 'Examination Records', 'exams', {
    detailSheet: 'Examination',
    description: sheetNote,
  }),

  field('libraryMembershipStatus', 'Library Membership Status', 'library'),
  field('libraryBlockReason', 'Library Block Reason', 'library'),

  field('appAccountStatus', 'Mobile App Account Status', 'system'),
  field('lastLoginAt', 'Last Login', 'system'),
  field('profileUpdatedAt', 'Profile Last Updated', 'system'),
  field('accountCreatedAt', 'Account Created Date', 'system'),
  field('accountUpdatedAt', 'Account Updated Date', 'system'),
  field('createdBy', 'Created By', 'system'),
  field('updatedBy', 'Updated By', 'system'),

  field('bankName', 'Bank Name', 'banking', { sensitive: true }),
  field('accountHolderName', 'Account Holder Name', 'banking', {
    sensitive: true,
  }),
  field('accountNumber', 'Account Number', 'banking', { sensitive: true }),
  field('ifsc', 'IFSC', 'banking', { sensitive: true }),
  field('branchName', 'Branch Name', 'banking', { sensitive: true }),
];

export const STUDENT_REPORT_FIELD_MAP = new Map(
  STUDENT_REPORT_FIELDS.map((f) => [f.key, f]),
);

export const SENSITIVE_REPORT_FIELDS = new Set(
  STUDENT_REPORT_FIELDS.filter((field) => field.sensitive).map(
    (field) => field.key,
  ),
);

export function canViewSensitiveReportFields(
  permissions: string[] | undefined,
) {
  const granted = new Set(permissions ?? []);
  return (
    granted.has('students:manage') || granted.has('students:profile-policy')
  );
}

export function visibleReportFields(permissions?: string[]) {
  if (canViewSensitiveReportFields(permissions)) return STUDENT_REPORT_FIELDS;
  return STUDENT_REPORT_FIELDS.filter((field) => !field.sensitive);
}

export function resolveFieldLabels(
  keys: string[],
): { key: string; label: string }[] {
  return keys.map((key) => ({
    key,
    label: STUDENT_REPORT_FIELD_MAP.get(key)?.label ?? key,
  }));
}

export function detailSheetsForColumns(keys: string[]) {
  const names = new Set<string>();
  for (const key of keys) {
    const sheet = STUDENT_REPORT_FIELD_MAP.get(key)?.detailSheet;
    if (sheet) names.add(sheet);
  }
  return [...names];
}
