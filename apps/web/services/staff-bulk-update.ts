import { api } from '@/services/api';
import type { StaffDirectoryFilters } from '@/components/staff-module/directory/staff-filter-utils';
import { downloadBlob } from '@/utils/download-blob';

export type StaffBulkUpdateMatchingKey = 'employeeCode' | 'shortCode' | 'portalEmail' | 'staffId';

export type StaffBulkUpdateFieldDef = {
  fieldKey: string;
  sectionKey: string;
  label: string;
  group: string;
  inputType: string;
  supportsAppend: boolean;
  lookupType?: string;
};

export type StaffBulkUpdateFieldGroup = {
  group: string;
  fields: StaffBulkUpdateFieldDef[];
};

export type StaffBulkUpdatePreviewRow = {
  staffId: string;
  employeeCode: string;
  fullName: string;
  changes: { fieldKey: string; label: string; before: unknown; after: unknown }[];
  errors: string[];
  warnings?: string[];
};

export type StaffBulkUpdatePreviewResult = {
  batchId: string;
  total: number;
  valid: number;
  invalid: number;
  skipped: number;
  rows: StaffBulkUpdatePreviewRow[];
  rowsTruncated?: boolean;
};

export type StaffBulkUpdateApplyResult = {
  batchId: string;
  async?: boolean;
  message?: string;
  applied?: number;
  errors?: number;
  total?: number;
};

export type StaffBulkUpdateBatchSummary = {
  id: string;
  status: string;
  updateMode: string;
  matchingKey: StaffBulkUpdateMatchingKey;
  fieldKeys: string[];
  staffCount: number;
  validCount: number;
  invalidCount: number;
  skippedCount: number;
  appliedCount: number;
  errorCount: number;
  appliedAt: string | null;
  rolledBackAt: string | null;
  createdAt: string;
  actor?: { id: string; email: string } | null;
  _count?: { changes: number };
};

export type StaffBulkUpdateScopePayload = {
  staffIds?: string[];
  filter?: Record<string, string | boolean | number | undefined>;
};

export async function fetchStaffBulkUpdateFields(): Promise<StaffBulkUpdateFieldGroup[]> {
  const { data } = await api.get('/v1/staff/bulk-update/fields');
  return data;
}

export async function downloadStaffBulkUpdateTemplate(
  fieldKeys: string[],
  matchingKey: StaffBulkUpdateMatchingKey,
  filters?: Record<string, string | undefined>,
) {
  const { data } = await api.get('/v1/staff/bulk-update/template', {
    params: { fields: fieldKeys.join(','), matchingKey, templateMode: 'ASSISTED', ...filters },
    responseType: 'blob',
  });
  downloadBlob(data, 'Staff_Bulk_Update_Template.xlsx');
}

export async function previewStaffBulkUpdate(payload: {
  scope: StaffBulkUpdateScopePayload;
  fieldKeys: string[];
  updateMode: 'REPLACE' | 'APPEND' | 'CSV';
  matchingKey: StaffBulkUpdateMatchingKey;
  values?: Record<string, unknown>;
  csvRows?: Record<string, string>[];
}): Promise<StaffBulkUpdatePreviewResult> {
  const { data } = await api.post('/v1/staff/bulk-update/preview', payload);
  return data;
}

export async function uploadStaffBulkUpdatePreview(
  file: File,
  fieldKeys: string[],
  matchingKey: StaffBulkUpdateMatchingKey,
): Promise<StaffBulkUpdatePreviewResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('fieldKeys', fieldKeys.join(','));
  form.append('matchingKey', matchingKey);
  const { data } = await api.post('/v1/staff/bulk-update/upload-preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  });
  return data;
}

export async function applyStaffBulkUpdate(
  batchId: string,
  forceApply = false,
): Promise<StaffBulkUpdateApplyResult> {
  const { data } = await api.post('/v1/staff/bulk-update/apply', {
    batchId,
    forceApply,
  });
  return data;
}

export async function rollbackStaffBulkUpdate(batchId: string) {
  const { data } = await api.post(`/v1/staff/bulk-update/rollback/${batchId}`);
  return data as { batchId: string; rolledBackStaff: number };
}

export async function fetchStaffBulkUpdateBatches(): Promise<StaffBulkUpdateBatchSummary[]> {
  const { data } = await api.get('/v1/staff/bulk-update/batches');
  return data;
}

export async function downloadStaffBulkUpdateErrorReport(batchId: string) {
  const { data } = await api.get(`/v1/staff/bulk-update/batches/${batchId}/error-report`, {
    responseType: 'blob',
  });
  downloadBlob(data, 'Staff_Bulk_Update_Error_Report.xlsx');
}

export function buildStaffBulkUpdateScope(
  selectedIds: Set<string>,
  filters: StaffDirectoryFilters,
  useFilters: boolean,
): StaffBulkUpdateScopePayload {
  if (!useFilters) return { staffIds: [...selectedIds] };
  const opt = (value: string) => value || undefined;
  return {
    filter: {
      search: opt(filters.search),
      staffType: opt(filters.staffType),
      departmentId: opt(filters.departmentId),
      designationId: opt(filters.designationId),
      additionalRoleCode: opt(filters.additionalRoleCode),
      shiftId: opt(filters.shiftId),
      status: opt(filters.status),
      hodOnly: filters.uiHodOnly === 'true' ? true : undefined,
      activeTeachingOnly: filters.uiActiveTeaching === 'true' ? true : undefined,
      hasPublications: filters.uiHasPublications === 'true' ? true : undefined,
    },
  };
}

export function parseStaffBulkUpdateCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(',').map((header) => header.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? '';
    });
    return row;
  });
}

export function formatStaffBulkValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
