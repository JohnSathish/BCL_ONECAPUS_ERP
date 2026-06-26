import { api } from '@/services/api';
import { downloadBlob } from '@/utils/download-blob';

export type StudentReportFilters = {
  campusId?: string;
  programVersionId?: string;
  departmentId?: string;
  shiftId?: string;
  batchId?: string;
  streamId?: string;
  semester?: number;
  academicYear?: string;
  admissionStatus?: string;
  studentStatus?: string;
  gender?: string;
  categoryLookupId?: string;
  religionLookupId?: string;
  bloodGroupLookupId?: string;
  state?: string;
  district?: string;
  feeStatus?: string;
  residenceType?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
};

export type ReportFieldDef = {
  key: string;
  label: string;
  group: string;
  description?: string;
};

export type FieldRegistry = {
  module: string;
  groups: Record<string, ReportFieldDef[]>;
  fields: ReportFieldDef[];
};

export type BuiltinReportTemplate = {
  key: string;
  name: string;
  description: string;
  module: string;
  defaultColumns: string[];
};

export type SavedReport = {
  id: string;
  name: string;
  module: string;
  reportKind: string;
  builtinKey: string | null;
  isSystemTemplate: boolean;
  filters: Record<string, unknown>;
  columns: string[];
  sortBy: string | null;
  sortDirection: string | null;
  groupBy: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TabularReportPreview = {
  total: number;
  truncated: boolean;
  rowCount: number;
  columns: string[] | { key: string; label: string }[];
  rows: Record<string, unknown>[];
};

export type BuiltinReportKey = 'student-master' | 'subject-summary' | 'subject-papers';

export type ReportBucket = {
  key: string;
  label: string;
  count: number;
  percentage?: number;
};

export type StudentReportDashboard = {
  totalStudents: number;
  activeStudents: number;
  programmeWise: ReportBucket[];
  semesterWise: ReportBucket[];
  shiftWise: ReportBucket[];
  genderWise: ReportBucket[];
  categoryWise: ReportBucket[];
  updatedAt: string;
};

export type DistributionReport = {
  title: string;
  total: number;
  buckets: ReportBucket[];
  crossTabs?: { label: string; buckets: ReportBucket[] }[];
  activeStudents?: number;
  academicYearWise?: ReportBucket[];
  majorWise?: ReportBucket[];
  minorWise?: ReportBucket[];
  withMobile?: number;
  withEmail?: number;
};

export type CombinationReport = {
  total: number;
  combinations: { major: string; minor: string; count: number }[];
};

export type AgeReport = {
  total: number;
  averageAge: number | null;
  youngest: { name: string; age: number } | null;
  oldest: { name: string; age: number } | null;
  buckets: ReportBucket[];
};

export type StudentReportType =
  | 'dashboard'
  | 'strength'
  | 'department'
  | 'gender'
  | 'category'
  | 'religion'
  | 'denomination'
  | 'major-subjects'
  | 'combinations'
  | 'mdc'
  | 'aec'
  | 'sec'
  | 'vac'
  | 'age'
  | 'blood-group'
  | 'admission'
  | 'contact';

function cleanParams(filters?: StudentReportFilters) {
  const params: Record<string, string | number> = {};
  if (!filters) return params;
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== '' && v !== null) params[k] = v;
  }
  return params;
}

export async function fetchStudentReportDashboard(
  filters?: StudentReportFilters,
): Promise<StudentReportDashboard> {
  const { data } = await api.get('/v1/student-reports/dashboard', { params: cleanParams(filters) });
  return data;
}

export async function fetchStudentDistributionReport(
  endpoint: Exclude<StudentReportType, 'dashboard' | 'combinations'>,
  filters?: StudentReportFilters,
): Promise<DistributionReport | AgeReport> {
  const { data } = await api.get(`/v1/student-reports/${endpoint}`, {
    params: cleanParams(filters),
  });
  return data;
}

export async function fetchStudentCombinationsReport(
  filters?: StudentReportFilters,
): Promise<CombinationReport> {
  const { data } = await api.get('/v1/student-reports/combinations', {
    params: cleanParams(filters),
  });
  return data;
}

