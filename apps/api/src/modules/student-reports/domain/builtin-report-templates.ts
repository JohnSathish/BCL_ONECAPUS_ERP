import { STUDENT_REPORT_FIELDS } from './student-report-field-registry';

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
  'programme',
  'department',
  'shift',
  'batch',
  'currentSemester',
  'gender',
  'category',
  'mobileNumber',
  'email',
  'feeStatus',
];

export const BUILTIN_STUDENT_REPORTS: BuiltinReportTemplate[] = [
  {
    key: 'student-master',
    name: 'Student Master Report',
    description:
      'Wide student profile export with programme, demographic, contact, and operational fields.',
    module: 'STUDENTS',
    defaultColumns: STUDENT_REPORT_FIELDS.filter((f) =>
      MASTER_DEFAULT_KEYS.includes(f.key),
    ).map((f) => f.key),
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
