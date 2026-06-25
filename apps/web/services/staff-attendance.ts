import { api } from '@/services/api';

export type AttendanceDevice = {
  id: string;
  name: string;
  model: string;
  serialNumber?: string | null;
  deviceCode?: string | null;
  ipAddress?: string | null;
  port?: number | null;
  location?: string | null;
  building?: string | null;
  floor?: string | null;
  description?: string | null;
  connectionType?: string | null;
  protocol?: string | null;
  timeoutSec?: number | null;
  retryCount?: number | null;
  sslEnabled?: boolean | null;
  devicePassword?: string | null;
  deviceKey?: string | null;
  machineNumber?: string | null;
  communicationKey?: string | null;
  firmwareVersion?: string | null;
  timezone?: string | null;
  heartbeatIntervalSec?: number | null;
  autoSyncEnabled?: boolean | null;
  syncFrequencyMin?: number | null;
  syncDirection?: string | null;
  punchMode?: string | null;
  duplicatePunchThresholdMin?: number | null;
  timeDriftToleranceSec?: number | null;
  processingStrategy?: string | null;
  status: string;
  registrationStatus?: string | null;
  networkStatus?: string | null;
  authenticationStatus?: string | null;
  syncHealthStatus?: string | null;
  signalHealth?: string | null;
  lastSeenAt?: string | null;
  lastSyncAt?: string | null;
  lastHeartbeatAt?: string | null;
  lastOnlineAt?: string | null;
  lastOfflineAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastFailedSyncAt?: string | null;
  failureReason?: string | null;
  uptimePercent?: string | number | null;
  lastDiagnosticAt?: string | null;
  lastDiagnosticPayload?: unknown;
  settings?: unknown;
  userCount: number;
  fingerprintCount: number;
  _count?: { mappings?: number; rawPunches?: number };
};

export type DeviceConfigPayload = {
  name: string;
  model: string;
  serialNumber: string;
  deviceCode?: string;
  location?: string;
  building?: string;
  floor?: string;
  description?: string;
  departmentScope?: unknown;
  connectionType?: string;
  ipAddress?: string;
  port?: number;
  protocol?: string;
  timeoutSec?: number;
  retryCount?: number;
  sslEnabled?: boolean;
  devicePassword?: string;
  deviceKey?: string;
  machineNumber?: string;
  communicationKey?: string;
  firmwareVersion?: string;
  timezone?: string;
  heartbeatIntervalSec?: number;
  autoSyncEnabled?: boolean;
  syncFrequencyMin?: number;
  syncDirection?: string;
  punchMode?: string;
  duplicatePunchThresholdMin?: number;
  timeDriftToleranceSec?: number;
  processingStrategy?: string;
  settings?: unknown;
};

export type AttendanceDashboard = {
  presentToday: number;
  absent: number;
  late: number;
  earlyOut: number;
  overtime: number;
  halfDay?: number;
  leaveToday?: number;
  weeklyOff?: number;
  holidayToday?: number;
  wfhToday?: number;
  deviceOnline?: number;
  missingPunch: number;
  liveActiveStaff: number;
  pendingRawLogs: number;
  devices: AttendanceDevice[];
};

