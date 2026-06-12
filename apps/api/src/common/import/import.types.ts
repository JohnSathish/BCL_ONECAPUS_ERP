export const IMPORT_MODULES = [
  'COURSE_MASTER',
  'STUDENT_MASTER',
  'REGISTRATION_IMPORT',
  'PORTAL_USERS',
  'STAFF',
] as const;
export type ImportModule = (typeof IMPORT_MODULES)[number];

export const IMPORT_BATCH_STATUSES = [
  'UPLOADED',
  'VALIDATING',
  'VALIDATED',
  'COMMITTING',
  'COMMITTED',
  'FAILED',
] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

export const IMPORT_ROW_STATUSES = [
  'PENDING',
  'VALID',
  'INVALID',
  'IMPORTED',
  'SKIPPED',
] as const;
// PENDING used while async validation runs
export type ImportRowStatus = (typeof IMPORT_ROW_STATUSES)[number];

export const IMPORT_COMMIT_MODES = ['VALID_ONLY', 'STRICT'] as const;
export type ImportCommitMode = (typeof IMPORT_COMMIT_MODES)[number];

export type ImportColumnDef = {
  key: string;
  header: string;
  required?: boolean;
};

export type ParsedImportRow = {
  rowNumber: number;
  raw: Record<string, unknown>;
};

export type ImportRowValidationResult = {
  rowNumber: number;
  status: ImportRowStatus;
  raw: Record<string, unknown>;
  normalized?: Record<string, unknown>;
  errors: string[];
  warnings?: string[];
  displayCode?: string;
  displayTitle?: string;
  academicMapping?: unknown;
};

export type ImportPreviewSummary = {
  total: number;
  valid: number;
  invalid: number;
  warnings?: number;
  duplicates?: number;
  missingSubjects?: number;
};

export type ImportPreviewResponse = {
  batchId: string;
  status: ImportBatchStatus;
  summary: ImportPreviewSummary;
  rows: ImportRowValidationResult[];
  hasMore: boolean;
};

export type ImportValidateOptions = Record<string, unknown>;

export type ImportModuleHandlerContext = {
  tenantId: string;
  userId: string;
  batchId: string;
  options?: ImportValidateOptions;
};

export type ImportModuleHandler<TNormalized = Record<string, unknown>> = {
  module: ImportModule;
  columnDefs: ImportColumnDef[];
  nepForbiddenHeaders: string[];
  parseAndValidate(
    tenantId: string,
    rows: ParsedImportRow[],
    options?: ImportValidateOptions,
  ): Promise<ImportRowValidationResult[]>;
  commitRows(
    ctx: ImportModuleHandlerContext,
    rows: { rowNumber: number; normalized: TNormalized }[],
  ): Promise<{ rowNumber: number; entityId: string }[]>;
  buildTemplateWorkbook(): Promise<Buffer>;
  buildErrorReportWorkbook(rows: ImportRowValidationResult[]): Promise<Buffer>;
};
