/** Institutional document categories for the Knowledge Base. */
export const KNOWLEDGE_SOURCE_TYPES = [
  'CURRICULUM',
  'EXAMINATION_REGULATION',
  'ATTENDANCE_RULE',
  'FEE_RULE',
  'ADMISSION_RULE',
  'HOSTEL_RULE',
  'HR_POLICY',
  'GENERAL_POLICY',
] as const;

export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const REGULATION_SOURCE_TYPES: KnowledgeSourceType[] = [
  'EXAMINATION_REGULATION',
  'ATTENDANCE_RULE',
  'FEE_RULE',
  'ADMISSION_RULE',
  'HOSTEL_RULE',
  'HR_POLICY',
  'GENERAL_POLICY',
];

export const SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  CURRICULUM: 'Curriculum Framework',
  EXAMINATION_REGULATION: 'Examination Regulations',
  ATTENDANCE_RULE: 'Attendance Rules',
  FEE_RULE: 'Fee Rules',
  ADMISSION_RULE: 'Admission Rules',
  HOSTEL_RULE: 'Hostel Rules',
  HR_POLICY: 'HR / Service Rules',
  GENERAL_POLICY: 'General Policy',
};

/** Regex patterns to extract structured facts from regulation PDF text. */
export const REGULATION_FACT_PATTERNS: Array<{
  key: string;
  label: string;
  pattern: RegExp;
}> = [
  {
    key: 'MIN_ATTENDANCE_PERCENT',
    label: 'Minimum attendance percentage',
    pattern: /minimum\s+(?:of\s+)?(\d+)\s*%?\s*attendance/i,
  },
  {
    key: 'ATTENDANCE_REQUIREMENT',
    label: 'Attendance requirement',
    pattern: /(\d+)\s*%?\s*attendance\s+(?:is\s+)?(?:required|mandatory)/i,
  },
  {
    key: 'PROMOTION_ATTENDANCE',
    label: 'Attendance for promotion',
    pattern: /promotion.*?(\d+)\s*%?\s*attendance/i,
  },
  {
    key: 'EXAM_ELIGIBILITY_ATTENDANCE',
    label: 'Exam eligibility attendance',
    pattern: /eligible.*?examination.*?(\d+)\s*%/i,
  },
];
