import { api } from '@/services/api';

export type RollNumberPreview = {
  rollNumber: string;
  prefix: string;
  yearSuffix: string;
  sequence: number;
  admissionYear: number;
  streamCode: string;
};

export type RollNumberConfig = {
  settings: {
    sequenceLength: number;
    separator: string;
    autoGenerateOnAdmit: boolean;
  };
  prefixes: Array<{
    streamId: string;
    streamCode: string;
    streamName: string;
    prefix: string;
    isActive: boolean;
    configured: boolean;
  }>;
};

export type RollNumberPreviewRow = {
  studentId: string;
  photoPath?: string | null;
  fullName?: string;
  applicationNumber?: string | null;
  admissionNumber?: string | null;
  programme?: string | null;
  programmeCode?: string | null;
  department?: string | null;
  departmentCode?: string | null;
  batch?: string | null;
  semester?: number | null;
  gender?: string | null;
  currentRollNumber?: string | null;
  newRollNumber?: string | null;
  streamCode?: string | null;
  admissionYear?: number | null;
  generationStatus: 'READY' | 'BLOCKED' | 'SKIPPED';
  remarks: string[];
  issues?: string[];
};

export type BulkGenerateRollNumbersResult = {
  preview: RollNumberPreviewRow[];
  blocked?: RollNumberPreviewRow[];
  attention?: Array<{ studentId: string; fullName?: string; reasons: string[] }>;
  summary?: {
    totalFound: number;
    candidatesWithoutRoll?: number;
    alreadyAssigned?: number;
    ready: number;
    blocked: number;
    skipped: number;
    testRecords: number;
    missingData: number;
    duplicatesDetected: number;
    errors: number;
  };
  analysis?: {
    warnings: string[];
    patternSamples: string[];
    expectedNextByPrefix: Array<{
      prefix: string;
      yearSuffix: string;
      nextSequence: number;
      sample: string;
    }>;
    patternDescription?: string;
  };
  generated: number;
  totalCandidates: number;
  audit?: {
    firstRollNumber?: string;
    lastRollNumber?: string;
    studentsGenerated?: number;
  };
};

export type RollNumberCleanupScan = {
  scanned: number;
  totals: {
    testRecords: number;
    duplicateNames: number;
    missingProgrammes: number;
    missingDepartments: number;
    invalidAdmissionNumbers: number;
    duplicateRollNumbers: number;
  };
  categories: {
    testRecords: Array<{ studentId: string; fullName?: string; reason: string }>;
    duplicateNames: Array<{ name: string; count: number; studentIds: string[] }>;
    missingProgrammes: Array<{ studentId: string; fullName?: string }>;
    missingDepartments: Array<{ studentId: string; fullName?: string }>;
    invalidAdmissionNumbers: Array<{ studentId: string; fullName?: string; value: string }>;
    duplicateRollNumbers: Array<{ rollNumber: string; count: number }>;
  };
};

export async function previewRollNumber(input: {
  streamId: string;
  admissionBatchId: string;
}): Promise<RollNumberPreview> {
  const { data } = await api.post<RollNumberPreview>('/v1/students/generate-roll-number', {
    ...input,
    preview: true,
  });
  return data;
}

export async function fetchRollNumberConfig(): Promise<RollNumberConfig> {
  const { data } = await api.get<RollNumberConfig>('/v1/settings/roll-number-config');
  return data;
}

export async function updateRollNumberConfig(
  payload: Partial<RollNumberConfig['settings']> & {
    prefixes?: Array<{ streamId: string; prefix: string; isActive?: boolean }>;
  },
): Promise<RollNumberConfig> {
  const { data } = await api.patch<RollNumberConfig>('/v1/settings/roll-number-config', payload);
  return data;
}

export async function bulkGenerateRollNumbers(input: {
  dryRun?: boolean;
  institutionId?: string;
  admissionYear?: number;
  departmentId?: string;
  streamId?: string;
  semesterNo?: number;
  excludeStudentIds?: string[];
}): Promise<BulkGenerateRollNumbersResult> {
  const { data } = await api.post<BulkGenerateRollNumbersResult>(
    '/v1/students/roll-numbers/bulk-generate',
    input,
  );
  return data;
}

export async function fetchRollNumberDataCleanup(): Promise<RollNumberCleanupScan> {
  const { data } = await api.get<RollNumberCleanupScan>('/v1/students/roll-numbers/data-cleanup');
  return data;
}

export async function syncRollNumberSequences(institutionId?: string) {
  const { data } = await api.post<{ synced: number; keys: number }>(
    '/v1/students/roll-numbers/sync-sequences',
    { institutionId },
  );
  return data;
}

export type RollNumberSequenceRow = {
  prefix: string;
  admissionYear: number;
  currentSequence: number;
  nextSequence: number;
  nextRollNumber: string;
  lastGeneratedRollNumber: string | null;
  totalGenerated: number;
};

