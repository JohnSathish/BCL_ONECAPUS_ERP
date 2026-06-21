'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  Download,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  UserX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  bulkGenerateRollNumbers,
  fetchRollNumberDataCleanup,
  syncRollNumberSequences,
  type BulkGenerateRollNumbersResult,
  type RollNumberPreviewRow,
} from '@/services/roll-number';
import { cn } from '@/utils/cn';

function exportPreviewCsv(rows: RollNumberPreviewRow[], filename: string) {
  const headers = [
    'Student Name',
    'Application No',
    'Admission No',
    'Programme',
    'Department',
    'Batch',
    'Semester',
    'Gender',
    'Current Roll',
    'New Roll',
    'Status',
    'Remarks',
  ];
  const body = rows.map((r) =>
    [
      r.fullName ?? '',
      r.applicationNumber ?? '',
      r.admissionNumber ?? '',
      r.programme ?? '',
      r.department ?? '',
      r.batch ?? '',
      r.semester ?? '',
      r.gender ?? '',
      r.currentRollNumber ?? '',
      r.newRollNumber ?? '',
      r.generationStatus,
      r.remarks.join('; '),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  const csv = [headers.join(','), ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn('mt-1 text-2xl font-bold', tone)}>{value}</p>
    </div>
  );
}

export function RollNumberGenerationPanel() {
  const [admissionYear, setAdmissionYear] = useState('');
  const [bulkResult, setBulkResult] = useState<BulkGenerateRollNumbersResult | null>(null);
  const [workflowStep, setWorkflowStep] = useState<1 | 2 | 3 | 4>(1);
  const [search, setSearch] = useState('');
  const [programmeFilter, setProgrammeFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [batchFilter, setBatchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<'name' | 'roll' | 'department'>('name');
  const [scopeFilter, setScopeFilter] = useState<{
    streamId?: string;
    departmentId?: string;
    semesterNo?: number;
  }>({});

  const cleanupQ = useQuery({
    queryKey: ['admin', 'roll-number-cleanup'],
    queryFn: fetchRollNumberDataCleanup,
  });

  const bulkMut = useMutation({
    mutationFn: bulkGenerateRollNumbers,
    onSuccess: (data) => {
      setBulkResult(data);
      if (data.generated > 0) setWorkflowStep(4);
      else if (!data.summary?.ready) setWorkflowStep(1);
      else setWorkflowStep(2);
    },
  });

  const syncMut = useMutation({
    mutationFn: () => syncRollNumberSequences(),
  });

  const buildPayload = (overrides?: Partial<typeof scopeFilter>) => ({
    dryRun: true as const,
    admissionYear: admissionYear ? Number(admissionYear) : undefined,
    excludeStudentIds: Array.from(excluded),
    ...scopeFilter,
    ...overrides,
  });

  const runValidate = () => {
    cleanupQ.refetch();
    setWorkflowStep(1);
    bulkMut.mutate(buildPayload());
  };

  const runPreview = () => {
    setWorkflowStep(2);
    bulkMut.mutate(buildPayload());
  };

  const rows = bulkResult?.preview ?? [];

  const programmes = useMemo(
    () => [...new Set(rows.map((r) => r.programme).filter(Boolean))] as string[],
    [rows],
  );
  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.department).filter(Boolean))] as string[],
    [rows],
  );
  const batches = useMemo(
    () => [...new Set(rows.map((r) => r.batch).filter(Boolean))] as string[],
    [rows],
  );

  const filtered = useMemo(() => {
    let list = [...rows];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.fullName?.toLowerCase().includes(q) ||
          r.applicationNumber?.toLowerCase().includes(q) ||
          r.admissionNumber?.toLowerCase().includes(q),
      );
    }
    if (programmeFilter) list = list.filter((r) => r.programme === programmeFilter);
    if (departmentFilter) list = list.filter((r) => r.department === departmentFilter);
    if (batchFilter) list = list.filter((r) => r.batch === batchFilter);
    if (statusFilter) list = list.filter((r) => r.generationStatus === statusFilter);

    list.sort((a, b) => {
      if (sortKey === 'roll') {
        return String(a.newRollNumber ?? '').localeCompare(String(b.newRollNumber ?? ''));
      }
      if (sortKey === 'department') {
        return String(a.department ?? '').localeCompare(String(b.department ?? ''));
      }
      return String(a.fullName ?? '').localeCompare(String(b.fullName ?? ''));
    });
    return list;
  }, [rows, search, programmeFilter, departmentFilter, batchFilter, statusFilter, sortKey]);

  const duplicateRolls = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (r.newRollNumber) counts.set(r.newRollNumber, (counts.get(r.newRollNumber) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, c]) => c > 1).map(([k]) => k));
  }, [rows]);

  const excludeTestRecords = () => {
    const testIds = rows.filter((r) => r.issues?.includes('TEST_RECORD')).map((r) => r.studentId);
    setExcluded(new Set([...excluded, ...testIds]));
  };

  const confirmGenerate = () => {
    const summary = bulkResult?.summary;
    const ready = summary?.ready ?? 0;
    const blocked = summary?.blocked ?? 0;
    const testRecords = summary?.testRecords ?? 0;
    const msg = [
      `${ready} student(s) will receive roll numbers.`,
      blocked > 0 ? `${blocked} record(s) are blocked and will be skipped.` : '',
      testRecords > 0 ? `${testRecords} test/dummy record(s) will be excluded automatically.` : '',
      'Continue?',
    ]
      .filter(Boolean)
      .join('\n');
    if (!window.confirm(msg)) return;
    setWorkflowStep(3);
    bulkMut.mutate({
      dryRun: false,
      admissionYear: admissionYear ? Number(admissionYear) : undefined,
      excludeStudentIds: Array.from(excluded),
      ...scopeFilter,
    });
  };

  const summary = bulkResult?.summary;

  const workflowSteps = [
    { n: 1, label: 'Validate Data' },
    { n: 2, label: 'Preview Roll Numbers' },
    { n: 3, label: 'Approve Generation' },
    { n: 4, label: 'Generate Roll Numbers' },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {workflowSteps.map((step) => (
          <div
            key={step.n}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              workflowStep >= step.n
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground',
            )}
          >
            Step {step.n}: {step.label}
            {workflowStep > step.n ? ' ✓' : ''}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="bulk-year">Admission year (optional)</Label>
          <Input
            id="bulk-year"
            type="number"
            placeholder="2026"
            className="w-32"
            value={admissionYear}
            onChange={(e) => setAdmissionYear(e.target.value)}
          />
        </div>
        <Button size="sm" variant="outline" disabled={bulkMut.isPending} onClick={runValidate}>
          {bulkMut.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          1. Validate Data
        </Button>
        <Button size="sm" variant="outline" disabled={bulkMut.isPending} onClick={runPreview}>
          2. Preview Roll Numbers
        </Button>
        <Button
          size="sm"
          disabled={bulkMut.isPending || !bulkResult || !(summary?.ready ?? 0)}
          onClick={confirmGenerate}
        >
          3–4. Generate Roll Numbers
        </Button>
        {bulkResult ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportPreviewCsv(rows, 'roll-number-preview.csv')}
          >
            <Download className="mr-1 h-3 w-3" />
            Export Preview
          </Button>
        ) : null}
      </div>

      {summary ? (
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-7">
          <SummaryCard label="Students Found" value={summary.totalFound} />
          <SummaryCard label="Ready For Generation" value={summary.ready} tone="text-emerald-600" />
          <SummaryCard
            label="Already Assigned"
            value={summary.alreadyAssigned ?? 0}
            tone="text-blue-600"
          />
          <SummaryCard label="Blocked" value={summary.blocked} tone="text-rose-600" />
          <SummaryCard label="Test Records" value={summary.testRecords} tone="text-amber-600" />
          <SummaryCard label="Missing Data" value={summary.missingData} />
          <SummaryCard label="Duplicates" value={summary.duplicatesDetected} />
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setScopeFilter({});
              runPreview();
            }}
          >
            Generate All
          </Button>
          {programmes.map((p) => (
            <Button
              key={p}
              size="sm"
              variant="outline"
              onClick={() => {
                setProgrammeFilter(p);
                setScopeFilter({});
                runPreview();
              }}
            >
              {p}
            </Button>
          ))}
          {departments.slice(0, 6).map((d) => (
            <Button
              key={d}
              size="sm"
              variant="outline"
              onClick={() => {
                setDepartmentFilter(d);
                setScopeFilter({});
                runPreview();
              }}
            >
              Dept: {d}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
          >
            Sync Sequences
          </Button>
        </div>
      ) : null}

      {bulkResult?.analysis ? (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-sm">
          <p className="font-semibold">Roll Number Generation Analysis</p>
          <p className="mt-1 text-muted-foreground">
            {summary?.totalFound ?? 0} students found · {summary?.ready ?? 0} ready ·{' '}
            {summary?.blocked ?? 0} blocked
          </p>
          {bulkResult.analysis.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-amber-800">
              {bulkResult.analysis.warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}
          {bulkResult.analysis.expectedNextByPrefix?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {bulkResult.analysis.expectedNextByPrefix.map((p) => (
                <span
                  key={`${p.prefix}${p.yearSuffix}`}
                  className="rounded-full bg-background px-2 py-1 font-mono"
                >
                  Next {p.prefix}
                  {p.yearSuffix}: {p.sample}
                </span>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {(bulkResult?.attention?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-rose-900">
            <ShieldAlert className="h-4 w-4" />
            Records Requiring Attention ({bulkResult!.attention!.length})
          </h3>
          <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-sm">
            {bulkResult!.attention!.map((a) => (
              <li key={a.studentId} className="rounded-lg bg-white/80 px-3 py-2">
                <p className="font-medium">{a.fullName ?? a.studentId.slice(0, 8)}</p>
                <p className="text-xs text-rose-800">{a.reasons.join(' · ')}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {bulkResult ? (
        <>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search name, application, admission no…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              value={programmeFilter}
              onChange={(e) => setProgrammeFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="">All programmes</option>
              {programmes.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="">All departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="">All batches</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="">All statuses</option>
              <option value="READY">Ready</option>
              <option value="BLOCKED">Blocked</option>
              <option value="SKIPPED">Skipped</option>
            </select>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="name">Sort: Name</option>
              <option value="roll">Sort: Roll</option>
              <option value="department">Sort: Department</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={excludeTestRecords}>
              <UserX className="mr-1 h-3 w-3" />
              Exclude Test Records
            </Button>
            <Button size="sm" variant="outline" onClick={() => setExcluded(new Set())}>
              Clear Exclusions
            </Button>
            <Button size="sm" variant="outline" onClick={runPreview}>
              <RefreshCw className="mr-1 h-3 w-3" />
              Regenerate Preview
            </Button>
          </div>

          <div className="max-h-[480px] overflow-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[1100px] text-xs">
              <thead className="sticky top-0 z-10 bg-muted/95 text-left shadow-sm">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Photo</th>
                  <th className="px-2 py-2">Student Name</th>
                  <th className="px-2 py-2">Application No</th>
                  <th className="px-2 py-2">Admission No</th>
                  <th className="px-2 py-2">Programme</th>
                  <th className="px-2 py-2">Department</th>
                  <th className="px-2 py-2">Batch</th>
                  <th className="px-2 py-2">Sem</th>
                  <th className="px-2 py-2">Gender</th>
                  <th className="px-2 py-2">Current Roll</th>
                  <th className="px-2 py-2">New Roll</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, index) => {
                  const isDup = row.newRollNumber && duplicateRolls.has(row.newRollNumber);
                  const missingInfo = row.issues?.some((i) => i.startsWith('MISSING'));
                  const isTest = row.issues?.includes('TEST_RECORD');
                  const isExcluded = excluded.has(row.studentId);
                  return (
                    <tr
                      key={row.studentId}
                      className={cn(
                        'border-t border-border/40',
                        index % 2 === 1 && 'bg-muted/20',
                        isDup && 'bg-rose-50/80',
                        missingInfo && 'bg-amber-50/50',
                        isTest && 'bg-rose-100/60',
                        isExcluded && 'opacity-50',
                      )}
                    >
                      <td className="px-2 py-2 text-muted-foreground">{index + 1}</td>
                      <td className="px-2 py-2">
                        {row.photoPath ? (
                          <span
                            className="inline-block h-8 w-8 rounded-full bg-muted"
                            title="Photo"
                          />
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-2 py-2 font-medium">{row.fullName ?? '—'}</td>
                      <td className="px-2 py-2 font-mono">{row.applicationNumber ?? '—'}</td>
                      <td className="px-2 py-2 font-mono">{row.admissionNumber ?? '—'}</td>
                      <td className="px-2 py-2">{row.programme ?? '—'}</td>
                      <td className="px-2 py-2">{row.department ?? '—'}</td>
                      <td className="px-2 py-2">{row.batch ?? '—'}</td>
                      <td className="px-2 py-2">{row.semester ?? '—'}</td>
                      <td className="px-2 py-2">{row.gender ?? '—'}</td>
                      <td className="px-2 py-2">{row.currentRollNumber ?? '—'}</td>
                      <td
                        className={cn(
                          'px-2 py-2 font-semibold font-mono',
                          isDup && 'text-rose-700',
                        )}
                      >
                        {row.newRollNumber ?? '—'}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            row.generationStatus === 'READY' && 'bg-emerald-100 text-emerald-800',
                            row.generationStatus === 'BLOCKED' && 'bg-rose-100 text-rose-800',
                            row.generationStatus === 'SKIPPED' && 'bg-slate-100 text-slate-700',
                          )}
                        >
                          {row.generationStatus}
                        </span>
                      </td>
                      <td className="max-w-[180px] truncate px-2 py-2 text-muted-foreground">
                        {row.remarks.join('; ') || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {bulkResult.generated > 0 && bulkResult.audit ? (
            <p className="text-sm text-emerald-700">
              Generated {bulkResult.generated} roll number(s): {bulkResult.audit.firstRollNumber} →{' '}
              {bulkResult.audit.lastRollNumber}
            </p>
          ) : null}
        </>
      ) : null}

      <div className="rounded-xl border border-border/60 bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Data Validation Results
        </h3>
        {cleanupQ.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Scanning student master…</p>
        ) : cleanupQ.data ? (
          <>
            <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6 text-xs">
              <CleanupStat label="Test records" value={cleanupQ.data.totals.testRecords} />
              <CleanupStat label="Duplicate names" value={cleanupQ.data.totals.duplicateNames} />
              <CleanupStat
                label="Missing programmes"
                value={cleanupQ.data.totals.missingProgrammes}
              />
              <CleanupStat
                label="Missing departments"
                value={cleanupQ.data.totals.missingDepartments}
              />
              <CleanupStat
                label="Invalid admission no"
                value={cleanupQ.data.totals.invalidAdmissionNumbers}
              />
              <CleanupStat
                label="Duplicate rolls"
                value={cleanupQ.data.totals.duplicateRollNumbers}
              />
            </div>
            {cleanupQ.data.categories.testRecords.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs">
                <p className="font-semibold text-amber-900">Test Records</p>
                <ul className="mt-1 space-y-0.5 text-amber-800">
                  {cleanupQ.data.categories.testRecords.slice(0, 8).map((t) => (
                    <li key={t.studentId}>
                      {t.fullName ?? t.studentId.slice(0, 8)} — {t.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : null}
        {syncMut.data ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Synced {syncMut.data.synced} sequence counter(s)
          </p>
        ) : null}
      </div>
    </div>
  );
}

function CleanupStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/30 px-2 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold', value > 0 && 'text-amber-700')}>{value}</p>
    </div>
  );
}
