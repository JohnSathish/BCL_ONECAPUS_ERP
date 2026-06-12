'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  Fingerprint,
  History,
  Loader2,
  RadioTower,
  RefreshCcw,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react';

import { BulkActionButton, BulkActionToolbar, BulkEmptyState } from '@/components/erp/bulk-actions';
import { Button } from '@/components/ui/button';
import {
  autoMapBiometricStaff,
  createBiometricDevice,
  createAttendanceSettingsRecord,
  deleteBiometricDevice,
  fetchAttendanceAuditLogs,
  fetchAttendanceCorrections,
  fetchAttendanceReport,
  fetchAttendanceRules,
  fetchAttendanceSettings,
  fetchBiometricDevices,
  fetchDeviceUsers,
  fetchBiometricMappings,
  fetchDailyAttendance,
  fetchLiveAttendance,
  fetchMonthlyAttendance,
  fetchStaffAttendanceDashboard,
  fetchSyncBatches,
  previewBiometricUsers,
  processPendingAttendance,
  pushBiometricUsers,
  reprocessStaffAttendance,
  seedAttendanceSettingsDefaults,
  syncBiometricDevice,
  testBiometricDevice,
  testBiometricDeviceStep,
  updateAttendanceMasterSettings,
  updateBiometricDevice,
  upsertBiometricMapping,
  type AttendanceDevice,
  type AttendanceMapping,
  type DevicePulledUser,
  type DailyAttendanceRecord,
  type PushPreviewRow,
  type PushUsersResult,
  type RawPunch,
} from '@/services/staff-attendance';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type DashboardRibbonData = {
  presentToday?: number;
  absent?: number;
  late?: number;
  halfDay?: number;
  earlyOut?: number;
  overtime?: number;
  missingPunch?: number;
  deviceOnline?: number;
  liveActiveStaff?: number;
  pendingRawLogs?: number;
};

type DiagnosticStepResult = {
  key: string;
  label: string;
  status: string;
  message?: string;
  latencyMs?: number;
};

type DiagnosticResult = {
  health?: { status?: string; signalHealth?: string };
  networkStatus?: string;
  authenticationStatus?: string;
  syncHealthStatus?: string;
  steps?: DiagnosticStepResult[];
};

type SyncBatchResult = {
  id?: string;
};

type SettingsRow = Record<string, unknown> & {
  id?: string;
  name?: string;
  code?: string;
  mode?: string;
  status?: string;
  shortCode?: string;
  scopeType?: string;
  createdAt?: string;
  updatedAt?: string;
  startedAt?: string;
  attendanceDate?: string;
  action?: string;
  correctionType?: string;
};

type ReportRow = Record<string, unknown> & {
  id?: string;
  staffProfileId?: string;
  staff?: { fullName?: string; employeeCode?: string };
  deviceUserId?: string;
  name?: string;
  attendanceDate?: string;
  punchTimestamp?: string;
  firstInAt?: string | null;
  lastOutAt?: string | null;
  workedMinutes?: number;
  lateMinutes?: number;
  overtimeMinutes?: number;
  status?: string;
};

type ReportShape = {
  title?: string;
  summary?: Record<string, unknown>;
  totals?: Record<string, unknown>;
  rows?: ReportRow[];
  staff?: ReportRow[];
};

type PageKind =
  | 'dashboard'
  | 'live'
  | 'processing'
  | 'register'
  | 'daily'
  | 'monthly'
  | 'late'
  | 'leave'
  | 'corrections'
  | 'devices'
  | 'sync'
  | 'mappings'
  | 'upload'
  | 'rules'
  | 'shift-rules'
  | 'reports'
  | 'audit'
  | 'inspector'
  | 'settings';

const titles: Record<PageKind, { title: string; subtitle: string }> = {
  dashboard: {
    title: 'Staff Attendance & Biometrics',
    subtitle:
      'Enterprise biometric attendance command center for devices, live punches, rules, reports, and audit.',
  },
  live: {
    title: 'Live Attendance Wall',
    subtitle: 'Monitor incoming staff punches and device activity in near real time.',
  },
  processing: {
    title: 'Attendance Processing',
    subtitle: 'Pull logs, process attendance, reprocess records, and monitor the processing queue.',
  },
  register: {
    title: 'Attendance Register',
    subtitle: 'Review processed attendance records with correction and export readiness.',
  },
  daily: {
    title: 'Daily Attendance',
    subtitle: 'Daily staff attendance register with IN, OUT, worked hours, late, early, and OT.',
  },
  monthly: {
    title: 'Monthly Attendance Sheet',
    subtitle: 'Payroll-ready matrix foundation for P, A, L, HD, WO, H, and OT views.',
  },
  late: {
    title: 'Late / Early / OT',
    subtitle: 'Analyze late arrivals, early departures, and overtime trends.',
  },
  leave: {
    title: 'Leave Integration',
    subtitle: 'Prepare absent-to-leave conversion and approved leave overlay workflows.',
  },
  corrections: {
    title: 'Attendance Corrections',
    subtitle: 'Manage missed punch, wrong device, and manual correction requests.',
  },
  devices: {
    title: 'Biometric Device Console',
    subtitle: 'Configure eSSL X2008 devices, monitor health, and run sync operations.',
  },
  sync: {
    title: 'Device Sync Center',
    subtitle: 'Track manual, scheduled, incremental, and full sync batches.',
  },
  mappings: {
    title: 'Staff Biometric Mapping',
    subtitle: 'Map ERP staff to biometric IDs and device user IDs with conflict detection.',
  },
  upload: {
    title: 'Device Upload Manager',
    subtitle: 'Push ERP staff master data to biometric devices with progress tracking.',
  },
  rules: {
    title: 'Attendance Rules',
    subtitle: 'Configure late, early, overtime, duplicate tolerance, and processing policies.',
  },
  'shift-rules': {
    title: 'Shift Rules',
    subtitle: 'Define shift-specific grace, work hours, cross-midnight, and auto-close settings.',
  },
  reports: {
    title: 'Biometric Reporting Suite',
    subtitle: 'Run daily, monthly, late, missing punch, raw log, and device health reports.',
  },
  audit: {
    title: 'Attendance Audit Logs',
    subtitle: 'Audit device operations, mapping changes, sync jobs, and corrections.',
  },
  inspector: {
    title: 'Device Inspector',
    subtitle: 'Debug eSSL device connectivity, users, and ERP-to-device mapping comparisons.',
  },
  settings: {
    title: 'Attendance Master Settings',
    subtitle:
      'Global attendance policy engine for shifts, punches, identity strategy, retention, and processing.',
  },
};

export function StaffAttendanceStudio({ page }: { page: PageKind }) {
  const meta = titles[page];
  const dashboard = useQuery({
    queryKey: ['staff-attendance', 'dashboard'],
    queryFn: fetchStaffAttendanceDashboard,
  });

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <Fingerprint className="h-3.5 w-3.5" />
              eSSL X2008 biometric ecosystem
            </span>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{meta.title}</h1>
            <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
          </div>
          <BulkActionToolbar>
            <LinkButton
              href="/admin/staff/attendance/devices"
              icon={<RadioTower className="h-4 w-4" />}
            >
              Devices
            </LinkButton>
            <LinkButton
              href="/admin/staff/attendance/sync"
              icon={<RefreshCcw className="h-4 w-4" />}
            >
              Sync Center
            </LinkButton>
            <LinkButton href="/admin/staff/attendance/audit" icon={<History className="h-4 w-4" />}>
              Audit Logs
            </LinkButton>
            <LinkButton
              href="/admin/staff/attendance/settings"
              icon={<Settings2 className="h-4 w-4" />}
            >
              Settings
            </LinkButton>
          </BulkActionToolbar>
        </div>
      </section>

      <DashboardRibbon loading={dashboard.isLoading} data={dashboard.data} />

      {page === 'dashboard' ? <DashboardHome /> : null}
      {page === 'devices' ? <DeviceConsole /> : null}
      {page === 'inspector' ? <DeviceInspector /> : null}
      {page === 'mappings' ? <MappingConsole /> : null}
      {page === 'live' ? <LiveAttendanceWall /> : null}
      {page === 'daily' || page === 'register' ? <DailyRegister /> : null}
      {page === 'sync' || page === 'processing' ? <SyncCenter /> : null}
      {page === 'rules' || page === 'shift-rules' || page === 'settings' ? (
        <RulesAndSettings kind={page} />
      ) : null}
      {page === 'corrections' ? <CorrectionsConsole /> : null}
      {page === 'monthly' ? <MonthlyAttendanceView /> : null}
      {page === 'reports' || page === 'late' || page === 'leave' || page === 'upload' ? (
        <ReportsAndFoundations kind={page} />
      ) : null}
      {page === 'audit' ? <AuditConsole /> : null}
    </div>
  );
}

function LinkButton({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {icon}
      {children}
    </Link>
  );
}

function DashboardRibbon({ data, loading }: { data?: DashboardRibbonData; loading: boolean }) {
  const cards = [
    {
      label: 'Present Today',
      value: data?.presentToday ?? 0,
      icon: <CheckCircle2 className="h-4 w-4" />,
      tone: 'success',
    },
    {
      label: 'Absent',
      value: data?.absent ?? 0,
      icon: <AlertTriangle className="h-4 w-4" />,
      tone: 'error',
    },
    {
      label: 'Late',
      value: data?.late ?? 0,
      icon: <Clock3 className="h-4 w-4" />,
      tone: 'warning',
    },
    {
      label: 'Half Day',
      value: data?.halfDay ?? 0,
      icon: <CalendarDays className="h-4 w-4" />,
      tone: 'warning',
    },
    {
      label: 'OT Staff',
      value: data?.overtime ?? 0,
      icon: <Activity className="h-4 w-4" />,
      tone: 'success',
    },
    {
      label: 'Missing Punch',
      value: data?.missingPunch ?? 0,
      icon: <Fingerprint className="h-4 w-4" />,
      tone: 'warning',
    },
    {
      label: 'Device Online',
      value: data?.deviceOnline ?? 0,
      icon: <ShieldCheck className="h-4 w-4" />,
      tone: 'success',
    },
    {
      label: 'Live Active Staff',
      value: data?.liveActiveStaff ?? 0,
      icon: <Users className="h-4 w-4" />,
      tone: 'default',
    },
    {
      label: 'Pending Raw Logs',
      value: data?.pendingRawLogs ?? 0,
      icon: <Database className="h-4 w-4" />,
      tone: 'default',
    },
  ];
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-lg shadow-black/5 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div
            className={cn(
              'mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary',
              card.tone === 'success' && 'bg-emerald-500/10 text-emerald-600',
              card.tone === 'error' && 'bg-destructive/10 text-destructive',
              card.tone === 'warning' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
            )}
          >
            {card.icon}
          </div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-xl font-semibold">
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              Number(card.value).toLocaleString()
            )}
          </p>
        </div>
      ))}
    </section>
  );
}

