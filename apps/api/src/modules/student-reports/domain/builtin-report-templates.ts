export type BuiltinReportKey =
  | 'student-master'
  | 'subject-summary'
  | 'subject-papers';

export type BuiltinReportTemplate = {
  key: BuiltinReportKey;
  name: string;
  description: string;
  module: 'STUDENTS';
  defaultColumns: string[];
};

const MASTER_DEFAULT_KEYS = [
  'rollNumber',
  'fullName',
  'gender',
  'category',
  'mobileNumber',
  'email',
  'programme',
  'department',
  'shift',
  'batch',
  'currentSemester',
  'feeStatus',
  'mdc',
  'aec',
  'sec',
  'vac',
  'vtc',
  'fatherName',
  'motherName',
  'permanentAddress',
  'schoolName',
];

export const BUILTIN_STUDENT_REPORTS: BuiltinReportTemplate[] = [
  {
    key: 'student-master',
    name: 'Student Master Report',
    description:
      'Wide student profile export with programme, demographic, contact, and operational fields.',
    module: 'STUDENTS',
    defaultColumns: MASTER_DEFAULT_KEYS,
  },
  {
    key: 'subject-summary',
    name: 'Subject Registration Report',
    description:
      'Per-student NEP category summary showing department names (Major, Minor, MDC, AEC, SEC, VTC).',
    module: 'STUDENTS',
    defaultColumns: [
      'rollNumber',
      'fullName',
      'batch',
      'currentSemester',
      'major',
      'minor',
      'mdc',
      'aec',
      'sec',
      'vtc',
    ],
  },
  {
    key: 'subject-papers',
    name: 'Subject Paper Report',
    description:
      'Per-student paper codes and titles by NEP category, including multiple major papers.',
    module: 'STUDENTS',
    defaultColumns: [
      'rollNumber',
      'fullName',
      'batch',
      'currentSemester',
      'majorPaper1',
      'majorPaper2',
      'majorPaper3',
      'majorPaper4',
      'minor',
      'mdc',
      'aec',
      'sec',
      'vtc',
    ],
  },
];

export const BUILTIN_REPORT_MAP = new Map(
  BUILTIN_STUDENT_REPORTS.map((t) => [t.key, t]),
);