export type AttendanceCommandCenter = {
  generatedAt: string;
  today: {
    present: number;
    late: number;
    absent: number;
    onLeave: number;
    wfh: number;
    holiday: number;
    weeklyOff: number;
    halfDay: number;
  };
  liveStatus: {
    activeStaff: number;
    currentlyInside: number;
    alreadyLeft: number;
    notYetPunched: number;
    missingOut: number;
  };
  arrivalTimeline: Array<{ hour: number; label: string; count: number; intensity: number }>;
  devices: Array<{
    id: string;
    name: string;
    location: string;
    online: boolean;
    healthLabel: string;
    punchesToday: number;
    userCount: number;
    lastSyncAt?: string | null;
    lastSyncLabel: string;
    networkQuality: string;
    firmwareVersion: string;
    syncHealthStatus: string;
  }>;
  departmentHeatmap: Array<{
    department: string;
    attendancePercent: number;
    present: number;
    total: number;
    health: string;
  }>;
  departmentRanking: Array<{
    rank: number;
    department: string;
    attendancePercent: number;
    present: number;
    total: number;
    health: string;
  }>;
  weeklyPattern: Array<{ day: string; attendancePercent: number; health: string }>;
  trends: {
    series: Array<Record<string, unknown>>;
    direction: {
      attendance: string;
      late: string;
      leave: string;
      overtime: string;
    };
  };
  monthlyAnalytics: {
    current: {
      attendancePercent: number;
      latePercent: number;
      leavePercent: number;
      overtimePercent: number;
    };
    previous: {
      attendancePercent: number;
      latePercent: number;
      leavePercent: number;
      overtimePercent: number;
    };
    deltas: {
      attendance: number;
      late: number;
      leave: number;
      overtime: number;
    };
  };
  insights: Array<{ id: string; severity: string; title: string; body: string }>;
  alerts: Array<{ id: string; severity: string; title: string; action: string }>;
  recentPunches: Array<{
    id: string;
    staffName: string;
    employeeCode?: string;
    department?: string;
    deviceName: string;
    location?: string;
    punchTimestamp: string;
    direction: string;
  }>;
  pendingCorrections: number;
  deviceOnline: number;
};

export type StaffAttendanceTimeline = {
  staff: { id: string; fullName: string; employeeCode?: string; department?: { name?: string } };
  date: string;
  timeline: Array<{
    id: string;
    time: string;
    label: string;
    deviceName?: string;
    location?: string;
  }>;
  summary: {
    status: string;
    firstInAt?: string | null;
    lastOutAt?: string | null;
    workedMinutes: number;
    lateMinutes: number;
    overtimeMinutes: number;
    exceptionFlags: unknown;
  } | null;
  score: {
    score: number;
    breakdown: Record<string, number>;
    disciplineStars: number;
  };
  calendar: Array<{ date: string; status: string; lateMinutes: number }>;
};

export type AttendanceMapping = {
  id: string;
  staffProfileId: string;
  deviceId?: string | null;
  biometricId: string;
  deviceUserId: string;
  syncStatus: string;
  enrollmentStatus: string;
  conflictReason?: string | null;
  lastPunchAt?: string | null;
  staff?: {
    id: string;
    fullName: string;
    employeeCode: string;
    biometricId?: string | null;
    biometricExternalUserId?: string | null;
    rfidNo?: string | null;
    department?: { name: string } | null;
  };
  device?: { id: string; name: string; status: string } | null;
};

export type PushPreviewRow = {
  staffProfileId?: string;
  employeeCode?: string;
  fullName?: string;
  biometricId?: string;
  deviceUserId?: string;
  name?: string;
  cardNumber?: string;
  privilege?: string;
  enabled?: boolean;
  status: string;
  missing: string[];
};

export type PushUsersResult = {
  total: number;
  successful: number;
  duplicate: number;
  ready?: number;
  invalid: number;
  failed: number;
  errors: string[];
  validationErrors?: Array<{
    staffProfileId?: string;
    employeeCode?: string;
    fullName?: string;
    deviceUserId?: string;
    missing: string[];
    message: string;
  }>;
  preview?: PushPreviewRow[];
};

export type DevicePulledUser = {
  deviceUserId: string;
  name?: string;
  cardNumber?: string;
  password?: string;
  privilege?: string;
  templateCount?: number;
  faceCount?: number;
  deviceName?: string;
  mappingStatus: string;
  diagnosticReason?: string;
  matchedStaff?: {
    id: string;
    employeeCode: string;
    fullName: string;
    biometricId?: string | null;
    rfidNo?: string | null;
  } | null;
};

export type DailyAttendanceRecord = {
  id: string;
  attendanceDate: string;
  firstInAt?: string | null;
  lastOutAt?: string | null;
  workedMinutes: number;
  lateMinutes: number;
  earlyMinutes: number;
  overtimeMinutes: number;
  status: string;
  remarks?: string | null;
  staff?: {
    id: string;
    fullName: string;
    employeeCode: string;
    department?: { name: string } | null;
    primaryShift?: { name: string } | null;
  };
};

export type RawPunch = {
  id: string;
  deviceUserId: string;
  biometricId?: string | null;
  punchTimestamp: string;
  punchDirection?: string | null;
  verificationMode?: string | null;
  processingStatus: string;
  staff?: {
    fullName: string;
    employeeCode: string;
    photoUrl?: string | null;
    department?: { name: string } | null;
  };
  device?: { name: string; status: string };
};

