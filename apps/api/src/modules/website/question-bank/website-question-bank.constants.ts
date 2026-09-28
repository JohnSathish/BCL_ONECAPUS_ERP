export const QUESTION_BANK_MASTER_KINDS = [
  'ACADEMIC_YEAR',
  'PROGRAMME',
  'DEPARTMENT',
  'MAJOR',
  'SUBJECT',
  'EXAM_TYPE',
] as const;
export type QuestionBankMasterKind =
  (typeof QUESTION_BANK_MASTER_KINDS)[number];

export const QUESTION_PAPER_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'ARCHIVED',
] as const;
export type QuestionPaperStatus = (typeof QUESTION_PAPER_STATUSES)[number];

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

export const QUESTION_PAPER_PDF_MIME_TYPES = new Set([
  'application/pdf',
  'application/x-pdf',
]);

/** Absolute ceiling for uploads; per-site CMS setting may only lower it. */
export const QUESTION_PAPER_DEFAULT_HARD_MAX_MB = 25;
export const QUESTION_PAPER_DEFAULT_MAX_MB = 20;
export const QUESTION_PAPER_DEFAULT_PAGE_SIZE = 10;
export const QUESTION_PAPER_MAX_PAGE_SIZE = 50;

export const QUESTION_PAPER_STORAGE_PREFIX = 'website-question-papers';
