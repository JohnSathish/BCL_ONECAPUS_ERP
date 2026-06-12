import { api } from '@/services/api';
import type { ProgramDataCleanupReport } from '@/types/program-data-cleanup';

export async function fetchProgramDataCleanupReport(): Promise<ProgramDataCleanupReport> {
  const { data } = await api.get('/v1/programs-courses/data-cleanup/report');
  return data;
}

export async function purgeCleanupVersion(versionId: string) {
  const { data } = await api.delete(`/v1/programs-courses/data-cleanup/versions/${versionId}`);
  return data;
}

export async function removeUnusedProgram(programId: string) {
  const { data } = await api.delete(`/v1/programs-courses/data-cleanup/programs/${programId}`);
  return data;
}

export async function purgeOrphanProgramVersions(programCode: string) {
  const { data } = await api.delete(
    `/v1/programs-courses/data-cleanup/orphans/${encodeURIComponent(programCode)}`,
  );
  return data;
}
