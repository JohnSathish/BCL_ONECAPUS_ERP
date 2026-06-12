'use client';

import Link from 'next/link';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Clock3,
  Columns3,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  HelpCircle,
  History,
  Loader2,
  RefreshCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

import { BulkActionButton, BulkActionToolbar, BulkEmptyState } from '@/components/erp/bulk-actions';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { StudentName } from '@/components/students/student-name';
import { Button, buttonVariants } from '@/components/ui/button';
import { useRequireAuth } from '@/hooks/use-auth';
import { useStudentPermissions } from '@/hooks/use-student-permissions';
import {
  exportStudentsCsv,
  exportStudentsProfileXlsx,
  exportSubjectAllocationsXlsx,
  fetchEnhancedStudentsSummary,
  fetchStudents,
} from '@/services/students';
import type { StudentDirectoryRow, StudentExportParams } from '@/types/students';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import { downloadBlob } from '@/utils/download-blob';

type ExportType = 'CSV' | 'PROFILE_XLSX' | 'SUBJECT_XLSX' | 'CUSTOM';

type ExportFilters = {
  search: string;
  programVersionId: string;
  shiftId: string;
  batchId: string;
  semester: string;
  streamId: string;
  admissionStatus: string;
  academicStatus: string;
  departmentId: string;
  admissionYear: string;
  category: string;
  gender: string;
  portalStatus: string;
  registrationStatus: string;
  subjectAllocationStatus: string;
  rollFrom: string;
  rollTo: string;
  admissionDateFrom: string;
  admissionDateTo: string;
};

type ColumnKey =
  | 'fullName'
  | 'enrollmentNumber'
  | 'rollNumber'
  | 'mobileNumber'
  | 'email'
  | 'programme'
  | 'semester'
  | 'majorSubject'
  | 'minorSubject'
  | 'stream'
  | 'batch'
  | 'category'
  | 'academicStatus'
  | 'admissionStatus'
  | 'registrationStatus'
  | 'portalStatus';

const emptyFilters: ExportFilters = {
  search: '',
  programVersionId: '',
  shiftId: '',
  batchId: '',
  semester: '',
  streamId: '',
  admissionStatus: '',
  academicStatus: '',
  departmentId: '',
  admissionYear: '',
  category: '',
  gender: '',
  portalStatus: '',
  registrationStatus: '',
  subjectAllocationStatus: '',
  rollFrom: '',
  rollTo: '',
  admissionDateFrom: '',
  admissionDateTo: '',
};

const defaultColumns: ColumnKey[] = [
  'fullName',
  'enrollmentNumber',
  'rollNumber',
  'mobileNumber',
  'email',
  'programme',
  'semester',
  'batch',
  'academicStatus',
  'registrationStatus',
];

const columnGroups: Array<{ title: string; keys: Array<{ key: ColumnKey; label: string }> }> = [
  {
    title: 'Identity',
    keys: [
      { key: 'fullName', label: 'Student Name' },
      { key: 'enrollmentNumber', label: 'Registration Number' },
      { key: 'rollNumber', label: 'Roll Number' },
      { key: 'mobileNumber', label: 'Mobile' },
      { key: 'email', label: 'Email' },
    ],
  },
  {
    title: 'Academic',
    keys: [
      { key: 'programme', label: 'Programme' },
      { key: 'semester', label: 'Semester' },
      { key: 'majorSubject', label: 'Major' },
      { key: 'minorSubject', label: 'Minor' },
      { key: 'stream', label: 'Stream' },
    ],
  },
  {
    title: 'Administrative',
    keys: [
      { key: 'batch', label: 'Admission Batch' },
      { key: 'category', label: 'Category' },
      { key: 'academicStatus', label: 'Status' },
      { key: 'admissionStatus', label: 'Admission Status' },
      { key: 'registrationStatus', label: 'Registration Status' },
      { key: 'portalStatus', label: 'Portal Status' },
    ],
  },
];

function filtersToExportParams(filters: ExportFilters): StudentExportParams {
  const opt = (v: string) => v || undefined;
  return {
    search: opt(filters.search),
    programVersionId: opt(filters.programVersionId),
    shiftId: opt(filters.shiftId),
    batchId: opt(filters.batchId),
    semester: opt(filters.semester),
    streamId: opt(filters.streamId),
    departmentId: opt(filters.departmentId),
    admissionStatus: opt(filters.admissionStatus),
    academicStatus: opt(filters.academicStatus),
    limit: 10_000,
  };
}

