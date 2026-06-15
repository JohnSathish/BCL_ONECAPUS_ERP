import { api } from '@/services/api';
import type {
  AdmissionApplication,
  AdmissionApplicationDocument,
  AdmissionAuditEntry,
  AdmissionIntake,
  AdmissionSummary,
  MeritList,
  MeritListDetail,
  PaginatedApplications,
  SeatAllocation,
} from '@/types/admissions';

export async function fetchAdmissionsSummary(): Promise<AdmissionSummary> {
  const { data } = await api.get('/v1/admissions/summary');
  return data;
}

export async function fetchIntakes(): Promise<AdmissionIntake[]> {
  const { data } = await api.get('/v1/admissions/intakes');
  return data;
}

export async function createIntake(payload: {
  name: string;
  code: string;
  programId: string;
  academicYearId?: string;
  totalSeats: number;
  status?: string;
}) {
  const { data } = await api.post('/v1/admissions/intakes', payload);
  return data as AdmissionIntake;
}

export async function fetchApplications(params?: {
  page?: number;
  limit?: number;
  intakeId?: string;
  cycleId?: string;
  status?: string;
  search?: string;
  paymentStatus?: string;
  documentVerificationStatus?: string;
  paymentPending?: boolean;
  documentPending?: boolean;
  admissionFeePending?: boolean;
}): Promise<PaginatedApplications> {
  const { data } = await api.get('/v1/admissions/applications', { params });
  return data;
}

export async function createApplication(payload: {
  intakeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  category?: string;
  meritScore: number;
  academicStreamId: string;
}) {
  const { data } = await api.post('/v1/admissions/applications', payload);
  return data as AdmissionApplication;
}

export async function updateApplicationStatus(id: string, status: string) {
  const { data } = await api.patch(`/v1/admissions/applications/${id}/status`, {
    status,
  });
  return data as AdmissionApplication;
}

export async function fetchMeritLists(intakeId?: string): Promise<MeritList[]> {
  const { data } = await api.get('/v1/admissions/merit-lists', {
    params: intakeId ? { intakeId } : undefined,
  });
  return data;
}

export async function fetchMeritList(id: string): Promise<MeritListDetail> {
  const { data } = await api.get(`/v1/admissions/merit-lists/${id}`);
  return data;
}

export async function generateMeritList(payload: {
  intakeId: string;
  round?: number;
  name?: string;
}) {
  const { data } = await api.post('/v1/admissions/merit-lists/generate', payload);
  return data as MeritListDetail;
}

export async function publishMeritList(id: string) {
  const { data } = await api.post(`/v1/admissions/merit-lists/${id}/publish`);
  return data as MeritList;
}

export async function fetchAllocations(intakeId?: string): Promise<SeatAllocation[]> {
  const { data } = await api.get('/v1/admissions/allocations', {
    params: intakeId ? { intakeId } : undefined,
  });
  return data;
}

export async function runSeatAllocation(payload: {
  intakeId: string;
  meritListId: string;
  round?: number;
}) {
  const { data } = await api.post('/v1/admissions/allocations/run', payload);
  return data as {
    allocated: number;
    seatsRemaining: number;
    allocations: SeatAllocation[];
  };
}

export async function updateAllocationStatus(id: string, status: string) {
  const { data } = await api.patch(`/v1/admissions/allocations/${id}/status`, {
    status,
  });
  return data as SeatAllocation;
}

export type AdmissionCycle = {
  id: string;
  code: string;
  title: string;
  status: string;
  academicYear?: { id: string; name: string };
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  applicationDeadline?: string | null;
  paymentDeadline?: string | null;
  settings?: Record<string, unknown>;
  _count?: { applications: number; intakes: number };
};

export async function fetchCycles(status?: string): Promise<AdmissionCycle[]> {
  const { data } = await api.get('/v1/admissions/admin/cycles', {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function fetchCycle(id: string) {
  const { data } = await api.get(`/v1/admissions/admin/cycles/${id}`);
  return data;
}

export async function updateCycle(
  id: string,
  payload: Partial<{
    title: string;
    registrationOpensAt: string;
    registrationClosesAt: string;
    applicationDeadline: string;
    paymentDeadline: string;
    settings: Record<string, unknown>;
  }>,
) {
  const { data } = await api.patch(`/v1/admissions/admin/cycles/${id}`, payload);
  return data;
}

export async function publishCycle(id: string) {
  const { data } = await api.post(`/v1/admissions/admin/cycles/${id}/publish`);
  return data;
}

export async function closeCycle(id: string) {
  const { data } = await api.post(`/v1/admissions/admin/cycles/${id}/close`);
  return data;
}

export async function upsertIntakeShift(
  intakeId: string,
  payload: { shiftId: string; totalSeats: number; reservedSeats?: Record<string, number> },
) {
  const { data } = await api.put(`/v1/admissions/admin/intakes/${intakeId}/shifts`, payload);
  return data;
}

export async function verifyDocument(
  id: string,
  payload: { status: 'VERIFIED' | 'REJECTED'; remarks?: string },
) {
  const { data } = await api.patch(`/v1/admissions/admin/documents/${id}/verify`, payload);
  return data;
}

export async function markApplicationPayment(
  id: string,
  payload: { status: string; paymentReference?: string; amountPaid?: number },
) {
  const { data } = await api.patch(`/v1/admissions/admin/applications/${id}/payment`, payload);
  return data;
}

export async function fetchAdmissionsFunnel(cycleId?: string) {
  const { data } = await api.get('/v1/admissions/admin/analytics/funnel', {
    params: cycleId ? { cycleId } : undefined,
  });
  return data;
}

export async function fetchProgramBreakdown(cycleId?: string) {
  const { data } = await api.get('/v1/admissions/admin/analytics/programs', {
    params: cycleId ? { cycleId } : undefined,
  });
  return data;
}

export async function enrollFromApplicationAdmin(
  id: string,
  payload?: { programVersionId?: string; admissionBatchId?: string; primaryShiftId?: string },
) {
  const { data } = await api.post(`/v1/admissions/admin/applications/${id}/enroll`, payload ?? {});
  return data;
}

export async function fetchApplicationDocuments(
  applicationId: string,
): Promise<AdmissionApplicationDocument[]> {
  const { data } = await api.get(`/v1/admissions/admin/applications/${applicationId}/documents`);
  return data;
}

export async function fetchAdmissionAuditLog(
  entityType: string,
  entityId: string,
): Promise<AdmissionAuditEntry[]> {
  const { data } = await api.get(`/v1/admissions/admin/audit/${entityType}/${entityId}`);
  return data;
}

export async function markApplicationAdmissionFee(
  id: string,
  payload: {
    status: string;
    admissionFeeReference?: string;
    admissionFeeAmount?: number;
  },
) {
  const { data } = await api.patch(
    `/v1/admissions/admin/applications/${id}/admission-fee`,
    payload,
  );
  return data as AdmissionApplication;
}

export async function sendAdmissionOffer(id: string) {
  const { data } = await api.post(`/v1/admissions/admin/applications/${id}/send-offer`);
  return data as { sent: boolean; applicationNumber: string };
}

export async function downloadApplicationPdf(id: string, applicationNumber: string) {
  const { downloadBlob } = await import('@/utils/download-blob');
  const res = await api.get(`/v1/admissions/admin/applications/${id}/pdf`, {
    responseType: 'blob',
  });
  const safeName = applicationNumber.replace(/[^a-zA-Z0-9-]/g, '_');
  downloadBlob(res.data as Blob, `${safeName}_application.pdf`);
}
