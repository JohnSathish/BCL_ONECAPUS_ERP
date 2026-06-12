'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Eye,
  History,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Upload,
  Users,
} from 'lucide-react';

import {
  ASSIGNMENT_REASONS,
  defaultPayScaleForStaffType,
  formatInr,
  payScaleLabel,
  staffCategoryLabel,
  summarizeSalaryPreview,
  type SalaryPreviewLine,
} from '@/components/hr-module/pay-scale-utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GlassCard } from '@/components/erp/glass-card';
import { Input } from '@/components/ui/input';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { resolveUploadAssetUrl } from '@/lib/branding-asset';
import { fetchAcademicDepartments } from '@/services/organization';
import {
  archivePayAssignment,
  backfillPayAssignments,
  bulkCreatePayAssignments,
  createPayAssignment,
  fetchPayAssignmentStats,
  fetchPayAssignments,
  fetchPayStructures,
  fetchSalaryRevisions,
  fetchStaffLoans,
  previewPayStructure,
} from '@/services/payroll';
import {
  buildStatutoryOverrides,
  parseStatutoryOverrides,
  supportsFixedAllowance,
} from '@/components/hr-module/pay-statutory-utils';
import { fetchDesignations, fetchStaff, fetchStaffProfile } from '@/services/staff';
import { PAY_SCALE_TYPES, type StaffPayAssignment } from '@/types/payroll';
import type { StaffDirectoryRow, StaffProfile } from '@/types/staff';
import { STAFF_TYPES } from '@/types/staff';
import { apiErrorMessage } from '@/utils/api-error';
import {
  commitPayAssignmentImport,
  downloadPayAssignmentTemplate,
  validatePayAssignmentImport,
} from '@/services/hr';

type SalaryRevisionRow = {
  id: string;
  revisionType: string;
  effectiveFrom: string;
  afterSnapshot?: { basicPay?: number };
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card px-4 py-3 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-xs font-medium text-muted-foreground">{children}</label>;
}