export type RollNumberDepartmentMapping = {
  departmentId: string;
  departmentName: string;
  departmentCode: string;
};

export type RollNumberGenerationBatch = {
  id: string;
  batchNumber: number;
  generatedAt: string;
  generatedBy: string;
  admissionYear: number | null;
  studentsProcessed: number;
  firstRollNumber: string | null;
  lastRollNumber: string | null;
  blockedCount: number;
  excludedCount: number;
};

export async function fetchRollNumberSequences(): Promise<RollNumberSequenceRow[]> {
  const { data } = await api.get<RollNumberSequenceRow[]>(
    '/v1/settings/roll-number-config/sequences',
  );
  return data;
}

export async function fetchRollNumberDepartmentMappings(): Promise<RollNumberDepartmentMapping[]> {
  const { data } = await api.get<RollNumberDepartmentMapping[]>(
    '/v1/settings/roll-number-config/departments',
  );
  return data;
}

export async function resetRollNumberConfig(): Promise<RollNumberConfig> {
  const { data } = await api.post<RollNumberConfig>('/v1/settings/roll-number-config/reset');
  return data;
}

export async function fetchRollNumberHistory(): Promise<RollNumberGenerationBatch[]> {
  const { data } = await api.get<RollNumberGenerationBatch[]>('/v1/students/roll-numbers/history');
  return data;
}

export type RollShiftRangeRow = {
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  institutionId: string;
  admissionYear: number;
  sequenceStart: number | null;
  sequenceEnd: number | null;
  nextSequence: number | null;
  currentSequence: number | null;
  availableSeats: number;
  capacity: number;
  configured: boolean;
  isActive: boolean;
};

export type RollShiftRangesResponse = {
  admissionYear: number;
  shifts: RollShiftRangeRow[];
};

export type ShiftCapacityRow = {
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  admissionYear: number;
  rangeStart: number;
  rangeEnd: number;
  capacity: number;
  used: number;
  vacant: number;
  reserved: number;
  available: number;
  nextSequence: number;
  configured: boolean;
};

export type StudentRollShiftHistory = {
  currentRollNumber: string | null;
  currentShift: { id: string; code: string; name: string } | null;
  previousRollNumber: string | null;
  previousShift: { id: string; code: string; name: string } | null;
  transferHistory: Array<{
    id: string;
    fromShift: { id: string; code: string; name: string };
    toShift: { id: string; code: string; name: string };
    oldRollNumber: string | null;
    newRollNumber: string | null;
    status: string;
    reason: string | null;
    changedBy: { id: string; displayName: string | null; email: string } | null;
    changedAt: string;
  }>;
  rollAuditHistory: Array<{
    id: string;
    action: string;
    rollNumber: string;
    oldValue: string | null;
    newValue: string | null;
    changedBy: { id: string; displayName: string | null; email: string } | null;
    changedAt: string;
    metadata: unknown;
  }>;
};

export async function fetchRollShiftRanges(params?: {
  institutionId?: string;
  admissionYear?: number;
}): Promise<RollShiftRangesResponse> {
  const { data } = await api.get<RollShiftRangesResponse>(
    '/v1/students/roll-numbers/shift-ranges',
    { params },
  );
  return data;
}

export async function updateRollShiftRanges(payload: {
  institutionId: string;
  ranges: Array<{
    shiftId: string;
    admissionYear: number;
    sequenceStart: number;
    sequenceEnd: number;
    nextSequence?: number;
  }>;
}): Promise<RollShiftRangesResponse> {
  const { data } = await api.patch<RollShiftRangesResponse>(
    '/v1/students/roll-numbers/shift-ranges',
    payload,
  );
  return data;
}

export async function fetchRollShiftCapacity(params?: {
  institutionId?: string;
  admissionYear?: number;
}): Promise<ShiftCapacityRow[]> {
  const { data } = await api.get<ShiftCapacityRow[]>('/v1/students/roll-numbers/shift-capacity', {
    params,
  });
  return data;
}

export async function reserveRollNumber(payload: {
  institutionId: string;
  rollNumber: string;
  shiftId?: string;
  note?: string;
}) {
  const { data } = await api.post('/v1/students/roll-numbers/reserve', payload);
  return data;
}

export async function bulkShiftTransfer(payload: {
  studentIds: string[];
  toShiftId: string;
  reason?: string;
}) {
  const { data } = await api.post<{
    total: number;
    succeeded: number;
    failed: number;
    results: Array<{
      studentId: string;
      status: 'success' | 'failed';
      oldRollNumber?: string | null;
      newRollNumber?: string | null;
      error?: string;
    }>;
  }>('/v1/students/shift-transfers/bulk', payload);
  return data;
}

export async function fetchStudentRollShiftHistory(
  studentId: string,
): Promise<StudentRollShiftHistory> {
  const { data } = await api.get<StudentRollShiftHistory>(
    `/v1/students/${studentId}/roll-number-history`,
  );
  return data;
}