export async function exportStudentReport(
  reportType: StudentReportType,
  format: 'xlsx' | 'csv',
  filters?: StudentReportFilters,
): Promise<void> {
  const response = await api.get('/v1/student-reports/export', {
    params: { ...cleanParams(filters), reportType, format },
    responseType: 'blob',
  });
  const ext = format === 'xlsx' ? 'xlsx' : 'csv';
  downloadBlob(response.data, `student_report_${reportType}.${ext}`);
}

export async function fetchReportFieldRegistry(module = 'STUDENTS'): Promise<FieldRegistry> {
  const { data } = await api.get('/v1/student-reports/field-registry', {
    params: { module },
  });
  return data;
}

export async function fetchBuiltinReportTemplates(): Promise<BuiltinReportTemplate[]> {
  const { data } = await api.get('/v1/student-reports/builtin-templates');
  return data;
}

export async function fetchSavedReports(module = 'STUDENTS'): Promise<SavedReport[]> {
  const { data } = await api.get('/v1/student-reports/saved', { params: { module } });
  return data;
}

export async function createSavedReport(payload: {
  name: string;
  columns: string[];
  filters?: Record<string, unknown>;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}): Promise<SavedReport> {
  const { data } = await api.post('/v1/student-reports/saved', payload);
  return data;
}

export async function toggleSavedReportFavorite(id: string): Promise<{ favorited: boolean }> {
  const { data } = await api.post(`/v1/student-reports/saved/${id}/favorite`);
  return data;
}

export async function deleteSavedReport(id: string): Promise<{ ok: boolean }> {
  const { data } = await api.delete(`/v1/student-reports/saved/${id}`);
  return data;
}

export async function previewSavedReport(
  id: string,
  filters?: StudentReportFilters,
): Promise<TabularReportPreview> {
  const { data } = await api.get(`/v1/student-reports/saved/${id}/preview`, {
    params: cleanParams(filters),
  });
  return data;
}

export async function exportSavedReport(
  id: string,
  format: 'xlsx' | 'csv',
  filters?: StudentReportFilters,
): Promise<void> {
  const response = await api.get(`/v1/student-reports/saved/${id}/export`, {
    params: { ...cleanParams(filters), format },
    responseType: 'blob',
  });
  downloadBlob(response.data, `saved-report-${id}.${format === 'xlsx' ? 'xlsx' : 'csv'}`);
}

export type ScheduledReport = {
  id: string;
  name: string;
  module: string;
  scheduleType: string;
  scheduleDay: number | null;
  scheduleTime: string | null;
  format: string;
  recipientEmails: string[] | null;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  savedReport: { id: string; name: string; builtinKey: string | null } | null;
};

export async function fetchScheduledReports(module = 'STUDENTS'): Promise<ScheduledReport[]> {
  const { data } = await api.get('/v1/student-reports/scheduled', { params: { module } });
  return data;
}

export async function createScheduledReport(payload: {
  name: string;
  savedReportId: string;
  scheduleType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  scheduleDay?: number;
  scheduleTime?: string;
  format?: 'xlsx' | 'csv';
  recipientEmails?: string[];
}): Promise<ScheduledReport> {
  const { data } = await api.post('/v1/student-reports/scheduled', payload);
  return data;
}

export async function deleteScheduledReport(id: string): Promise<{ ok: boolean }> {
  const { data } = await api.delete(`/v1/student-reports/scheduled/${id}`);
  return data;
}

export async function previewBuiltinReport(
  key: BuiltinReportKey,
  filters?: StudentReportFilters,
  columns?: string[],
): Promise<TabularReportPreview> {
  const { data } = await api.get(`/v1/student-reports/${builtinPath(key)}/preview`, {
    params: { ...cleanParams(filters), ...(columns?.length ? { columns } : {}) },
  });
  return data;
}

export async function exportBuiltinReport(
  key: BuiltinReportKey,
  format: 'xlsx' | 'csv',
  filters?: StudentReportFilters,
  columns?: string[],
): Promise<void> {
  const response = await api.get(`/v1/student-reports/${builtinPath(key)}/export`, {
    params: {
      ...cleanParams(filters),
      format,
      ...(columns?.length ? { columns } : {}),
    },
    responseType: 'blob',
  });
  downloadBlob(response.data, `${key}.${format === 'xlsx' ? 'xlsx' : 'csv'}`);
}

function builtinPath(key: BuiltinReportKey) {
  if (key === 'student-master') return 'master';
  if (key === 'subject-summary') return 'subject-summary';
  return 'subject-papers';
}
