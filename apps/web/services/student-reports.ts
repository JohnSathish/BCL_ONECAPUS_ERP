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
};

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