export type AttendanceSettingsOverview = {
  master: Record<string, unknown>;
  shiftRules: Array<Record<string, unknown>>;
  shiftGroups: Array<Record<string, unknown>>;
  leaveTypes: Array<Record<string, unknown>>;
  employeeCategories: Array<Record<string, unknown>>;
  holidays: Array<Record<string, unknown>>;
  departmentRules: Array<Record<string, unknown>>;
  otRules: Array<Record<string, unknown>>;
  processingRuns: Array<Record<string, unknown>>;
  counts: Record<string, number>;
};

export type MonthlyAttendanceSummary = {
  from: string;
  to: string;
  days: string[];
  staff: Array<{
    staffProfileId: string;
    staff?: DailyAttendanceRecord['staff'];
    present: number;
    absent: number;
    leave: number;
    late: number;
    earlyExit: number;
    halfDay: number;
    weeklyOff: number;
    holiday: number;
    overtimeMinutes: number;
    workedMinutes: number;
    days: Record<
      string,
      {
        status: string;
        in?: string | null;
        out?: string | null;
        workedMinutes?: number;
        lateMinutes?: number;
        overtimeMinutes?: number;
      }
    >;
  }>;
  totals: Record<string, number>;
};

export type AttendanceReportPayload = {
  title: string;
  generatedAt: string;
  summary: Record<string, unknown>;
  rows: DailyAttendanceRecord[] | RawPunch[] | AttendanceDevice[] | Array<Record<string, unknown>>;
  export?: Record<string, boolean>;
};

export async function fetchStaffAttendanceDashboard(): Promise<AttendanceDashboard> {
  const { data } = await api.get('/v1/staff/attendance/dashboard');
  return data;
}

export async function fetchAttendanceCommandCenter(): Promise<AttendanceCommandCenter> {
  const { data } = await api.get('/v1/staff/attendance/analytics/command-center');
  return data;
}

export async function fetchStaffAttendanceTimeline(
  staffProfileId: string,
  date?: string,
): Promise<StaffAttendanceTimeline> {
  const { data } = await api.get(
    `/v1/staff/attendance/analytics/staff/${staffProfileId}/timeline`,
    { params: date ? { date } : undefined },
  );
  return data;
}

export async function fetchBiometricDevices(): Promise<AttendanceDevice[]> {
  const { data } = await api.get('/v1/staff/attendance/biometric-devices');
  return data;
}

export async function createBiometricDevice(payload: DeviceConfigPayload) {
  const { data } = await api.post('/v1/staff/attendance/biometric-devices', payload);
  return data;
}

export async function updateBiometricDevice(id: string, payload: DeviceConfigPayload) {
  const { data } = await api.patch(`/v1/staff/attendance/biometric-devices/${id}`, payload);
  return data;
}

export async function deleteBiometricDevice(id: string) {
  const { data } = await api.delete(`/v1/staff/attendance/biometric-devices/${id}`);
  return data;
}

export async function testBiometricDevice(id: string) {
  const { data } = await api.post(`/v1/staff/attendance/biometric-devices/${id}/test`);
  return data;
}

export async function testBiometricDeviceStep(id: string, test: string) {
  const { data } = await api.post(`/v1/staff/attendance/biometric-devices/${id}/test/${test}`);
  return data;
}

export async function syncBiometricDevice(
  id: string,
  payload?: { mode?: string; from?: string; to?: string },
) {
  const { data } = await api.post(
    `/v1/staff/attendance/biometric-devices/${id}/sync`,
    payload ?? {},
  );
  return data;
}

export async function pushBiometricUsers(
  id: string,
  payload?: { staffProfileIds?: string[]; departmentId?: string },
) {
  const { data } = await api.post(
    `/v1/staff/attendance/biometric-devices/${id}/push-users`,
    payload ?? {},
  );
  return data;
}

export async function previewBiometricUsers(
  id: string,
  payload?: { staffProfileIds?: string[]; departmentId?: string },
) {
  const { data } = await api.post(
    `/v1/staff/attendance/biometric-devices/${id}/push-users/preview`,
    payload ?? {},
  );
  return data;
}

