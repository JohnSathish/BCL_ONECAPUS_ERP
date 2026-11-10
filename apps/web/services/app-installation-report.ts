import { api } from '@/services/api';
import { downloadBlob, filenameFromContentDisposition } from '@/utils/download-blob';

export type InstallStatus = 'INSTALLED' | 'NOT_INSTALLED' | 'UNVERIFIED';
export type InstallShift = 'MORNING' | 'DAY' | 'EVENING';
export type InstallCategory = 'TEACHING' | 'NON_TEACHING' | 'STUDENTS' | 'ALL';
export type InstallFilterStatus = InstallStatus | 'ALL';
export type InstallScope = 'summary' | 'detailed' | 'pending' | 'department';

export type InstallationFilters = {
  academicYearId?: string;
  departmentId?: string;
  semester?: number;
  shift?: InstallShift;
  category?: InstallCategory;
  status?: InstallFilterStatus;
  search?: string;
  presentation?: 'screen' | 'pending';
};

export type InstallationPerson = {
  id: string;
  userId: string | null;
  category: 'STUDENT' | 'TEACHING' | 'NON_TEACHING';
  categoryLabel: string;
  name: string;
  identifier: string;
  roleLabel: string;
  email: string | null;
  mobile: string | null;
  departmentId: string;
  departmentName: string;
  shiftLabel: string;
  semester: number | null;
  status: InstallStatus;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  serial: number;
};

export type InstallationDepartment = {
  id: string;
  serial: number;
  name: string;
  total: number;
  installed: number;
  notInstalled: number;
  unverified: number;
  percent: number;
  people: InstallationPerson[];
  followUp: InstallationPerson[];
};

export type InstallationReport = {
  collegeName: string;
  headingName: string;
  academicYear: { id: string; name: string; liveCensus: boolean } | null;
  generatedAt: string;
  generatedLabel: string;
  populationNote: string;
  basis: string;
  filters: {
    academicYearId: string | null;
    departmentId: string | null;
    semester: number | null;
    shift: string | null;
    category: string;
    status: string;
    search: string | null;
    presentation: 'screen' | 'pending';
  };
  summary: {
    total: number;
    installed: number;
    notInstalled: number;
    unverified: number;
    percent: number;
    highest: { id: string; name: string; percent: number; total: number } | null;
    lowest: { id: string; name: string; percent: number; total: number } | null;
  };
  departments: InstallationDepartment[];
};

function cleanParams(filters: InstallationFilters) {
  const params: Record<string, string | number> = {};
  if (filters.academicYearId) params.academicYearId = filters.academicYearId;
  if (filters.departmentId) params.departmentId = filters.departmentId;
  if (filters.semester) params.semester = filters.semester;
  if (filters.shift) params.shift = filters.shift;
  if (filters.category && filters.category !== 'ALL') params.category = filters.category;
  if (filters.status && filters.status !== 'ALL') params.status = filters.status;
  if (filters.search?.trim()) params.search = filters.search.trim();
  if (filters.presentation) params.presentation = filters.presentation;
  return params;
}

export async function fetchInstallationReport(filters: InstallationFilters) {
  const { data } = await api.get<InstallationReport>('/v1/mobile-app/installation-report', {
    params: cleanParams(filters),
  });
  return data;
}

export async function downloadInstallationExport(
  filters: InstallationFilters & { format: 'pdf' | 'xlsx'; scope: InstallScope },
) {
  const response = await api.get('/v1/mobile-app/installation-report/export', {
    params: {
      ...cleanParams(filters),
      format: filters.format,
      scope: filters.scope,
    },
    responseType: 'blob',
  });
  const blob = response.data as Blob;
  if (blob.type.includes('json') || blob.type.includes('text')) {
    const text = await blob.text();
    let message = 'Could not prepare the report.';
    try {
      const body = JSON.parse(text) as { message?: string | string[] };
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message || message;
    } catch {
      message = text.slice(0, 180) || message;
    }
    throw new Error(message);
  }
  const fallback = `dbc-app-installation-${filters.scope}.${filters.format === 'pdf' ? 'pdf' : 'xlsx'}`;
  const header = response.headers['content-disposition'] as string | undefined;
  downloadBlob(blob, filenameFromContentDisposition(header) ?? fallback);
}
