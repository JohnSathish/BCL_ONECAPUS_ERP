import { api } from '@/services/api';
import type {
  AdmissionApplication,
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
  status?: string;
  search?: string;
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