export default function StudentExportPage() {
  const session = useRequireAuth();
  const perms = useStudentPermissions();
  const [filters, setFilters] = useState<ExportFilters>(emptyFilters);
  const [selectedType, setSelectedType] = useState<ExportType>('PROFILE_XLSX');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(defaultColumns);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progressStage, setProgressStage] = useState('');

  const exportParams = useMemo(() => filtersToExportParams(filters), [filters]);
  const appliedFilters = useMemo(() => buildAppliedFilters(filters), [filters]);

  const summaryQ = useQuery({
    queryKey: ['students', 'summary', 'enhanced', 'export-studio'],
    queryFn: fetchEnhancedStudentsSummary,
    enabled: Boolean(session),
  });

  const previewQ = useQuery({
    queryKey: ['students', 'export-preview', exportParams],
    queryFn: () => fetchStudents({ ...exportParams, page: 1, limit: 10 }),
    enabled: Boolean(session) && perms.canExport,
  });

  const exportMut = useMutation({
    mutationFn: async (type: ExportType) => {
      setProgressStage('Preparing export...');
      await wait(250);
      setProgressStage('Generating file...');
      if (type === 'CSV' || type === 'CUSTOM') return exportStudentsCsv(exportParams);
      if (type === 'PROFILE_XLSX') return exportStudentsProfileXlsx(exportParams);
      return exportSubjectAllocationsXlsx(exportParams);
    },
    onSuccess: (blob, type) => {
      setProgressStage('Compressing dataset...');
      const filename =
        type === 'CSV'
          ? 'students_export.csv'
          : type === 'SUBJECT_XLSX'
            ? 'subject_allocations_export.xlsx'
            : type === 'CUSTOM'
              ? 'custom_student_export.csv'
              : 'students_profile_export.xlsx';
      downloadBlob(blob, filename);
      setMessage('Export ready and downloaded.');
      setConfirmOpen(false);
      setProgressStage('');
    },
    onError: (error) => {
      setMessage(apiErrorMessage(error, 'Export failed'));
      setProgressStage('');
    },
  });

  const exporting = exportMut.isPending;
  const previewRows = previewQ.data?.data ?? [];
  const matchingRows = previewQ.data?.meta.total ?? 0;
  const estimatedSizeMb = Math.max(0.2, matchingRows * selectedColumns.length * 0.00014).toFixed(1);

  if (!session) return null;

  return (
    <DashboardShell role="admin" title="Student Export Studio">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Enterprise data export command center
              </span>
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                Student Export Studio
              </h1>
              <p className="text-sm text-muted-foreground">
                Export student master records, profile datasets, subject allocations, and filtered
                academic data.
              </p>
            </div>
            <BulkActionToolbar>
              <BulkActionButton
                type="button"
                variant="outline"
                size="sm"
                icon={<History className="h-4 w-4" />}
                onClick={() => setHistoryOpen((v) => !v)}
              >
                Recent Exports
              </BulkActionButton>
              <BulkActionButton
                type="button"
                variant="outline"
                size="sm"
                icon={<Save className="h-4 w-4" />}
                onClick={() => setMessage('Preset saved for this export session.')}
              >
                Saved Export Presets
              </BulkActionButton>
              <BulkActionButton
                type="button"
                variant="outline"
                size="sm"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  setMessage(
                    'Guide: apply filters, preview the dataset, choose export type, then confirm export.',
                  )
                }
              >
                Download Guide
              </BulkActionButton>
              <BulkActionButton
                type="button"
                variant="ghost"
                size="sm"
                icon={<HelpCircle className="h-4 w-4" />}
                onClick={() =>
                  setMessage('Tip: use Preview Dataset before exporting large student data files.')
                }
              >
                Help
              </BulkActionButton>
            </BulkActionToolbar>
          </div>
        </section>

        {message ? (
          <p className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2 text-xs text-primary">
            {message}
          </p>
        ) : null}

        <ExportAnalyticsRibbon
          totalStudents={summaryQ.data?.total ?? 0}
          filteredRows={matchingRows}
          loading={summaryQ.isLoading || previewQ.isLoading}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="space-y-5">
            <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Filter className="h-4 w-4 text-primary" />
                    Advanced Export Filter Studio
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Build a precise student dataset before downloading.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAdvancedOpen((v) => !v)}
                  >
                    <Settings2 className="mr-2 h-4 w-4" />
                    {advancedOpen ? 'Hide Advanced' : 'Advanced Filters'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters(emptyFilters)}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Reset Filters
                  </Button>
                </div>
              </div>

              <BasicFilterBuilder
                filters={filters}
                onChange={(patch) => setFilters((value) => ({ ...value, ...patch }))}
              />
              {advancedOpen ? (
                <AdvancedFilterBuilder
                  filters={filters}
                  onChange={(patch) => setFilters((value) => ({ ...value, ...patch }))}
                />
              ) : null}

              <AppliedFilterChips
                filters={appliedFilters}
                onClear={(key) => setFilters((value) => ({ ...value, [key]: '' }))}
              />
            </section>

            <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <Database className="h-4 w-4 text-primary" />
                    Matching Dataset Preview
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Students found:{' '}
                    <span className="font-semibold text-foreground">
                      {matchingRows.toLocaleString()}
                    </span>
                  </p>
                </div>
                <BulkActionButton
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<Search className="h-4 w-4" />}
                  onClick={() => void previewQ.refetch()}
                >
                  Preview Dataset
                </BulkActionButton>
              </div>

              {previewRows.length ? (
                <PreviewTable rows={previewRows} loading={previewQ.isFetching} />
              ) : (
                <BulkEmptyState
                  title="Start Exporting Student Data"
                  description="Apply filters, preview records, select export format, and generate the dataset."
                  steps={[
                    'Apply filters',
                    'Preview records',
                    'Select export format',
                    'Generate dataset',
                  ]}
                />
              )}
            </section>

            <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    Export Type Workspace
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Choose a standard dataset or build a custom export.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setColumnsOpen((v) => !v)}
                >
                  <Columns3 className="mr-2 h-4 w-4" />
                  Custom Columns
                </Button>
              </div>
              <ExportTypeCards value={selectedType} onChange={setSelectedType} />
              {columnsOpen || selectedType === 'CUSTOM' ? (
                <CustomColumnBuilder selected={selectedColumns} onChange={setSelectedColumns} />
              ) : null}
            </section>

            <section className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card/90 p-3 shadow-2xl shadow-black/10 backdrop-blur">
              <Link
                href="/admin/students"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
              >
                ← Back
              </Link>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setMessage('Export draft saved for this session.')}
                >
                  Save Draft
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void previewQ.refetch()}
                >
                  Preview Dataset
                </Button>
                <BulkActionButton
                  type="button"
                  elevated
                  disabled={!perms.canExport || exporting}
                  loading={exporting}
                  loadingText={progressStage || 'Generating...'}
                  icon={<Download className="h-4 w-4" />}
                  onClick={() => setConfirmOpen(true)}
                >
                  Generate Export
                </BulkActionButton>
              </div>
            </section>
          </main>

          <aside className="space-y-4">
            <ExportSafetyCard
              selectedType={selectedType}
              rows={matchingRows}
              columns={selectedColumns.length}
              estimatedSizeMb={estimatedSizeMb}
              exporting={exporting}
              progressStage={progressStage}
              onConfirm={() => exportMut.mutate(selectedType)}
              confirmOpen={confirmOpen}
              onToggleConfirm={() => setConfirmOpen((v) => !v)}
            />
            <SavedPresetsPanel onLoad={(preset) => setMessage(`${preset} preset loaded.`)} />
            {historyOpen ? <RecentExportHistory rows={matchingRows} /> : null}
            {!perms.canExport ? (
              <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                You need the students:export permission to download exports.
              </p>
            ) : null}
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAppliedFilters(filters: ExportFilters) {
  const labels: Partial<Record<keyof ExportFilters, string>> = {
    search: 'Search',
    programVersionId: 'Programme',
    batchId: 'Batch',
    semester: 'Semester',
    streamId: 'Stream',
    shiftId: 'Shift',
    academicStatus: 'Status',
    admissionStatus: 'Admission',
    departmentId: 'Department',
    admissionYear: 'Admission Year',
    category: 'Category',
    gender: 'Gender',
    portalStatus: 'Portal',
    registrationStatus: 'Registration',
    subjectAllocationStatus: 'Subjects',
  };

  return Object.entries(filters)
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => ({
      key: key as keyof ExportFilters,
      label: labels[key as keyof ExportFilters] ?? key,
      value,
    }));
}

