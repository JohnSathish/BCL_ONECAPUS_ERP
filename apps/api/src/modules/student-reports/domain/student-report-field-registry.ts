export type StudentReportFieldGroup =
  | 'identity'
  | 'programme'
  | 'academic'
  | 'demographics'
  | 'contact'
  | 'guardian'
  | 'address'
  | 'board'
  | 'cuet'
  | 'abc'
  | 'operational'
  | 'track';

export type StudentReportFieldDef = {
  key: string;
  label: string;
  group: StudentReportFieldGroup;
  description?: string;
};

export const STUDENT_REPORT_FIELD_GROUPS: Record<
  StudentReportFieldGroup,
  string
> = {
  identity: 'Identity',
  programme: 'Programme',
  academic: 'Academic',
  demographics: 'Demographics',
  contact: 'Contact',
  guardian: 'Guardian',
  address: 'Address',
  board: 'Board Exam',
  cuet: 'CUET',
  abc: 'ABC ID',
  operational: 'Operational',
  track: 'Major / Minor Track',
};

export const STUDENT_REPORT_FIELDS: StudentReportFieldDef[] = [
  { key: 'rollNumber', label: 'Roll Number', group: 'identity' },
  { key: 'enrollmentNumber', label: 'Registration No.', group: 'identity' },
  { key: 'admissionNumber', label: 'Admission No.', group: 'identity' },
  { key: 'applicationNumber', label: 'Application No.', group: 'identity' },
  { key: 'rfidNumber', label: 'RFID', group: 'identity' },
  { key: 'fullName', label: 'Full Name', group: 'identity' },
  { key: 'programme', label: 'Programme', group: 'programme' },
  { key: 'programmeVersion', label: 'Programme Version', group: 'programme' },
  { key: 'department', label: 'Department', group: 'programme' },
  { key: 'shift', label: 'Shift', group: 'programme' },
  { key: 'stream', label: 'Stream', group: 'programme' },
  { key: 'batch', label: 'Batch', group: 'programme' },
  { key: 'session', label: 'Admission Session', group: 'programme' },
  { key: 'currentSemester', label: 'Current Semester', group: 'academic' },
  { key: 'academicStatus', label: 'Academic Status', group: 'academic' },
  { key: 'admissionStatus', label: 'Admission Status', group: 'academic' },
  { key: 'studentStatus', label: 'Student Status', group: 'academic' },
  { key: 'admissionDate', label: 'Admission Date', group: 'academic' },
  { key: 'admissionType', label: 'Admission Type', group: 'academic' },
  { key: 'gender', label: 'Gender', group: 'demographics' },
  { key: 'dateOfBirth', label: 'Date of Birth', group: 'demographics' },
  { key: 'age', label: 'Age', group: 'demographics' },
  { key: 'category', label: 'Category', group: 'demographics' },
  { key: 'religion', label: 'Religion', group: 'demographics' },
  { key: 'denomination', label: 'Denomination', group: 'demographics' },
  { key: 'tribe', label: 'Tribe', group: 'demographics' },
  { key: 'bloodGroup', label: 'Blood Group', group: 'demographics' },
  { key: 'maritalStatus', label: 'Marital Status', group: 'demographics' },
  { key: 'nationalId', label: 'National ID', group: 'demographics' },
  {
    key: 'differentlyAbled',
    label: 'Differently Abled',
    group: 'demographics',
  },
  { key: 'ews', label: 'EWS', group: 'demographics' },
  { key: 'email', label: 'Email', group: 'contact' },
  { key: 'mobileNumber', label: 'Mobile', group: 'contact' },
  { key: 'fatherName', label: 'Father Name', group: 'guardian' },
  { key: 'motherName', label: 'Mother Name', group: 'guardian' },
  { key: 'guardianName', label: 'Guardian Name', group: 'guardian' },
  { key: 'guardianMobile', label: 'Guardian Mobile', group: 'guardian' },
  { key: 'permanentAddress', label: 'Permanent Address', group: 'address' },
  { key: 'presentAddress', label: 'Present Address', group: 'address' },
  { key: 'state', label: 'State', group: 'address' },
  { key: 'district', label: 'District', group: 'address' },
  { key: 'pincode', label: 'Pincode', group: 'address' },
  { key: 'boardName', label: 'Board Name', group: 'board' },
  { key: 'boardYear', label: 'Board Year', group: 'board' },
  { key: 'boardPercentage', label: 'Board Percentage', group: 'board' },
  { key: 'cuetRoll', label: 'CUET Roll', group: 'cuet' },
  { key: 'cuetScore', label: 'CUET Score', group: 'cuet' },
  { key: 'abcId', label: 'ABC ID', group: 'abc' },
  { key: 'abcVerified', label: 'ABC Verified', group: 'abc' },
  { key: 'feeStatus', label: 'Fee Status', group: 'operational' },
  { key: 'feeDueAmount', label: 'Fee Due Amount', group: 'operational' },
  { key: 'residenceType', label: 'Residence Type', group: 'operational' },
  { key: 'hostelBlock', label: 'Hostel Block', group: 'operational' },
  { key: 'hostelRoom', label: 'Hostel Room', group: 'operational' },
  { key: 'attendancePercent', label: 'Attendance %', group: 'operational' },
  { key: 'majorDepartment', label: 'Major Department', group: 'track' },
  { key: 'minorDepartment', label: 'Minor Department', group: 'track' },
];

export const STUDENT_REPORT_FIELD_MAP = new Map(
  STUDENT_REPORT_FIELDS.map((f) => [f.key, f]),
);

export function resolveFieldLabels(
  keys: string[],
): { key: string; label: string }[] {
  return keys.map((key) => ({
    key,
    label: STUDENT_REPORT_FIELD_MAP.get(key)?.label ?? key,
  }));
}
