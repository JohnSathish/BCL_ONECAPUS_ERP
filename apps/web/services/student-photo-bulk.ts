import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { pingActivity } from '@/lib/auth/session-activity';
import { createHttpClient } from '@/lib/http/create-client';
import { getDirectApiBaseUrl } from '@/lib/http/env';
import { api } from '@/services/api';
import { downloadBlob } from '@/utils/download-blob';

/** Bypass Next.js dev proxy — multipart uploads are truncated when proxied. */
const uploadApi = createHttpClient({
  baseURL: getDirectApiBaseUrl(),
  onSuccess: pingActivity,
  onUnauthorized: (error, retry) => tokenRefreshManager.handle401(error, retry),
});
import type { DirectoryFilters } from '@/components/students-module/directory/directory-filter-bar';

export type PhotoIdentifierStrategy =
  | 'rollNumber'
  | 'applicationNumber'
  | 'studentCode'
  | 'enrollmentNumber'
  | 'nehuRegistrationNumber'
  | 'studentId';

export type PhotoBulkChange = {
  id: string;
  fileName: string;
  originalName: string;
  identifier: string | null;
  oldPhotoPath: string | null;
  newPhotoPath: string | null;
  stagedPath: string | null;
  thumbnailPath: string | null;
  status: string;
  errorMessage: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  student: {
    id: string;
    rollNumber: string | null;
    applicationNumber: string | null;
    enrollmentNumber: string;
    masterProfile: { fullName: string | null; photoPath: string | null } | null;
  } | null;
};

export type PhotoBulkBatch = {
  id: string;
  status: string;
  uploadMode: string;
  identifierStrategy: PhotoIdentifierStrategy;
  conflictStrategy: string;
  duplicateStrategy: string;
  totalFiles: number;
  matchedCount: number;
  unmatchedCount: number;
  duplicateCount: number;
  missingCount: number;
  assignedCount: number;
  skippedCount: number;
  errorCount: number;
  createdAt: string;
  appliedAt: string | null;
  changes?: PhotoBulkChange[];
};

export type PhotoBulkPreviewPayload = {
  identifierStrategy: PhotoIdentifierStrategy;
  uploadMode?: 'FILES' | 'ZIP' | 'CSV';
  normalization: {
    ignoreExtension: boolean;
    ignoreSpaces: boolean;
    ignoreCase: boolean;
    stripSpecialCharacters: boolean;
  };
  scopeFilter?: Record<string, string | undefined>;
  conflictStrategy: 'REPLACE_EXISTING' | 'SKIP_EXISTING' | 'KEEP_BOTH';
  duplicateStrategy: 'LATEST' | 'HIGHEST_RESOLUTION' | 'MANUAL';
  cropMode: 'COVER' | 'CONTAIN';
  csvMap?: string;
};