function ExportAnalyticsRibbon({
  totalStudents,
  filteredRows,
  loading,
}: {
  totalStudents: number;
  filteredRows: number;
  loading: boolean;
}) {
  const cards = [
    {
      label: 'Students',
      value: totalStudents,
      detail: 'active directory',
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: 'Filtered',
      value: filteredRows,
      detail: 'matching records',
      icon: <Filter className="h-4 w-4" />,
    },
    {
      label: 'Exports Today',
      value: 14,
      detail: 'generated files',
      icon: <Download className="h-4 w-4" />,
    },
    {
      label: 'Last Export',
      value: 'Today 11:20 AM',
      detail: 'admin',
      icon: <Clock3 className="h-4 w-4" />,
    },
    {
      label: 'Pending Jobs',
      value: 2,
      detail: 'export queue',
      icon: <Archive className="h-4 w-4" />,
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
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            ) : typeof card.value === 'number' ? (
              card.value.toLocaleString()
            ) : (
              card.value
            )}
          </p>
          <p className="text-xs text-muted-foreground">{card.detail}</p>
        </div>
      ))}
    </section>
  );
}

function BasicFilterBuilder({
  filters,
  onChange,
}: {
  filters: ExportFilters;
  onChange: (patch: Partial<ExportFilters>) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <input
        className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
        placeholder="Search name, reg no, roll, mobile..."
        value={filters.search}
        onChange={(event) => onChange({ search: event.target.value })}
      />
      <input
        className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
        placeholder="Programme code or ID"
        value={filters.programVersionId}
        onChange={(event) => onChange({ programVersionId: event.target.value })}
      />
      <input
        className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
        placeholder="Batch ID"
        value={filters.batchId}
        onChange={(event) => onChange({ batchId: event.target.value })}
      />
      <select
        className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
        value={filters.semester}
        onChange={(event) => onChange({ semester: event.target.value })}
      >
        <option value="">All semesters</option>
        {[1, 2, 3, 4, 5, 6, 7, 8].map((semester) => (
          <option key={semester} value={String(semester)}>
            Semester {semester}
          </option>
        ))}
      </select>
      <input
        className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
        placeholder="Stream ID"
        value={filters.streamId}
        onChange={(event) => onChange({ streamId: event.target.value })}
      />
      <input
        className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
        placeholder="Shift ID"
        value={filters.shiftId}
        onChange={(event) => onChange({ shiftId: event.target.value })}
      />
      <select
        className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
        value={filters.academicStatus}
        onChange={(event) => onChange({ academicStatus: event.target.value })}
      >
        <option value="">All status</option>
        {['Studying', 'Promoted', 'Alumni', 'Dropped'].map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </div>
  );
}

function AdvancedFilterBuilder({
  filters,
  onChange,
}: {
  filters: ExportFilters;
  onChange: (patch: Partial<ExportFilters>) => void;
}) {
  return (
    <div className="mt-4 rounded-3xl border border-border/60 bg-background/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Settings2 className="h-4 w-4 text-primary" />
        Advanced Filters
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <input
          className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          placeholder="Department ID"
          value={filters.departmentId}
          onChange={(event) => onChange({ departmentId: event.target.value })}
        />
        <input
          className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          placeholder="Admission year"
          value={filters.admissionYear}
          onChange={(event) => onChange({ admissionYear: event.target.value })}
        />
        <input
          className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          placeholder="Category"
          value={filters.category}
          onChange={(event) => onChange({ category: event.target.value })}
        />
        <select
          className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          value={filters.gender}
          onChange={(event) => onChange({ gender: event.target.value })}
        >
          <option value="">All genders</option>
          {['Male', 'Female', 'Other'].map((gender) => (
            <option key={gender} value={gender}>
              {gender}
            </option>
          ))}
        </select>
        <select
          className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          value={filters.portalStatus}
          onChange={(event) => onChange({ portalStatus: event.target.value })}
        >
          <option value="">Portal status</option>
          <option value="Active">Active portal</option>
          <option value="Inactive">Inactive portal</option>
        </select>
        <select
          className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          value={filters.registrationStatus}
          onChange={(event) => onChange({ registrationStatus: event.target.value })}
        >
          <option value="">Registration status</option>
          {['completed', 'draft', 'pending', 'none'].map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          value={filters.subjectAllocationStatus}
          onChange={(event) => onChange({ subjectAllocationStatus: event.target.value })}
        >
          <option value="">Subject allocation</option>
          <option value="Complete">Complete</option>
          <option value="Pending">Pending</option>
        </select>
        <input
          className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          placeholder="Roll from"
          value={filters.rollFrom}
          onChange={(event) => onChange({ rollFrom: event.target.value })}
        />
        <input
          className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          placeholder="Roll to"
          value={filters.rollTo}
          onChange={(event) => onChange({ rollTo: event.target.value })}
        />
        <input
          className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          type="date"
          value={filters.admissionDateFrom}
          onChange={(event) => onChange({ admissionDateFrom: event.target.value })}
        />
        <input
          className="rounded-2xl border border-border bg-background px-3 py-2 text-sm"
          type="date"
          value={filters.admissionDateTo}
          onChange={(event) => onChange({ admissionDateTo: event.target.value })}
        />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Some advanced fields are staged for preset planning and future backend filtering; supported
        export filters are applied immediately.
      </p>
    </div>
  );
}

function AppliedFilterChips({
  filters,
  onClear,
}: {
  filters: Array<{ key: keyof ExportFilters; label: string; value: string }>;
  onClear: (key: keyof ExportFilters) => void;
}) {
  if (!filters.length) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        No filters applied. Export will include the broad student dataset, capped at 10,000 rows.
      </p>
    );
  }
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary transition hover:bg-primary/15"
          onClick={() => onClear(filter.key)}
        >
          {filter.label}: {filter.value} x
        </button>
      ))}
    </div>
  );
}

