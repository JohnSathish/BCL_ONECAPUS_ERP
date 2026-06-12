import { api } from '@/services/api';
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';

export type BulkUpdateFieldDef = {
  fieldKey: string;
  sectionKey: string;
  label: string;
  group: string;
  inputType: string;
  permission: 'personal' | 'academic' | 'subjects';
  supportsAppend: boolean;
  lookupType?: string;
  nepCategory?: string;
};

export type BulkUpdateFieldGroup = {
  group: string;
  fields: BulkUpdateFieldDef[];
};

export type BulkUpdatePreviewRow = {
  studentId: string;
  fullName: string;
  rollNumber: string | null;
  enrollmentNumber: string;
  changes: {
    fieldKey: string;
    label: string;
    before: unknown;
    after: unknown;
  }[];
  errors: string[];
};

export type BulkUpdatePreviewResult = {
  batchId: string;
  total: number;
  valid: number;
  invalid: number;
  rows: BulkUpdatePreviewRow[];
  rowsTruncated?: boolean;
};

export type BulkUpdateApplyResult = {
  batchId: string;
  async?: boolean;
  message?: string;
  applied?: number;
  errors?: number;
  total?: number;
};

export type BulkUpdateBatchSummary = {
  id: string;
  status: string;
  updateMode: string;
  fieldKeys: string[];
  studentCount: number;
  validCount: number;
  invalidCount: number;
  appliedCount: number;
  errorCount: number;
  appliedAt: string | null;
  rolledBackAt: string | null;
  createdAt: string;
  actor?: { id: string; email: string } | null;
  _count?: { changes: number };
};

export type BulkUpdateBatchDetail = BulkUpdateBatchSummary & {
  changes: Array<{
    id: string;
    fieldKey: string;
    sectionKey: string;
    oldValue: unknown;
    newValue: unknown;
    status: string;
    errorMessage: string | null;
    student: {
      id: string;
      rollNumber: string | null;
      enrollmentNumber: string;
      masterProfile: { fullName: string | null } | null;
    };
  }>;
};

export type BulkUpdateScopePayload = {
  studentIds?: string[];
  filter?: Record<string, string | undefined>;
};

function filtersToScopeFilter(filters: DirectoryFilters): Record<string, string | undefined> {
  const opt = (v: string) => v || undefined;
  return {
    search: opt(filters.search),
    programVersionId: opt(filters.programVersionId),
    shiftId: opt(filters.shiftId),
    batchId: opt(filters.batchId),
    semester: opt(filters.semester),
    streamId: opt(filters.streamId),
    departmentId: opt(filters.departmentId),
    sessionId: opt(filters.sessionId),
    categoryLookupId: opt(filters.categoryLookupId),
    religionLookupId: opt(filters.religionLookupId),
    differentlyAbled: opt(filters.differentlyAbled),
    studentStatus: opt(filters.studentStatus),
    admissionType: opt(filters.admissionType),
    admissionStatus: opt(filters.admissionStatus),
    academicStatus: opt(filters.academicStatus),
  };
}

export async function fetchBulkUpdateFields(): Promise<BulkUpdateFieldGroup[]> {
  const { data } = await api.get('/v1/students/bulk-update/fields');
  return data;
}

export async function previewBulkUpdate(payload: {
  scope: BulkUpdateScopePayload;
  fieldKeys: string[];
  updateMode: 'REPLACE' | 'APPEND' | 'CSV';
  values?: Record<string, unknown>;
  csvRows?: Record<string, string>[];
  allowVtcOverride?: boolean;
}): Promise<BulkUpdatePreviewResult> {
  const { data } = await api.post('/v1/students/bulk-update/preview', payload);
  return data;
}

export async function applyBulkUpdate(
  batchId: string,
  forceApply = false,
): Promise<BulkUpdateApplyResult> {
  const { data } = await api.post('/v1/students/bulk-update/apply', {
    batchId,
    forceApply,
  });
  return data;
}

export async function rollbackBulkUpdate(batchId: string) {
  const { data } = await api.post(`/v1/students/bulk-update/rollback/${batchId}`);
  return data as { batchId: string; rolledBackStudents: number };
}

export async function importBulkUpdateCsv(
  fieldKeys: string[],
  csvRows: Record<string, string>[],
): Promise<BulkUpdatePreviewResult> {
  const { data } = await api.post('/v1/students/bulk-update/csv-import', {
    fieldKeys,
    csvRows,
  });
  return data;
}

export async function fetchBulkUpdateBatches(): Promise<BulkUpdateBatchSummary[]> {
  const { data } = await api.get('/v1/students/bulk-update/batches');
  return data;
}

export async function fetchBulkUpdateBatch(id: string): Promise<BulkUpdateBatchDetail> {
  const { data } = await api.get(`/v1/students/bulk-update/batches/${id}`);
  return data;
}

export function buildBulkUpdateScope(
  selectedIds: Set<string>,
  filters: DirectoryFilters,
  useFilters: boolean,
): BulkUpdateScopePayload {
  if (useFilters) {
    return { filter: filtersToScopeFilter(filters) };
  }
  return { studentIds: [...selectedIds] };
}

export function parseBulkUpdateCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
}

export function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