function filtersToParams(filters: DirectoryFilters): Record<string, string | undefined> {
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

export async function previewStudentPhotoBulkUpload(
  files: File[],
  payload: PhotoBulkPreviewPayload,
  onUploadProgress?: (pct: number) => void,
): Promise<PhotoBulkBatch> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file, file.webkitRelativePath || file.name));
  form.append('identifierStrategy', payload.identifierStrategy);
  form.append('uploadMode', payload.uploadMode ?? 'FILES');
  form.append('conflictStrategy', payload.conflictStrategy);
  form.append('duplicateStrategy', payload.duplicateStrategy);
  form.append('cropMode', payload.cropMode);
  form.append('normalization', JSON.stringify(payload.normalization));
  if (payload.scopeFilter) form.append('scopeFilter', JSON.stringify(payload.scopeFilter));
  if (payload.csvMap) form.append('csvMap', payload.csvMap);

  const { data } = await uploadApi.post('/v1/students/photos/bulk/preview', form, {
    timeout: 600_000,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    onUploadProgress: (e) => {
      if (onUploadProgress && e.total) onUploadProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data as PhotoBulkBatch;
}

const PHOTO_BATCH_DONE = new Set(['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED']);

export type PhotoBulkApplyProgress = {
  percent: number;
  processed: number;
  total: number;
  label: string;
  indeterminate: boolean;
};

export function getPhotoBulkApplyProgress(job: PhotoBulkBatch): PhotoBulkApplyProgress {
  const total = job.matchedCount || 0;
  const processed = job.assignedCount + job.skippedCount;

  if (job.status === 'COMPLETED' || job.status === 'COMPLETED_WITH_ERRORS') {
    return {
      percent: 100,
      processed: total,
      total,
      label: job.status === 'COMPLETED_WITH_ERRORS' ? 'Completed with errors' : 'Completed',
      indeterminate: false,
    };
  }

  if (job.status === 'FAILED') {
    return {
      percent: total ? Math.round((processed / total) * 100) : 0,
      processed,
      total,
      label: 'Failed',
      indeterminate: false,
    };
  }

  if (job.status === 'PROCESSING') {
    const percent = total > 0 ? Math.min(99, Math.round((processed / total) * 100)) : 0;
    return {
      percent,
      processed,
      total,
      label:
        processed > 0
          ? `Assigning photos — ${processed} of ${total} (${percent}%)`
          : 'Starting assignment… (this may take a few minutes for large batches)',
      indeterminate: processed === 0,
    };
  }

  if (job.status === 'PREVIEWED') {
    return {
      percent: 0,
      processed: 0,
      total,
      label: 'Ready to apply',
      indeterminate: false,
    };
  }

  return {
    percent: 0,
    processed,
    total,
    label: job.status.replace(/_/g, ' ').toLowerCase(),
    indeterminate: false,
  };
}

async function pollUntilPhotoBatchApplied(
  batchId: string,
  onProgress?: (batch: PhotoBulkBatch) => void,
): Promise<PhotoBulkBatch> {
  for (let attempt = 0; attempt < 300; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const batch = await fetchStudentPhotoBulkJob(batchId);
    onProgress?.(batch);
    if (PHOTO_BATCH_DONE.has(batch.status)) return batch;
  }
  throw new Error('Photo assignment is still processing. Check the jobs list in a few minutes.');
}

export async function applyStudentPhotoBulkUpload(
  batchId: string,
  conflictStrategy?: string,
  onProgress?: (batch: PhotoBulkBatch) => void,
) {
  const { data } = await api.post('/v1/students/photos/bulk/apply', { batchId, conflictStrategy });
  const result = data as {
    batchId: string;
    async?: boolean;
    message?: string;
    assigned?: number;
    skipped?: number;
    errors?: number;
    total?: number;
  };
  if (!result.async) return result;

  onProgress?.(
    await fetchStudentPhotoBulkJob(batchId).catch(
      () =>
        ({
          id: batchId,
          status: 'PROCESSING',
          matchedCount: result.total ?? 0,
          assignedCount: 0,
          skippedCount: 0,
          errorCount: 0,
        }) as PhotoBulkBatch,
    ),
  );

  const batch = await pollUntilPhotoBatchApplied(batchId, onProgress);
  return {
    batchId,
    async: false,
    assigned: batch.assignedCount,
    skipped: batch.skippedCount,
    errors: batch.errorCount,
    total: batch.matchedCount,
    message: `Assigned ${batch.assignedCount} photos. Skipped ${batch.skippedCount}. Unmatched files were not applied.`,
  };
}

export async function fetchStudentPhotoBulkJobs(): Promise<PhotoBulkBatch[]> {
  const { data } = await api.get('/v1/students/photos/bulk/jobs');
  return data;
}

export async function fetchStudentPhotoBulkJob(id: string): Promise<PhotoBulkBatch> {
  const { data } = await api.get(`/v1/students/photos/bulk/jobs/${id}`);
  return data;
}

export async function downloadStudentPhotoBulkReport(batchId: string) {
  const { data } = await api.get(`/v1/students/photos/bulk/report/${batchId}`, {
    responseType: 'blob',
  });
  downloadBlob(data as Blob, `Student_Photo_Upload_Report_${batchId}.csv`);
}

export async function downloadStudentPhotoIdentifierList(
  filters: DirectoryFilters,
  identifierStrategy: PhotoIdentifierStrategy,
) {
  const { data } = await api.get('/v1/students/photos/bulk/identifier-list.csv', {
    params: { ...filtersToParams(filters), identifierStrategy },
    responseType: 'blob',
  });
  downloadBlob(data as Blob, 'Student_Photo_Identifier_List.csv');
}

export async function deleteStudentPhotosBulk(payload: {
  filter?: Record<string, string | undefined>;
  studentIds?: string[];
}) {
  const { data } = await api.delete('/v1/students/photos/bulk/photos', { data: payload });
  return data as { deleted: number };
}

export async function reprocessStudentPhotosBulk(payload: {
  filter?: Record<string, string | undefined>;
  studentIds?: string[];
}) {
  const { data } = await api.post('/v1/students/photos/bulk/photos/reprocess', payload);
  return data as { reprocessed: number; errors: number };
}

export function buildPhotoScopeFilter(filters: DirectoryFilters) {
  return filtersToParams(filters);
}