export function PayAssignmentsPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const now = new Date();

  const [message, setMessage] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [showStaffResults, setShowStaffResults] = useState(false);

  const [filterDepartmentId, setFilterDepartmentId] = useState('');
  const [filterStaffType, setFilterStaffType] = useState('');
  const [filterDesignationId, setFilterDesignationId] = useState('');
  const [filterPayScale, setFilterPayScale] = useState('');
  const [tableSearch, setTableSearch] = useState('');

  const [form, setForm] = useState({
    payStructureTemplateId: '',
    payScaleType: 'COLLEGE_TEACHING',
    basicPay: 50000,
    effectiveFrom: now.toISOString().slice(0, 10),
    reason: 'New Appointment',
    pfExempt: false,
    houseRent: 0,
    fixedAllowance: 0,
  });

  const [viewAssignment, setViewAssignment] = useState<StaffPayAssignment | null>(null);
  const [historyStaffId, setHistoryStaffId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    total: number;
    valid: number;
    invalid: number;
  } | null>(null);
  const [bulkForm, setBulkForm] = useState({
    payStructureTemplateId: '',
    payScaleType: 'UGC',
    staffType: 'TEACHING',
    departmentId: '',
    effectiveFrom: now.toISOString().slice(0, 10),
    reason: 'Pay Scale Migration',
  });

  const statsQ = useQuery({
    queryKey: ['payroll', 'assignments', 'stats'],
    queryFn: fetchPayAssignmentStats,
    enabled,
  });

  const structuresQ = useQuery({
    queryKey: ['payroll', 'structures'],
    queryFn: () => fetchPayStructures(),
    enabled,
  });

  const departmentsQ = useQuery({
    queryKey: ['departments', 'academic'],
    queryFn: () => fetchAcademicDepartments(),
    enabled,
  });

  const designationsQ = useQuery({
    queryKey: ['staff', 'designations', filterStaffType],
    queryFn: () => fetchDesignations(filterStaffType || undefined),
    enabled,
  });

  const staffSearchQ = useQuery({
    queryKey: ['payroll', 'staff-search', staffSearch],
    queryFn: () =>
      fetchStaff({
        search: staffSearch.trim(),
        limit: 12,
        status: 'ACTIVE',
        departmentId: filterDepartmentId || undefined,
        staffType: filterStaffType || undefined,
      }),
    enabled: enabled && staffSearch.trim().length >= 2,
  });

  const profileQ = useQuery({
    queryKey: ['staff', selectedStaffId, 'profile'],
    queryFn: () => fetchStaffProfile(selectedStaffId),
    enabled: enabled && Boolean(selectedStaffId),
  });

  const staffAssignmentQ = useQuery({
    queryKey: ['payroll', 'assignments', 'staff', selectedStaffId],
    queryFn: () => fetchPayAssignments({ staffProfileId: selectedStaffId, status: 'ACTIVE' }),
    enabled: enabled && Boolean(selectedStaffId),
  });

  const assignmentsQ = useQuery({
    queryKey: [
      'payroll',
      'assignments',
      filterDepartmentId,
      filterStaffType,
      filterDesignationId,
      filterPayScale,
      tableSearch,
    ],
    queryFn: () =>
      fetchPayAssignments({
        departmentId: filterDepartmentId || undefined,
        staffType: filterStaffType || undefined,
        designationId: filterDesignationId || undefined,
        payScaleType: filterPayScale || undefined,
        search: tableSearch.trim() || undefined,
        status: 'ACTIVE',
      }),
    enabled,
  });

  const previewQ = useQuery({
    queryKey: [
      'payroll',
      'preview',
      form.payStructureTemplateId,
      form.basicPay,
      form.pfExempt,
      form.houseRent,
      form.fixedAllowance,
    ],
    queryFn: () =>
      previewPayStructure(
        form.payStructureTemplateId,
        form.basicPay,
        buildStatutoryOverrides({
          pfExempt: form.pfExempt,
          houseRent: form.houseRent,
          fixedAllowance: form.fixedAllowance,
        }),
      ),
    enabled: enabled && Boolean(form.payStructureTemplateId) && form.basicPay > 0,
  });

  const loansQ = useQuery({
    queryKey: ['payroll', 'loans', selectedStaffId],
    queryFn: () => fetchStaffLoans(selectedStaffId, 'ACTIVE'),
    enabled: enabled && Boolean(selectedStaffId),
  });

  const historyQ = useQuery({
    queryKey: ['payroll', 'revisions', historyStaffId],
    queryFn: () => fetchSalaryRevisions(historyStaffId),
    enabled: enabled && Boolean(historyStaffId) && showHistory,
  });

  const assignmentHistoryQ = useQuery({
    queryKey: ['payroll', 'assignments', 'history', historyStaffId],
    queryFn: () => fetchPayAssignments({ staffProfileId: historyStaffId, status: 'ALL' }),
    enabled: enabled && Boolean(historyStaffId) && showHistory,
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['payroll'] });

  const assignMut = useMutation({
    mutationFn: () =>
      createPayAssignment({
        staffProfileId: selectedStaffId,
        payStructureTemplateId: form.payStructureTemplateId,
        payScaleType: form.payScaleType,
        basicPay: form.basicPay,
        effectiveFrom: form.effectiveFrom,
        notes: form.reason,
        pfExempt: form.pfExempt,
        houseRent: form.houseRent,
        fixedAllowance: supportsFixedAllowance(form.payScaleType) ? form.fixedAllowance : undefined,
      }),
    onSuccess: () => {
      setMessage('Pay assignment saved.');
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not save assignment')),
  });

  const bulkMut = useMutation({
    mutationFn: () =>
      bulkCreatePayAssignments({
        payStructureTemplateId: bulkForm.payStructureTemplateId,
        payScaleType: bulkForm.payScaleType,
        effectiveFrom: bulkForm.effectiveFrom,
        notes: bulkForm.reason,
        staffType: bulkForm.staffType || undefined,
        departmentId: bulkForm.departmentId || undefined,
      }),
    onSuccess: (res) => {
      setMessage(`Bulk assignment: ${res.created} created, ${res.skipped} skipped.`);
      setBulkOpen(false);
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Bulk assignment failed')),
  });

  const archiveMut = useMutation({
    mutationFn: archivePayAssignment,
    onSuccess: () => {
      setMessage('Assignment archived.');
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Could not archive')),
  });

  const backfillMut = useMutation({
    mutationFn: backfillPayAssignments,
    onSuccess: (r) => {
      setMessage(`Backfilled ${r.created} assignments.`);
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Backfill failed')),
  });

  const importValidateMut = useMutation({
    mutationFn: (file: File) => validatePayAssignmentImport(file),
    onSuccess: (r) => setImportPreview({ total: r.total, valid: r.valid, invalid: r.invalid }),
    onError: (e) => setMessage(apiErrorMessage(e, 'Import validation failed')),
  });

  const importCommitMut = useMutation({
    mutationFn: (file: File) => commitPayAssignmentImport(file),
    onSuccess: (r) => {
      setMessage(`Import complete: ${r.created} created, ${r.skipped} skipped.`);
      setImportOpen(false);
      setImportFile(null);
      setImportPreview(null);
      invalidate();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Import failed')),
  });

  const downloadTemplate = async () => {
    const blob = await downloadPayAssignmentTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pay-assignment-import-template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectStaff = (row: StaffDirectoryRow) => {
    setSelectedStaffId(row.id);
    setStaffSearch(row.fullName);
    setShowStaffResults(false);
    setShowHistory(false);
    setHistoryStaffId('');
  };

  useEffect(() => {
    if (!profileQ.data) return;
    const profile = profileQ.data;
    const active = staffAssignmentQ.data?.[0];
    const basic = active
      ? Number(active.basicPay)
      : profile.basicPay != null
        ? Number(profile.basicPay)
        : 50000;
    const scale = active?.payScaleType ?? defaultPayScaleForStaffType(profile.staffType);
    const structureId =
      active?.payStructureTemplate?.id ??
      structuresQ.data?.find((s) => s.payScaleTypes?.includes(scale))?.id ??
      structuresQ.data?.[0]?.id ??
      '';

    const statutory = parseStatutoryOverrides(active?.componentOverrides);
    setForm((f) => ({
      ...f,
      basicPay: basic,
      payScaleType: scale,
      payStructureTemplateId: structureId,
      pfExempt: statutory.pfExempt,
      houseRent: statutory.houseRent,
      fixedAllowance: statutory.fixedAllowance,
    }));
  }, [profileQ.data, staffAssignmentQ.data, structuresQ.data]);

  const salaryHistoryRows = useMemo(() => {
    const rows: Array<{ id: string; effectiveFrom: string; basicPay: number; label: string }> = [];
    for (const a of assignmentHistoryQ.data ?? []) {
      rows.push({
        id: `a-${a.id}`,
        effectiveFrom: a.effectiveFrom,
        basicPay: Number(a.basicPay),
        label: a.notes ?? payScaleLabel(a.payScaleType),
      });
    }
    for (const r of (historyQ.data ?? []) as SalaryRevisionRow[]) {
      rows.push({
        id: `r-${r.id}`,
        effectiveFrom: r.effectiveFrom,
        basicPay: Number(r.afterSnapshot?.basicPay ?? 0),
        label: r.revisionType,
      });
    }
    return rows
      .filter((r) => r.basicPay > 0)
      .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
  }, [assignmentHistoryQ.data, historyQ.data]);

  const salaryPreview = useMemo(() => {
    const lines = (previewQ.data ?? []) as SalaryPreviewLine[];
    const loanDeduction = loansQ.data?.[0]?.monthlyDeduction
      ? Number(loansQ.data[0].monthlyDeduction)
      : 0;
    return summarizeSalaryPreview(lines, loanDeduction);
  }, [previewQ.data, loansQ.data]);

  const currentAssignment = staffAssignmentQ.data?.[0];
  const profile = profileQ.data;

  const resolveStructureId = (a: StaffPayAssignment) => {
    if (a.payStructureTemplate?.id) return a.payStructureTemplate.id;
    const tpl = a.payStructureTemplate;
    return (
      structuresQ.data?.find(
        (s) => (tpl?.code && s.code === tpl.code) || (tpl?.name && s.name === tpl.name),
      )?.id ??
      structuresQ.data?.[0]?.id ??
      ''
    );
  };

  const loadAssignmentForEdit = (a: StaffPayAssignment) => {
    const statutory = parseStatutoryOverrides(a.componentOverrides);
    setSelectedStaffId(a.staffProfileId);
    setStaffSearch(a.staffProfile?.fullName ?? '');
    setForm({
      payStructureTemplateId: resolveStructureId(a),
      payScaleType: a.payScaleType,
      basicPay: Number(a.basicPay),
      effectiveFrom: a.effectiveFrom.slice(0, 10),
      reason: a.notes ?? 'Salary Revision',
      pfExempt: statutory.pfExempt,
      houseRent: statutory.houseRent,
      fixedAllowance: statutory.fixedAllowance,
    });
  };

  const filteredStructures = useMemo(() => {
    const all = structuresQ.data ?? [];
    return all.filter(
      (s) => !s.payScaleTypes?.length || s.payScaleTypes.includes(form.payScaleType),
    );
  }, [structuresQ.data, form.payScaleType]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Pay Assignments</h2>
          <p className="text-sm text-muted-foreground">
            Assign pay structures to staff with live salary preview.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <Users className="mr-2 h-4 w-4" /> Bulk Assignment
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={backfillMut.isPending}
            onClick={() => backfillMut.mutate()}
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Backfill from Profiles
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Assigned" value={statsQ.data?.totalAssigned ?? '—'} />
        <StatCard label="Teaching Staff" value={statsQ.data?.teachingStaff ?? '—'} />
        <StatCard label="Non-Teaching" value={statsQ.data?.nonTeachingStaff ?? '—'} />
        <StatCard label="UGC Scale" value={statsQ.data?.ugcScaleStaff ?? '—'} />
        <StatCard label="State Scale" value={statsQ.data?.stateScaleStaff ?? '—'} />
        <StatCard label="Contract / Guest" value={statsQ.data?.contractStaff ?? '—'} />
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-border/60 bg-muted/20 p-3">
        <select
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          value={filterDepartmentId}
          onChange={(e) => setFilterDepartmentId(e.target.value)}
        >
          <option value="">All departments</option>
          {(departmentsQ.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          value={filterStaffType}
          onChange={(e) => {
            setFilterStaffType(e.target.value);
            setFilterDesignationId('');
          }}
        >
          <option value="">All categories</option>
          {STAFF_TYPES.map((t) => (
            <option key={t} value={t}>
              {staffCategoryLabel(t)}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          value={filterDesignationId}
          onChange={(e) => setFilterDesignationId(e.target.value)}
        >
          <option value="">All designations</option>
          {(designationsQ.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          value={filterPayScale}
          onChange={(e) => setFilterPayScale(e.target.value)}
        >
          <option value="">All pay scales</option>
          {PAY_SCALE_TYPES.map((t) => (
            <option key={t} value={t}>
              {payScaleLabel(t)}
            </option>
          ))}
        </select>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {(filterPayScale === 'COLLEGE_NON_TEACHING' || filterPayScale === '') && (
        <GlassCard className="border-blue-500/20 bg-blue-500/5 p-4">
          <h3 className="text-sm font-semibold">Non-Teaching Payroll — Production Checklist</h3>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
            <li>
              Ensure all non-teaching staff exist in{' '}
              <Link href="/admin/staff" className="text-primary hover:underline">
                Staff Directory
              </Link>{' '}
              (import via Staff → Import if needed).
            </li>
            <li>
              <strong>Import Excel</strong> above — use the <em>DBC Non-Teaching Sheet</em> tab
              (Name, Basic, Fixed Allowance) or paste your May salary sheet.
            </li>
            <li>
              Assign pay structure <strong>DBC Non-Teaching</strong> (or enter Basic + Fixed
              Allowance manually per staff).
            </li>
            <li>
              Create payroll run:{' '}
              <Link href="/admin/hr/payroll/runs" className="text-primary hover:underline">
                Payroll Runs
              </Link>{' '}
              → Month <strong>May 2026</strong>, scale <strong>COLLEGE_NON_TEACHING</strong> →
              Calculate → Verify → Publish.
            </li>
            <li>
              Export <strong>DBC Non-Teaching</strong> Excel from Reports and bank transfer file
              after publish.
            </li>
          </ol>
        </GlassCard>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(360px,420px)_1fr]">
        <GlassCard className="space-y-4 p-4">
          <h3 className="font-semibold">New Pay Assignment</h3>

          <div className="relative">
            <FieldLabel>Search Staff</FieldLabel>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name, employee code, mobile, department…"
                value={staffSearch}
                onChange={(e) => {
                  setStaffSearch(e.target.value);
                  setShowStaffResults(true);
                  if (!e.target.value.trim()) setSelectedStaffId('');
                }}
                onFocus={() => setShowStaffResults(true)}
                className="pl-9"
              />
            </div>
            {showStaffResults && staffSearch.trim().length >= 2 ? (
              <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg">
                {staffSearchQ.isLoading ? (
                  <p className="p-3 text-xs text-muted-foreground">Searching…</p>
                ) : staffSearchQ.data?.data?.length ? (
                  staffSearchQ.data.data.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className="flex w-full gap-3 border-b border-border/60 px-3 py-2 text-left hover:bg-muted/60"
                      onClick={() => selectStaff(row)}
                    >
                      {row.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveUploadAssetUrl(row.photoUrl) ?? ''}
                          alt=""
                          className="h-10 w-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted font-bold">
                          {row.fullName.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{row.fullName}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Employee ID: {row.employeeCode}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {[row.department, row.designation].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="p-3 text-xs text-muted-foreground">No staff found.</p>
                )}
              </div>
            ) : null}
          </div>

          {profile ? (
            <StaffSummaryCard profile={profile} currentAssignment={currentAssignment} />
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              Search and select a staff member to begin.
            </div>
          )}

          <div className="grid gap-3">
            <div>
              <FieldLabel>Pay Structure</FieldLabel>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                value={form.payStructureTemplateId}
                onChange={(e) => setForm({ ...form, payStructureTemplateId: e.target.value })}
              >
                <option value="">Select structure</option>
                {filteredStructures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Pay Scale Category</FieldLabel>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                value={form.payScaleType}
                onChange={(e) => setForm({ ...form, payScaleType: e.target.value })}
              >
                {PAY_SCALE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {payScaleLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Basic Pay (₹)</FieldLabel>
                <Input
                  type="number"
                  className="mt-1"
                  value={form.basicPay}
                  onChange={(e) => setForm({ ...form, basicPay: Number(e.target.value) })}
                />
              </div>
              {supportsFixedAllowance(form.payScaleType) ? (
                <div>
                  <FieldLabel>Fixed Allowance (₹)</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    className="mt-1"
                    value={form.fixedAllowance}
                    onChange={(e) => setForm({ ...form, fixedAllowance: Number(e.target.value) })}
                  />
                  <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                    Leave 0 to use the pay structure formula (e.g. 20% of basic).
                  </p>
                </div>
              ) : (
                <div>
                  <FieldLabel>Effective From</FieldLabel>
                  <Input
                    type="date"
                    className="mt-1"
                    value={form.effectiveFrom}
                    onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                  />
                </div>
              )}
            </div>
            {supportsFixedAllowance(form.payScaleType) ? (
              <div>
                <FieldLabel>Effective From</FieldLabel>
                <Input
                  type="date"
                  className="mt-1 max-w-[calc(50%-0.375rem)]"
                  value={form.effectiveFrom}
                  onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                />
              </div>
            ) : null}
            <div>
              <FieldLabel>Reason</FieldLabel>
              <select
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              >
                {ASSIGNMENT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {(form.payScaleType === 'COLLEGE_TEACHING' || form.payScaleType === 'UGC') && (
              <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Statutory Options
                </p>
                {form.payScaleType === 'COLLEGE_TEACHING' ? (
                  <label className="flex cursor-pointer items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={form.pfExempt}
                      onChange={(e) => setForm({ ...form, pfExempt: e.target.checked })}
                    />
                    <span>
                      <span className="font-medium">PF Exempt</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        No employer PF added to gross and no employee/PPF deduction (e.g. staff
                        above PF criteria or opted out).
                      </span>
                    </span>
                  </label>
                ) : null}
                <div>
                  <FieldLabel>House Rent Deduction (₹)</FieldLabel>
                  <Input
                    type="number"
                    min={0}
                    className="mt-1"
                    value={form.houseRent}
                    onChange={(e) => setForm({ ...form, houseRent: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}
          </div>

          {form.payStructureTemplateId ? (
            <SalaryPreviewPanel
              preview={salaryPreview}
              basicPay={form.basicPay}
              loading={previewQ.isFetching}
            />
          ) : null}

          {profile && showHistory && historyStaffId === profile.id ? (
            <SalaryHistoryPanel
              rows={salaryHistoryRows}
              loading={historyQ.isFetching || assignmentHistoryQ.isFetching}
            />
          ) : profile ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => {
                setHistoryStaffId(profile.id);
                setShowHistory(true);
              }}
            >
              <History className="mr-1 h-3 w-3" /> Show salary history
            </Button>
          ) : null}

          <Button
            className="w-full"
            disabled={!selectedStaffId || !form.payStructureTemplateId || assignMut.isPending}
            onClick={() => assignMut.mutate()}
          >
            {assignMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Assignment
          </Button>
        </GlassCard>

        <GlassCard className="flex flex-col p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">Active Pay Assignments</h3>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search assignments…"
                className="h-8 pl-8 text-xs"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="min-h-[420px] flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-2">Staff</th>
                  <th className="py-2 pr-2">Structure</th>
                  <th className="py-2 pr-2">Basic</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignmentsQ.isLoading ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : assignmentsQ.data?.length ? (
                  assignmentsQ.data.map((a) => (
                    <tr key={a.id} className="border-b border-border/60">
                      <td className="py-2 pr-2">
                        <p className="font-medium">{a.staffProfile?.fullName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {a.staffProfile?.employeeCode}
                        </p>
                      </td>
                      <td className="py-2 pr-2">
                        <p>{payScaleLabel(a.payScaleType)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {a.payStructureTemplate?.name}
                        </p>
                        {parseStatutoryOverrides(a.componentOverrides).pfExempt ? (
                          <span className="mt-0.5 inline-block rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                            PF Exempt
                          </span>
                        ) : null}
                        {parseStatutoryOverrides(a.componentOverrides).fixedAllowance > 0 ? (
                          <span className="mt-0.5 inline-block rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-800">
                            FA{' '}
                            {formatInr(
                              parseStatutoryOverrides(a.componentOverrides).fixedAllowance,
                            )}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2 tabular-nums">{formatInr(Number(a.basicPay))}</td>
                      <td className="py-2 pr-2">
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          {a.status}
                        </span>
                      </td>
                      <td className="py-2">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="View"
                            onClick={() => setViewAssignment(a)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Edit"
                            onClick={() => loadAssignmentForEdit(a)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="History"
                            onClick={() => {
                              setHistoryStaffId(a.staffProfileId);
                              setShowHistory(true);
                              setSelectedStaffId(a.staffProfileId);
                              setStaffSearch(a.staffProfile?.fullName ?? '');
                            }}
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive"
                            title="Archive"
                            onClick={() => archiveMut.mutate(a.id)}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      No active assignments match filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      <Dialog open={Boolean(viewAssignment)} onOpenChange={() => setViewAssignment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assignment Details</DialogTitle>
          </DialogHeader>
          {viewAssignment ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Staff:</span>{' '}
                {viewAssignment.staffProfile?.fullName}
              </p>
              <p>
                <span className="text-muted-foreground">Employee ID:</span>{' '}
                {viewAssignment.staffProfile?.employeeCode}
              </p>
              <p>
                <span className="text-muted-foreground">Structure:</span>{' '}
                {viewAssignment.payStructureTemplate?.name}
              </p>
              <p>
                <span className="text-muted-foreground">Pay scale:</span>{' '}
                {payScaleLabel(viewAssignment.payScaleType)}
              </p>
              <p>
                <span className="text-muted-foreground">Basic pay:</span>{' '}
                {formatInr(Number(viewAssignment.basicPay))}
              </p>
              <p>
                <span className="text-muted-foreground">Effective from:</span>{' '}
                {viewAssignment.effectiveFrom.slice(0, 10)}
              </p>
              {viewAssignment.notes ? (
                <p>
                  <span className="text-muted-foreground">Reason:</span> {viewAssignment.notes}
                </p>
              ) : null}
              {parseStatutoryOverrides(viewAssignment.componentOverrides).pfExempt ? (
                <p>
                  <span className="text-muted-foreground">PF:</span> Exempt (no employer or employee
                  PF)
                </p>
              ) : null}
              {parseStatutoryOverrides(viewAssignment.componentOverrides).houseRent > 0 ? (
                <p>
                  <span className="text-muted-foreground">House rent:</span>{' '}
                  {formatInr(parseStatutoryOverrides(viewAssignment.componentOverrides).houseRent)}
                </p>
              ) : null}
              {parseStatutoryOverrides(viewAssignment.componentOverrides).fixedAllowance > 0 ? (
                <p>
                  <span className="text-muted-foreground">Fixed allowance:</span>{' '}
                  {formatInr(
                    parseStatutoryOverrides(viewAssignment.componentOverrides).fixedAllowance,
                  )}
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewAssignment(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bulk Pay Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Assign a pay structure to all active staff matching the filters below. Staff without
              basic pay are skipped.
            </p>
            <div>
              <FieldLabel>Staff category</FieldLabel>
              <select
                className="mt-1 w-full rounded-md border px-2 py-2"
                value={bulkForm.staffType}
                onChange={(e) => setBulkForm({ ...bulkForm, staffType: e.target.value })}
              >
                <option value="">All categories</option>
                {STAFF_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {staffCategoryLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Department (optional)</FieldLabel>
              <select
                className="mt-1 w-full rounded-md border px-2 py-2"
                value={bulkForm.departmentId}
                onChange={(e) => setBulkForm({ ...bulkForm, departmentId: e.target.value })}
              >
                <option value="">All departments</option>
                {(departmentsQ.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Pay scale</FieldLabel>
              <select
                className="mt-1 w-full rounded-md border px-2 py-2"
                value={bulkForm.payScaleType}
                onChange={(e) => setBulkForm({ ...bulkForm, payScaleType: e.target.value })}
              >
                {PAY_SCALE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {payScaleLabel(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Pay structure</FieldLabel>
              <select
                className="mt-1 w-full rounded-md border px-2 py-2"
                value={bulkForm.payStructureTemplateId}
                onChange={(e) =>
                  setBulkForm({ ...bulkForm, payStructureTemplateId: e.target.value })
                }
              >
                <option value="">Select structure</option>
                {(structuresQ.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel>Effective from</FieldLabel>
                <Input
                  type="date"
                  className="mt-1"
                  value={bulkForm.effectiveFrom}
                  onChange={(e) => setBulkForm({ ...bulkForm, effectiveFrom: e.target.value })}
                />
              </div>
              <div>
                <FieldLabel>Reason</FieldLabel>
                <select
                  className="mt-1 w-full rounded-md border px-2 py-2"
                  value={bulkForm.reason}
                  onChange={(e) => setBulkForm({ ...bulkForm, reason: e.target.value })}
                >
                  {ASSIGNMENT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!bulkForm.payStructureTemplateId || bulkMut.isPending}
              onClick={() => bulkMut.mutate()}
            >
              {bulkMut.isPending ? 'Assigning…' : 'Run Bulk Assignment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Pay Assignments from Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Upload the standard template, paste a DBC salary sheet, or use the{' '}
              <strong>DBC Non-Teaching Sheet</strong> tab (Name + Basic + Fixed Allowance).
              Structures: <strong>DBC_UGC_7TH</strong>, <strong>DBC_TEACHING_LEGACY</strong>,{' '}
              <strong>DBC_NON_TEACHING</strong>.
            </p>
            <Button variant="outline" size="sm" onClick={() => void downloadTemplate()}>
              Download Template
            </Button>
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setImportFile(file);
                setImportPreview(null);
                if (file) importValidateMut.mutate(file);
              }}
            />
            {importPreview ? (
              <p className="text-xs">
                {importPreview.valid} valid / {importPreview.invalid} invalid of{' '}
                {importPreview.total} rows
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!importFile || !importPreview?.valid || importCommitMut.isPending}
              onClick={() => importFile && importCommitMut.mutate(importFile)}
            >
              {importCommitMut.isPending ? 'Importing…' : 'Import Valid Rows'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StaffSummaryCard({
  profile,
  currentAssignment,
}: {
  profile: StaffProfile;
  currentAssignment?: StaffPayAssignment;
}) {
  const photo = profile.photoUrl ? resolveUploadAssetUrl(profile.photoUrl) : null;
  return (
    <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="h-16 w-16 rounded-lg border object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-muted text-lg font-bold">
          {profile.fullName.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold uppercase tracking-wide">{profile.fullName}</p>
        <dl className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          <div className="flex gap-2">
            <dt className="w-24 shrink-0">Employee ID</dt>
            <dd className="font-medium text-foreground">{profile.employeeCode}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0">Department</dt>
            <dd className="text-foreground">{profile.department ?? '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0">Designation</dt>
            <dd className="text-foreground">{profile.designation ?? '—'}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0">Category</dt>
            <dd className="text-foreground">{staffCategoryLabel(profile.staffType)}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-24 shrink-0">Current Pay</dt>
            <dd className="font-semibold text-foreground">
              {currentAssignment
                ? formatInr(Number(currentAssignment.basicPay))
                : profile.basicPay != null
                  ? formatInr(Number(profile.basicPay))
                  : '—'}
            </dd>
          </div>
          {currentAssignment?.payStructureTemplate?.name ? (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0">Structure</dt>
              <dd className="text-foreground">{currentAssignment.payStructureTemplate.name}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

function SalaryPreviewPanel({
  preview,
  basicPay,
  loading,
}: {
  preview: ReturnType<typeof summarizeSalaryPreview>;
  basicPay: number;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Salary Preview
      </p>
      {loading ? (
        <p className="text-xs text-muted-foreground">Calculating…</p>
      ) : (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between font-medium">
            <span>Basic Pay</span>
            <span>{formatInr(basicPay)}</span>
          </div>
          {preview.earnings
            .filter((l) => l.code.toUpperCase() !== 'BASIC')
            .map((l) => (
              <div key={l.code} className="flex justify-between text-muted-foreground">
                <span>{l.name}</span>
                <span>{formatInr(l.amount)}</span>
              </div>
            ))}
          <div className="flex justify-between border-t border-border/60 pt-1 font-semibold">
            <span>Gross Salary</span>
            <span>{formatInr(preview.gross)}</span>
          </div>
          {preview.deductionLines.map((l) => (
            <div key={l.code} className="flex justify-between text-muted-foreground">
              <span>{l.name}</span>
              <span>{formatInr(l.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t border-border/60 pt-1 text-base font-bold text-primary">
            <span>Net Salary</span>
            <span>{formatInr(preview.net)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function SalaryHistoryPanel({
  rows,
  loading,
}: {
  rows: Array<{ id: string; effectiveFrom: string; basicPay: number; label: string }>;
  loading?: boolean;
}) {
  if (loading) return <p className="text-xs text-muted-foreground">Loading salary history…</p>;
  if (!rows.length) return <p className="text-xs text-muted-foreground">No salary history yet.</p>;
  return (
    <div className="rounded-lg border border-border/60 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Salary History
      </p>
      <ul className="space-y-1 text-xs">
        {rows.map((r) => (
          <li key={r.id} className="flex justify-between gap-2">
            <span>
              {new Date(r.effectiveFrom).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
            <span className="font-medium tabular-nums">{formatInr(r.basicPay)}</span>
            <span className="truncate text-muted-foreground">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
