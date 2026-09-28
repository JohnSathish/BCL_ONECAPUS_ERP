export const QUESTION_PAPER_SORTS = [
  'newest',
  'oldest',
  'title',
  'subject_code',
  'exam_year',
] as const;
export type QuestionPaperSort = (typeof QUESTION_PAPER_SORTS)[number];

export const QUESTION_BANK_DOWNLOAD_MODES = ['NEW_TAB', 'DOWNLOAD'] as const;
export type QuestionBankDownloadMode =
  (typeof QUESTION_BANK_DOWNLOAD_MODES)[number];

export const QUESTION_PAPER_DEFAULT_PAGE_SIZE = 10;
export const QUESTION_PAPER_MAX_PAGE_SIZE = 50;

/** Labels for the ERP repository's examination types (public filter + cards). */
export const EXAM_TYPE_LABELS: Record<string, string> = {
  UNIVERSITY_EXAM: 'University Examination',
  INTERNAL: 'Internal Assessment',
  MID_SEM: 'Mid Semester',
  MODEL: 'Model Examination',
  PRACTICAL: 'Practical',
  SUPPLEMENTARY: 'Supplementary',
  REVALUATION: 'Revaluation',
};

/** Labels for FYUP subject categories. */
export const SUBJECT_CATEGORY_LABELS: Record<string, string> = {
  MAJOR: 'Major',
  MINOR: 'Minor',
  MDC: 'Multidisciplinary (MDC)',
  AEC: 'Ability Enhancement (AEC)',
  SEC: 'Skill Enhancement (SEC)',
  VAC: 'Value Added (VAC)',
  VTC: 'Vocational (VTC)',
  PRACTICAL: 'Practical',
};

export const ENUM_FILTER_PATTERN = /^[A-Z_]{2,32}$/;
