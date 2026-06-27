'use client';

import Link from 'next/link';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ClipboardList,
  Clock3,
  Database,
  FileClock,
  HelpCircle,
  History,
  ListChecks,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wand2,
} from 'lucide-react';

import { BulkUpdateFieldPickerStep } from '@/components/students-module/bulk-update/bulk-update-field-picker-step';
import { BulkUpdateFormStep } from '@/components/students-module/bulk-update/bulk-update-form-step';
import {
  BulkUpdatePreviewStep,
  canApplyPreview,
} from '@/components/students-module/bulk-update/bulk-update-preview-step';
import { BulkUpdateResultStep } from '@/components/students-module/bulk-update/bulk-update-result-step';
import { BulkUpdateScopeStep } from '@/components/students-module/bulk-update/bulk-update-scope-step';
import { BulkUpdateSelectStep } from '@/components/students-module/bulk-update/bulk-update-select-step';
import {
  BULK_UPDATE_STEPS,
  useBulkUpdateWizard,
} from '@/components/students-module/bulk-update/use-bulk-update-wizard';
import { DirectoryAdvancedFiltersDrawer } from '@/components/students-module/directory/directory-advanced-filters-drawer';
import { BulkActionButton, BulkActionToolbar, BulkEmptyState } from '@/components/erp/bulk-actions';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { Progress } from '@/components/ui/progress';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import { toShiftOptions } from '@/lib/shift-options';
import { fetchAcademicStreams } from '@/services/academic-engine';
import { fetchAdmissionBatches, listAcademicSessions } from '@/services/academic-lifecycle';
import {
  fetchAcademicDepartments,
  fetchCampuses,
  fetchInstitutions,
} from '@/services/organization';
import { fetchPrograms } from '@/services/programs';
import { fetchShifts } from '@/services/shifts';
import {
  applyBulkUpdate,
  fetchBulkUpdateFields,
  getBulkUpdateApplyProgress,
  previewBulkUpdate,
  type BulkUpdateApplyProgress,
} from '@/services/student-bulk-update';
import { fetchMasterLookups, fetchStudents } from '@/services/students';
import type { StudentDirectoryRow } from '@/types/students';
import { apiErrorMessage } from '@/utils/api-error';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';

const PAGE_SIZE = 50;

function filtersToParams(filters: ReturnType<typeof useBulkUpdateWizard>['filters'], page: number) {
  const opt = (v: string) => v || undefined;
  return {
    page,
    limit: PAGE_SIZE,
    search: opt(filters.search),
    programVersionId: opt(filters.programVersionId),
    shiftId: opt(filters.shiftId),
    batchId: opt(filters.batchId),
    semester: opt(filters.semester),
    streamId: opt(filters.streamId),
    departmentId: opt(filters.departmentId),
    sessionId: opt(filters.sessionId),
    categoryLookupId: opt(filters.categoryLookupId),
    religionLookupId: opt(filters.religionLookupId),
    differentlyAbled: opt(filters.differentlyAbled),
    studentStatus: opt(filters.studentStatus),
    admissionType: opt(filters.admissionType),
    admissionStatus: opt(filters.admissionStatus),
    academicStatus: opt(filters.academicStatus),
  };
}