export async function fetchDeviceUsers(id: string): Promise<DevicePulledUser[]> {
  const { data } = await api.get(`/v1/staff/attendance/biometric-devices/${id}/users`);
  return data;
}

export async function fetchBiometricMappings(): Promise<AttendanceMapping[]> {
  const { data } = await api.get('/v1/staff/attendance/biometric-mappings');
  return data;
}

export async function upsertBiometricMapping(payload: {
  staffProfileId: string;
  deviceId?: string;
  biometricId: string;
  deviceUserId: string;
}) {
  const { data } = await api.post('/v1/staff/attendance/biometric-mappings', payload);
  return data;
}

export async function autoMapBiometricStaff(payload?: { deviceId?: string }) {
  const { data } = await api.post(
    '/v1/staff/attendance/biometric-mappings/auto-map',
    payload ?? {},
  );
  return data;
}

export async function fetchLiveAttendance(): Promise<RawPunch[]> {
  const { data } = await api.get('/v1/staff/attendance/live');
  return data;
}

export async function fetchDailyAttendance(
  params?:
    | string
    | {
        date?: string;
        from?: string;
        to?: string;
        status?: string;
        departmentId?: string;
        staffProfileId?: string;
        shiftId?: string;
      },
): Promise<DailyAttendanceRecord[]> {
  const query = typeof params === 'string' ? { date: params } : params;
  const { data } = await api.get('/v1/staff/attendance/daily', { params: query });
  return data;
}

export async function fetchMonthlyAttendance(params?: {
  month?: string;
  departmentId?: string;
  staffProfileId?: string;
  shiftId?: string;
}): Promise<MonthlyAttendanceSummary> {
  const { data } = await api.get('/v1/staff/attendance/monthly', { params });
  return data;
}

export async function fetchSyncBatches() {
  const { data } = await api.get('/v1/staff/attendance/sync-batches');
  return data;
}

export async function fetchAttendanceRules() {
  const { data } = await api.get('/v1/staff/attendance/rules');
  return data;
}

export async function fetchAttendanceCorrections() {
  const { data } = await api.get('/v1/staff/attendance/corrections');
  return data;
}

export async function fetchAttendanceAuditLogs() {
  const { data } = await api.get('/v1/staff/attendance/audit-logs');
  return data;
}

export async function fetchStaffAttendanceProfileSummary(staffProfileId: string) {
  const { data } = await api.get(`/v1/staff/attendance/staff/${staffProfileId}/summary`);
  return data;
}

export async function fetchAttendanceReport(
  type: string,
  params?: Record<string, string | undefined>,
): Promise<AttendanceReportPayload | MonthlyAttendanceSummary> {
  const { data } = await api.get(`/v1/staff/attendance/reports/${type}`, { params });
  return data;
}

export async function processPendingAttendance(): Promise<{
  processedPunches: number;
  records: number;
}> {
  const { data } = await api.post('/v1/staff/attendance/process-pending');
  return data;
}

export async function fetchAttendanceSettings(): Promise<AttendanceSettingsOverview> {
  const { data } = await api.get('/v1/staff/attendance/settings');
  return data;
}

export async function seedAttendanceSettingsDefaults() {
  const { data } = await api.post('/v1/staff/attendance/settings/seed-defaults');
  return data;
}

export async function updateAttendanceMasterSettings(payload: Record<string, unknown>) {
  const { data } = await api.patch('/v1/staff/attendance/settings/master', payload);
  return data;
}

export async function createAttendanceSettingsRecord(
  resource: string,
  payload: Record<string, unknown>,
) {
  const { data } = await api.post(`/v1/staff/attendance/settings/${resource}`, { data: payload });
  return data;
}

export async function updateAttendanceSettingsRecord(
  resource: string,
  id: string,
  payload: Record<string, unknown>,
) {
  const { data } = await api.patch(`/v1/staff/attendance/settings/${resource}/${id}`, {
    data: payload,
  });
  return data;
}

export async function reprocessStaffAttendance(payload: {
  from?: string;
  to?: string;
  staffProfileId?: string;
  departmentId?: string;
  mode?: string;
}) {
  const { data } = await api.post('/v1/staff/attendance/settings/reprocess', payload);
  return data;
}