function DashboardHome() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5">
        <h2 className="text-sm font-semibold">Attendance Operations Command Center</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure devices, push staff, pull logs, process attendance, and monitor anomalies from
          this workspace.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ['Biometric Devices', '/admin/staff/attendance/devices'],
            ['Live Attendance', '/admin/staff/attendance/live'],
            ['Daily Register', '/admin/staff/attendance/daily'],
            ['Mappings', '/admin/staff/attendance/mappings'],
            ['Rules', '/admin/staff/attendance/rules'],
            ['Reports', '/admin/staff/attendance/reports'],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm font-semibold transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/5 hover:shadow-md"
            >
              {label}
            </Link>
          ))}
        </div>
      </section>
      <DeviceHealthPanel />
    </div>
  );
}

function DeviceHealthPanel() {
  const devices = useQuery({
    queryKey: ['staff-attendance', 'devices'],
    queryFn: fetchBiometricDevices,
  });
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
      <h2 className="text-sm font-semibold">Device Health Monitor</h2>
      <div className="mt-3 space-y-2">
        {(devices.data ?? []).slice(0, 5).map((device) => (
          <div key={device.id} className="rounded-2xl bg-muted/35 p-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{device.name}</p>
              <StatusPill status={device.status} />
            </div>
            <p className="mt-1 text-muted-foreground">
              {device.model} · Last sync {formatDateTime(device.lastSyncAt)}
            </p>
          </div>
        ))}
        {!devices.data?.length ? (
          <p className="text-xs text-muted-foreground">No devices configured yet.</p>
        ) : null}
      </div>
    </section>
  );
}

