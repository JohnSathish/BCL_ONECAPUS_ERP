import { api } from '@/services/api';

export type MonitorField = { key: string; label: string };

export type MonitorRow = {
  studentId: string;
  fullName: string;
  rollNumber: string | null;
  department: string;
  programme: string;
  semester: number;
  shift: string;
  mobileNumber: string | null;
  missing: Array<{ key: string; label: string }>;
  percent: number;
  updatedAt: string;
};

export type MonitorOverview = {
  summary: {
    total: number;
    complete: number;
    incomplete: number;
    completePercent: number;
    incompletePercent: number;
    pendingVerification: number;
  };
  requiredKeys: string[];
  fields: MonitorField[];
  rows: MonitorRow[];
  total: number;
  page: number;
  pageSize: number;
  defaultMessage: string;
  channels: { whatsapp: boolean; sms: boolean; push: boolean };
};

export type MonitorFilters = {
  search?: string;
  departmentId?: string;
  semester?: string;
  shiftId?: string;
  gender?: string;
  missingField?: string;
  status?: 'incomplete' | 'complete' | 'all';
  academicYearId?: string;
  page?: number;
  pageSize?: number;
};

function paramsOf(filters: MonitorFilters) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== '' && value != null),
  );
}

export async function fetchProfileMonitor(filters: MonitorFilters) {
  const { data } = await api.get<MonitorOverview>('/v1/students/profile-completion-monitor', {
    params: paramsOf(filters),
  });
  return data;
}

export async function fetchProfileMonitorIds(filters: MonitorFilters) {
  const { data } = await api.get<string[]>('/v1/students/profile-completion-monitor/ids', {
    params: paramsOf(filters),
  });
  return data;
}

export async function fetchProfileMonitorAnalytics(filters: MonitorFilters) {
  const { data } = await api.get<{
    incompleteStudents: number;
    multipleMissing: number;
    byField: Array<{
      key: string;
      label: string;
      missing: number;
      filled: number;
      filledPercent: number;
    }>;
    byDepartment: Array<{
      department: string;
      students: number;
      complete: number;
      completePercent: number;
    }>;
  }>('/v1/students/profile-completion-monitor/analytics', { params: paramsOf(filters) });
  return data;
}

export async function fetchProfileMonitorHistory(page = 1) {
  const { data } = await api.get<{
    total: number;
    page: number;
    rows: Array<{
      id: string;
      createdAt: string;
      channel: string;
      audience: string;
      recipients: number;
      successful: number;
      failed: number;
      skipped: number;
      sentBy: string;
      message: string;
      failures: string[];
    }>;
  }>('/v1/students/profile-completion-monitor/history', { params: { page } });
  return data;
}

export async function saveProfileMonitorSettings(payload: {
  requiredKeys: string[];
  reminderIntervalHours: number;
}) {
  const { data } = await api.put('/v1/students/profile-completion-monitor/settings', payload);
  return data as { requiredKeys: string[]; reminderIntervalHours: number };
}

export async function sendProfileReminder(
  payload: MonitorFilters & {
    channel: 'WHATSAPP' | 'SMS' | 'PUSH';
    audience: 'incomplete' | 'selected' | 'missing_field';
    message: string;
    studentIds?: string[];
  },
) {
  const { data } = await api.post(
    '/v1/students/profile-completion-monitor/reminders',
    paramsOf(payload),
  );
  return data as {
    batchId: string;
    recipients: number;
    success: number;
    failed: number;
    skipped: number;
    queued?: boolean;
  };
}

export async function exportProfileMonitor(filters: MonitorFilters, studentIds?: string[]) {
  const { data } = await api.get<Blob>('/v1/students/profile-completion-monitor/export', {
    params: { ...paramsOf(filters), studentIds: studentIds?.join(',') || undefined },
    responseType: 'blob',
  });
  return data;
}