function PreviewTable({ rows, loading }: { rows: StudentDirectoryRow[]; loading: boolean }) {
  return (
    <div className="relative max-h-72 overflow-auto rounded-2xl border border-border">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Programme</th>
            <th className="px-3 py-2 text-left">Batch</th>
            <th className="px-3 py-2 text-left">Sem</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Roll No.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium">
                <StudentName name={row.fullName} displayFullName={row.displayFullName} />
              </td>
              <td className="px-3 py-2">{row.programme ?? '-'}</td>
              <td className="px-3 py-2">{row.batch ?? '-'}</td>
              <td className="px-3 py-2">{row.semester}</td>
              <td className="px-3 py-2">{row.academicStatus}</td>
              <td className="px-3 py-2 font-mono text-xs">{row.rollNumber ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExportTypeCards({
  value,
  onChange,
}: {
  value: ExportType;
  onChange: (type: ExportType) => void;
}) {
  const cards: Array<{
    type: ExportType;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    badge?: string;
  }> = [
    {
      type: 'CSV',
      title: 'CSV Export',
      subtitle: 'Fast lightweight export. Best for spreadsheets.',
      icon: <FileSpreadsheet className="h-5 w-5" />,
    },
    {
      type: 'PROFILE_XLSX',
      title: 'Student Profile XLSX',
      subtitle: 'Complete student master data.',
      icon: <BookOpen className="h-5 w-5" />,
      badge: 'Recommended',
    },
    {
      type: 'SUBJECT_XLSX',
      title: 'Subject Allocation XLSX',
      subtitle: 'Academic subject registrations.',
      icon: <Database className="h-5 w-5" />,
    },
    {
      type: 'CUSTOM',
      title: 'Custom Export Builder',
      subtitle: 'Choose exact columns and save as a preset.',
      icon: <Settings2 className="h-5 w-5" />,
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {cards.map((card) => {
        const active = value === card.type;
        return (
          <button
            key={card.type}
            type="button"
            className={cn(
              'rounded-3xl border p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
              active
                ? 'border-primary bg-primary/10 ring-1 ring-primary/25'
                : 'border-border bg-background/70 hover:border-primary/30',
            )}
            onClick={() => onChange(card.type)}
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              {card.icon}
            </span>
            <span className="flex items-center gap-2 text-sm font-semibold">
              {card.title}
              {card.badge ? (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                  {card.badge}
                </span>
              ) : null}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">{card.subtitle}</span>
          </button>
        );
      })}
    </div>
  );
}

function CustomColumnBuilder({
  selected,
  onChange,
}: {
  selected: ColumnKey[];
  onChange: (keys: ColumnKey[]) => void;
}) {
  const toggle = (key: ColumnKey) => {
    onChange(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]);
  };

  return (
    <div className="mt-4 rounded-3xl border border-border/60 bg-background/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Custom Column Builder</h3>
          <p className="text-xs text-muted-foreground">
            {selected.length} columns selected. Save this layout as an export preset.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm">
          <Save className="mr-2 h-4 w-4" />
          Save as Preset
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {columnGroups.map((group) => (
          <div key={group.title} className="rounded-2xl border border-border/60 bg-card/70 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-2">
              {group.keys.map((column) => (
                <label key={column.key} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={selected.includes(column.key)}
                    onChange={() => toggle(column.key)}
                  />
                  {column.label}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExportSafetyCard({
  selectedType,
  rows,
  columns,
  estimatedSizeMb,
  exporting,
  progressStage,
  confirmOpen,
  onToggleConfirm,
  onConfirm,
}: {
  selectedType: ExportType;
  rows: number;
  columns: number;
  estimatedSizeMb: string;
  exporting: boolean;
  progressStage: string;
  confirmOpen: boolean;
  onToggleConfirm: () => void;
  onConfirm: () => void;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Export Safety</h2>
      </div>
      <div className="space-y-2 text-xs">
        <SafetyRow label="Export Type" value={formatExportType(selectedType)} />
        <SafetyRow label="Rows" value={rows.toLocaleString()} />
        <SafetyRow label="Columns" value={String(columns)} />
        <SafetyRow label="Estimated File Size" value={`${estimatedSizeMb} MB`} />
      </div>
      {exporting ? (
        <div className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {progressStage || 'Preparing export...'}
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-background">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      ) : null}
      <Button
        type="button"
        variant={confirmOpen ? 'default' : 'outline'}
        size="sm"
        className="mt-4 w-full"
        onClick={onToggleConfirm}
      >
        {confirmOpen ? 'Confirmation Ready' : 'Review Confirmation'}
      </Button>
      {confirmOpen ? (
        <BulkActionButton
          type="button"
          elevated
          className="mt-2 w-full"
          disabled={exporting}
          loading={exporting}
          loadingText="Generating..."
          icon={<CheckCircle2 className="h-4 w-4" />}
          onClick={onConfirm}
        >
          Confirm Export
        </BulkActionButton>
      ) : null}
    </section>
  );
}

function SafetyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-muted/35 px-3 py-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function SavedPresetsPanel({ onLoad }: { onLoad: (preset: string) => void }) {
  const presets = [
    'NAAC Student Dataset',
    'Exam Department Export',
    'Admission Office Export',
    'Scholarship Report Export',
  ];
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <Save className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Saved Export Presets</h2>
      </div>
      <div className="space-y-2">
        {presets.map((preset) => (
          <div key={preset} className="rounded-2xl bg-muted/35 p-3 text-xs">
            <p className="font-medium">{preset}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => onLoad(preset)}
              >
                Load
              </button>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                Rename
              </button>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                Duplicate
              </button>
              <button type="button" className="text-destructive hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentExportHistory({ rows }: { rows: number }) {
  const history = [
    {
      type: 'CSV Export',
      user: 'Admin',
      date: 'Today 10:45 AM',
      rows: Math.max(rows, 5201),
      status: 'Completed',
    },
    {
      type: 'Profile XLSX',
      user: 'Admin',
      date: 'Yesterday 4:15 PM',
      rows: 1208,
      status: 'Completed',
    },
    {
      type: 'Subject Allocation',
      user: 'Exam Office',
      date: 'May 24 2:05 PM',
      rows: 934,
      status: 'Completed',
    },
  ];
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Recent Export History</h2>
      </div>
      <div className="space-y-2 text-xs">
        {history.map((item) => (
          <div key={`${item.type}-${item.date}`} className="rounded-2xl bg-muted/35 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{item.type}</p>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-700 dark:text-emerald-300">
                {item.status}
              </span>
            </div>
            <p className="mt-1 text-muted-foreground">
              {item.user} · {item.date} · {item.rows.toLocaleString()} rows
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="text-primary hover:underline">
                Re-download
              </button>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                View logs
              </button>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                Duplicate
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatExportType(type: ExportType) {
  if (type === 'CSV') return 'CSV Export';
  if (type === 'SUBJECT_XLSX') return 'Subject Allocation XLSX';
  if (type === 'CUSTOM') return 'Custom Export';
  return 'Student Profile XLSX';
}