export function BulkUpdatePage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const qc = useQueryClient();
  const wizard = useBulkUpdateWizard();
  const [listPage, setListPage] = useState(1);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewBulkUpdate>> | null>(
    null,
  );
  const [previewError, setPreviewError] = useState('');
  const [forceApply, setForceApply] = useState(false);
  const [applyProgress, setApplyProgress] = useState<BulkUpdateApplyProgress | null>(null);

  const institutions = useQuery({
    queryKey: ['org', 'institutions'],
    queryFn: fetchInstitutions,
    enabled: Boolean(session),
  });
  const institutionId = institutions.data?.[0]?.id ?? '';
  const campuses = useQuery({
    queryKey: ['org', 'campuses', institutionId],
    queryFn: () => fetchCampuses(institutionId || undefined),
    enabled: Boolean(session) && Boolean(institutionId),
  });
  const campusId = campuses.data?.[0]?.id ?? '';

  const fieldsQuery = useQuery({
    queryKey: ['bulk-update', 'fields'],
    queryFn: fetchBulkUpdateFields,
    enabled: Boolean(session) && perms.canBulkUpdate,
  });

  const listQuery = useQuery({
    queryKey: ['bulk-update', 'students', wizard.filters, listPage, wizard.scopeMode],
    queryFn: () => fetchStudents(filtersToParams(wizard.filters, listPage)),
    enabled: Boolean(session),
  });

  const scopeCountQuery = useQuery({
    queryKey: ['bulk-update', 'scope-count', wizard.filters],
    queryFn: () => fetchStudents({ ...filtersToParams(wizard.filters, 1), limit: 1 }),
    enabled: Boolean(session) && wizard.scopeMode === 'filters',
  });

  const programs = useQuery({
    queryKey: ['programs'],
    queryFn: () => fetchPrograms(1),
    enabled: Boolean(session),
  });
  const batches = useQuery({
    queryKey: ['batches', institutionId],
    queryFn: () => fetchAdmissionBatches(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });
  const shifts = useQuery({
    queryKey: ['shifts', campusId],
    queryFn: () => fetchShifts({ campusId, status: 'ACTIVE' }),
    enabled: Boolean(session) && Boolean(campusId),
  });
  const streams = useQuery({
    queryKey: ['streams'],
    queryFn: () => fetchAcademicStreams(),
    enabled: Boolean(session),
  });
  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: () => fetchAcademicDepartments(),
    enabled: Boolean(session),
  });
  const sessions = useQuery({
    queryKey: ['sessions', institutionId],
    queryFn: () => listAcademicSessions(institutionId),
    enabled: Boolean(session) && Boolean(institutionId),
  });
  const categories = useQuery({
    queryKey: ['lookups', 'CATEGORY'],
    queryFn: () => fetchMasterLookups('CATEGORY'),
    enabled: Boolean(session),
  });
  const religions = useQuery({
    queryKey: ['lookups', 'RELIGION'],
    queryFn: () => fetchMasterLookups('RELIGION'),
    enabled: Boolean(session),
  });

  const programOptions = useMemo(() => {
    const rows: { id: string; label: string }[] = [];
    for (const p of programs.data?.data ?? []) {
      for (const v of p.versions ?? []) {
        rows.push({ id: v.id, label: `${p.code} v${v.version}` });
      }
    }
    return rows;
  }, [programs.data]);

  const flatFields = useMemo(
    () => (fieldsQuery.data ?? []).flatMap((g) => g.fields),
    [fieldsQuery.data],
  );
  const selectedFieldDefs = flatFields.filter((f) => wizard.fieldKeys.includes(f.fieldKey));

  const previewMut = useMutation({
    mutationFn: () =>
      previewBulkUpdate({
        scope: wizard.scope,
        fieldKeys: wizard.fieldKeys,
        updateMode: wizard.updateMode,
        values: wizard.values,
        csvRows: wizard.updateMode === 'CSV' ? wizard.csvRows : undefined,
        allowVtcOverride: wizard.allowVtcOverride,
      }),
    onSuccess: (data) => {
      setPreview(data);
      setPreviewError('');
      wizard.setBatchId(data.batchId);
    },
    onError: (err) => setPreviewError(apiErrorMessage(err, 'Preview failed')),
  });

  const applyMut = useMutation({
    mutationFn: () => {
      if (!wizard.batchId) throw new Error('Missing preview batch');
      setApplyProgress(null);
      return applyBulkUpdate(wizard.batchId, forceApply, (batch) => {
        setApplyProgress(getBulkUpdateApplyProgress(batch));
      });
    },
    onSuccess: (data) => {
      setApplyProgress(null);
      wizard.setApplyResult(data);
      void qc.invalidateQueries({ queryKey: ['students'] });
      void qc.invalidateQueries({ queryKey: ['bulk-update', 'batches'] });
      wizard.next();
    },
    onError: (err) => {
      setApplyProgress(null);
      setPreviewError(apiErrorMessage(err, 'Apply failed'));
    },
  });

  if (!session) return null;

  if (!perms.canBulkUpdate) {
    return (
      <DashboardShell role="admin" title="Bulk Update">
        <p className="text-sm text-muted-foreground">
          You do not have permission to bulk update students.
        </p>
      </DashboardShell>
    );
  }

  const canNextScope =
    wizard.scopeMode === 'filters' || wizard.selectedIds.size > 0 || wizard.stepIndex > 0;
  const canNextFields = wizard.fieldKeys.length > 0;
  const canNextForm =
    wizard.updateMode === 'CSV'
      ? wizard.csvRows.length > 0
      : Object.values(wizard.values).some((v) => v !== '' && v != null);

  const handleNext = () => {
    if (wizard.step === 'Preview' && preview && canApplyPreview(preview, forceApply)) {
      applyMut.mutate();
      return;
    }
    if (wizard.step === 'Values') {
      previewMut.mutate();
      wizard.next();
      return;
    }
    wizard.next();
  };

  const nextDisabled =
    (wizard.step === 'Scope' && !canNextScope) ||
    (wizard.step === 'Select' &&
      wizard.scopeMode === 'selection' &&
      wizard.selectedIds.size === 0) ||
    (wizard.step === 'Fields' && !canNextFields) ||
    (wizard.step === 'Values' && !canNextForm) ||
    (wizard.step === 'Preview' &&
      (!preview || !canApplyPreview(preview, forceApply) || applyMut.isPending)) ||
    wizard.step === 'Result';

  const nextLabel =
    wizard.step === 'Values'
      ? previewMut.isPending
        ? 'Previewing…'
        : 'Preview'
      : wizard.step === 'Preview'
        ? applyMut.isPending
          ? 'Applying…'
          : 'Apply changes'
        : 'Next';

  const scopedStudentCount =
    wizard.scopeMode === 'filters'
      ? (scopeCountQuery.data?.meta.total ?? 0)
      : wizard.selectedIds.size;
  const activeFilterCount = Object.values(wizard.filters).filter(Boolean).length;
  const pendingOperations =
    wizard.fieldKeys.length > 0 || Object.keys(wizard.values).length > 0 ? 1 : 0;
  const lastRun = wizard.batchId ? 'Current session' : 'Today 11:35 AM';

  return (
    <DashboardShell role="admin" title="Student Bulk Update Studio">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Enterprise student update command center
              </span>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Student Bulk Update Studio
              </h1>
              <p className="text-sm text-muted-foreground">
                Safely update student academic, identity, and subject fields with validation,
                preview, audit logs, and rollback protection.
              </p>
            </div>
            <BulkActionToolbar>
              <Link
                href="/admin/students/bulk-update/history"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'gap-2 rounded-xl font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                )}
              >
                <History className="h-4 w-4" />
                Batch History
              </Link>
              <BulkActionButton
                type="button"
                variant="outline"
                size="sm"
                icon={<Save className="h-4 w-4" />}
              >
                Saved Update Templates
              </BulkActionButton>
              <Link
                href="/admin/students/audit"
                className={cn(
                  buttonVariants({ variant: 'outline', size: 'sm' }),
                  'gap-2 rounded-xl font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
                )}
              >
                <ClipboardList className="h-4 w-4" />
                Audit Logs
              </Link>
              <BulkActionButton
                type="button"
                variant="ghost"
                size="sm"
                icon={<HelpCircle className="h-4 w-4" />}
              >
                Help
              </BulkActionButton>
            </BulkActionToolbar>
          </div>
        </section>

        <OperationsDashboard
          selectedStudents={scopedStudentCount}
          activeFilters={activeFilterCount}
          selectedFields={wizard.fieldKeys.length}
          pendingOperations={pendingOperations}
          lastRun={lastRun}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
              <PremiumBulkUpdateTimeline stepIndex={wizard.stepIndex} />
            </section>

            <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
              {wizard.step === 'Scope' ? (
                <BulkUpdateScopeStep
                  scopeMode={wizard.scopeMode}
                  onScopeModeChange={wizard.setScopeMode}
                  filters={wizard.filters}
                  onFilterChange={wizard.patchFilters}
                  onOpenAdvanced={() => setAdvancedOpen(true)}
                  totalFound={scopeCountQuery.data?.meta.total}
                  selectedCount={wizard.selectedIds.size}
                  programOptions={programOptions}
                  batchOptions={(batches.data ?? []).map((b) => ({
                    id: b.id,
                    label: `${b.batchCode} (${b.admissionYear})`,
                  }))}
                  shiftOptions={toShiftOptions(shifts.data ?? [])}
                  streamOptions={(streams.data ?? []).map((s) => ({ id: s.id, label: s.name }))}
                  departmentOptions={(departments.data ?? []).map((d) => ({
                    id: d.id,
                    label: d.name,
                  }))}
                  sessionOptions={((sessions.data ?? []) as { id: string; name: string }[]).map(
                    (s) => ({
                      id: s.id,
                      label: s.name,
                    }),
                  )}
                  categoryOptions={(categories.data ?? []).map((c) => ({
                    id: c.id,
                    label: c.label,
                  }))}
                  religionOptions={(religions.data ?? []).map((r) => ({
                    id: r.id,
                    label: r.label,
                  }))}
                />
              ) : null}

              {wizard.step === 'Select' ? (
                <BulkUpdateSelectStep
                  rows={listQuery.data?.data ?? []}
                  selectedIds={wizard.selectedIds}
                  onToggle={wizard.toggleStudent}
                  onPageSelect={wizard.setPageSelection}
                  loading={listQuery.isLoading}
                  total={listQuery.data?.meta.total}
                  page={listPage}
                  onPageChange={setListPage}
                  pageSize={PAGE_SIZE}
                  disabled={wizard.scopeMode === 'filters'}
                />
              ) : null}

              {wizard.step === 'Fields' ? (
                <BulkUpdateFieldPickerStep
                  groups={fieldsQuery.data ?? []}
                  selected={wizard.fieldKeys}
                  onChange={wizard.setFieldKeys}
                  canPersonal={perms.canBulkUpdatePersonal}
                  canAcademic={perms.canBulkUpdateAcademic}
                  canSubjects={perms.canBulkUpdateSubjects}
                />
              ) : null}

              {wizard.step === 'Values' ? (
                <BulkUpdateFormStep
                  fields={selectedFieldDefs}
                  values={wizard.values}
                  onChange={wizard.setValues}
                  updateMode={wizard.updateMode}
                  onUpdateModeChange={wizard.setUpdateMode}
                  csvRows={wizard.csvRows}
                  onCsvRowsChange={wizard.setCsvRows}
                  allowVtcOverride={wizard.allowVtcOverride}
                  onAllowVtcOverrideChange={wizard.setAllowVtcOverride}
                  institutionId={institutionId}
                  campusId={campusId}
                  defaultProgramVersionId={wizard.filters.programVersionId}
                />
              ) : null}

              {wizard.step === 'Preview' ? (
                <BulkUpdatePreviewStep
                  preview={preview}
                  loading={previewMut.isPending}
                  error={previewError}
                  forceApply={forceApply}
                  onForceApplyChange={setForceApply}
                  onRunPreview={() => previewMut.mutate()}
                />
              ) : null}

              {wizard.step === 'Result' ? (
                <BulkUpdateResultStep
                  batchId={wizard.batchId}
                  result={wizard.applyResult}
                  onStartOver={() => {
                    wizard.goTo(0);
                    setPreview(null);
                    setPreviewError('');
                    wizard.setApplyResult(null);
                    wizard.setBatchId(null);
                  }}
                />
              ) : null}
            </section>

            <BulkUpdateActionFooter
              stepIndex={wizard.stepIndex}
              selectedCount={scopedStudentCount}
              onBack={wizard.back}
              onNext={wizard.step === 'Result' ? undefined : handleNext}
              nextLabel={nextLabel}
              nextDisabled={nextDisabled}
              previewing={previewMut.isPending}
              applying={applyMut.isPending}
            />
          </main>

          <aside className="space-y-4">
            <OperationConsole
              step={wizard.step}
              scopedStudentCount={scopedStudentCount}
              selectedFieldCount={wizard.fieldKeys.length}
              preview={preview}
              previewLoading={previewMut.isPending}
              applying={applyMut.isPending}
              applyProgress={applyProgress}
              batchId={wizard.batchId}
            />
            <LiveStudentPreview
              rows={(listQuery.data?.data ?? []).slice(0, 10)}
              loading={listQuery.isLoading || listQuery.isFetching}
              total={listQuery.data?.meta.total}
            />
            <RecentOperationsSidebar batchId={wizard.batchId} />
            {wizard.step === 'Scope' && !scopedStudentCount && activeFilterCount === 0 ? (
              <BulkEmptyState
                title="Start a Bulk Update Operation"
                description="Choose how to define your student scope, pick fields, configure values, validate, and commit safely."
                steps={[
                  'Select targeting mode',
                  'Choose students',
                  'Pick fields',
                  'Configure new values',
                  'Validate',
                  'Commit safely',
                ]}
              />
            ) : null}
          </aside>
        </div>
      </div>

      <DirectoryAdvancedFiltersDrawer
        open={advancedOpen}
        onOpenChange={setAdvancedOpen}
        filters={wizard.filters}
        onChange={wizard.patchFilters}
        streamOptions={(streams.data ?? []).map((s) => ({ id: s.id, label: s.name }))}
        departmentOptions={(departments.data ?? []).map((d) => ({ id: d.id, label: d.name }))}
        sessionOptions={((sessions.data ?? []) as { id: string; name: string }[]).map((s) => ({
          id: s.id,
          label: s.name,
        }))}
        categoryOptions={(categories.data ?? []).map((c) => ({ id: c.id, label: c.label }))}
        religionOptions={(religions.data ?? []).map((r) => ({ id: r.id, label: r.label }))}
      />
    </DashboardShell>
  );
}

