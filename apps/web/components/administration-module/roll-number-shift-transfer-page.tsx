'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeftRight,
  Armchair,
  CalendarClock,
  Gauge,
  History,
  Search,
  Sun,
  Sunrise,
  Users,
  AlertTriangle,
  ChevronsUpDown,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { AdminPageHeader } from '@/components/administration-module/admin-page-header';
import { AdminShell, AdminGlassCard } from '@/components/administration-module/ui/admin-shell';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { ShiftTransferConfirmDialog } from '@/components/students-module/profile/shift-transfer-confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRequireAuth } from '@/hooks/use-auth';
import { useInstitutionBranding } from '@/hooks/use-institution-branding';
import { fetchAcademicDepartments, fetchInstitutions } from '@/services/organization';
import { fetchAllPrograms } from '@/services/programs';
import {
  bulkShiftTransfer,
  fetchRollShiftCapacity,
  previewBulkShiftTransfer,
  type ShiftTransferPreview,
} from '@/services/roll-number';
import { fetchShifts } from '@/services/shifts';
import { fetchStudents } from '@/services/students';
import type { StudentDirectoryRow } from '@/types/students';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type RollAction = 'regenerate' | 'keep' | 'manual';
type AttendanceAction = 'transfer' | 'reset' | 'keep';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

function isMorningShift(name: string, code: string) {
  const hay = `${name} ${code}`.toLowerCase();
  return /morning|morn\b|^m$|\bm\b/.test(hay);
}

function isDayShift(name: string, code: string) {
  const hay = `${name} ${code}`.toLowerCase();
  return /day|evening|afternoon|^d$|\bd\b/.test(hay) && !isMorningShift(name, code);
}

