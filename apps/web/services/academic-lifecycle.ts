import { api } from '@/services/api';
import type {
  AcademicStructureResponse,
  AdmissionBatchRow,
  CycleDashboard,
  CycleRolloverPreview,
  InstitutionAcademicConfig,
  PromotionLogRow,
} from '@/types/academic-lifecycle';

export type {
  InstitutionAcademicConfig,
  SemesterStructureRow,
  AcademicStructureResponse,
} from '@/types/academic-lifecycle';

export async function fetchAcademicConfig(institutionId: string) {
  const { data } = await api.get(
    `/v1/academic-lifecycle/institutions/${institutionId}/academic-config`,
  );
  return data as InstitutionAcademicConfig;
}

export async function fetchAcademicStructure(institutionId: string) {
  const { data } = await api.get(
    `/v1/academic-lifecycle/institutions/${institutionId}/semesters/structure`,
  );
  return data as AcademicStructureResponse;
}

export async function fetchCycleDashboard(institutionId: string) {
  const { data } = await api.get(
    `/v1/academic-lifecycle/institutions/${institutionId}/cycles/dashboard`,
  );
  return data as CycleDashboard;
}

export async function fetchAdmissionBatches(institutionId: string) {
  const { data } = await api.get(
    `/v1/academic-lifecycle/institutions/${institutionId}/admission-batches`,
  );
  return data as AdmissionBatchRow[];
}

export async function fetchPromotionLogs(institutionId: string, limit = 50) {
  const { data } = await api.get(
    `/v1/academic-lifecycle/institutions/${institutionId}/promotion-logs`,
    { params: { limit } },
  );
  return data as PromotionLogRow[];
}

export async function provisionFyugp(institutionId: string, baseYearName?: string) {
  const { data } = await api.post(
    `/v1/academic-lifecycle/institutions/${institutionId}/semesters/provision-fyugp`,
    { baseYearName },
  );
  return data as AcademicStructureResponse;
}

export async function createAcademicSession(
  institutionId: string,
  payload: {
    name: string;
    startDate: string;
    endDate: string;
    status?: string;
    isPrimarySession?: boolean;
  },
) {
  const { data } = await api.post(
    `/v1/academic-lifecycle/institutions/${institutionId}/academic-sessions`,
    payload,
  );
  return data;
}

export async function createAdmissionBatch(
  institutionId: string,
  payload: {
    batchCode: string;
    admissionYear: number;
    entrySessionId: string;
    currentSemester: number;
  },
) {
  const { data } = await api.post(
    `/v1/academic-lifecycle/institutions/${institutionId}/admission-batches`,
    payload,
  );
  return data as AdmissionBatchRow;
}

export async function listAcademicSessions(institutionId: string) {
  const { data } = await api.get(
    `/v1/academic-lifecycle/institutions/${institutionId}/academic-sessions`,
  );
  return data;
}

export async function activateOddCycle(
  institutionId: string,
  payload: { campusId?: string; shiftId?: string } = {},
) {
  const { data } = await api.post(
    `/v1/academic-lifecycle/institutions/${institutionId}/cycles/activate-odd`,
    payload,
  );
  return data;
}

export async function activateEvenCycle(
  institutionId: string,
  payload: { campusId?: string; shiftId?: string } = {},
) {
  const { data } = await api.post(
    `/v1/academic-lifecycle/institutions/${institutionId}/cycles/activate-even`,
    payload,
  );
  return data;
}

export async function previewCycleRollover(institutionId: string) {
  const { data } = await api.get(
    `/v1/academic-lifecycle/institutions/${institutionId}/cycle-rollover/preview`,
  );
  return data as CycleRolloverPreview;
}

export async function applyCycleRollover(
  institutionId: string,
  payload: { campusId?: string; shiftId?: string } = {},
) {
  const { data } = await api.post(
    `/v1/academic-lifecycle/institutions/${institutionId}/cycle-rollover/apply`,
    payload,
  );
  return data;
}

export async function rollbackCycleRollover(institutionId: string, cycleRolloverGroupId?: string) {
  const { data } = await api.post(
    `/v1/academic-lifecycle/institutions/${institutionId}/cycle-rollover/rollback`,
    { cycleRolloverGroupId },
  );
  return data;
}

export async function activateSemester(
  semesterId: string,
  payload: { campusId: string; shiftId: string; runPromotion?: boolean },
) {
  const { data } = await api.post(
    `/v1/academic-lifecycle/semesters/${semesterId}/activate`,
    payload,
  );
  return data;
}

export async function freezeSemester(semesterId: string) {
  const { data } = await api.post(`/v1/academic-lifecycle/semesters/${semesterId}/freeze`);
  return data;
}

export async function previewPromotion(params: {
  institutionId: string;
  fromSequence: number;
  toSequence: number;
  campusId?: string;
  shiftId?: string;
  admissionBatchId?: string;
  programVersionId?: string;
}) {
  const { data } = await api.get('/v1/academic-lifecycle/promotion-runs/preview', { params });
  return data;
}

export async function previewPromotionMappings(params: {
  institutionId: string;
  fromSequence: number;
  toSequence: number;
  campusId?: string;
  shiftId?: string;
  admissionBatchId?: string;
  programVersionId?: string;
  studentIds?: string[];
}) {
  const { data } = await api.get('/v1/academic-lifecycle/promotion-runs/mapping-preview', {
    params,
  });
  return data;
}

export async function validatePromotion(params: {
  institutionId: string;
  fromSequence: number;
  toSequence: number;
  campusId?: string;
  shiftId?: string;
  admissionBatchId?: string;
  programVersionId?: string;
}) {
  const { data } = await api.get('/v1/academic-lifecycle/promotion-runs/validate', { params });
  return data;
}

export async function createPromotionRun(payload: {
  institutionId: string;
  fromSequence: number;
  toSequence: number;
  campusId?: string;
  shiftId?: string;
  trigger?: string;
  admissionBatchId?: string;
}) {
  const { data } = await api.post('/v1/academic-lifecycle/promotion-runs', payload);
  return data;
}

export async function applyPromotionRun(runId: string) {
  const { data } = await api.post(`/v1/academic-lifecycle/promotion-runs/${runId}/apply`);
  return data;
}

export async function rollbackPromotionRun(runId: string) {
  const { data } = await api.post(`/v1/academic-lifecycle/promotion-runs/${runId}/rollback`);
  return data;
}

export async function promoteStudent(studentId: string, action: 'promote' | 'detain' = 'promote') {
  const { data } = await api.post(`/v1/academic-lifecycle/students/${studentId}/promotion`, {
    action,
  });
  return data;
}
