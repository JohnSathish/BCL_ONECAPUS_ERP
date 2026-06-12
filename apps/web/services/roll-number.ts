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

export type BulkGenerateRollNumbersResult = {
  preview: Array<{
    studentId: string;
    fullName?: string;
    rollNumber: string;
    streamCode?: string;
    admissionYear?: number;
  }>;
  generated: number;
  totalCandidates: number;
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
}): Promise<BulkGenerateRollNumbersResult> {
  const { data } = await api.post<BulkGenerateRollNumbersResult>(
    '/v1/students/roll-numbers/bulk-generate',
    input,
  );
  return data;
}

export async function syncRollNumberSequences(institutionId?: string) {
  const { data } = await api.post<{ synced: number; keys: number }>(
    '/v1/students/roll-numbers/sync-sequences',
    { institutionId },
  );
  return data;
}
