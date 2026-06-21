export type RollEligibilityIssue =
  | 'TEST_RECORD'
  | 'MISSING_NAME'
  | 'MISSING_PROGRAMME'
  | 'MISSING_DEPARTMENT'
  | 'MISSING_ACADEMIC_YEAR'
  | 'NOT_ADMITTED'
  | 'INACTIVE_STATUS'
  | 'MISSING_STREAM'
  | 'MISSING_BATCH'
  | 'DUPLICATE_ROLL_PREVIEW'
  | 'CONTEXT_ERROR';

const TEST_NAME_PATTERNS = [
  /\btest\s+student\b/i,
  /\bdummy\s+student\b/i,
  /\bsample\s+student\b/i,
  /\bdemo\s+student\b/i,
  /\bimport\s+test\b/i,
  /\btesting\s+record\b/i,
  /\bplaceholder\s+record\b/i,
  /\btest\s+record\b/i,
  /\bdummy\s+data\b/i,
  /\bsample\s+data\b/i,
];

export function isTestOrDummyRecord(input: {
  fullName?: string | null;
  applicationNumber?: string | null;
  enrollmentNumber?: string | null;
  importSource?: string | null;
  admissionSource?: string | null;
}): boolean {
  const name = input.fullName?.trim() ?? '';
  if (TEST_NAME_PATTERNS.some((p) => p.test(name))) return true;

  const app = input.applicationNumber?.trim().toUpperCase() ?? '';
  const enr = input.enrollmentNumber?.trim().toUpperCase() ?? '';
  if (/^(TEST|DEMO|SAMPLE|IMPORT-?TEST)/.test(app)) return true;
  if (/^(TEST|DEMO|SAMPLE|IMPORT-?TEST)/.test(enr)) return true;

  const src =
    `${input.importSource ?? ''} ${input.admissionSource ?? ''}`.toUpperCase();
  if (/\b(TEST|DEMO|SAMPLE|DUMMY|PLACEHOLDER)\b/.test(src)) return true;

  return false;
}

export type StudentEligibilityInput = {
  fullName?: string | null;
  applicationNumber?: string | null;
  enrollmentNumber?: string | null;
  importSource?: string | null;
  admissionSource?: string | null;
  programmeId?: string | null;
  departmentId?: string | null;
  admissionYear?: number | null;
  admissionStatus?: string | null;
  studentStatus?: string | null;
  streamId?: string | null;
  admissionBatchId?: string | null;
};

export function evaluateRollEligibility(input: StudentEligibilityInput): {
  blocked: boolean;
  issues: RollEligibilityIssue[];
  remarks: string[];
} {
  const remarks: string[] = [];
  const issues: RollEligibilityIssue[] = [];

  if (isTestOrDummyRecord(input)) {
    issues.push('TEST_RECORD');
    remarks.push('Test/dummy record detected');
  }
  if (!input.fullName?.trim()) {
    issues.push('MISSING_NAME');
    remarks.push('Full name missing');
  }
  if (!input.programmeId) {
    issues.push('MISSING_PROGRAMME');
    remarks.push('Programme not assigned');
  }
  if (!input.departmentId) {
    issues.push('MISSING_DEPARTMENT');
    remarks.push('Department not assigned');
  }
  if (!input.admissionYear) {
    issues.push('MISSING_ACADEMIC_YEAR');
    remarks.push('Academic year not assigned');
  }
  if (!input.streamId) {
    issues.push('MISSING_STREAM');
    remarks.push('Stream not assigned');
  }
  if (!input.admissionBatchId) {
    issues.push('MISSING_BATCH');
    remarks.push('Admission batch not assigned');
  }
  const admissionStatus = (input.admissionStatus ?? 'ACTIVE').toUpperCase();
  if (!['ACTIVE', 'ADMITTED', 'CONFIRMED'].includes(admissionStatus)) {
    issues.push('NOT_ADMITTED');
    remarks.push(`Admission status: ${admissionStatus}`);
  }
  const studentStatus = (input.studentStatus ?? 'STUDYING').toUpperCase();
  if (!['STUDYING', 'ACTIVE', 'ENROLLED'].includes(studentStatus)) {
    issues.push('INACTIVE_STATUS');
    remarks.push(`Student status: ${studentStatus}`);
  }

  const blocked = issues.length > 0;
  return { blocked, issues, remarks };
}

export function issueLabel(issue: RollEligibilityIssue): string {
  const map: Record<RollEligibilityIssue, string> = {
    TEST_RECORD: 'Test Record Detected',
    MISSING_NAME: 'Name Missing',
    MISSING_PROGRAMME: 'Programme Missing',
    MISSING_DEPARTMENT: 'Department Missing',
    MISSING_ACADEMIC_YEAR: 'Academic Year Missing',
    NOT_ADMITTED: 'Not Admitted',
    INACTIVE_STATUS: 'Inactive Student',
    MISSING_STREAM: 'Stream Missing',
    MISSING_BATCH: 'Batch Missing',
    DUPLICATE_ROLL_PREVIEW: 'Duplicate Roll in Preview',
    CONTEXT_ERROR: 'Roll Context Error',
  };
  return map[issue] ?? issue;
}