export function RollNumberShiftTransferPage() {
  useRequireAuth();
  const qc = useQueryClient();
  const { branding } = useInstitutionBranding();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [programmeFilter, setProgrammeFilter] = useState('');
  const [semesterFilter, setSemesterFilter] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [fromShiftId, setFromShiftId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [toShiftId, setToShiftId] = useState('');
  const [reason, setReason] = useState('Morning → Day transfer batch');
  const [effectiveDate, setEffectiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rollAction, setRollAction] = useState<RollAction>('regenerate');
  const [attendanceAction, setAttendanceAction] = useState<AttendanceAction>('transfer');
  const [warningsOpen, setWarningsOpen] = useState(true);

  const [message, setMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [previewPanelOpen, setPreviewPanelOpen] = useState(false);
  const [lastResults, setLastResults] = useState<
    Array<{
      studentId: string;
      status: 'success' | 'failed';
      oldRollNumber?: string | null;
      newRollNumber?: string | null;
      error?: string;
    }>
  >([]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, programmeFilter, semesterFilter, departmentId, fromShiftId]);

  const institutionsQ = useQuery({
    queryKey: ['institutions'],
    queryFn: fetchInstitutions,
  });
  const institutionId = institutionsQ.data?.[0]?.id ?? '';
  const institutionName =
    branding?.displayName?.trim() ||
    branding?.shortName?.trim() ||
    institutionsQ.data?.[0]?.name ||
    'Institution';

  const admissionYear = new Date().getFullYear();

  const shiftsQ = useQuery({
    queryKey: ['shifts', 'active'],
    queryFn: () => fetchShifts({ status: 'ACTIVE' }),
  });

  const capacityQ = useQuery({
    queryKey: ['roll-shift-capacity', institutionId, admissionYear],
    queryFn: () => fetchRollShiftCapacity({ institutionId, admissionYear }),
    enabled: Boolean(institutionId),
  });

  const programsQ = useQuery({
    queryKey: ['programs', 'all-lite'],
    queryFn: () => fetchAllPrograms(),
  });

  const departmentsQ = useQuery({
    queryKey: ['departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
  });

  const studentsQ = useQuery({
    queryKey: [
      'students',
      'shift-transfer',
      page,
      debouncedSearch,
      programmeFilter,
      semesterFilter,
      departmentId,
      fromShiftId,
    ],
    queryFn: () =>
      fetchStudents({
        page,
        limit: 10,
        search: debouncedSearch || undefined,
        shiftId: fromShiftId || undefined,
        departmentId: departmentId || undefined,
        semester: semesterFilter || undefined,
        programVersionId: programmeFilter || undefined,
      }),
  });

  const rows = studentsQ.data?.data ?? [];
  const meta = studentsQ.data?.meta;
  const totalFiltered = meta?.total ?? 0;
  const totalPages = meta?.totalPages ?? 1;

  const shifts = shiftsQ.data ?? [];
  const capacityRows = capacityQ.data ?? [];

  const morningCap = useMemo(() => {
    return (
      capacityRows.find((c) => isMorningShift(c.shiftName, c.shiftCode)) ?? capacityRows[0] ?? null
    );
  }, [capacityRows]);

  const dayCap = useMemo(() => {
    return (
      capacityRows.find((c) => isDayShift(c.shiftName, c.shiftCode)) ??
      capacityRows.find((c) => c.shiftId !== morningCap?.shiftId) ??
      null
    );
  }, [capacityRows, morningCap?.shiftId]);

  const targetCapacity = useMemo(
    () => capacityRows.find((c) => c.shiftId === toShiftId) ?? null,
    [capacityRows, toShiftId],
  );

  const capacityRemainingPct = useMemo(() => {
    const totalCapacity = capacityRows.reduce((sum, r) => sum + (r.capacity || 0), 0);
    const totalVacant = capacityRows.reduce((sum, r) => sum + (r.vacant || 0), 0);
    if (!totalCapacity) return null;
    return (totalVacant / totalCapacity) * 100;
  }, [capacityRows]);

  const fromShiftName = useMemo(() => {
    if (!fromShiftId) {
      const sample = rows.find((r) => r.shift)?.shift;
      return sample ?? 'Current shift';
    }
    return shifts.find((s) => s.id === fromShiftId)?.name ?? 'Current shift';
  }, [fromShiftId, rows, shifts]);

  const toShift = shifts.find((s) => s.id === toShiftId) ?? null;

  const previewQ = useQuery({
    queryKey: ['shift-transfer', 'preview-bulk', selectedIds, toShiftId],
    queryFn: () =>
      previewBulkShiftTransfer({
        studentIds: selectedIds,
        toShiftId,
      }),
    enabled: selectedIds.length > 0 && Boolean(toShiftId),
  });

  const previewByStudent = useMemo(() => {
    const map = new Map<string, ShiftTransferPreview>();
    for (const item of previewQ.data?.previews ?? []) {
      map.set(item.studentId, item);
    }
    return map;
  }, [previewQ.data?.previews]);

  const pageSelectedCount = rows.filter((r) => selectedIds.includes(r.id)).length;
  const allPageSelected = rows.length > 0 && pageSelectedCount === rows.length;

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !rows.some((r) => r.id === id)));
      return;
    }
    setSelectedIds((prev) => [...new Set([...prev, ...rows.map((r) => r.id)])]);
  };

  const selectAllFiltered = async () => {
    const res = await fetchStudents({
      page: 1,
      limit: Math.min(Math.max(totalFiltered, 1), 100),
      search: debouncedSearch || undefined,
      shiftId: fromShiftId || undefined,
      departmentId: departmentId || undefined,
      semester: semesterFilter || undefined,
      programVersionId: programmeFilter || undefined,
    });
    setSelectedIds(res.data.map((s) => s.id));
  };

  const clearFilters = () => {
    setSearch('');
    setProgrammeFilter('');
    setSemesterFilter('');
    setDepartmentId('');
    setFromShiftId('');
    setPage(1);
  };

  const composedReason = useMemo(() => {
    const base = reason.trim() || 'Bulk shift transfer';
    return effectiveDate ? `${base} (effective ${effectiveDate})` : base;
  }, [reason, effectiveDate]);

  const transferMut = useMutation({
    mutationFn: () =>
      bulkShiftTransfer({
        studentIds: selectedIds,
        toShiftId,
        reason: composedReason,
      }),
    onSuccess: (result) => {
      setLastResults(result.results);
      setMessage(
        `Transferred ${result.succeeded} of ${result.total} student(s). New roll numbers assigned in the destination shift.`,
      );
      setSelectedIds([]);
      setConfirmOpen(false);
      setPreviewPanelOpen(false);
      void qc.invalidateQueries({ queryKey: ['students'] });
      void qc.invalidateQueries({ queryKey: ['roll-shift-capacity'] });
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Bulk shift transfer failed')),
  });

  const firstPreview = previewQ.data?.previews[0] ?? null;
  const previewErrorCount = previewQ.data?.errors.length ?? 0;
  const canTransfer =
    selectedIds.length > 0 &&
    Boolean(toShiftId) &&
    rollAction === 'regenerate' &&
    !transferMut.isPending;

  const yearLabel = `AY ${admissionYear}-${String(admissionYear + 1).slice(-2)}`;

  return (
    <DashboardShell role="admin" title="Shift Transfer">
      <AdminShell>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{institutionName}</span>
          <span aria-hidden>·</span>
          <span>{yearLabel}</span>
          <span aria-hidden>·</span>
          <span>ODD Cycle</span>
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            Active
          </span>
        </div>

        <AdminPageHeader
          title="Shift Transfer"
          subtitle="Transfer students between shifts with automatic roll number regeneration and audit history."
          actions={
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link href="/admin/administration/roll-number-history">
                <History className="h-4 w-4" />
                Audit History
              </Link>
            </Button>
          }
        />

        {message ? (
          <p className="mb-4 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
            {message}
          </p>
        ) : null}

        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={<Sunrise className="h-4 w-4 text-emerald-600" />}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            label="Morning Shift"
            value={morningCap ? String(morningCap.used) : '—'}
            hint="Students"
          />
          <StatCard
            icon={<Sun className="h-4 w-4 text-sky-600" />}
            iconBg="bg-sky-50 dark:bg-sky-950/40"
            label="Day Shift"
            value={dayCap ? String(dayCap.used) : '—'}
            hint="Students"
          />
          <StatCard
            icon={<Armchair className="h-4 w-4 text-violet-600" />}
            iconBg="bg-violet-50 dark:bg-violet-950/40"
            label="Available Seats"
            value={
              targetCapacity
                ? String(targetCapacity.available)
                : dayCap
                  ? String(dayCap.available)
                  : '—'
            }
            hint={toShift ? `In ${toShift.name}` : 'In Day Shift'}
          />
          <StatCard
            icon={<Users className="h-4 w-4 text-orange-600" />}
            iconBg="bg-orange-50 dark:bg-orange-950/40"
            label="Selected Students"
            value={String(selectedIds.length)}
            hint="Students"
          />
          <StatCard
            icon={<Gauge className="h-4 w-4 text-blue-600" />}
            iconBg="bg-blue-50 dark:bg-blue-950/40"
            label="Capacity Remaining"
            value={capacityRemainingPct != null ? `${capacityRemainingPct.toFixed(1)}%` : '—'}
            hint="Of Total Capacity"
          />
        </div>

        <div className="grid gap-4 pb-24 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
          <AdminGlassCard className="overflow-hidden p-0">
            <div className="border-b border-border/70 px-4 py-3">
              <h2 className="text-sm font-semibold">Select students</h2>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-8"
                    placeholder="Search by Roll No / Name…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                  Advanced Filters
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  Clear
                </Button>
              </div>

              {showAdvanced ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <FilterSelect
                    label="Programme"
                    value={programmeFilter}
                    onChange={setProgrammeFilter}
                    options={(programsQ.data?.data ?? []).flatMap((p) =>
                      (p.versions ?? []).map((v) => ({
                        value: v.id,
                        label: `${p.name}${v.version ? ` v${v.version}` : ''}`,
                      })),
                    )}
                    placeholder="All programmes"
                  />
                  <FilterSelect
                    label="Semester"
                    value={semesterFilter}
                    onChange={setSemesterFilter}
                    options={[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
                      value: String(n),
                      label: `Semester ${n}`,
                    }))}
                    placeholder="All semesters"
                  />
                  <FilterSelect
                    label="Department"
                    value={departmentId}
                    onChange={setDepartmentId}
                    options={(departmentsQ.data ?? []).map((d) => ({
                      value: d.id,
                      label: d.name,
                    }))}
                    placeholder="All departments"
                  />
                  <FilterSelect
                    label="Current Shift"
                    value={fromShiftId}
                    onChange={setFromShiftId}
                    options={shifts.map((s) => ({
                      value: s.id,
                      label: `${s.name} (${s.code})`,
                    }))}
                    placeholder="All shifts"
                  />
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleSelectAllPage}
                    disabled={!rows.length}
                  />
                  Select All (This Page)
                </label>
                <button
                  type="button"
                  className="font-semibold text-primary hover:underline disabled:opacity-50"
                  disabled={!totalFiltered}
                  onClick={() => void selectAllFiltered()}
                >
                  Select All Filtered ({totalFiltered})
                </button>
                <span className="ml-auto font-medium text-foreground">
                  {selectedIds.length} selected
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5 w-10" />
                    <th className="px-3 py-2.5">Student</th>
                    <th className="px-3 py-2.5">Roll No.</th>
                    <th className="px-3 py-2.5">Programme</th>
                    <th className="px-3 py-2.5">Sem.</th>
                    <th className="px-3 py-2.5">Department</th>
                    <th className="px-3 py-2.5">Current Shift</th>
                    <th className="px-3 py-2.5">New Roll No.</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsQ.isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                        Loading students…
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                        No students match the current filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <StudentRow
                        key={row.id}
                        row={row}
                        checked={selectedIds.includes(row.id)}
                        onToggle={() => toggleStudent(row.id)}
                        preview={previewByStudent.get(row.id)}
                        previewError={
                          previewQ.data?.errors.find((e) => e.studentId === row.id)?.error
                        }
                        showPreview={Boolean(toShiftId && selectedIds.includes(row.id))}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
              <span>
                Showing {rows.length ? (page - 1) * 10 + 1 : 0} to {(page - 1) * 10 + rows.length}{' '}
                of {totalFiltered} students
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </Button>
                <span className="px-2 font-medium text-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </AdminGlassCard>

          <AdminGlassCard className="h-fit space-y-4 p-4">
            <h2 className="text-sm font-semibold">Transfer settings</h2>

            <div className="space-y-1.5">
              <Label>Target Shift</Label>
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={toShiftId}
                onChange={(e) => setToShiftId(e.target.value)}
              >
                <option value="">Select shift…</option>
                {shifts.map((shift) => (
                  <option key={shift.id} value={shift.id}>
                    {shift.name} ({shift.code})
                    {fromShiftId && shift.id === fromShiftId ? ' — current filter' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Target Section</Label>
              <select
                disabled
                className="h-9 w-full rounded-md border border-input bg-muted/40 px-2 text-sm text-muted-foreground"
                defaultValue=""
              >
                <option value="">Section remapping — coming soon</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Transfer Effective Date</Label>
              <div className="relative">
                <CalendarClock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="date"
                  className="pl-8"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Added to the audit reason. Transfer still runs immediately.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Transfer Reason</Label>
              <textarea
                rows={3}
                placeholder="Morning → Day transfer batch"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Roll Number Action
              </legend>
              <RadioOption
                checked={rollAction === 'regenerate'}
                onChange={() => setRollAction('regenerate')}
                title="Regenerate (Recommended)"
                description="Assign next available roll number in the target shift range."
              />
              <RadioOption
                checked={rollAction === 'keep'}
                onChange={() => setRollAction('keep')}
                title="Keep Existing"
                description="Not supported yet — destination shift sequencing requires a new roll."
                disabled
              />
              <RadioOption
                checked={rollAction === 'manual'}
                onChange={() => setRollAction('manual')}
                title="Manual"
                description="Available on single-student transfer from the profile screen."
                disabled
              />
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Attendance Handling
              </legend>
              <RadioOption
                checked={attendanceAction === 'transfer'}
                onChange={() => setAttendanceAction('transfer')}
                title="Transfer Attendance"
                description="Attendance records stay on the student (default behaviour)."
              />
              <RadioOption
                checked={attendanceAction === 'reset'}
                onChange={() => setAttendanceAction('reset')}
                title="Reset Attendance"
                description="Not available yet."
                disabled
              />
              <RadioOption
                checked={attendanceAction === 'keep'}
                onChange={() => setAttendanceAction('keep')}
                title="Keep Attendance"
                description="Same as transfer for now."
                disabled
              />
            </fieldset>

            <div className="rounded-xl border border-border/70 bg-muted/20 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Transfer Preview
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <PreviewChip
                  label={`${selectedIds.length} student${selectedIds.length === 1 ? '' : 's'}`}
                />
                <span className="text-muted-foreground">→</span>
                <PreviewChip label={fromShiftName} />
                <span className="text-muted-foreground">→</span>
                <PreviewChip label={toShift?.name ?? 'Target shift'} tone="primary" />
                <span className="text-muted-foreground">→</span>
                <PreviewChip label="New Roll Numbers (Auto)" tone="success" />
              </div>
              {previewQ.isFetching ? (
                <p className="mt-2 text-xs text-muted-foreground">Refreshing roll previews…</p>
              ) : null}
              {previewErrorCount > 0 ? (
                <p className="mt-2 text-xs text-destructive">
                  {previewErrorCount} student(s) cannot be previewed — check shift ranges.
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-amber-800 dark:text-amber-200"
                onClick={() => setWarningsOpen((v) => !v)}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                Important before you transfer
                <span className="ml-auto">{warningsOpen ? '▴' : '▾'}</span>
              </button>
              {warningsOpen ? (
                <ul className="space-y-1.5 px-3 pb-3 text-[11px] leading-relaxed text-amber-900/90 dark:text-amber-100/80">
                  <li>• Roll numbers are regenerated in the destination shift sequence.</li>
                  <li>• Previous rolls remain in audit history — they are not deleted.</li>
                  <li>• Subjects and programme stay the same; only shift + roll change.</li>
                  <li>• Ensure target shift has enough available seats before confirming.</li>
                </ul>
              ) : null}
            </div>
          </AdminGlassCard>
        </div>

        {lastResults.length > 0 ? (
          <AdminGlassCard className="mb-20 p-4">
            <h2 className="text-sm font-semibold">Last transfer results</h2>
            <ul className="mt-2 divide-y divide-border text-sm">
              {lastResults.map((row) => (
                <li key={row.studentId} className="py-2">
                  {row.status === 'success' ? (
                    <span className="font-mono">
                      {row.oldRollNumber ?? '—'} → {row.newRollNumber ?? '—'}
                    </span>
                  ) : (
                    <span className="text-destructive">{row.error ?? 'Failed'}</span>
                  )}
                </li>
              ))}
            </ul>
          </AdminGlassCard>
        ) : null}

        {previewPanelOpen && selectedIds.length > 0 && toShiftId ? (
          <AdminGlassCard className="mb-20 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Roll number preview</h2>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPreviewPanelOpen(false)}
              >
                Close
              </Button>
            </div>
            {previewQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading previews…</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
                {selectedIds.map((id) => {
                  const preview = previewByStudent.get(id);
                  const err = previewQ.data?.errors.find((e) => e.studentId === id);
                  const row = rows.find((r) => r.id === id);
                  return (
                    <li key={id} className="font-mono text-xs">
                      {row?.fullName ?? id}: {preview?.currentRollNumber ?? row?.rollNumber ?? '—'}{' '}
                      →{' '}
                      {preview?.previewRollNumber ??
                        (err ? <span className="text-destructive">{err.error}</span> : '—')}
                    </li>
                  );
                })}
              </ul>
            )}
          </AdminGlassCard>
        ) : null}

        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-end gap-2 px-4 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedIds([]);
                setMessage('');
                setPreviewPanelOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-primary/40 text-primary"
              disabled={!selectedIds.length || !toShiftId}
              onClick={() => setPreviewPanelOpen(true)}
            >
              Preview Transfer
            </Button>
            <Button
              type="button"
              className="gap-1.5"
              disabled={!canTransfer}
              onClick={() => setConfirmOpen(true)}
            >
              <ArrowLeftRight className="h-4 w-4" />
              {transferMut.isPending
                ? 'Transferring…'
                : `Transfer Students (${selectedIds.length})`}
            </Button>
          </div>
        </div>

        <ShiftTransferConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          preview={firstPreview}
          bulkCount={selectedIds.length}
          pending={transferMut.isPending}
          onConfirm={() => transferMut.mutate()}
        />
      </AdminShell>
    </DashboardShell>
  );
}

function StatCard({
  icon,
  iconBg,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <AdminGlassCard className="flex items-center gap-3 p-3.5">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', iconBg)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-xl font-bold leading-tight">{value}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </AdminGlassCard>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      <select
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function RadioOption({
  checked,
  onChange,
  title,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer gap-2.5 rounded-lg border border-border/70 px-3 py-2',
        checked && !disabled ? 'border-primary/50 bg-primary/5' : '',
        disabled ? 'cursor-not-allowed opacity-60' : 'hover:bg-muted/30',
      )}
    >
      <input
        type="radio"
        className="mt-1"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

function PreviewChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'primary' | 'success';
}) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 font-semibold',
        tone === 'primary' && 'bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200',
        tone === 'success' &&
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
        tone === 'neutral' && 'bg-muted text-foreground',
      )}
    >
      {label}
    </span>
  );
}