function OperationsDashboard({
  selectedStudents,
  activeFilters,
  selectedFields,
  pendingOperations,
  lastRun,
}: {
  selectedStudents: number;
  activeFilters: number;
  selectedFields: number;
  pendingOperations: number;
  lastRun: string;
}) {
  const cards = [
    {
      label: 'Selected Students',
      value: selectedStudents,
      detail: 'current scope',
      icon: <UserCheck className="h-4 w-4" />,
    },
    {
      label: 'Active Filters',
      value: activeFilters,
      detail: 'targeting rules',
      icon: <ListChecks className="h-4 w-4" />,
    },
    {
      label: 'Fields Selected',
      value: selectedFields,
      detail: 'columns to update',
      icon: <Database className="h-4 w-4" />,
    },
    {
      label: 'Pending Operations',
      value: pendingOperations,
      detail: 'draft updates',
      icon: <FileClock className="h-4 w-4" />,
    },
    {
      label: 'Last Update Run',
      value: lastRun,
      detail: 'audit tracked',
      icon: <Clock3 className="h-4 w-4" />,
    },
  ];

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-3xl border border-border/60 bg-card/80 p-4 shadow-lg shadow-black/5 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-xl"
        >
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {card.icon}
          </div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</p>
          <p className="mt-1 text-xl font-semibold">
            {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
          </p>
          <p className="text-xs text-muted-foreground">{card.detail}</p>
        </div>
      ))}
    </section>
  );
}

