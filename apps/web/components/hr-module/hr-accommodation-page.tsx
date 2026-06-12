'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Building2,
  Eye,
  Home,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  Wrench,
} from 'lucide-react';

import { AccommodationAlertBanner } from '@/components/hr-module/accommodation/accommodation-alert-banner';
import { AccommodationAuditPanel } from '@/components/hr-module/accommodation/accommodation-audit-panel';
import { AccommodationQuarterDetailDialog } from '@/components/hr-module/accommodation/accommodation-quarter-detail-dialog';
import { AccommodationQuarterEditDialog } from '@/components/hr-module/accommodation/accommodation-quarter-edit-dialog';
import { AccommodationVacateDialog } from '@/components/hr-module/accommodation/accommodation-vacate-dialog';
import {
  EmptyTableRow,
  Field,
  formatDate,
  formatInr,
  inputClass,
  OccupancyBar,
  quarterTypeLabel,
  StatusBadge,
} from '@/components/hr-module/accommodation/accommodation-utils';
import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  allotQuarter,
  archiveQuarter,
  createMonthlyCharge,
  createQuarter,
  deleteMonthlyCharge,
  exportOccupancyReportExcel,
  exportPayrollRecoveryExcel,
  exportStaffRegisterExcel,
  fetchAccommodationDashboard,
  fetchAccommodationHistoryReport,
  fetchAvailableQuarters,
  fetchDepartmentWiseReport,
  fetchMonthlyCharges,
  fetchOccupancies,
  fetchOccupancyReport,
  fetchPayrollRecoveryReport,
  fetchQuarterTypes,
  fetchQuarters,
  fetchStaffAccommodationRegister,
  markQuarterMaintenance,
  markQuarterVacant,
  searchStaffForAllotment,
  updateQuarter,
  vacateQuarter,
} from '@/services/accommodation';
import type { QuarterOccupancy, StaffQuarter } from '@/services/accommodation';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type Tab = 'dashboard' | 'quarters' | 'allot' | 'charges' | 'history' | 'reports' | 'audit';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function HrAccommodationPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const now = new Date();

  const [quarterFilter, setQuarterFilter] = useState({ search: '', status: '' });
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedQuarterId, setSelectedQuarterId] = useState('');
  const [allotForm, setAllotForm] = useState({
    allottedAt: now.toISOString().slice(0, 10),
    payrollDeductionEnabled: true,
    notes: '',
  });

  const [quarterForm, setQuarterForm] = useState({
    quarterNumber: '',
    quarterType: 'FACULTY',
    block: '',
    floor: '',
    numberOfRooms: 2,
    monthlyRent: 500,
    waterCharge: 100,
    electricityCharge: 250,
    maintenanceCharge: 150,
    internetCharge: 0,
    remarks: '',
  });

  const [chargeForm, setChargeForm] = useState({
    quarterId: '',
    staffProfileId: '',
    chargeType: 'ELECTRICITY',
    billingMonth: now.getMonth() + 1,
    billingYear: now.getFullYear(),
    amount: 0,
    remarks: '',
  });

  const [editQuarter, setEditQuarter] = useState<StaffQuarter | null>(null);
  const [detailQuarterId, setDetailQuarterId] = useState<string | null>(null);
  const [vacateOccupancy, setVacateOccupancy] = useState<QuarterOccupancy | null>(null);
  const [reportType, setReportType] = useState<
    'register' | 'occupancy' | 'recovery' | 'history' | 'department'
  >('register');
  const [recoveryMonth, setRecoveryMonth] = useState(6);
  const [recoveryYear, setRecoveryYear] = useState(2026);
  const [occupancyFilter, setOccupancyFilter] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');

  const dashboardQ = useQuery({
    queryKey: ['accommodation', 'dashboard'],
    queryFn: fetchAccommodationDashboard,
    enabled: enabled && tab === 'dashboard',
  });

  const typesQ = useQuery({
    queryKey: ['accommodation', 'types'],
    queryFn: fetchQuarterTypes,
    enabled,
  });

  const quartersQ = useQuery({
    queryKey: ['accommodation', 'quarters', quarterFilter],
    queryFn: () => fetchQuarters(quarterFilter),
    enabled: enabled && ['quarters', 'allot', 'charges'].includes(tab),
  });

  const staffQ = useQuery({
    queryKey: ['accommodation', 'staff-search', staffSearch],
    queryFn: () => searchStaffForAllotment(staffSearch),
    enabled: enabled && tab === 'allot' && staffSearch.trim().length >= 2,
  });

  const availableQ = useQuery({
    queryKey: ['accommodation', 'available'],
    queryFn: fetchAvailableQuarters,
    enabled: enabled && tab === 'allot',
  });

  const historyQ = useQuery({
    queryKey: ['accommodation', 'history', historySearch, historyStatus],
    queryFn: () =>
      fetchOccupancies({
        limit: 200,
        search: historySearch || undefined,
        status: historyStatus || undefined,
      }),
    enabled: enabled && tab === 'history',
  });

  const chargesQ = useQuery({
    queryKey: ['accommodation', 'charges'],
    queryFn: () => fetchMonthlyCharges(),
    enabled: enabled && tab === 'charges',
  });

  const registerQ = useQuery({
    queryKey: ['accommodation', 'register'],
    queryFn: fetchStaffAccommodationRegister,
    enabled: enabled && tab === 'reports' && reportType === 'register',
  });

  const occupancyReportQ = useQuery({
    queryKey: ['accommodation', 'report-occupancy', occupancyFilter],
    queryFn: () => fetchOccupancyReport(occupancyFilter || undefined),
    enabled: enabled && tab === 'reports' && reportType === 'occupancy',
  });

  const recoveryReportQ = useQuery({
    queryKey: ['accommodation', 'report-recovery', recoveryMonth, recoveryYear],
    queryFn: () => fetchPayrollRecoveryReport(recoveryMonth, recoveryYear),
    enabled: enabled && tab === 'reports' && reportType === 'recovery',
  });

  const historyReportQ = useQuery({
    queryKey: ['accommodation', 'report-history'],
    queryFn: () => fetchAccommodationHistoryReport(),
    enabled: enabled && tab === 'reports' && reportType === 'history',
  });

  const departmentReportQ = useQuery({
    queryKey: ['accommodation', 'report-department'],
    queryFn: fetchDepartmentWiseReport,
    enabled: enabled && tab === 'reports' && reportType === 'department',
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['accommodation'] });

  const createQuarterMut = useMutation({
    mutationFn: createQuarter,
    onSuccess: () => {
      setMessage('Quarter created');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Failed to create quarter')),
  });

  const allotMut = useMutation({
    mutationFn: allotQuarter,
    onSuccess: () => {
      setMessage('Quarter allotted successfully');
      setSelectedStaffId('');
      setSelectedQuarterId('');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Allotment failed')),
  });

  const vacateMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      vacateQuarter(id, payload),
    onSuccess: () => {
      setMessage('Quarter vacated');
      setVacateOccupancy(null);
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Vacate failed')),
  });

  const chargeMut = useMutation({
    mutationFn: createMonthlyCharge,
    onSuccess: () => {
      setMessage('Charge posted');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Failed to post charge')),
  });

  const maintenanceMut = useMutation({
    mutationFn: markQuarterMaintenance,
    onSuccess: () => {
      setMessage('Marked under maintenance');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Action failed')),
  });

  const vacantMut = useMutation({
    mutationFn: markQuarterVacant,
    onSuccess: () => {
      setMessage('Marked vacant');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Action failed')),
  });

  const updateQuarterMut = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      updateQuarter(id, payload),
    onSuccess: () => {
      setMessage('Quarter updated');
      setEditQuarter(null);
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Update failed')),
  });

  const archiveMut = useMutation({
    mutationFn: archiveQuarter,
    onSuccess: () => {
      setMessage('Quarter archived');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Archive failed')),
  });

  const deleteChargeMut = useMutation({
    mutationFn: deleteMonthlyCharge,
    onSuccess: () => {
      setMessage('Charge removed');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Could not remove charge')),
  });

  const selectedStaff = useMemo(
    () => (staffQ.data ?? []).find((s: { id: string }) => s.id === selectedStaffId),
    [staffQ.data, selectedStaffId],
  );

  const selectedChargeStaff = useMemo(() => {
    const q = (quartersQ.data?.data ?? []).find((x) => x.id === chargeForm.quarterId);
    return q?.activeOccupant ?? null;
  }, [quartersQ.data, chargeForm.quarterId]);

  const selectedQuarter = useMemo(
    () => (availableQ.data ?? []).find((q: { id: string }) => q.id === selectedQuarterId),
    [availableQ.data, selectedQuarterId],
  );

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'quarters', label: 'Quarter Master' },
    { key: 'allot', label: 'Allotment' },
    { key: 'charges', label: 'Monthly Charges' },
    { key: 'history', label: 'History' },
    { key: 'reports', label: 'Reports' },
    { key: 'audit', label: 'Audit Log' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Staff Accommodation</h2>
          <p className="text-sm text-muted-foreground">
            Quarters management, allotment, payroll recovery, and occupancy reporting.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => invalidate()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setError('');
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              tab === t.key
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message ? (
        <AccommodationAlertBanner message={message} onDismiss={() => setMessage('')} />
      ) : null}
      {error ? (
        <AccommodationAlertBanner message={error} variant="error" onDismiss={() => setError('')} />
      ) : null}

      {tab === 'dashboard' && dashboardQ.data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              {
                label: 'Total Quarters',
                value: dashboardQ.data.cards.totalQuarters,
                icon: Building2,
              },
              { label: 'Occupied', value: dashboardQ.data.cards.occupiedQuarters, icon: UserCheck },
              { label: 'Vacant', value: dashboardQ.data.cards.vacantQuarters, icon: Home },
              {
                label: 'Maintenance',
                value: dashboardQ.data.cards.maintenanceQuarters,
                icon: Wrench,
              },
              { label: 'Reserved', value: dashboardQ.data.cards.reservedQuarters, icon: Home },
            ].map((c) => (
              <GlassCard key={c.label} className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <c.icon className="h-4 w-4" />
                  <span className="text-xs">{c.label}</span>
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums">{c.value}</p>
              </GlassCard>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <GlassCard className="p-4">
              <p className="text-xs text-muted-foreground">Monthly Rent Collection</p>
              <p className="text-xl font-bold">
                {formatInr(dashboardQ.data.revenue.monthlyRentCollection)}
              </p>
            </GlassCard>
            <GlassCard className="p-4">
              <p className="text-xs text-muted-foreground">Pending Charges</p>
              <p className="text-xl font-bold">
                {formatInr(dashboardQ.data.revenue.pendingCharges)}
              </p>
            </GlassCard>
            <GlassCard className="p-4">
              <p className="text-xs text-muted-foreground">Annual Revenue (Est.)</p>
              <p className="text-xl font-bold">
                {formatInr(dashboardQ.data.revenue.annualRevenue)}
              </p>
            </GlassCard>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <GlassCard className="p-4">
              <h3 className="mb-3 font-semibold">Occupancy by Block</h3>
              <div className="space-y-3">
                {dashboardQ.data.charts.occupancyByBlock.map((b) => (
                  <OccupancyBar
                    key={b.block}
                    label={b.block}
                    occupied={b.occupied}
                    total={b.total}
                  />
                ))}
              </div>
            </GlassCard>
            <GlassCard className="p-4">
              <h3 className="mb-3 font-semibold">Occupancy by Type</h3>
              <div className="space-y-3">
                {dashboardQ.data.charts.occupancyByType.map((t) => (
                  <OccupancyBar
                    key={t.quarterType}
                    label={quarterTypeLabel(t.quarterType)}
                    occupied={t.occupied}
                    total={t.total}
                  />
                ))}
              </div>
            </GlassCard>
          </div>
        </div>
      ) : null}

      {tab === 'quarters' ? (
        <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
          <GlassCard className="p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Plus className="h-4 w-4" /> Add Quarter
            </h3>
            <div className="space-y-2 text-sm">
              <Field label="Quarter number *">
                <input
                  className={inputClass()}
                  placeholder="e.g. 102"
                  value={quarterForm.quarterNumber}
                  onChange={(e) =>
                    setQuarterForm({ ...quarterForm, quarterNumber: e.target.value })
                  }
                />
              </Field>
              <Field label="Quarter type">
                <select
                  className={inputClass()}
                  value={quarterForm.quarterType}
                  onChange={(e) => setQuarterForm({ ...quarterForm, quarterType: e.target.value })}
                >
                  {(typesQ.data ?? []).map((t) => (
                    <option key={t.slug} value={t.slug}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Block">
                  <input
                    className={inputClass()}
                    value={quarterForm.block}
                    onChange={(e) => setQuarterForm({ ...quarterForm, block: e.target.value })}
                  />
                </Field>
                <Field label="Floor">
                  <input
                    className={inputClass()}
                    value={quarterForm.floor}
                    onChange={(e) => setQuarterForm({ ...quarterForm, floor: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Monthly rent (₹)">
                <input
                  type="number"
                  className={inputClass()}
                  value={quarterForm.monthlyRent}
                  onChange={(e) =>
                    setQuarterForm({ ...quarterForm, monthlyRent: Number(e.target.value) })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Water">
                  <input
                    type="number"
                    className={inputClass()}
                    value={quarterForm.waterCharge}
                    onChange={(e) =>
                      setQuarterForm({ ...quarterForm, waterCharge: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Electricity">
                  <input
                    type="number"
                    className={inputClass()}
                    value={quarterForm.electricityCharge}
                    onChange={(e) =>
                      setQuarterForm({ ...quarterForm, electricityCharge: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Maintenance">
                  <input
                    type="number"
                    className={inputClass()}
                    value={quarterForm.maintenanceCharge}
                    onChange={(e) =>
                      setQuarterForm({ ...quarterForm, maintenanceCharge: Number(e.target.value) })
                    }
                  />
                </Field>
                <Field label="Internet">
                  <input
                    type="number"
                    className={inputClass()}
                    value={quarterForm.internetCharge}
                    onChange={(e) =>
                      setQuarterForm({ ...quarterForm, internetCharge: Number(e.target.value) })
                    }
                  />
                </Field>
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={createQuarterMut.isPending || !quarterForm.quarterNumber}
                onClick={() => createQuarterMut.mutate(quarterForm)}
              >
                Create Quarter
              </Button>
            </div>
          </GlassCard>
          <GlassCard className="overflow-auto p-4">
            <div className="mb-3 flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  className="w-full rounded border py-1.5 pl-7 pr-2 text-sm"
                  placeholder="Search quarters..."
                  value={quarterFilter.search}
                  onChange={(e) => setQuarterFilter({ ...quarterFilter, search: e.target.value })}
                />
              </div>
              <select
                className="rounded border px-2 py-1.5 text-sm"
                value={quarterFilter.status}
                onChange={(e) => setQuarterFilter({ ...quarterFilter, status: e.target.value })}
              >
                <option value="">All statuses</option>
                <option value="VACANT">Vacant</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="RESERVED">Reserved</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2 pr-2">Code</th>
                  <th className="py-2 pr-2">Type</th>
                  <th className="py-2 pr-2">Block</th>
                  <th className="py-2 pr-2">Rent</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Occupant</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(quartersQ.data?.data ?? []).length === 0 ? (
                  <EmptyTableRow colSpan={7} message="No quarters match your filters." />
                ) : (
                  (quartersQ.data?.data ?? []).map((q) => (
                    <tr key={q.id} className="border-b border-border/40 hover:bg-muted/20">
                      <td className="py-2 pr-2">
                        <button
                          type="button"
                          className="font-mono text-xs text-primary hover:underline"
                          onClick={() => setDetailQuarterId(q.id)}
                        >
                          {q.code}
                        </button>
                      </td>
                      <td className="py-2 pr-2">{quarterTypeLabel(q.quarterType)}</td>
                      <td className="py-2 pr-2">{q.block ?? '—'}</td>
                      <td className="py-2 pr-2 tabular-nums">{formatInr(q.monthlyRent)}</td>
                      <td className="py-2 pr-2">
                        <StatusBadge status={q.status} />
                      </td>
                      <td className="py-2 pr-2">{q.activeOccupant?.fullName ?? '—'}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            title="View"
                            onClick={() => setDetailQuarterId(q.id)}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            title="Edit"
                            onClick={() => setEditQuarter(q)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {q.status !== 'MAINTENANCE' && q.status !== 'OCCUPIED' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px]"
                              onClick={() => maintenanceMut.mutate(q.id)}
                            >
                              Maintenance
                            </Button>
                          ) : null}
                          {q.status === 'MAINTENANCE' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[10px]"
                              onClick={() => vacantMut.mutate(q.id)}
                            >
                              Mark Vacant
                            </Button>
                          ) : null}
                          {q.status !== 'OCCUPIED' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 w-7 p-0 text-destructive"
                              title="Archive"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Archive ${q.code}? This cannot be undone for active listings.`,
                                  )
                                )
                                  archiveMut.mutate(q.id);
                              }}
                            >
                              <Archive className="h-3 w-3" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </GlassCard>
        </div>
      ) : null}

      {tab === 'allot' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-4 space-y-3">
            <h3 className="font-semibold">Step 1 — Search Staff</h3>
            <input
              className="w-full rounded border px-2 py-1.5 text-sm"
              placeholder="Name, code, mobile..."
              value={staffSearch}
              onChange={(e) => setStaffSearch(e.target.value)}
            />
            <div className="max-h-48 space-y-1 overflow-auto">
              {(staffQ.data ?? []).map(
                (s: {
                  id: string;
                  fullName: string;
                  employeeCode: string;
                  department: { name: string } | null;
                  quarterOccupancies: unknown[];
                }) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStaffId(s.id)}
                    className={cn(
                      'w-full rounded border px-2 py-1.5 text-left text-sm',
                      selectedStaffId === s.id && 'border-primary bg-primary/5',
                    )}
                  >
                    <p className="font-medium">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.employeeCode} · {s.department?.name ?? '—'}
                    </p>
                    {(s.quarterOccupancies ?? []).length > 0 ? (
                      <p className="text-[10px] text-amber-600">Already has active quarter</p>
                    ) : null}
                  </button>
                ),
              )}
            </div>
          </GlassCard>
          <GlassCard className="p-4 space-y-3">
            <h3 className="font-semibold">Step 2 — Select Quarter</h3>
            <select
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={selectedQuarterId}
              onChange={(e) => setSelectedQuarterId(e.target.value)}
            >
              <option value="">Select available quarter</option>
              {(availableQ.data ?? []).map(
                (q: {
                  id: string;
                  code: string;
                  quarterType: string;
                  block: string | null;
                  monthlyRent: number;
                  status: string;
                }) => (
                  <option key={q.id} value={q.id}>
                    {q.code} — {q.quarterType} — {q.block ?? 'N/A'} —{' '}
                    {formatInr(Number(q.monthlyRent))}
                  </option>
                ),
              )}
            </select>
            {selectedQuarter ? (
              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Rent</dt>
                  <dd>{formatInr(Number(selectedQuarter.monthlyRent))}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <StatusBadge status={selectedQuarter.status} />
                  </dd>
                </div>
              </dl>
            ) : null}
            {selectedStaff ? (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-xs">
                Staff: <strong>{selectedStaff.fullName}</strong> ({selectedStaff.employeeCode})
              </div>
            ) : null}
            <h3 className="font-semibold">Step 3 — Allot</h3>
            <input
              type="date"
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={allotForm.allottedAt}
              onChange={(e) => setAllotForm({ ...allotForm, allottedAt: e.target.value })}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allotForm.payrollDeductionEnabled}
                onChange={(e) =>
                  setAllotForm({ ...allotForm, payrollDeductionEnabled: e.target.checked })
                }
              />
              Payroll deduction enabled
            </label>
            <Button
              disabled={!selectedStaffId || !selectedQuarterId || allotMut.isPending}
              onClick={() =>
                allotMut.mutate({
                  staffProfileId: selectedStaffId,
                  quarterId: selectedQuarterId,
                  ...allotForm,
                })
              }
            >
              Allot Quarter
            </Button>
          </GlassCard>
        </div>
      ) : null}

      {tab === 'charges' ? (
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <GlassCard className="p-4 space-y-2">
            <h3 className="font-semibold">Post Monthly Charge</h3>
            <select
              className={inputClass()}
              value={chargeForm.quarterId}
              onChange={(e) => {
                const q = (quartersQ.data?.data ?? []).find((x) => x.id === e.target.value);
                setChargeForm({
                  ...chargeForm,
                  quarterId: e.target.value,
                  staffProfileId: q?.activeOccupant?.staffProfileId ?? '',
                });
              }}
            >
              <option value="">Select occupied quarter</option>
              {(quartersQ.data?.data ?? [])
                .filter((q) => q.status === 'OCCUPIED')
                .map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.code} — {q.activeOccupant?.fullName}
                  </option>
                ))}
            </select>
            {selectedChargeStaff ? (
              <p className="text-xs text-muted-foreground">
                Staff: <strong>{selectedChargeStaff.fullName}</strong> (
                {selectedChargeStaff.employeeCode})
              </p>
            ) : (
              <p className="text-xs text-amber-600">Select a quarter with an active occupant.</p>
            )}
            <Field label="Charge type">
              <select
                className={inputClass()}
                value={chargeForm.chargeType}
                onChange={(e) => setChargeForm({ ...chargeForm, chargeType: e.target.value })}
              >
                <option value="ELECTRICITY">Electricity</option>
                <option value="WATER">Water</option>
                <option value="INTERNET">Internet</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="REPAIR">Repair</option>
              </select>
            </Field>
            <Field
              label={`Billing period (${MONTH_LABELS[chargeForm.billingMonth - 1] ?? chargeForm.billingMonth} ${chargeForm.billingYear})`}
            >
              <div className="grid grid-cols-2 gap-2">
                <select
                  className={inputClass()}
                  value={chargeForm.billingMonth}
                  onChange={(e) =>
                    setChargeForm({ ...chargeForm, billingMonth: Number(e.target.value) })
                  }
                >
                  {MONTH_LABELS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className={inputClass()}
                  value={chargeForm.billingYear}
                  onChange={(e) =>
                    setChargeForm({ ...chargeForm, billingYear: Number(e.target.value) })
                  }
                />
              </div>
            </Field>
            <Field label="Amount (₹)">
              <input
                type="number"
                className={inputClass()}
                placeholder="0"
                value={chargeForm.amount || ''}
                onChange={(e) => setChargeForm({ ...chargeForm, amount: Number(e.target.value) })}
              />
            </Field>
            <Button
              disabled={chargeMut.isPending || !chargeForm.quarterId || !chargeForm.staffProfileId}
              onClick={() => chargeMut.mutate(chargeForm)}
            >
              Post Charge
            </Button>
          </GlassCard>
          <GlassCard className="overflow-auto p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="py-2">Quarter</th>
                  <th className="py-2">Staff</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Period</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {(chargesQ.data ?? []).length === 0 ? (
                  <EmptyTableRow colSpan={7} message="No monthly charges posted yet." />
                ) : (
                  (chargesQ.data ?? []).map(
                    (c: {
                      id: string;
                      quarter: { code: string };
                      staffProfile: { fullName: string };
                      chargeType: string;
                      billingMonth: number;
                      billingYear: number;
                      amount: number;
                      status: string;
                    }) => (
                      <tr key={c.id} className="border-b border-border/40">
                        <td className="py-2 font-mono text-xs">{c.quarter.code}</td>
                        <td className="py-2">{c.staffProfile.fullName}</td>
                        <td className="py-2">{c.chargeType}</td>
                        <td className="py-2">
                          {MONTH_LABELS[c.billingMonth - 1]} {c.billingYear}
                        </td>
                        <td className="py-2 tabular-nums">{formatInr(Number(c.amount))}</td>
                        <td className="py-2">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="py-2">
                          {c.status === 'PENDING' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={() => deleteChargeMut.mutate(c.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </GlassCard>
        </div>
      ) : null}

      {tab === 'history' ? (
        <GlassCard className="overflow-auto p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                className={inputClass('pl-7')}
                placeholder="Search staff or quarter…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </div>
            <select
              className={inputClass('w-auto')}
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
            >
              <option value="">All records</option>
              <option value="ACTIVE">Active only</option>
              <option value="COMPLETED">Completed only</option>
            </select>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                <th className="py-2">Quarter</th>
                <th className="py-2">Staff</th>
                <th className="py-2">Allotted</th>
                <th className="py-2">Vacated</th>
                <th className="py-2">Rent</th>
                <th className="py-2">Status</th>
                <th className="py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {(historyQ.data?.data ?? []).length === 0 ? (
                <EmptyTableRow colSpan={7} message="No occupancy records found." />
              ) : (
                (historyQ.data?.data ?? []).map((o) => (
                  <tr key={o.id} className="border-b border-border/40">
                    <td className="py-2 font-mono text-xs">{o.quarter.code}</td>
                    <td className="py-2">{o.staffProfile.fullName}</td>
                    <td className="py-2">{formatDate(o.allottedAt)}</td>
                    <td className="py-2">{formatDate(o.vacatedAt)}</td>
                    <td className="py-2 tabular-nums">{formatInr(o.monthlyRent)}</td>
                    <td className="py-2">
                      <StatusBadge status={o.status === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED'} />
                    </td>
                    <td className="py-2">
                      {o.status === 'ACTIVE' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[10px]"
                          onClick={() => setVacateOccupancy(o)}
                        >
                          Vacate
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </GlassCard>
      ) : null}

      {tab === 'reports' ? (
        <div className="space-y-3 print:space-y-2" id="accommodation-reports">
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {(
              [
                ['register', 'Staff Register'],
                ['occupancy', 'Occupancy'],
                ['department', 'By Department'],
                ['history', 'History'],
                ['recovery', 'Payroll Recovery'],
              ] as const
            ).map(([t, label]) => (
              <Button
                key={t}
                size="sm"
                variant={reportType === t ? 'default' : 'outline'}
                onClick={() => setReportType(t)}
              >
                {label}
              </Button>
            ))}
            {reportType === 'occupancy' ? (
              <select
                className="rounded border px-2 py-1 text-sm"
                value={occupancyFilter}
                onChange={(e) => setOccupancyFilter(e.target.value)}
              >
                <option value="">All</option>
                <option value="VACANT">Vacant</option>
                <option value="OCCUPIED">Occupied</option>
                <option value="MAINTENANCE">Maintenance</option>
              </select>
            ) : null}
            {reportType === 'recovery' ? (
              <>
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="w-16 rounded border px-2 py-1 text-sm"
                  value={recoveryMonth}
                  onChange={(e) => setRecoveryMonth(Number(e.target.value))}
                />
                <input
                  type="number"
                  className="w-20 rounded border px-2 py-1 text-sm"
                  value={recoveryYear}
                  onChange={(e) => setRecoveryYear(Number(e.target.value))}
                />
              </>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (reportType === 'register') void exportStaffRegisterExcel();
                else if (reportType === 'occupancy')
                  void exportOccupancyReportExcel(occupancyFilter || undefined);
                else if (reportType === 'recovery')
                  void exportPayrollRecoveryExcel(recoveryMonth, recoveryYear);
              }}
            >
              Export Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1 h-3.5 w-3.5" /> Print
            </Button>
          </div>

          {reportType === 'register' ? (
            <GlassCard className="overflow-auto p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2">Staff</th>
                    <th className="py-2">Code</th>
                    <th className="py-2">Department</th>
                    <th className="py-2">Quarter</th>
                    <th className="py-2">Block</th>
                    <th className="py-2">Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {(registerQ.data ?? []).map(
                    (r: {
                      id: string;
                      staffProfile: {
                        fullName: string;
                        employeeCode: string;
                        department: { name: string } | null;
                      };
                      quarter: { code: string; block: string | null };
                      monthlyRent: number;
                    }) => (
                      <tr key={r.id} className="border-b border-border/40">
                        <td className="py-2">{r.staffProfile.fullName}</td>
                        <td className="py-2 font-mono text-xs">{r.staffProfile.employeeCode}</td>
                        <td className="py-2">{r.staffProfile.department?.name ?? '—'}</td>
                        <td className="py-2 font-mono text-xs">{r.quarter.code}</td>
                        <td className="py-2">{r.quarter.block ?? '—'}</td>
                        <td className="py-2 tabular-nums">{formatInr(Number(r.monthlyRent))}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </GlassCard>
          ) : null}

          {reportType === 'occupancy' ? (
            <GlassCard className="overflow-auto p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2">Code</th>
                    <th className="py-2">Block</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Occupant</th>
                    <th className="py-2">Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {(occupancyReportQ.data ?? []).map(
                    (q: {
                      id: string;
                      code: string;
                      block: string | null;
                      status: string;
                      monthlyRent: number;
                      occupancies: { staffProfile: { fullName: string } }[];
                    }) => (
                      <tr key={q.id} className="border-b border-border/40">
                        <td className="py-2 font-mono text-xs">{q.code}</td>
                        <td className="py-2">{q.block ?? '—'}</td>
                        <td className="py-2">
                          <StatusBadge status={q.status} />
                        </td>
                        <td className="py-2">{q.occupancies[0]?.staffProfile.fullName ?? '—'}</td>
                        <td className="py-2 tabular-nums">{formatInr(Number(q.monthlyRent))}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </GlassCard>
          ) : null}

          {reportType === 'recovery' ? (
            <GlassCard className="overflow-auto p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2">Staff</th>
                    <th className="py-2">Component</th>
                    <th className="py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(recoveryReportQ.data ?? []).length === 0 ? (
                    <EmptyTableRow
                      colSpan={3}
                      message="No recovery data for this period. Run payroll Calculate first."
                    />
                  ) : (
                    (recoveryReportQ.data ?? []).map(
                      (
                        r: { staffName: string; componentName: string; amount: number },
                        i: number,
                      ) => (
                        <tr key={i} className="border-b border-border/40">
                          <td className="py-2">{r.staffName}</td>
                          <td className="py-2">{r.componentName}</td>
                          <td className="py-2 tabular-nums">{formatInr(r.amount)}</td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </GlassCard>
          ) : null}

          {reportType === 'department' ? (
            <GlassCard className="overflow-auto p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2">Department</th>
                    <th className="py-2">Staff</th>
                    <th className="py-2">Quarter</th>
                    <th className="py-2">Block</th>
                    <th className="py-2">Rent</th>
                  </tr>
                </thead>
                <tbody>
                  {(departmentReportQ.data ?? []).length === 0 ? (
                    <EmptyTableRow colSpan={5} message="No active allotments by department." />
                  ) : (
                    (departmentReportQ.data ?? []).map(
                      (r: {
                        id: string;
                        staffProfile: { fullName: string; department: { name: string } | null };
                        quarter: { code: string; block: string | null };
                        monthlyRent: number;
                      }) => (
                        <tr key={r.id} className="border-b border-border/40">
                          <td className="py-2">{r.staffProfile.department?.name ?? '—'}</td>
                          <td className="py-2">{r.staffProfile.fullName}</td>
                          <td className="py-2 font-mono text-xs">{r.quarter.code}</td>
                          <td className="py-2">{r.quarter.block ?? '—'}</td>
                          <td className="py-2 tabular-nums">{formatInr(Number(r.monthlyRent))}</td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </GlassCard>
          ) : null}

          {reportType === 'history' ? (
            <GlassCard className="overflow-auto p-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2">Quarter</th>
                    <th className="py-2">Staff</th>
                    <th className="py-2">Allotted</th>
                    <th className="py-2">Vacated</th>
                    <th className="py-2">Rent</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(historyReportQ.data ?? []).length === 0 ? (
                    <EmptyTableRow colSpan={6} message="No accommodation history." />
                  ) : (
                    (historyReportQ.data ?? []).map(
                      (r: {
                        id: string;
                        quarter: { code: string };
                        staffProfile: { fullName: string };
                        allottedAt: string;
                        vacatedAt: string | null;
                        monthlyRent: number;
                        status: string;
                      }) => (
                        <tr key={r.id} className="border-b border-border/40">
                          <td className="py-2 font-mono text-xs">{r.quarter.code}</td>
                          <td className="py-2">{r.staffProfile.fullName}</td>
                          <td className="py-2">{formatDate(r.allottedAt)}</td>
                          <td className="py-2">{formatDate(r.vacatedAt)}</td>
                          <td className="py-2 tabular-nums">{formatInr(Number(r.monthlyRent))}</td>
                          <td className="py-2">
                            <StatusBadge status={r.status} />
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </GlassCard>
          ) : null}
        </div>
      ) : null}

      {tab === 'audit' ? <AccommodationAuditPanel enabled={enabled && tab === 'audit'} /> : null}

      <AccommodationQuarterEditDialog
        open={!!editQuarter}
        quarter={editQuarter}
        quarterTypes={typesQ.data ?? []}
        onClose={() => setEditQuarter(null)}
        onSave={(payload) =>
          editQuarter && updateQuarterMut.mutate({ id: editQuarter.id, payload })
        }
        isPending={updateQuarterMut.isPending}
      />

      <AccommodationVacateDialog
        open={!!vacateOccupancy}
        occupancy={vacateOccupancy}
        onClose={() => setVacateOccupancy(null)}
        onConfirm={(payload) =>
          vacateOccupancy && vacateMut.mutate({ id: vacateOccupancy.id, payload })
        }
        isPending={vacateMut.isPending}
      />

      <AccommodationQuarterDetailDialog
        quarterId={detailQuarterId}
        onClose={() => setDetailQuarterId(null)}
        onVacate={(occupancy) => {
          setDetailQuarterId(null);
          setVacateOccupancy(occupancy);
        }}
        onAllotNew={(quarterId) => {
          setDetailQuarterId(null);
          setTab('allot');
          setSelectedQuarterId(quarterId);
          setMessage('Select the new staff member, then confirm allotment.');
        }}
      />
    </div>
  );
}