function StudentRow({
  row,
  checked,
  onToggle,
  preview,
  previewError,
  showPreview,
}: {
  row: StudentDirectoryRow;
  checked: boolean;
  onToggle: () => void;
  preview?: ShiftTransferPreview;
  previewError?: string;
  showPreview: boolean;
}) {
  const name = row.displayFullName || row.fullName;
  return (
    <tr className="border-b border-border/40 hover:bg-muted/20">
      <td className="px-3 py-2.5">
        <input type="checkbox" checked={checked} onChange={onToggle} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[11px] font-bold text-sky-800 dark:bg-sky-950/50 dark:text-sky-200">
            {initials(name) || '?'}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {row.enrollmentNumber || row.admissionNumber || '—'}
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {row.rollNumber || '—'}
        </span>
      </td>
      <td className="px-3 py-2.5 text-xs">{row.programme || row.programmeCode || '—'}</td>
      <td className="px-3 py-2.5 text-xs">{row.semester ?? '—'}</td>
      <td className="px-3 py-2.5 text-xs">{row.majorSubject || '—'}</td>
      <td className="px-3 py-2.5">
        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
          {row.shift || '—'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        {showPreview ? (
          preview?.previewRollNumber ? (
            <span className="inline-flex rounded-full bg-sky-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
              {preview.previewRollNumber}
            </span>
          ) : previewError ? (
            <span className="text-[11px] text-destructive">{previewError}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground">…</span>
          )
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
      </td>
    </tr>
  );
}