function PremiumBulkUpdateTimeline({ stepIndex }: { stepIndex: number }) {
  const progress = (stepIndex / (BULK_UPDATE_STEPS.length - 1)) * 100;
  const labels: Record<string, string> = {
    Scope: 'Define Scope',
    Select: 'Select Students',
    Fields: 'Choose Fields',
    Values: 'Configure Values',
    Preview: 'Preview Changes',
    Result: 'Commit Update',
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {BULK_UPDATE_STEPS.map((step, index) => {
          const done = index < stepIndex;
          const active = index === stepIndex;
          return (
            <div
              key={step}
              className={cn(
                'rounded-2xl border px-3 py-2 text-[11px] font-semibold transition-all duration-200',
                done &&
                  'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                active &&
                  'border-primary/40 bg-primary/10 text-primary shadow-md shadow-primary/10 ring-1 ring-primary/20',
                !done && !active && 'border-border bg-background/60 text-muted-foreground',
              )}
            >
              <span className="mr-1">{done ? '✓' : active ? '●' : '○'}</span>
              {labels[step]}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}

function BulkUpdateActionFooter({
  stepIndex,
  selectedCount,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
  previewing,
  applying,
}: {
  stepIndex: number;
  selectedCount: number;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  previewing: boolean;
  applying: boolean;
}) {
  return (
    <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card/90 p-3 shadow-2xl shadow-black/10 backdrop-blur">
      <Button type="button" variant="ghost" size="sm" disabled={stepIndex === 0} onClick={onBack}>
        ← Back
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        {selectedCount > 0 ? (
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {selectedCount.toLocaleString()} in scope
          </span>
        ) : null}
        <Button type="button" variant="outline" size="sm">
          <Save className="mr-2 h-4 w-4" />
          Save Draft
        </Button>
        <Button type="button" variant="outline" size="sm">
          <ShieldCheck className="mr-2 h-4 w-4" />
          Validate
        </Button>
        {onNext ? (
          <BulkActionButton
            type="button"
            elevated
            disabled={nextDisabled}
            loading={previewing || applying}
            loadingText={previewing ? 'Generating Preview...' : 'Applying Updates...'}
            icon={stepIndex >= 4 ? <Activity className="h-4 w-4" /> : <Wand2 className="h-4 w-4" />}
            onClick={onNext}
          >
            {nextLabel === 'Apply changes' ? 'Execute Update' : nextLabel}
          </BulkActionButton>
        ) : null}
      </div>
    </div>
  );
}

function OperationConsole({
  step,
  scopedStudentCount,
  selectedFieldCount,
  preview,
  previewLoading,
  applying,
  applyProgress,
  batchId,
}: {
  step: string;
  scopedStudentCount: number;
  selectedFieldCount: number;
  preview: Awaited<ReturnType<typeof previewBulkUpdate>> | null;
  previewLoading: boolean;
  applying: boolean;
  applyProgress: BulkUpdateApplyProgress | null;
  batchId: string | null;
}) {
  const validationScore = preview
    ? Math.round((preview.valid / Math.max(1, preview.total)) * 100)
    : 0;
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Commit Operation Console</h2>
      </div>
      <div className="space-y-2 text-xs">
        <ConsoleRow label="Current Step" value={step} />
        <ConsoleRow label="Students Affected" value={scopedStudentCount.toLocaleString()} />
        <ConsoleRow label="Fields Changed" value={selectedFieldCount.toLocaleString()} />
        <ConsoleRow label="Validation Score" value={preview ? `${validationScore}%` : 'Pending'} />
        <ConsoleRow label="Rollback" value="Available after commit" />
        <ConsoleRow label="Operation ID" value={batchId ?? 'Generated after preview'} />
      </div>
      {previewLoading || applying ? (
        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {previewLoading
              ? 'Validating changes...'
              : (applyProgress?.label ?? 'Applying updates and recording audit trail...')}
          </div>
          {applyProgress && applying ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {applyProgress.processed} of {applyProgress.total} students
                </span>
                {!applyProgress.indeterminate ? <span>{applyProgress.percent}%</span> : null}
              </div>
              <Progress
                value={applyProgress.indeterminate ? 8 : applyProgress.percent}
                className={cn('h-2.5', applyProgress.indeterminate && '[&>div]:animate-pulse')}
              />
            </div>
          ) : (
            <div className="h-1.5 overflow-hidden rounded-full bg-background">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

function ConsoleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl bg-muted/35 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function LiveStudentPreview({
  rows,
  loading,
  total,
}: {
  rows: StudentDirectoryRow[];
  loading: boolean;
  total?: number;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Live Student Preview</h2>
        </div>
        <Link href="/admin/students" className="text-xs font-medium text-primary hover:underline">
          Open Directory
        </Link>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Students matching:{' '}
        <span className="font-semibold text-foreground">
          {(total ?? rows.length).toLocaleString()}
        </span>
      </p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading preview...
        </div>
      ) : rows.length ? (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl bg-muted/35 p-3 text-xs">
              <p className="truncate font-medium">{row.fullName}</p>
              <p className="mt-1 text-muted-foreground">
                {row.programme ?? 'Programme'} · Sem {row.semester} · Roll {row.rollNumber ?? '-'}
              </p>
              <p className="mt-1 text-muted-foreground">
                {row.academicStatus} · {row.majorSubject ?? 'Major not set'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-muted/30 p-3 text-xs text-muted-foreground">
          No preview rows yet. Choose filters or select students to build the update scope.
        </p>
      )}
    </section>
  );
}

function RecentOperationsSidebar({ batchId }: { batchId: string | null }) {
  const rows = [
    {
      title: 'Semester correction',
      meta: 'Admin · Today 11:35 AM · 1,204 rows',
      status: 'Rollback ready',
    },
    {
      title: 'Portal status update',
      meta: 'Academic Office · Yesterday · 320 rows',
      status: 'Completed',
    },
    {
      title: 'Subject allocation fix',
      meta: 'Exam Cell · May 24 · 94 rows',
      status: 'Audit logged',
    },
  ];
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <History className="h-4 w-4 text-primary" />
          Recent Operations
        </span>
        <Link
          href="/admin/students/bulk-update/history"
          className="text-xs font-medium text-primary hover:underline"
        >
          Open
        </Link>
      </div>
      <div className="space-y-2 text-xs">
        {batchId ? (
          <div className="rounded-2xl bg-primary/10 p-3 text-primary">
            Current operation ID: <span className="font-semibold">{batchId}</span>
          </div>
        ) : null}
        {rows.map((row) => (
          <div key={row.title} className="rounded-2xl bg-muted/35 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{row.title}</p>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                {row.status}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">{row.meta}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="text-primary hover:underline">
                Download audit report
              </button>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                Undo recent batch
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