function DeviceConsole() {
  const qc = useQueryClient();
  const [form, setForm] = useState<DeviceFormState>(defaultDeviceForm());
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<AttendanceDevice | null>(null);
  const [deleteDevice, setDeleteDevice] = useState<AttendanceDevice | null>(null);
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [operationMessage, setOperationMessage] = useState('');
  const [diagnosticDevice, setDiagnosticDevice] = useState<AttendanceDevice | null>(null);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [pushDevice, setPushDevice] = useState<AttendanceDevice | null>(null);
  const [pushPreview, setPushPreview] = useState<PushUsersResult | null>(null);
  const [deviceUsers, setDeviceUsers] = useState<DevicePulledUser[]>([]);
  const devices = useQuery({
    queryKey: ['staff-attendance', 'devices'],
    queryFn: fetchBiometricDevices,
  });
  const createMut = useMutation({
    mutationFn: () => createBiometricDevice(toDevicePayload(form)),
    onSuccess: () => {
      setForm(defaultDeviceForm());
      setPanelOpen(false);
      setOperationMessage('Device created successfully.');
      void qc.invalidateQueries({ queryKey: ['staff-attendance', 'devices'] });
    },
  });
  const updateMut = useMutation({
    mutationFn: () => {
      if (!editingDevice) throw new Error('No device selected for editing.');
      return updateBiometricDevice(editingDevice.id, toDevicePayload(form));
    },
    onSuccess: (device: AttendanceDevice) => {
      setOperationMessage(
        'Device updated. Run Test Connection to refresh connectivity and heartbeat.',
      );
      setPanelOpen(false);
      setEditingDevice(null);
      setDiagnosticDevice(device);
      testMut.mutate(device.id);
      void qc.invalidateQueries({ queryKey: ['staff-attendance', 'devices'] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteBiometricDevice(id),
    onSuccess: () => {
      setDeleteDevice(null);
      setOperationMessage(
        'Device soft deleted. Configuration and mappings were archived; audit history is retained.',
      );
      void qc.invalidateQueries({ queryKey: ['staff-attendance'] });
    },
  });
  const testMut = useMutation({
    mutationFn: testBiometricDevice,
    onSuccess: (result: DiagnosticResult) => {
      setOperationMessage(
        `Connection test: ${result?.health?.status ?? 'completed'} (${result?.health?.signalHealth ?? 'health updated'})`,
      );
      setDiagnosticResult(result);
      void qc.invalidateQueries({ queryKey: ['staff-attendance', 'devices'] });
    },
  });
  const stepMut = useMutation({
    mutationFn: ({ id, test }: { id: string; test: string }) => testBiometricDeviceStep(id, test),
    onSuccess: (result: DiagnosticResult) => {
      setDiagnosticResult(result);
      setOperationMessage(
        `${result?.steps?.[0]?.label ?? 'Diagnostic'}: ${result?.steps?.[0]?.message ?? 'completed'}`,
      );
      void qc.invalidateQueries({ queryKey: ['staff-attendance', 'devices'] });
    },
  });
  const syncMut = useMutation({
    mutationFn: (id: string) => syncBiometricDevice(id, { mode: 'INCREMENTAL' }),
    onSuccess: (result: SyncBatchResult) => {
      setOperationMessage(`Pull logs queued. Sync batch: ${result?.id ?? 'created'}`);
      void qc.invalidateQueries({ queryKey: ['staff-attendance'] });
    },
  });
  const pushMut = useMutation({
    mutationFn: (id: string) => pushBiometricUsers(id),
    onSuccess: (result: PushUsersResult) => {
      setPushPreview(result);
      setOperationMessage(
        result?.validationErrors?.length
          ? `Push blocked: ${result.validationErrors.length} staff records need biometric/device data.`
          : `Push staff completed: ${result?.successful ?? 0}/${result?.total ?? 0} users uploaded.`,
      );
      void qc.invalidateQueries({ queryKey: ['staff-attendance'] });
    },
  });
  const previewMut = useMutation({
    mutationFn: (id: string) => previewBiometricUsers(id),
    onSuccess: (result: PushUsersResult) => {
      setPushPreview(result);
      setOperationMessage(
        `Push preview: ${result?.ready ?? 0} ready, ${result?.invalid ?? 0} need attention.`,
      );
    },
  });
  const deviceUsersMut = useMutation({
    mutationFn: (id: string) => fetchDeviceUsers(id),
    onSuccess: (rows) => {
      setDeviceUsers(rows);
      setOperationMessage(`Pulled ${rows.length} device users for verification.`);
    },
  });
  const bulkSyncMut = useMutation({
    mutationFn: async () =>
      Promise.all(
        (devices.data ?? []).map((device) =>
          syncBiometricDevice(device.id, { mode: 'INCREMENTAL' }),
        ),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff-attendance'] }),
  });
  const testAllMut = useMutation({
    mutationFn: async () =>
      Promise.all((devices.data ?? []).map((device) => testBiometricDevice(device.id))),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff-attendance', 'devices'] }),
  });

  const health = useMemo(() => {
    const rows = devices.data ?? [];
    return {
      total: rows.length,
      online: rows.filter((device) => ['CONNECTED', 'ONLINE'].includes(device.status)).length,
      pending: rows.filter((device) => device.status.includes('PENDING')).length,
      offline: rows.filter((device) => ['DISCONNECTED', 'NOT_CONFIGURED'].includes(device.status))
        .length,
    };
  }, [devices.data]);

  const filteredDevices = useMemo(() => {
    const needle = search.trim().toUpperCase();
    return (devices.data ?? []).filter((device) => {
      const haystack = [
        device.name,
        device.ipAddress,
        device.serialNumber,
        device.location,
        device.model,
        device.deviceCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toUpperCase();
      const matchesSearch = !needle || haystack.includes(needle);
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'ONLINE' && device.networkStatus === 'ONLINE') ||
        (statusFilter === 'OFFLINE' &&
          ['OFFLINE', 'TIMEOUT', 'PORT_CLOSED'].includes(String(device.networkStatus))) ||
        (statusFilter === 'WARNING' &&
          ['WARNING', 'FAILED', 'DELAYED'].includes(String(device.syncHealthStatus))) ||
        (statusFilter === 'AUTH_FAIL' &&
          String(device.authenticationStatus ?? '').includes('FAILED')) ||
        (statusFilter === 'NEVER_SYNCED' && device.syncHealthStatus === 'NEVER_SYNCED') ||
        (statusFilter === 'X2008' &&
          String(device.model ?? '')
            .toUpperCase()
            .includes('X2008'));
      return matchesSearch && matchesStatus;
    });
  }, [devices.data, search, statusFilter]);

  const openAddPanel = () => {
    setEditingDevice(null);
    setForm(defaultDeviceForm());
    setPanelOpen(true);
  };

  const openEditPanel = (device: AttendanceDevice) => {
    setEditingDevice(device);
    setForm(deviceToForm(device));
    setPanelOpen(true);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-border/60 bg-card/85 p-5 shadow-lg shadow-black/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Biometric Devices Master Setup</h2>
            <p className="text-sm text-muted-foreground">
              Primary administration panel for eSSL X2008 device registry, IP settings, credentials,
              sync rules, and health.
            </p>
          </div>
          <BulkActionToolbar>
            <BulkActionButton type="button" size="sm" onClick={openAddPanel}>
              Add Device
            </BulkActionButton>
            <BulkActionButton
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void devices.refetch()}
            >
              Refresh
            </BulkActionButton>
            <BulkActionButton
              type="button"
              size="sm"
              variant="outline"
              loading={bulkSyncMut.isPending}
              onClick={() => bulkSyncMut.mutate()}
              disabled={!devices.data?.length}
            >
              Sync All
            </BulkActionButton>
            <BulkActionButton
              type="button"
              size="sm"
              variant="outline"
              loading={testAllMut.isPending}
              onClick={() => testAllMut.mutate()}
              disabled={!devices.data?.length}
            >
              Test All Connections
            </BulkActionButton>
            <Button type="button" size="sm" variant="outline" className="rounded-xl">
              Import Devices
            </Button>
          </BulkActionToolbar>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <HealthCard
            label="Registered Devices"
            value={health.total}
            icon={<RadioTower className="h-4 w-4" />}
          />
          <HealthCard
            label="Online"
            value={health.online}
            icon={<CheckCircle2 className="h-4 w-4" />}
            tone="success"
          />
          <HealthCard
            label="Pending Setup"
            value={health.pending}
            icon={<Clock3 className="h-4 w-4" />}
            tone="warning"
          />
          <HealthCard
            label="Offline / Not Configured"
            value={health.offline}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone="error"
          />
        </div>
      </section>

      <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Device List View</h2>
            <p className="text-xs text-muted-foreground">
              Biometric Devices is the infrastructure master. Sync Center is only for jobs, logs,
              failures, and retries.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="h-9 min-w-64 rounded-xl border border-border bg-background px-3 text-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, IP, serial, location"
            />
            <select
              className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {['ALL', 'ONLINE', 'OFFLINE', 'WARNING', 'AUTH_FAIL', 'NEVER_SYNCED', 'X2008'].map(
                (option) => (
                  <option key={option} value={option}>
                    {option.replaceAll('_', ' ')}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
        <DeviceTable
          devices={filteredDevices}
          pending={devices.isLoading}
          expandedDeviceId={expandedDeviceId}
          onToggleExpand={(id) => setExpandedDeviceId((current) => (current === id ? null : id))}
          onTest={(device) => {
            setDiagnosticDevice(device);
            testMut.mutate(device.id);
          }}
          onEdit={openEditPanel}
          onDelete={setDeleteDevice}
          onSync={(id) => syncMut.mutate(id)}
          onPush={(device) => {
            setPushDevice(device);
            setPushPreview(null);
            setDeviceUsers([]);
            previewMut.mutate(device.id);
          }}
        />
      </section>

      {createMut.isError ||
      updateMut.isError ||
      deleteMut.isError ||
      testMut.isError ||
      syncMut.isError ||
      pushMut.isError ||
      bulkSyncMut.isError ||
      testAllMut.isError ? (
        <p className="text-sm text-destructive">
          {apiErrorMessage(
            createMut.error ||
              updateMut.error ||
              deleteMut.error ||
              testMut.error ||
              syncMut.error ||
              pushMut.error ||
              bulkSyncMut.error ||
              testAllMut.error,
            'Device action failed',
          )}
        </p>
      ) : null}
      {panelOpen ? (
        <DeviceEditorPanel
          mode={editingDevice ? 'edit' : 'add'}
          form={form}
          setForm={setForm}
          loading={createMut.isPending || updateMut.isPending}
          onTest={() => {
            if (editingDevice) testMut.mutate(editingDevice.id);
          }}
          onClose={() => {
            setPanelOpen(false);
            setEditingDevice(null);
          }}
          onSubmit={() => (editingDevice ? updateMut.mutate() : createMut.mutate())}
        />
      ) : null}
      {deleteDevice ? (
        <DeleteDeviceModal
          device={deleteDevice}
          loading={deleteMut.isPending}
          onCancel={() => setDeleteDevice(null)}
          onConfirm={() => deleteMut.mutate(deleteDevice.id)}
        />
      ) : null}
      {diagnosticDevice ? (
        <DiagnosticPanel
          device={diagnosticDevice}
          result={diagnosticResult}
          loading={testMut.isPending || stepMut.isPending}
          onRun={(test) => stepMut.mutate({ id: diagnosticDevice.id, test })}
          onClose={() => {
            setDiagnosticDevice(null);
            setDiagnosticResult(null);
          }}
        />
      ) : null}
      {pushDevice ? (
        <PushPreviewPanel
          device={pushDevice}
          result={pushPreview}
          deviceUsers={deviceUsers}
          loading={previewMut.isPending || pushMut.isPending || deviceUsersMut.isPending}
          onRefresh={() => previewMut.mutate(pushDevice.id)}
          onPush={() => pushMut.mutate(pushDevice.id)}
          onPullUsers={() => deviceUsersMut.mutate(pushDevice.id)}
          onClose={() => {
            setPushDevice(null);
            setPushPreview(null);
            setDeviceUsers([]);
          }}
        />
      ) : null}
      {operationMessage ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          {operationMessage}
        </p>
      ) : null}
    </div>
  );
}

function DeviceTable({
  devices,
  pending,
  expandedDeviceId,
  onToggleExpand,
  onTest,
  onEdit,
  onDelete,
  onSync,
  onPush,
}: {
  devices: AttendanceDevice[];
  pending: boolean;
  expandedDeviceId: string | null;
  onToggleExpand: (id: string) => void;
  onTest: (device: AttendanceDevice) => void;
  onEdit: (device: AttendanceDevice) => void;
  onDelete: (device: AttendanceDevice) => void;
  onSync: (id: string) => void;
  onPush: (device: AttendanceDevice) => void;
}) {
  if (pending) return <p className="text-sm text-muted-foreground">Loading devices...</p>;
  if (!devices.length) {
    return (
      <BulkEmptyState
        title="No biometric devices configured"
        description="Add your eSSL X2008 middleware connector to start syncing staff users and punches."
        steps={['Create device', 'Test connection', 'Auto map staff', 'Push users', 'Pull logs']}
      />
    );
  }
  return (
    <div className="overflow-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>
            {[
              '',
              'Device',
              'IP',
              'Model',
              'Status',
              'Users',
              'Punches',
              'Last Sync',
              'Last Heartbeat',
              'Version',
              'Actions',
            ].map((h) => (
              <th key={h || 'expand'} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <Fragment key={device.id}>
              <tr className="border-t border-border align-top">
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="rounded-md px-2 py-1 text-xs hover:bg-muted"
                    onClick={() => onToggleExpand(device.id)}
                  >
                    {expandedDeviceId === device.id ? '▼' : '▶'}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <p className="font-medium">{device.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {device.deviceCode ?? 'Auto code'} · SN {device.serialNumber ?? '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">{device.location ?? '-'}</p>
                </td>
                <td className="px-3 py-2">
                  {device.ipAddress ?? '-'}:{device.port ?? '-'}
                </td>
                <td className="px-3 py-2">{device.model}</td>
                <td className="px-3 py-2">
                  <div className="space-y-1">
                    <StatusPill status={device.networkStatus ?? 'UNKNOWN'} />
                    <StatusPill status={device.authenticationStatus ?? 'NOT_TESTED'} />
                    <StatusPill status={device.syncHealthStatus ?? 'NEVER_SYNCED'} />
                  </div>
                </td>
                <td className="px-3 py-2">{device.userCount ?? 0}</td>
                <td className="px-3 py-2">{device._count?.rawPunches ?? 0}</td>
                <td className="px-3 py-2">{formatDateTime(device.lastSyncAt)}</td>
                <td className="px-3 py-2">{formatDateTime(device.lastHeartbeatAt)}</td>
                <td className="px-3 py-2">{device.firmwareVersion ?? '-'}</td>
                <td className="px-3 py-2">
                  <DeviceActionMenu
                    device={device}
                    onTest={onTest}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onSync={onSync}
                    onPush={onPush}
                  />
                </td>
              </tr>
              {expandedDeviceId === device.id ? (
                <tr className="border-t border-border bg-muted/20">
                  <td colSpan={11} className="px-4 py-3">
                    <DeviceDiagnosticsRow device={device} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeviceActionMenu({
  device,
  onTest,
  onEdit,
  onDelete,
  onSync,
  onPush,
}: {
  device: AttendanceDevice;
  onTest: (device: AttendanceDevice) => void;
  onEdit: (device: AttendanceDevice) => void;
  onDelete: (device: AttendanceDevice) => void;
  onSync: (id: string) => void;
  onPush: (device: AttendanceDevice) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const positionMenu = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuWidth = 176;
      const estimatedMenuHeight = 280;
      const viewportPadding = 12;
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const openUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
      const maxHeight = Math.max(160, openUpward ? spaceAbove - 6 : spaceBelow - 6);
      setMenuStyle({
        position: 'fixed',
        top: openUpward
          ? Math.max(viewportPadding, rect.top - Math.min(estimatedMenuHeight, maxHeight) - 6)
          : rect.bottom + 6,
        left: Math.max(12, rect.right - menuWidth),
        width: menuWidth,
        maxHeight,
      });
    };
    positionMenu();
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [open]);

  const runAction = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <div className="relative inline-block">
      <Button
        ref={buttonRef}
        type="button"
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={() => setOpen((value) => !value)}
      >
        Quick Actions ▼
      </Button>
      {open ? (
        <div
          className="z-[80] overflow-y-auto rounded-xl border border-border bg-card p-1 text-xs shadow-2xl"
          style={menuStyle}
        >
          <ActionMenuButton onClick={() => runAction(() => onTest(device))}>
            Test Connection
          </ActionMenuButton>
          <ActionMenuButton onClick={() => runAction(() => onEdit(device))}>
            Edit Device
          </ActionMenuButton>
          <ActionMenuButton
            disabled={!isDeviceAuthenticated(device)}
            onClick={() => runAction(() => onSync(device.id))}
          >
            Pull Logs
          </ActionMenuButton>
          <ActionMenuButton
            disabled={!isDeviceAuthenticated(device)}
            onClick={() => runAction(() => onPush(device))}
          >
            Push Staff
          </ActionMenuButton>
          <ActionMenuButton
            disabled={!isDeviceAuthenticated(device)}
            onClick={() => runAction(() => onSync(device.id))}
          >
            Sync Now
          </ActionMenuButton>
          <ActionMenuButton onClick={() => runAction(() => onTest(device))}>
            View Diagnostics
          </ActionMenuButton>
          <ActionMenuButton danger onClick={() => runAction(() => onDelete(device))}>
            Delete Device
          </ActionMenuButton>
        </div>
      ) : null}
    </div>
  );
}

function ActionMenuButton({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'block w-full rounded-lg px-3 py-2 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50',
        danger && 'text-destructive hover:bg-destructive/10',
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DeviceDiagnosticsRow({ device }: { device: AttendanceDevice }) {
  return (
    <div className="grid gap-3 text-xs md:grid-cols-3">
      <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
        <p className="font-semibold">Network Diagnostics</p>
        <p className="mt-2 text-muted-foreground">IP: {device.ipAddress ?? '-'}</p>
        <p className="text-muted-foreground">Port: {device.port ?? '-'}</p>
        <p className="text-muted-foreground">Heartbeat: {formatDateTime(device.lastHeartbeatAt)}</p>
        <p className="text-muted-foreground">Failure: {device.failureReason ?? '-'}</p>
      </div>
      <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
        <p className="font-semibold">Device Info</p>
        <p className="mt-2 text-muted-foreground">Firmware: {device.firmwareVersion ?? '-'}</p>
        <p className="text-muted-foreground">Serial: {device.serialNumber ?? '-'}</p>
        <p className="text-muted-foreground">Users: {device.userCount ?? 0}</p>
        <p className="text-muted-foreground">Punches: {device._count?.rawPunches ?? 0}</p>
      </div>
      <div className="rounded-2xl border border-border/60 bg-background/80 p-3">
        <p className="font-semibold">Sync Stats</p>
        <p className="mt-2 text-muted-foreground">Mappings: {device._count?.mappings ?? 0}</p>
        <p className="text-muted-foreground">
          Last Success: {formatDateTime(device.lastSuccessfulSyncAt)}
        </p>
        <p className="text-muted-foreground">
          Last Failure: {formatDateTime(device.lastFailedSyncAt)}
        </p>
        <p className="text-muted-foreground">Retries: {device.retryCount ?? 0}</p>
      </div>
    </div>
  );
}

function DeviceEditorPanel({
  mode,
  form,
  setForm,
  loading,
  onSubmit,
  onClose,
  onTest,
}: {
  mode: 'add' | 'edit';
  form: DeviceFormState;
  setForm: (value: DeviceFormState) => void;
  loading: boolean;
  onSubmit: () => void;
  onClose: () => void;
  onTest: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40">
      <div className="ml-auto flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold">
              {mode === 'edit' ? 'Edit Biometric Device' : 'Add Biometric Device'}
            </h2>
            <p className="text-xs text-muted-foreground">
              Accordion editor for basic info, network, authentication, sync rules, and advanced
              eSSL settings.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <DeviceMasterForm form={form} setForm={setForm} onSubmit={onSubmit} loading={loading} />
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onTest} disabled={mode !== 'edit'}>
            Test Connection
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={loading || !form.name || !form.serialNumber}
            >
              {loading ? 'Saving...' : mode === 'edit' ? 'Save Updates' : 'Save Device'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteDeviceModal({
  device,
  loading,
  onCancel,
  onConfirm,
}: {
  device: AttendanceDevice;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const blocked = ['CONNECTED', 'SYNCING', 'PULLING', 'PUSHING'].includes(device.status);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-card p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-destructive">Delete Biometric Device?</h2>
        <div className="mt-4 rounded-2xl bg-muted/40 p-4 text-sm">
          <p>
            <span className="font-semibold">Device:</span> {device.name}
          </p>
          <p>
            <span className="font-semibold">IP:</span> {device.ipAddress ?? '-'}:
            {device.port ?? '-'}
          </p>
          <p>
            <span className="font-semibold">Status:</span> {device.status}
          </p>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          This will soft-delete the device configuration, archive mapping relations, and keep audit
          references for compliance.
        </p>
        <ul className="mt-3 list-inside list-disc text-sm text-muted-foreground">
          <li>device configuration disabled</li>
          <li>sync schedules and mappings archived</li>
          <li>audit references remain archived</li>
        </ul>
        {blocked ? (
          <p className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            Stop or disconnect this device before deleting it.
          </p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={loading || blocked}
            onClick={onConfirm}
          >
            {loading ? 'Deleting...' : 'Delete Permanently'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DiagnosticPanel({
  device,
  result,
  loading,
  onRun,
  onClose,
}: {
  device: AttendanceDevice;
  result: DiagnosticResult | null;
  loading: boolean;
  onRun: (test: string) => void;
  onClose: () => void;
}) {
  const tests = [
    ['network', 'Test Network'],
    ['port', 'Test Port'],
    ['authentication', 'Test Authentication'],
    ['device-info', 'Test Device Info'],
    ['attendance-pull', 'Test Attendance Pull'],
    ['staff-upload', 'Test Staff Upload'],
    ['time-sync', 'Test Time Sync'],
    ['full', 'Run Full Suite'],
  ];
  return (
    <section className="rounded-3xl border border-primary/20 bg-card/95 p-4 shadow-2xl shadow-primary/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Diagnostic Console: {device.name}</h2>
          <p className="text-xs text-muted-foreground">
            {device.ipAddress ?? 'No IP'}:{device.port ?? '-'} · Last diagnostic{' '}
            {formatDateTime(device.lastDiagnosticAt)}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {tests.map(([key, label]) => (
          <Button
            key={key}
            type="button"
            variant={key === 'full' ? 'default' : 'outline'}
            size="sm"
            disabled={loading}
            onClick={() => onRun(key)}
          >
            {loading ? 'Running...' : label}
          </Button>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <DiagnosticMetric label="Registration" value={device.registrationStatus ?? 'CONFIGURED'} />
        <DiagnosticMetric
          label="Network"
          value={result?.networkStatus ?? device.networkStatus ?? 'UNKNOWN'}
        />
        <DiagnosticMetric
          label="Authentication"
          value={result?.authenticationStatus ?? device.authenticationStatus ?? 'NOT_TESTED'}
        />
        <DiagnosticMetric
          label="Sync Health"
          value={result?.syncHealthStatus ?? device.syncHealthStatus ?? 'NEVER_SYNCED'}
        />
      </div>
      <div className="mt-4 space-y-2">
        {(result?.steps ?? []).map((step) => (
          <div
            key={step.key}
            className="rounded-2xl border border-border/60 bg-background/70 p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">{step.label}</p>
              <StatusPill status={step.status} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{step.message}</p>
            {step.latencyMs ? (
              <p className="mt-1 text-[11px] text-muted-foreground">Latency: {step.latencyMs}ms</p>
            ) : null}
          </div>
        ))}
        {!result?.steps?.length ? (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            Run a diagnostic test to see network, port, authentication, device info, attendance
            pull, user upload, and time sync results.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function DiagnosticMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-2">
        <StatusPill status={value} />
      </div>
    </div>
  );
}

function PushPreviewPanel({
  device,
  result,
  deviceUsers,
  loading,
  onRefresh,
  onPush,
  onPullUsers,
  onClose,
}: {
  device: AttendanceDevice;
  result: PushUsersResult | null;
  deviceUsers: DevicePulledUser[];
  loading: boolean;
  onRefresh: () => void;
  onPush: () => void;
  onPullUsers: () => void;
  onClose: () => void;
}) {
  const rows = (result?.preview ?? []) as PushPreviewRow[];
  const hasErrors = rows.some((row) => row.missing?.length);
  return (
    <section className="rounded-3xl border border-primary/20 bg-card/95 p-4 shadow-2xl shadow-primary/10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Device Sync Preview: {device.name}</h2>
          <p className="text-xs text-muted-foreground">
            Staff Code stays ERP-only. Device upload uses Biometric ID as UserID, full name as
            device name, and RFID as card number.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={loading} onClick={onRefresh}>
            Refresh Preview
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={onPullUsers}
          >
            Pull From Device
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading || hasErrors || !rows.length}
            onClick={onPush}
          >
            Push To Device
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <DiagnosticMetric
          label="Ready To Push"
          value={String(rows.filter((row) => !row.missing?.length).length)}
        />
        <DiagnosticMetric
          label="Needs Attention"
          value={String(rows.filter((row) => row.missing?.length).length)}
        />
        <DiagnosticMetric
          label="Last Result"
          value={result?.failed ? 'PUSH_FAILED' : result?.successful ? 'PUSH_SUCCESS' : 'PREVIEW'}
        />
      </div>
      <div className="mt-4 overflow-auto rounded-2xl border border-border">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              {['ERP Staff', 'Device Payload', 'RFID/Card', 'Privilege', 'Status', 'Errors'].map(
                (head) => (
                  <th key={head} className="px-3 py-2">
                    {head}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.staffProfileId ?? index} className="border-t border-border align-top">
                <td className="px-3 py-2">
                  <p className="font-semibold">{row.employeeCode ?? '-'}</p>
                  <p>{row.fullName ?? '-'}</p>
                </td>
                <td className="px-3 py-2">
                  <p>UserID={row.deviceUserId ?? '-'}</p>
                  <p>Name={row.name ?? '-'}</p>
                </td>
                <td className="px-3 py-2">Card={row.cardNumber ?? '-'}</td>
                <td className="px-3 py-2">{row.privilege ?? '-'}</td>
                <td className="px-3 py-2">
                  <StatusPill status={row.status} />
                </td>
                <td className="px-3 py-2 text-destructive">{row.missing?.join(', ') || '-'}</td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td className="px-3 py-4 text-muted-foreground" colSpan={6}>
                  No staff rows in preview.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {deviceUsers.length ? (
        <div className="mt-4 overflow-auto rounded-2xl border border-border">
          <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold">
            Device Pull Verification
          </div>
          <table className="min-w-full text-left text-xs">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                {[
                  'Device UserID',
                  'Device Name',
                  'CardNo',
                  'Privilege',
                  'Template Count',
                  'Mapping Status',
                  'Matched ERP Staff',
                ].map((head) => (
                  <th key={head} className="px-3 py-2">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deviceUsers.map((user) => (
                <tr
                  key={`${user.deviceUserId}-${user.cardNumber ?? ''}`}
                  className="border-t border-border"
                >
                  <td className="px-3 py-2">{user.deviceUserId}</td>
                  <td className="px-3 py-2">{user.name ?? '-'}</td>
                  <td className="px-3 py-2">{user.cardNumber ?? '-'}</td>
                  <td className="px-3 py-2">{user.privilege ?? '-'}</td>
                  <td className="px-3 py-2">{user.templateCount ?? 0}</td>
                  <td className="px-3 py-2">
                    <StatusPill status={user.mappingStatus} />
                  </td>
                  <td className="px-3 py-2">
                    {user.matchedStaff
                      ? `${user.matchedStaff.employeeCode} · ${user.matchedStaff.fullName}`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

type DeviceFormState = {
  name: string;
  model: string;
  serialNumber: string;
  deviceCode: string;
  location: string;
  building: string;
  floor: string;
  departmentScope: string;
  description: string;
  connectionType: string;
  ipAddress: string;
  port: string;
  protocol: string;
  timeoutSec: string;
  retryCount: string;
  sslEnabled: boolean;
  devicePassword: string;
  deviceKey: string;
  machineNumber: string;
  communicationKey: string;
  firmwareVersion: string;
  timezone: string;
  heartbeatIntervalSec: string;
  autoSyncEnabled: boolean;
  syncFrequencyMin: string;
  syncDirection: string;
  punchMode: string;
  duplicatePunchThresholdMin: string;
  timeDriftToleranceSec: string;
  processingStrategy: string;
  webServiceUrl: string;
  webUsername: string;
  webPassword: string;
  companyShortName: string;
};

function defaultDeviceForm(): DeviceFormState {
  return {
    name: 'Main Gate Attendance',
    model: 'eSSL X2008',
    serialNumber: '',
    deviceCode: '',
    location: 'Admin Block',
    building: '',
    floor: '',
    departmentScope: '',
    description: '',
    connectionType: 'ETIMETRACKLITE_WEB',
    ipAddress: '192.168.1.105',
    port: '3366',
    protocol: 'WebAPIService.asmx',
    timeoutSec: '30',
    retryCount: '3',
    sslEnabled: false,
    devicePassword: '',
    deviceKey: '',
    machineNumber: '',
    communicationKey: '',
    firmwareVersion: '',
    timezone: 'Asia/Kolkata',
    heartbeatIntervalSec: '60',
    autoSyncEnabled: true,
    syncFrequencyMin: '15',
    syncDirection: 'DEVICE_TO_ERP',
    punchMode: 'IN_OUT',
    duplicatePunchThresholdMin: '5',
    timeDriftToleranceSec: '60',
    processingStrategy: 'FIRST_IN_LAST_OUT',
    webServiceUrl: '',
    webUsername: '',
    webPassword: '',
    companyShortName: '',
  };
}

function deviceToForm(device: AttendanceDevice): DeviceFormState {
  const settings =
    device.settings && typeof device.settings === 'object' && !Array.isArray(device.settings)
      ? (device.settings as Record<string, unknown>)
      : {};
  const etime =
    settings.etimeTrackLite &&
    typeof settings.etimeTrackLite === 'object' &&
    !Array.isArray(settings.etimeTrackLite)
      ? (settings.etimeTrackLite as Record<string, unknown>)
      : {};
  return {
    name: device.name ?? '',
    model: device.model ?? 'eSSL X2008',
    serialNumber: device.serialNumber ?? '',
    deviceCode: device.deviceCode ?? '',
    location: device.location ?? '',
    building: device.building ?? '',
    floor: device.floor ?? '',
    departmentScope: '',
    description: device.description ?? '',
    connectionType: device.connectionType ?? 'TCP_IP',
    ipAddress: device.ipAddress ?? '',
    port: String(device.port ?? 4370),
    protocol: device.protocol ?? 'TCP/IP',
    timeoutSec: String(device.timeoutSec ?? 30),
    retryCount: String(device.retryCount ?? 3),
    sslEnabled: Boolean(device.sslEnabled),
    devicePassword: device.devicePassword ?? '',
    deviceKey: device.deviceKey ?? '',
    machineNumber: device.machineNumber ?? '',
    communicationKey: device.communicationKey ?? '',
    firmwareVersion: device.firmwareVersion ?? '',
    timezone: device.timezone ?? 'Asia/Kolkata',
    heartbeatIntervalSec: String(device.heartbeatIntervalSec ?? 60),
    autoSyncEnabled: device.autoSyncEnabled ?? true,
    syncFrequencyMin: String(device.syncFrequencyMin ?? 15),
    syncDirection: device.syncDirection ?? 'DEVICE_TO_ERP',
    punchMode: device.punchMode ?? 'IN_OUT',
    duplicatePunchThresholdMin: String(device.duplicatePunchThresholdMin ?? 5),
    timeDriftToleranceSec: String(device.timeDriftToleranceSec ?? 60),
    processingStrategy: device.processingStrategy ?? 'FIRST_IN_LAST_OUT',
    webServiceUrl: String(etime.webServiceUrl ?? ''),
    webUsername: String(etime.username ?? ''),
    webPassword: String(etime.password ?? ''),
    companyShortName: String(etime.companyShortName ?? ''),
  };
}

function toDevicePayload(form: DeviceFormState) {
  return {
    ...form,
    deviceCode: form.deviceCode || undefined,
    departmentScope: form.departmentScope ? { scope: form.departmentScope } : undefined,
    port: Number(form.port || 4370),
    timeoutSec: Number(form.timeoutSec || 30),
    retryCount: Number(form.retryCount || 3),
    heartbeatIntervalSec: Number(form.heartbeatIntervalSec || 60),
    syncFrequencyMin: Number(form.syncFrequencyMin || 15),
    duplicatePunchThresholdMin: Number(form.duplicatePunchThresholdMin || 5),
    timeDriftToleranceSec: Number(form.timeDriftToleranceSec || 60),
    settings: {
      etimeTrackLite: {
        webServiceUrl: form.webServiceUrl || undefined,
        username: form.webUsername || undefined,
        password: form.webPassword || undefined,
        companyShortName: form.companyShortName || undefined,
      },
    },
  };
}

function DeviceMasterForm({
  form,
  setForm,
  onSubmit,
  loading,
}: {
  form: DeviceFormState;
  setForm: (value: DeviceFormState) => void;
  onSubmit: () => void;
  loading: boolean;
}) {
  const update = <K extends keyof DeviceFormState>(key: K, value: DeviceFormState[K]) =>
    setForm({ ...form, [key]: value });

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <DeviceFormSection title="Basic Information">
        <DeviceInput
          label="Device Name"
          value={form.name}
          onChange={(value) => update('name', value)}
          required
        />
        <DeviceSelect
          label="Device Model"
          value={form.model}
          onChange={(value) => update('model', value)}
          options={['eSSL X2008', 'eSSL MB20', 'ZKTeco F18', 'Generic TCP/IP Device', 'Other']}
        />
        <DeviceInput
          label="Device Serial Number"
          value={form.serialNumber}
          onChange={(value) => update('serialNumber', value)}
          required
        />
        <DeviceInput
          label="Device Code"
          value={form.deviceCode}
          onChange={(value) => update('deviceCode', value)}
          placeholder="Auto-generated if blank"
        />
        <DeviceInput
          label="Location"
          value={form.location}
          onChange={(value) => update('location', value)}
        />
        <DeviceInput
          label="Building"
          value={form.building}
          onChange={(value) => update('building', value)}
        />
        <DeviceInput
          label="Department Scope"
          value={form.departmentScope}
          onChange={(value) => update('departmentScope', value)}
          placeholder="Optional"
        />
        <DeviceInput
          label="Floor"
          value={form.floor}
          onChange={(value) => update('floor', value)}
        />
      </DeviceFormSection>

      <DeviceFormSection title="Network Configuration">
        <DeviceInput
          label="Device IP Address"
          value={form.ipAddress}
          onChange={(value) => update('ipAddress', value)}
          placeholder="192.168.1.105"
        />
        <DeviceInput label="Port" value={form.port} onChange={(value) => update('port', value)} />
        <DeviceInput
          label="Communication Password"
          value={form.devicePassword}
          onChange={(value) => update('devicePassword', value)}
          type="password"
        />
        <DeviceSelect
          label="Connection Mode"
          value={form.connectionType}
          onChange={(value) => update('connectionType', value)}
          options={['ETIMETRACKLITE_WEB', 'TCP_IP', 'MIDDLEWARE', 'SQL_SYNC', 'PUSH_API']}
        />
        <DeviceInput
          label="Protocol"
          value={form.protocol}
          onChange={(value) => update('protocol', value)}
        />
        <DeviceInput
          label="Timeout (seconds)"
          value={form.timeoutSec}
          onChange={(value) => update('timeoutSec', value)}
        />
        <DeviceInput
          label="Retry Count"
          value={form.retryCount}
          onChange={(value) => update('retryCount', value)}
        />
        <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs">
          <input
            type="checkbox"
            checked={form.sslEnabled}
            onChange={(event) => update('sslEnabled', event.target.checked)}
          />
          SSL Enabled
        </label>
      </DeviceFormSection>

      <DeviceFormSection title="eTimeTrackLite Web Integration">
        <DeviceInput
          label="WebAPIService.asmx URL"
          value={form.webServiceUrl}
          onChange={(value) => update('webServiceUrl', value)}
          placeholder="http://192.168.6.66:3366/WebAPIService.asmx"
        />
        <DeviceInput
          label="Login Name"
          value={form.webUsername}
          onChange={(value) => update('webUsername', value)}
          placeholder="eTimeTrackLite login"
        />
        <DeviceInput
          label="Login Password"
          value={form.webPassword}
          onChange={(value) => update('webPassword', value)}
          type="password"
        />
        <DeviceInput
          label="Company Short Name"
          value={form.companyShortName}
          onChange={(value) => update('companyShortName', value)}
          placeholder="Required for AddEmployeeByCompanyShortName"
        />
      </DeviceFormSection>

      <DeviceFormSection title="eSSL Specific Configuration">
        <DeviceInput
          label="Device Key"
          value={form.deviceKey}
          onChange={(value) => update('deviceKey', value)}
        />
        <DeviceInput
          label="Machine Number"
          value={form.machineNumber}
          onChange={(value) => update('machineNumber', value)}
        />
        <DeviceInput
          label="Communication Key"
          value={form.communicationKey}
          onChange={(value) => update('communicationKey', value)}
        />
        <DeviceInput
          label="Firmware Version"
          value={form.firmwareVersion}
          onChange={(value) => update('firmwareVersion', value)}
        />
        <DeviceInput
          label="Timezone"
          value={form.timezone}
          onChange={(value) => update('timezone', value)}
        />
        <DeviceInput
          label="Heartbeat Interval"
          value={form.heartbeatIntervalSec}
          onChange={(value) => update('heartbeatIntervalSec', value)}
        />
      </DeviceFormSection>

      <DeviceFormSection title="Sync Configuration">
        <label className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs">
          <input
            type="checkbox"
            checked={form.autoSyncEnabled}
            onChange={(event) => update('autoSyncEnabled', event.target.checked)}
          />
          Auto Sync Enabled
        </label>
        <DeviceSelect
          label="Sync Frequency"
          value={form.syncFrequencyMin}
          onChange={(value) => update('syncFrequencyMin', value)}
          options={['5', '15', '60', '0']}
        />
        <DeviceSelect
          label="Sync Direction"
          value={form.syncDirection}
          onChange={(value) => update('syncDirection', value)}
          options={['DEVICE_TO_ERP', 'ERP_TO_DEVICE', 'BIDIRECTIONAL']}
        />
      </DeviceFormSection>

      <DeviceFormSection title="Attendance Configuration">
        <DeviceSelect
          label="Punch Mode"
          value={form.punchMode}
          onChange={(value) => update('punchMode', value)}
          options={['IN_OUT', 'AUTO', 'IN_ONLY', 'OUT_ONLY']}
        />
        <DeviceInput
          label="Duplicate Punch Threshold"
          value={form.duplicatePunchThresholdMin}
          onChange={(value) => update('duplicatePunchThresholdMin', value)}
        />
        <DeviceInput
          label="Time Drift Tolerance"
          value={form.timeDriftToleranceSec}
          onChange={(value) => update('timeDriftToleranceSec', value)}
        />
        <DeviceSelect
          label="Processing Strategy"
          value={form.processingStrategy}
          onChange={(value) => update('processingStrategy', value)}
          options={['FIRST_IN_LAST_OUT', 'STRICT_IN_OUT', 'MULTI_PUNCH']}
        />
      </DeviceFormSection>

      <label className="block text-xs font-medium">
        Device Description
        <textarea
          className="mt-1 min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          value={form.description}
          onChange={(event) => update('description', event.target.value)}
        />
      </label>

      <BulkActionButton
        type="submit"
        className="w-full"
        loading={loading}
        disabled={!form.name || !form.serialNumber}
      >
        Save Device Master
      </BulkActionButton>
    </form>
  );
}

function DeviceFormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details
      className="rounded-2xl border border-border/60 bg-background/70 p-3"
      open={title === 'Basic Information' || title === 'Network Configuration'}
    >
      <summary className="mb-3 cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </summary>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </details>
  );
}

function DeviceInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-medium">
      {label}
      <input
        type={type}
        required={required}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function DeviceSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block text-xs font-medium">
      {label}
      <select
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === '0' ? 'Manual only' : option}
          </option>
        ))}
      </select>
    </label>
  );
}

function HealthCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone?: 'success' | 'warning' | 'error';
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
      <div
        className={cn(
          'mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary',
          tone === 'success' && 'bg-emerald-500/10 text-emerald-600',
          tone === 'warning' && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
          tone === 'error' && 'bg-destructive/10 text-destructive',
        )}
      >
        {icon}
      </div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function DeviceInspector() {
  const [deviceId, setDeviceId] = useState('');
  const [search, setSearch] = useState('');
  const [diagnostic, setDiagnostic] = useState<DiagnosticResult | null>(null);
  const [deviceUsers, setDeviceUsers] = useState<DevicePulledUser[]>([]);
  const devices = useQuery({
    queryKey: ['staff-attendance', 'devices'],
    queryFn: fetchBiometricDevices,
  });
  const mappings = useQuery({
    queryKey: ['staff-attendance', 'mappings'],
    queryFn: fetchBiometricMappings,
  });
  const selectedDevice =
    (devices.data ?? []).find((device) => device.id === deviceId) ?? devices.data?.[0];
  const effectiveDeviceId = selectedDevice?.id ?? '';
  const testMut = useMutation({
    mutationFn: (id: string) => testBiometricDevice(id),
    onSuccess: (result: DiagnosticResult) => setDiagnostic(result),
  });
  const usersMut = useMutation({
    mutationFn: (id: string) => fetchDeviceUsers(id),
    onSuccess: (rows: DevicePulledUser[]) => setDeviceUsers(rows),
  });
  const filteredUsers = deviceUsers.filter((user) => {
    const needle = search.trim().toUpperCase();
    if (!needle) return true;
    return [
      user.deviceUserId,
      user.name,
      user.cardNumber,
      user.matchedStaff?.fullName,
      user.matchedStaff?.employeeCode,
    ]
      .filter(Boolean)
      .some((value) => String(value).toUpperCase().includes(needle));
  });
  const mappingByDeviceUser = new Map(
    (mappings.data ?? []).map((mapping) => [String(mapping.deviceUserId), mapping]),
  );

  return (
    <section className="space-y-4 rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Device Inspector</h2>
          <p className="text-xs text-muted-foreground">
            Test eSSL connectivity, list device users, search by biometric/device ID/name, and
            compare ERP vs device records.
          </p>
        </div>
        <label className="block text-xs font-medium">
          Device
          <select
            className="mt-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
            value={effectiveDeviceId}
            onChange={(event) => setDeviceId(event.target.value)}
          >
            {(devices.data ?? []).map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedDevice ? (
        <>
          <div className="grid gap-3 md:grid-cols-5">
            <DiagnosticMetric label="IP" value={selectedDevice.ipAddress ?? 'NOT_CONFIGURED'} />
            <DiagnosticMetric label="Port" value={String(selectedDevice.port ?? 4370)} />
            <DiagnosticMetric label="Network" value={selectedDevice.networkStatus ?? 'UNKNOWN'} />
            <DiagnosticMetric
              label="Auth"
              value={selectedDevice.authenticationStatus ?? 'NOT_TESTED'}
            />
            <DiagnosticMetric label="Users" value={String(selectedDevice.userCount ?? 0)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={testMut.isPending}
              onClick={() => testMut.mutate(selectedDevice.id)}
            >
              TEST DEVICE
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={usersMut.isPending || !isDeviceAuthenticated(selectedDevice)}
              onClick={() => usersMut.mutate(selectedDevice.id)}
            >
              LOAD DEVICE USERS
            </Button>
            <input
              className="min-w-72 rounded-xl border border-border bg-background px-3 py-2 text-sm"
              placeholder="Search DeviceUserID, BiometricID, Name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {testMut.error || usersMut.error ? (
            <p className="text-sm text-destructive">
              {apiErrorMessage(testMut.error || usersMut.error, 'Device inspector action failed')}
            </p>
          ) : null}
          {diagnostic ? (
            <div className="grid gap-2 md:grid-cols-2">
              {(diagnostic.steps ?? []).map((step) => (
                <div
                  key={step.key}
                  className="rounded-2xl border border-border/60 bg-background/70 p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{step.label}</p>
                    <StatusPill status={step.status} />
                  </div>
                  <p className="mt-1 text-muted-foreground">{step.message}</p>
                </div>
              ))}
            </div>
          ) : null}
          <div className="overflow-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left">
                <tr>
                  {[
                    'ERP Staff',
                    'ERP Biometric ID',
                    'Device UserID',
                    'Device Name',
                    'CardNo',
                    'Fingerprints',
                    'Status',
                  ].map((heading) => (
                    <th key={heading} className="px-3 py-2">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const mapping = mappingByDeviceUser.get(String(user.deviceUserId));
                  return (
                    <tr key={user.deviceUserId} className="border-t border-border">
                      <td className="px-3 py-2">
                        {user.matchedStaff?.fullName ?? mapping?.staff?.fullName ?? '-'}
                      </td>
                      <td className="px-3 py-2">
                        {user.matchedStaff?.biometricId ?? mapping?.biometricId ?? '-'}
                      </td>
                      <td className="px-3 py-2">{user.deviceUserId}</td>
                      <td className="px-3 py-2">{user.name ?? '-'}</td>
                      <td className="px-3 py-2">{user.cardNumber ?? '-'}</td>
                      <td className="px-3 py-2">{user.templateCount ?? 0}</td>
                      <td className="px-3 py-2">
                        <StatusPill status={user.mappingStatus} />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {user.diagnosticReason ?? 'Loaded from device'}
                        </p>
                      </td>
                    </tr>
                  );
                })}
                {!filteredUsers.length ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                      Load device users to inspect ERP vs device mapping.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">No biometric device configured.</p>
      )}
    </section>
  );
}

function MappingConsole() {
  const qc = useQueryClient();
  const [message, setMessage] = useState('');
  const mappings = useQuery({
    queryKey: ['staff-attendance', 'mappings'],
    queryFn: fetchBiometricMappings,
  });
  const devices = useQuery({
    queryKey: ['staff-attendance', 'devices'],
    queryFn: fetchBiometricDevices,
  });
  const defaultDeviceId = devices.data?.[0]?.id;
  const autoMut = useMutation({
    mutationFn: () =>
      autoMapBiometricStaff(defaultDeviceId ? { deviceId: defaultDeviceId } : undefined),
    onSuccess: (result: {
      created?: number;
      updated?: number;
      conflicts?: number;
      scannedDeviceUsers?: number;
    }) => {
      setMessage(
        `Auto map completed: ${result.created ?? 0} created, ${result.updated ?? 0} updated, ${result.conflicts ?? 0} conflicts, ${result.scannedDeviceUsers ?? 0} device users scanned.`,
      );
      void qc.invalidateQueries({ queryKey: ['staff-attendance'] });
    },
  });
  const pushMut = useMutation({
    mutationFn: ({ deviceId, staffProfileId }: { deviceId: string; staffProfileId: string }) =>
      pushBiometricUsers(deviceId, { staffProfileIds: [staffProfileId] }),
    onSuccess: (result: PushUsersResult) => {
      setMessage(
        result.failed
          ? `Push failed: ${result.errors.join('; ') || 'Device rejected user.'}`
          : 'Push successful. Device user verified and mapping updated.',
      );
      void qc.invalidateQueries({ queryKey: ['staff-attendance'] });
    },
  });
  const pullMut = useMutation({
    mutationFn: (deviceId: string) => fetchDeviceUsers(deviceId),
    onSuccess: (rows: DevicePulledUser[]) => {
      setMessage(`Pulled ${rows.length} users from device and refreshed ERP mappings.`);
      void qc.invalidateQueries({ queryKey: ['staff-attendance'] });
    },
  });
  const manualMut = useMutation({
    mutationFn: (row: AttendanceMapping) => {
      const deviceId = row.deviceId ?? defaultDeviceId;
      if (!deviceId)
        throw new Error(
          'No biometric device configured. Add/select a device before manual mapping.',
        );
      if (!row.staffProfileId) throw new Error('Mapping row is missing staff profile ID.');
      return upsertBiometricMapping({
        staffProfileId: row.staffProfileId,
        deviceId,
        biometricId: row.staff?.biometricId ?? row.biometricId,
        deviceUserId: row.deviceUserId || row.staff?.biometricId || row.biometricId,
      });
    },
    onSuccess: () => {
      setMessage('Manual mapping saved. Device relation and status refreshed.');
      void qc.invalidateQueries({ queryKey: ['staff-attendance'] });
    },
  });
  const actionError = autoMut.error || pushMut.error || pullMut.error || manualMut.error;
  return (
    <section className="space-y-3 rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Staff Biometric Mapping Center</h2>
          <p className="text-xs text-muted-foreground">
            Auto map by Device UserID/Biometric ID, RFID/CardNo, normalized name, then Staff Code
            fallback.
          </p>
        </div>
        <BulkActionButton
          type="button"
          size="sm"
          loading={autoMut.isPending}
          icon={<Fingerprint className="h-4 w-4" />}
          onClick={() => autoMut.mutate()}
        >
          Auto Map Staff
        </BulkActionButton>
      </div>
      {message ? (
        <p className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          {message}
        </p>
      ) : null}
      {actionError ? (
        <p className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {apiErrorMessage(actionError, 'Mapping action failed')}
        </p>
      ) : null}
      <MappingTable
        rows={mappings.data ?? []}
        loading={mappings.isLoading}
        defaultDeviceId={defaultDeviceId}
        actionLoading={pushMut.isPending || pullMut.isPending || manualMut.isPending}
        onManual={(row) => manualMut.mutate(row)}
        onPush={(row) => {
          const deviceId = row.deviceId ?? defaultDeviceId;
          if (!deviceId || !row.staffProfileId) {
            setMessage('Cannot push: mapping row is missing device or staff profile reference.');
            return;
          }
          pushMut.mutate({ deviceId, staffProfileId: row.staffProfileId });
        }}
        onPull={(row) => {
          const deviceId = row.deviceId ?? defaultDeviceId;
          if (!deviceId) {
            setMessage('Cannot pull: no biometric device configured for this mapping.');
            return;
          }
          pullMut.mutate(deviceId);
        }}
      />
    </section>
  );
}

function MappingTable({
  rows,
  loading,
  defaultDeviceId,
  actionLoading,
  onManual,
  onPush,
  onPull,
}: {
  rows: AttendanceMapping[];
  loading: boolean;
  defaultDeviceId?: string;
  actionLoading: boolean;
  onManual: (row: AttendanceMapping) => void;
  onPush: (row: AttendanceMapping) => void;
  onPull: (row: AttendanceMapping) => void;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading mappings...</p>;
  return (
    <div className="overflow-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>
            {[
              'Staff Code',
              'Staff Name',
              'Biometric ID',
              'Device User ID',
              'Device Name',
              'Mapping Status',
              'Actions',
            ].map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-3 py-2 font-mono text-xs">{row.staff?.employeeCode ?? '-'}</td>
              <td className="px-3 py-2 font-medium">
                <p>{row.staff?.fullName ?? '-'}</p>
                <p className="text-xs text-muted-foreground">
                  {row.staff?.department?.name ?? '-'}
                </p>
              </td>
              <td className="px-3 py-2">{row.staff?.biometricId ?? row.biometricId}</td>
              <td className="px-3 py-2">{row.deviceUserId}</td>
              <td className="px-3 py-2">
                {row.device?.name ??
                  (row.deviceId || defaultDeviceId ? 'Device pending refresh' : '-')}
              </td>
              <td className="px-3 py-2">
                <StatusPill status={row.syncStatus} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.enrollmentStatus} · Last punch {formatDateTime(row.lastPunchAt)}
                </p>
                {row.conflictReason ? (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    {row.conflictReason}
                  </p>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={actionLoading}
                    onClick={() => onManual(row)}
                  >
                    Manual Map
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={actionLoading}
                    onClick={() => onManual(row)}
                  >
                    Resolve Conflict
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={actionLoading}
                    onClick={() => onPush(row)}
                  >
                    Push To Device
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={actionLoading}
                    onClick={() => onPull(row)}
                  >
                    Pull From Device
                  </Button>
                </div>
              </td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                No mappings yet. Use Auto Map Staff to seed mappings from staff biometric IDs.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function LiveAttendanceWall() {
  const punches = useQuery({
    queryKey: ['staff-attendance', 'live'],
    queryFn: fetchLiveAttendance,
    refetchInterval: 15000,
  });
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Incoming Punch Stream</h2>
        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          Auto refresh 15s
        </span>
      </div>
      <PunchTable rows={punches.data ?? []} loading={punches.isLoading} />
    </section>
  );
}

function PunchTable({ rows, loading }: { rows: RawPunch[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading live punches...</p>;
  return (
    <div className="overflow-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>
            {['Staff', 'Department', 'Punch Time', 'Device', 'Type', 'Status', 'Shift'].map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium">
                {row.staff?.fullName ?? `Unknown ${row.deviceUserId}`}
              </td>
              <td className="px-3 py-2">{row.staff?.department?.name ?? '-'}</td>
              <td className="px-3 py-2">{formatDateTime(row.punchTimestamp)}</td>
              <td className="px-3 py-2">{row.device?.name ?? '-'}</td>
              <td className="px-3 py-2">
                <StatusPill status={row.punchDirection ?? 'IN'} />
              </td>
              <td className="px-3 py-2">{row.processingStatus}</td>
              <td className="px-3 py-2">Assigned shift</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyRegister() {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [status, setStatus] = useState('ALL');
  const records = useQuery({
    queryKey: ['staff-attendance', 'daily', from, to, status],
    queryFn: () =>
      fetchDailyAttendance({ from, to, status: status === 'ALL' ? undefined : status }),
  });
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Daily Attendance Register</h2>
          <p className="text-xs text-muted-foreground">
            Staff, employee code, department, shift, IN, OUT, worked hours, late, OT, status,
            corrections.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="date"
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <input
            type="date"
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
          <select
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {[
              'ALL',
              'PRESENT',
              'HALF_DAY',
              'ABSENT',
              'ON_LEAVE',
              'WEEKLY_OFF',
              'HOLIDAY',
              'PENDING_REVIEW',
            ].map((item) => (
              <option key={item} value={item}>
                {item.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
            Print / PDF
          </Button>
        </div>
      </div>
      <DailyTable rows={records.data ?? []} loading={records.isLoading} />
    </section>
  );
}

function DailyTable({ rows, loading }: { rows: DailyAttendanceRecord[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-muted-foreground">Loading register...</p>;
  return (
    <div className="overflow-auto rounded-2xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-left">
          <tr>
            {[
              'Staff',
              'Code',
              'Department',
              'Shift',
              'IN',
              'OUT',
              'Worked',
              'Late',
              'OT',
              'Status',
              'Remarks',
            ].map((h) => (
              <th key={h} className="px-3 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{row.staff?.fullName ?? '-'}</td>
              <td className="px-3 py-2 font-mono text-xs">{row.staff?.employeeCode ?? '-'}</td>
              <td className="px-3 py-2">{row.staff?.department?.name ?? '-'}</td>
              <td className="px-3 py-2">{row.staff?.primaryShift?.name ?? '-'}</td>
              <td className="px-3 py-2">{timeOnly(row.firstInAt)}</td>
              <td className="px-3 py-2">{timeOnly(row.lastOutAt)}</td>
              <td className="px-3 py-2">{minutes(row.workedMinutes)}</td>
              <td className="px-3 py-2">{row.lateMinutes}</td>
              <td className="px-3 py-2">{row.overtimeMinutes}</td>
              <td className="px-3 py-2">
                <StatusPill status={row.status} />
              </td>
              <td className="px-3 py-2">{row.remarks ?? '-'}</td>
            </tr>
          ))}
          {!rows.length ? (
            <tr>
              <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                No processed attendance records for this date.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function SyncCenter() {
  const batches = useQuery({
    queryKey: ['staff-attendance', 'sync-batches'],
    queryFn: fetchSyncBatches,
  });
  return (
    <GenericRows title="Device Sync Center" rows={batches.data ?? []} loading={batches.isLoading} />
  );
}

function MonthlyAttendanceView() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const monthly = useQuery({
    queryKey: ['staff-attendance', 'monthly', month],
    queryFn: () => fetchMonthlyAttendance({ month }),
  });
  const data = monthly.data;
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Monthly Attendance Summary</h2>
          <p className="text-xs text-muted-foreground">
            Payroll-ready present, absent, leave, late, OT and work-hour summary.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="month"
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
            Print / PDF
          </Button>
        </div>
      </div>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <PolicyMetric label="Present" value={String(data?.totals?.present ?? 0)} />
        <PolicyMetric label="Absent" value={String(data?.totals?.absent ?? 0)} />
        <PolicyMetric label="Leave" value={String(data?.totals?.leave ?? 0)} />
        <PolicyMetric label="OT Minutes" value={String(data?.totals?.overtimeMinutes ?? 0)} />
      </div>
      {monthly.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading monthly sheet...</p>
      ) : (
        <div className="overflow-auto rounded-2xl border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/60 text-left">
              <tr>
                {[
                  'Staff',
                  'Present',
                  'Absent',
                  'Leave',
                  'Late',
                  'Half Day',
                  'OT',
                  'Work Hours',
                ].map((h) => (
                  <th key={h} className="px-3 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data?.staff ?? []).map((row) => (
                <tr key={row.staffProfileId} className="border-t border-border">
                  <td className="px-3 py-2">
                    <p className="font-semibold">{row.staff?.fullName ?? row.staffProfileId}</p>
                    <p className="text-muted-foreground">{row.staff?.employeeCode ?? '-'}</p>
                  </td>
                  <td className="px-3 py-2">{row.present}</td>
                  <td className="px-3 py-2">{row.absent}</td>
                  <td className="px-3 py-2">{row.leave}</td>
                  <td className="px-3 py-2">{row.late}</td>
                  <td className="px-3 py-2">{row.halfDay}</td>
                  <td className="px-3 py-2">{minutes(row.overtimeMinutes)}</td>
                  <td className="px-3 py-2">{minutes(row.workedMinutes)}</td>
                </tr>
              ))}
              {!data?.staff?.length ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    No monthly attendance records generated.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RulesAndSettings({ kind }: { kind: PageKind }) {
  const rules = useQuery({
    queryKey: ['staff-attendance', 'rules'],
    queryFn: fetchAttendanceRules,
  });
  const settings = useQuery({
    queryKey: ['staff-attendance', 'settings'],
    queryFn: fetchAttendanceSettings,
  });
  const qc = useQueryClient();
  const [shiftForm, setShiftForm] = useState({
    name: 'Day Shift',
    shortCode: 'DAY',
    beginTime: '09:00',
    endTime: '17:00',
    lateGraceMin: '10',
    halfDayAfter: '11:00',
    absentAfter: '13:00',
    saturdayEndTime: '13:00',
    fullDayMinutes: '420',
    halfDayMinutes: '240',
  });
  const [reprocessForm, setReprocessForm] = useState({
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  const seedMut = useMutation({
    mutationFn: seedAttendanceSettingsDefaults,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff-attendance', 'settings'] }),
  });
  const saveMasterMut = useMutation({
    mutationFn: () =>
      updateAttendanceMasterSettings({
        timezone: 'Asia/Kolkata',
        timeFormat: '24H',
        deviceIdentityStrategy: 'BIOMETRIC_ID',
        duplicateSuppressionMin: 5,
        minPunchDifferenceMin: 5,
        noShiftAssignedHandling: 'MARK_PENDING_REVIEW',
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff-attendance', 'settings'] }),
  });
  const reprocessMut = useMutation({
    mutationFn: () =>
      reprocessStaffAttendance({ mode: 'MANUAL', from: reprocessForm.from, to: reprocessForm.to }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff-attendance', 'settings'] }),
  });
  const createShiftMut = useMutation({
    mutationFn: () =>
      createAttendanceSettingsRecord('shift-rules', {
        name: shiftForm.name,
        shortCode: shiftForm.shortCode,
        beginTime: shiftForm.beginTime,
        endTime: shiftForm.endTime,
        lateGraceMin: Number(shiftForm.lateGraceMin || 0),
        earlyExitGraceMin: 0,
        fullDayMinutes: Number(shiftForm.fullDayMinutes || 420),
        halfDayMinutes: Number(shiftForm.halfDayMinutes || 240),
        minWorkMinutes: Number(shiftForm.halfDayMinutes || 240),
        saturdayHalfDay: true,
        saturdayHalfDayEndTime: shiftForm.saturdayEndTime,
        settings: {
          halfDayAfter: shiftForm.halfDayAfter,
          absentAfter: shiftForm.absentAfter,
          weeklySchedule: {
            MONDAY: {
              workingDay: true,
              beginTime: shiftForm.beginTime,
              endTime: shiftForm.endTime,
            },
            TUESDAY: {
              workingDay: true,
              beginTime: shiftForm.beginTime,
              endTime: shiftForm.endTime,
            },
            WEDNESDAY: {
              workingDay: true,
              beginTime: shiftForm.beginTime,
              endTime: shiftForm.endTime,
            },
            THURSDAY: {
              workingDay: true,
              beginTime: shiftForm.beginTime,
              endTime: shiftForm.endTime,
            },
            FRIDAY: {
              workingDay: true,
              beginTime: shiftForm.beginTime,
              endTime: shiftForm.endTime,
            },
            SATURDAY: {
              workingDay: true,
              beginTime: shiftForm.beginTime,
              endTime: shiftForm.saturdayEndTime,
              fullDayMinutes: Number(shiftForm.halfDayMinutes || 240),
              halfDayMinutes: 120,
            },
            SUNDAY: { workingDay: false, status: 'WEEKLY_OFF' },
          },
        },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff-attendance', 'settings'] }),
  });

  if (kind === 'settings' || kind === 'shift-rules') {
    const data = settings.data;
    const master = data?.master ?? {};
    const sections = [
      [
        'Attendance Master Settings',
        'Year, timezone, time format, weekends, punch windows, no-shift handling, identity strategy, retention.',
        data?.master ? 1 : 0,
      ],
      [
        'Shift Rules',
        'Flexible/fixed shifts, cross-midnight, unlimited breaks, grace, half-day, OT, night shift.',
        data?.counts?.shiftRules ?? 0,
      ],
      [
        'Shift Groups',
        'Teaching, Admin, Security, Guest Faculty and default policy bundles.',
        data?.counts?.shiftGroups ?? 0,
      ],
      [
        'Shift Calendar',
        'Daily/monthly/semester planner for rotational, campus and department shifts.',
        data?.holidays?.length ?? 0,
      ],
      [
        'Shift Assignment',
        'Staff > Department > Category > Default priority based assignment engine.',
        data?.processingRuns?.length ?? 0,
      ],
      [
        'Leave Types',
        'CL, SL, EL, OD, LOP, attachment rules and approval flow foundations.',
        data?.counts?.leaveTypes ?? 0,
      ],
      [
        'Employee Categories',
        'Teaching, Non-Teaching, Guest, Contract, Security, Administration policy defaults.',
        data?.counts?.employeeCategories ?? 0,
      ],
      [
        'Public Holidays',
        'National, state, institution, campus and department scoped holidays.',
        data?.counts?.holidays ?? 0,
      ],
      [
        'Department Rules',
        'Department-specific fixed/flexible/rotational processing behavior.',
        data?.counts?.departmentRules ?? 0,
      ],
      [
        'OT Rules',
        'Eligibility, thresholds, holiday/weekend multipliers and approval requirements.',
        data?.counts?.otRules ?? 0,
      ],
      [
        'Biometric Devices',
        'Infrastructure-only device master, diagnostics, sync health and status engine.',
        data?.counts?.devices ?? 0,
      ],
      [
        'Device Sync Center',
        'Pull logs, push users, retries, queue history and conflict resolution.',
        data?.processingRuns?.length ?? 0,
      ],
    ];
    return (
      <div className="space-y-5">
        <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Attendance Policy Configuration Workspace</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Modern ERP settings hub inspired by eSSL business rules, separated from biometric
                device infrastructure.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={seedMut.isPending}
                onClick={() => seedMut.mutate()}
              >
                Seed Defaults
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={saveMasterMut.isPending}
                onClick={() => saveMasterMut.mutate()}
              >
                Save Master Defaults
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={reprocessMut.isPending}
                onClick={() => reprocessMut.mutate()}
              >
                Recalculate Attendance
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <PolicyMetric
              label="Identity Strategy"
              value={String(master.deviceIdentityStrategy ?? 'BIOMETRIC_ID')}
            />
            <PolicyMetric
              label="Duplicate Suppression"
              value={`${master.duplicateSuppressionMin ?? 5} min`}
            />
            <PolicyMetric
              label="No Shift Handling"
              value={String(master.noShiftAssignedHandling ?? 'PENDING_REVIEW')}
            />
            <PolicyMetric label="Timezone" value={String(master.timezone ?? 'Asia/Kolkata')} />
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sections.map(([title, description, count]) => (
            <div
              key={String(title)}
              className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
                <StatusPill status={Number(count) ? 'CONFIGURED' : 'READY'} />
              </div>
              <p className="mt-4 text-2xl font-semibold">{Number(count).toLocaleString()}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 xl:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Shift Master Quick Setup</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create a day-wise enterprise shift with Saturday half-day and late/half-day
                  thresholds.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                disabled={createShiftMut.isPending}
                onClick={() => createShiftMut.mutate()}
              >
                Save Shift Master
              </Button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-5">
              <DeviceInput
                label="Shift Name"
                value={shiftForm.name}
                onChange={(value) => setShiftForm({ ...shiftForm, name: value })}
              />
              <DeviceInput
                label="Short Code"
                value={shiftForm.shortCode}
                onChange={(value) => setShiftForm({ ...shiftForm, shortCode: value })}
              />
              <DeviceInput
                label="Begin Time"
                value={shiftForm.beginTime}
                onChange={(value) => setShiftForm({ ...shiftForm, beginTime: value })}
              />
              <DeviceInput
                label="End Time"
                value={shiftForm.endTime}
                onChange={(value) => setShiftForm({ ...shiftForm, endTime: value })}
              />
              <DeviceInput
                label="Saturday End"
                value={shiftForm.saturdayEndTime}
                onChange={(value) => setShiftForm({ ...shiftForm, saturdayEndTime: value })}
              />
              <DeviceInput
                label="Grace Minutes"
                value={shiftForm.lateGraceMin}
                onChange={(value) => setShiftForm({ ...shiftForm, lateGraceMin: value })}
              />
              <DeviceInput
                label="Half Day After"
                value={shiftForm.halfDayAfter}
                onChange={(value) => setShiftForm({ ...shiftForm, halfDayAfter: value })}
              />
              <DeviceInput
                label="Absent After"
                value={shiftForm.absentAfter}
                onChange={(value) => setShiftForm({ ...shiftForm, absentAfter: value })}
              />
              <DeviceInput
                label="Full Day Minutes"
                value={shiftForm.fullDayMinutes}
                onChange={(value) => setShiftForm({ ...shiftForm, fullDayMinutes: value })}
              />
              <DeviceInput
                label="Half Day Minutes"
                value={shiftForm.halfDayMinutes}
                onChange={(value) => setShiftForm({ ...shiftForm, halfDayMinutes: value })}
              />
            </div>
          </section>
          <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 xl:col-span-2">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Reprocess Attendance</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Rebuild final attendance after shift, holiday, leave, or device mapping changes.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="date"
                  className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
                  value={reprocessForm.from}
                  onChange={(event) =>
                    setReprocessForm({ ...reprocessForm, from: event.target.value })
                  }
                />
                <input
                  type="date"
                  className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
                  value={reprocessForm.to}
                  onChange={(event) =>
                    setReprocessForm({ ...reprocessForm, to: event.target.value })
                  }
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={reprocessMut.isPending}
                  onClick={() => reprocessMut.mutate()}
                >
                  Run Reprocess
                </Button>
              </div>
            </div>
          </section>
          <SettingsList
            title="Shift Rules"
            rows={data?.shiftRules ?? []}
            empty="No shift rules configured."
          />
          <SettingsList
            title="Leave Types"
            rows={data?.leaveTypes ?? []}
            empty="No leave types configured."
          />
          <SettingsList
            title="Employee Categories"
            rows={data?.employeeCategories ?? []}
            empty="No categories configured."
          />
          <SettingsList
            title="Processing Runs"
            rows={data?.processingRuns ?? []}
            empty="No processing runs yet."
          />
        </section>
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
      <h2 className="text-sm font-semibold">{titles[kind].title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{titles[kind].subtitle}</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[
          'Duplicate punch tolerance',
          'Grace late / early',
          'Minimum work hours',
          'Half day rule',
          'Overtime rule',
          'Auto processing schedule',
        ].map((rule) => (
          <div key={rule} className="rounded-2xl border border-border/60 bg-background/70 p-4">
            <p className="text-sm font-semibold">{rule}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Configured in rules API foundation. Existing records:{' '}
              {rules.data?.attendanceRules?.length ?? 0}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PolicyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value.replaceAll('_', ' ')}</p>
    </div>
  );
}

function SettingsList({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: SettingsRow[];
  empty: string;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {rows.length}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.slice(0, 8).map((row, index) => (
          <div key={row.id ?? index} className="rounded-2xl bg-muted/35 p-3 text-xs">
            <p className="font-semibold">
              {row.name ?? row.code ?? row.mode ?? row.status ?? row.id}
            </p>
            <p className="mt-1 text-muted-foreground">
              {row.shortCode ?? row.code ?? row.scopeType ?? row.status ?? 'Configured'} ·{' '}
              {formatDateTime(row.updatedAt ?? row.createdAt)}
            </p>
          </div>
        ))}
        {!rows.length ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
      </div>
    </section>
  );
}

function CorrectionsConsole() {
  const corrections = useQuery({
    queryKey: ['staff-attendance', 'corrections'],
    queryFn: fetchAttendanceCorrections,
  });
  return (
    <GenericRows
      title="Attendance Correction Workflow"
      rows={corrections.data ?? []}
      loading={corrections.isLoading}
    />
  );
}

function ReportsAndFoundations({ kind }: { kind: PageKind }) {
  const [reportType, setReportType] = useState(
    kind === 'reports' ? 'daily' : kind === 'late' ? 'late' : kind,
  );
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const qc = useQueryClient();
  const report = useQuery({
    queryKey: ['staff-attendance', 'report', reportType, from, to],
    queryFn: () => fetchAttendanceReport(reportType, { from, to }),
  });
  const processMut = useMutation({
    mutationFn: processPendingAttendance,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['staff-attendance'] }),
  });
  const reportData = (report.data ?? {}) as ReportShape;
  const reportRows = Array.isArray(reportData.rows)
    ? reportData.rows
    : Array.isArray(reportData.staff)
      ? reportData.staff
      : [];
  const summary = reportData.summary ?? reportData.totals ?? {};
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{reportData.title ?? titles[kind].title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{titles[kind].subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
            value={reportType}
            onChange={(event) => setReportType(event.target.value)}
          >
            {[
              ['daily', 'Daily Attendance'],
              ['monthly', 'Monthly Attendance'],
              ['late', 'Late Report'],
              ['early-exit', 'Early Exit'],
              ['overtime', 'OT Report'],
              ['missing-punch', 'Missing Punch'],
              ['shift-wise', 'Shift-wise'],
              ['department-wise', 'Department-wise'],
              ['raw-punches', 'Raw Punches'],
              ['device-health', 'Device Health'],
              ['sync-failures', 'Sync Failures'],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
          <input
            type="date"
            className="rounded-xl border border-border bg-background px-3 py-2 text-xs"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            disabled={processMut.isPending}
            onClick={() => processMut.mutate()}
          >
            Process Pending Punches
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => window.print()}>
            PDF / Print
          </Button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {Object.entries(summary)
          .slice(0, 8)
          .map(([key, value]) => (
            <PolicyMetric
              key={key}
              label={key.replace(/([A-Z])/g, ' $1')}
              value={String(value ?? 0)}
            />
          ))}
      </div>
      <div className="mt-4 overflow-auto rounded-2xl border border-border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60 text-left">
            <tr>
              {['Staff / Record', 'Date', 'IN', 'OUT', 'Worked', 'Late', 'OT', 'Status'].map(
                (h) => (
                  <th key={h} className="px-3 py-2">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {reportRows.slice(0, 200).map((row, index) => (
              <tr key={row.id ?? row.staffProfileId ?? index} className="border-t border-border">
                <td className="px-3 py-2 font-medium">
                  {row.staff?.fullName ??
                    row.deviceUserId ??
                    row.name ??
                    row.staffProfileId ??
                    row.id ??
                    '-'}
                </td>
                <td className="px-3 py-2">
                  {row.attendanceDate
                    ? formatDateTime(row.attendanceDate).split(',')[0]
                    : row.punchTimestamp
                      ? formatDateTime(row.punchTimestamp)
                      : '-'}
                </td>
                <td className="px-3 py-2">{timeOnly(row.firstInAt)}</td>
                <td className="px-3 py-2">{timeOnly(row.lastOutAt)}</td>
                <td className="px-3 py-2">
                  {row.workedMinutes != null ? minutes(row.workedMinutes) : '-'}
                </td>
                <td className="px-3 py-2">{row.lateMinutes ?? '-'}</td>
                <td className="px-3 py-2">{row.overtimeMinutes ?? '-'}</td>
                <td className="px-3 py-2">
                  {row.status ? <StatusPill status={String(row.status)} /> : '-'}
                </td>
              </tr>
            ))}
            {!reportRows.length ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                  No report rows for this filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Export-ready: Excel, CSV, PDF and print use this final attendance report payload.
      </p>
    </section>
  );
}

function AuditConsole() {
  const audit = useQuery({
    queryKey: ['staff-attendance', 'audit'],
    queryFn: fetchAttendanceAuditLogs,
  });
  return (
    <GenericRows title="Attendance Audit Logs" rows={audit.data ?? []} loading={audit.isLoading} />
  );
}

function GenericRows({
  title,
  rows,
  loading,
}: {
  title: string;
  rows: SettingsRow[];
  loading: boolean;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.slice(0, 50).map((row, index) => (
            <div key={row.id ?? index} className="rounded-2xl bg-muted/35 p-3 text-xs">
              <p className="font-medium">
                {row.action ?? row.status ?? row.correctionType ?? row.mode ?? row.id}
              </p>
              <p className="mt-1 text-muted-foreground">
                {formatDateTime(row.createdAt ?? row.startedAt ?? row.attendanceDate)} ·{' '}
                {JSON.stringify(row).slice(0, 160)}
              </p>
            </div>
          ))}
          {!rows.length ? <p className="text-sm text-muted-foreground">No records yet.</p> : null}
        </div>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone = [
    'CONNECTED',
    'SYNCED',
    'PRESENT',
    'IN',
    'ONLINE',
    'AUTH_SUCCESS',
    'HEALTHY',
    'PASS',
    'CONFIGURED',
  ].some((x) => status.includes(x));
  const warn = [
    'PENDING',
    'MISSING',
    'OUT',
    'UNKNOWN',
    'NOT_TESTED',
    'NEVER_SYNCED',
    'WARNING',
    'WARN',
    'DELAYED',
  ].some((x) => status.includes(x));
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tone && 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
        warn && 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
        !tone && !warn && 'bg-muted text-muted-foreground',
      )}
    >
      {status.replaceAll('_', ' ')}
    </span>
  );
}

function isDeviceAuthenticated(device: AttendanceDevice) {
  return device.networkStatus === 'ONLINE' && device.authenticationStatus === 'AUTH_SUCCESS';
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function timeOnly(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function minutes(value: number) {
  const h = Math.floor(value / 60);
  const m = value % 60;
  return `${h}h ${m}m`;
}
