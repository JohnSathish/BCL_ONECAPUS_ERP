import { api } from '@/services/api';
import { downloadBlob } from '@/utils/download-blob';
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

  const { data } = await api.post('/v1/students/photos/bulk/preview', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onUploadProgress && e.total) onUploadProgress(Math.round((e.loaded / e.total) * 100));
    },
  });
  return data as PhotoBulkBatch;
}

export async function applyStudentPhotoBulkUpload(batchId: string, conflictStrategy?: string) {
  const { data } = await api.post('/v1/students/photos/bulk/apply', { batchId, conflictStrategy });
  return data as {
    batchId: string;
    async?: boolean;
    message?: string;
    assigned?: number;
    skipped?: number;
    errors?: number;
    total?: number;
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
