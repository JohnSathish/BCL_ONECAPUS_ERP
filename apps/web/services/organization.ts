import { api } from '@/services/api';
import type {
  AcademicSettings,
  AcademicYear,
  Campus,
  Department,
  DepartmentStatus,
  DepartmentType,
  FacultyHodOption,
  Institution,
  SetupSummary,
} from '@/types/organization';

export async function fetchSetupSummary(): Promise<SetupSummary> {
  const { data } = await api.get('/v1/organization/setup-summary');
  return data;
}

export async function fetchAcademicSettings(): Promise<AcademicSettings> {
  const { data } = await api.get('/v1/organization/academic-settings');
  return data;
}

export async function updateAcademicSettings(payload: Partial<AcademicSettings>) {
  const { data } = await api.patch('/v1/organization/academic-settings', payload);
  return data as AcademicSettings;
}

export async function fetchInstitutions(): Promise<Institution[]> {
  const { data } = await api.get('/v1/organization/institutions');
  return data;
}

export async function createInstitution(payload: { name: string; code?: string }) {
  const { data } = await api.post('/v1/organization/institutions', payload);
  return data as Institution;
}

export async function deleteInstitution(id: string) {
  await api.delete(`/v1/organization/institutions/${id}`);
}

export async function fetchCampuses(institutionId?: string): Promise<Campus[]> {
  const { data } = await api.get('/v1/organization/campuses', { params: { institutionId } });
  return data;
}

export async function createCampus(payload: {
  institutionId: string;
  name: string;
  code?: string;
}) {
  const { data } = await api.post('/v1/organization/campuses', payload);
  return data as Campus;
}

export async function deleteCampus(id: string) {
  await api.delete(`/v1/organization/campuses/${id}`);
}

export async function fetchDepartments(params?: {
  campusId?: string;
  institutionId?: string;
  status?: DepartmentStatus;
  type?: 'ACADEMIC' | 'ADMINISTRATIVE';
  scope?: 'academic' | 'administrative';
  departmentType?: DepartmentType;
}): Promise<Department[]> {
  const { data } = await api.get('/v1/organization/departments', { params });
  return data;
}

/** Teaching/academic departments only — for Course Master, curriculum, and student academic flows. */
export async function fetchAcademicDepartments(params?: {
  campusId?: string;
  institutionId?: string;
  status?: DepartmentStatus;
}): Promise<Department[]> {
  return fetchDepartments({
    ...params,
    scope: 'academic',
    status: params?.status ?? 'ACTIVE',
  });
}

export async function fetchFacultyForHod(departmentId?: string): Promise<FacultyHodOption[]> {
  const { data } = await api.get('/v1/organization/faculty', {
    params: departmentId ? { departmentId } : undefined,
  });
  return data;
}

export async function createDepartment(payload: {
  institutionId: string;
  campusId?: string;
  name: string;
  code: string;
  departmentType?: DepartmentType;
  hodId?: string;
  status?: DepartmentStatus;
}) {
  const { data } = await api.post('/v1/organization/departments', payload);
  return data as Department;
}

export async function updateDepartment(
  id: string,
  payload: Partial<{
    campusId: string | null;
    name: string;
    code: string;
    departmentType: DepartmentType;
    hodId: string | null;
    status: DepartmentStatus;
  }>,
) {
  const { data } = await api.patch(`/v1/organization/departments/${id}`, payload);
  return data as Department;
}

export async function deleteDepartment(id: string) {
  await api.delete(`/v1/organization/departments/${id}`);
}

export async function fetchAcademicYears(): Promise<AcademicYear[]> {
  const { data } = await api.get('/v1/organization/academic-years');
  return data;
}

export async function createAcademicYear(payload: {
  name: string;
  startDate: string;
  endDate: string;
}) {
  const { data } = await api.post('/v1/organization/academic-years', payload);
  return data as AcademicYear;
}

export async function createSemester(payload: {
  academicYearId: string;
  name: string;
  sequence?: number;
  startDate?: string;
  endDate?: string;
}) {
  const { data } = await api.post('/v1/organization/semesters', payload);
  return data as unknown;
}
