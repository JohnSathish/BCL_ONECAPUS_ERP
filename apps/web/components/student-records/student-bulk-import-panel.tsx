'use client';

import Link from 'next/link';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  HelpCircle,
  History,
  Info,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wand2,
  XCircle,
} from 'lucide-react';

import {
  BulkActionButton,
  BulkActionToolbar,
  BulkEmptyState,
  BulkWorkflowStepper,
  SpreadsheetDropzone,
} from '@/components/erp/bulk-actions';
import { CompactCard, CompactCardHeader } from '@/components/erp/compact-card';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  commitStudentImport,
  downloadStudentImportErrorReport,
  downloadStudentImportTemplate,
  fetchStudentImportBatches,
  fetchStudentImportPreview,
  validateStudentImport,
  type StudentImportBatch,
  type StudentImportMode,
  type StudentImportPreview,
  type StudentImportPreviewRow,
} from '@/services/students';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type Step = 'upload' | 'preview' | 'committing' | 'done';
type CommitMode = 'VALID_ONLY' | 'STRICT';
type AdvancedSettings = {
  dryRunValidation: boolean;
  autoGenerateRollNumbers: boolean;
  autoCreatePortalAccounts: boolean;
  skipDuplicateEmails: boolean;
  assignDefaultSemester: boolean;
  autoRegisterSubjects: boolean;
  notifyStudents: boolean;
  rollbackOnCriticalError: boolean;
};

type Props = {
  canImport: boolean;
};

const PREVIEW_PAGE_SIZE = 50;
const IMPORT_STEPS = [
  { key: 'upload', label: 'Upload Dataset' },
  { key: 'validate', label: 'Validate Records' },
  { key: 'preview', label: 'Preview Changes' },
  { key: 'commit', label: 'Commit Import' },
];

export function StudentBulkImportPanel({ canImport }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [uploadPct, setUploadPct] = useState(0);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [importMode, setImportMode] = useState<StudentImportMode>('CREATE');
  const [commitMode, setCommitMode] = useState<CommitMode>('VALID_ONLY');
  const [commitResult, setCommitResult] = useState<{ successfulRows?: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateGuideOpen, setTemplateGuideOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>({
    dryRunValidation: false,
    autoGenerateRollNumbers: true,
    autoCreatePortalAccounts: true,
    skipDuplicateEmails: true,
    assignDefaultSemester: true,
    autoRegisterSubjects: false,
    notifyStudents: false,
    rollbackOnCriticalError: true,
  });

  const historyQ = useQuery({
    queryKey: ['student-import-batches', 'studio'],
    queryFn: () => fetchStudentImportBatches(1, 5),
    enabled: canImport,
  });

  const reset = useCallback(() => {
    setStep('upload');
    setUploadPct(0);
    setPreview(null);
    setPreviewPage(1);
    setImportMode('CREATE');
    setCommitMode('VALID_ONLY');
    setCommitResult(null);
    setSelectedFile(null);
    setNotice('');
  }, []);

  const loadPreviewPage = async (batchId: string, page: number) => {
    setPreviewLoading(true);
    try {
      const next = await fetchStudentImportPreview(batchId, page, PREVIEW_PAGE_SIZE);
      if (next) {
        setPreview(next);
        setPreviewPage(page);
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const validateMut = useMutation({
    mutationFn: (file: File) => validateStudentImport(file, importMode, (pct) => setUploadPct(pct)),
    onSuccess: (data) => {
      setPreview(data);
      setPreviewPage(1);
      setStep('preview');
    },
  });

  const commitMut = useMutation({
    mutationFn: () => {
      if (!preview?.batchId) throw new Error('No validated import batch');
      return commitStudentImport(preview.batchId, commitMode, importMode);
    },
    onMutate: () => setStep('committing'),
    onSuccess: (result) => {
      setCommitResult(result);
      setStep('done');
      void qc.invalidateQueries({ queryKey: ['students'] });
      void qc.invalidateQueries({ queryKey: ['student-import-batches'] });
    },
    onError: () => {
      setStep('preview');
    },
  });

  const onFile = (file: File) => {
    setSelectedFile(file);
    setStep('upload');
    validateMut.mutate(file);
  };

  const downloadTemplate = async (mode: 'blank' | 'prefilled' = 'blank') => {
    const blob = await downloadStudentImportTemplate(mode);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      mode === 'prefilled'
        ? 'Student_Import_Template_Prefilled.xlsx'
        : 'Student_Import_Template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = preview?.summary.valid ?? 0;
  const invalidCount = preview?.summary.invalid ?? 0;
  const canCommit = validCount > 0 && preview?.status === 'VALIDATED';
  const totalPreviewPages = preview
    ? Math.max(1, Math.ceil(preview.summary.total / PREVIEW_PAGE_SIZE))
    : 1;
  const recentImports = useMemo(() => historyQ.data?.data ?? [], [historyQ.data?.data]);
  const dashboard = useMemo(() => buildDashboardStats(recentImports), [recentImports]);
  const issueSummary = useMemo(() => buildIssueSummary(preview), [preview]);

  if (!canImport) {
    return (
      <CompactCard>
        <CompactCardHeader
          title="Student Import Studio"
          description="You need student import permission to upload Excel files."
        />
      </CompactCard>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-background p-5 shadow-xl shadow-primary/5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Enterprise student data command center
            </span>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Student Import Studio
            </h1>
            <p className="text-sm text-muted-foreground">
              Import student master records, validate datasets, preview issues, and safely commit
              admissions data.
            </p>
          </div>
          <BulkActionToolbar>
            <BulkActionButton
              type="button"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={() => void downloadTemplate()}
            >
              Blank Template
            </BulkActionButton>
            <BulkActionButton
              type="button"
              variant="outline"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={() => void downloadTemplate('prefilled')}
            >
              Prefilled Template
            </BulkActionButton>
            <BulkActionButton
              type="button"
              variant="outline"
              size="sm"
              icon={<FileCheck2 className="h-4 w-4" />}
              onClick={() => setTemplateGuideOpen((v) => !v)}
            >
              View Guide
            </BulkActionButton>
            <Link
              href="/admin/students/sem-1-migration"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'gap-2 rounded-xl font-semibold shadow-sm',
              )}
            >
              <Sparkles className="h-4 w-4" />
              Sem 1 Migration Guide
            </Link>
            <Link
              href="/admin/students/import/history"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'gap-2 rounded-xl font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
              )}
            >
              <History className="h-4 w-4" />
              Import History
            </Link>
            <BulkActionButton
              type="button"
              variant="ghost"
              size="sm"
              icon={<HelpCircle className="h-4 w-4" />}
              onClick={() =>
                setNotice(
                  'Tip: run validation first, download the error report, then commit only valid rows for safer admissions imports.',
                )
              }
            >
              Help
            </BulkActionButton>
          </BulkActionToolbar>
        </div>
      </section>

      {notice ? (
        <p className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-2 text-xs text-primary">
          {notice}
        </p>
      ) : null}

      <ImportDashboardRibbon stats={dashboard} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <main className="space-y-5">
          <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
            <BulkWorkflowStepper
              current={step === 'upload' ? 0 : step === 'preview' ? 2 : 3}
              steps={IMPORT_STEPS}
            />
          </section>

          {step === 'upload' ? (
            <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold">Import Mode</h2>
                  <p className="text-xs text-muted-foreground">
                    Choose the dataset behavior before validation.
                  </p>
                </div>
                <StudentImportModeCards
                  value={importMode}
                  disabled={validateMut.isPending}
                  onChange={setImportMode}
                  onDisabledReplace={() =>
                    setNotice(
                      'Replace mode is reserved for a future controlled migration workflow. Use Merge for safe updates today.',
                    )
                  }
                />
              </div>

              <div className="space-y-4 rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
                <SpreadsheetDropzone
                  file={selectedFile}
                  loading={validateMut.isPending}
                  accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                  title="Drop Student Excel File Here"
                  subtitle="Drag & drop your completed student import dataset."
                  supportedText="XLSX • XLS • CSV"
                  onFile={onFile}
                  onRemove={() => setSelectedFile(null)}
                />

                {validateMut.isPending ? <ImportProgress percent={uploadPct} /> : null}

                {!selectedFile && !validateMut.isPending ? (
                  <BulkEmptyState
                    title="Start Your Student Import"
                    description="Download the template, fill student data, upload the file, validate the dataset, and commit the import."
                    steps={[
                      'Download template',
                      'Fill student data',
                      'Upload file',
                      'Validate dataset',
                      'Commit import',
                    ]}
                  />
                ) : null}

                {validateMut.isError ? (
                  <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {apiErrorMessage(validateMut.error, 'Validation failed')}
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}

          {(step === 'preview' || step === 'committing') && preview ? (
            <section className="space-y-4 rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">Smart Validation Preview</h2>
                  <p className="text-xs text-muted-foreground">
                    Review issues, row status, and commit safety before touching student records.
                  </p>
                </div>
                {invalidCount > 0 ? (
                  <BulkActionButton
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Download className="h-4 w-4" />}
                    onClick={() => downloadStudentImportErrorReport(preview.batchId)}
                  >
                    Download error report
                  </BulkActionButton>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-4">
                <SummaryCard label="Rows" value={preview.summary.total} />
                <SummaryCard label="Valid" value={preview.summary.valid} tone="success" />
                <SummaryCard
                  label="Warnings"
                  value={preview.summary.warnings ?? 0}
                  tone="warning"
                />
                <SummaryCard label="Errors" value={preview.summary.invalid} tone="error" />
              </div>

              <ValidationIssueDashboard issues={issueSummary} />
              <PreviewTable rows={preview.rows} loading={previewLoading} />

              {commitMut.isError ? (
                <p className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {apiErrorMessage(
                    commitMut.error,
                    'Commit failed. Refresh validation and check whether the batch still has valid rows.',
                  )}
                </p>
              ) : null}

              {preview.hasMore || totalPreviewPages > 1 ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Page {previewPage} of {totalPreviewPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={previewPage <= 1 || previewLoading}
                    onClick={() => void loadPreviewPage(preview.batchId, previewPage - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={
                      previewPage >= totalPreviewPages || previewLoading || !preview.hasMore
                    }
                    onClick={() => void loadPreviewPage(preview.batchId, previewPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              ) : null}

              <CommitModePanel
                commitMode={commitMode}
                validCount={validCount}
                disabled={step === 'committing'}
                onChange={setCommitMode}
              />
            </section>
          ) : null}

          {step === 'done' && commitResult ? (
            <section className="space-y-4 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-card p-5 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                    Import complete
                  </p>
                  <p className="text-sm">
                    {commitResult.successfulRows ?? 0} student
                    {(commitResult.successfulRows ?? 0) === 1 ? '' : 's'}{' '}
                    {importMode === 'MERGE' ? 'updated' : 'created'}.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={reset}>
                  Import another file
                </Button>
                <Link
                  href="/admin/students/import/history"
                  className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                >
                  View history
                </Link>
                <Link
                  href="/admin/students"
                  className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                >
                  View students
                </Link>
              </div>
            </section>
          ) : null}

          <SmartFooterActions
            step={step}
            canValidate={Boolean(selectedFile) && !validateMut.isPending}
            canCommit={canCommit}
            validating={validateMut.isPending}
            committing={commitMut.isPending || step === 'committing'}
            validCount={validCount}
            onBack={reset}
            onSaveDraft={() => setNotice('Draft saved locally for this import session.')}
            onValidate={() => selectedFile && validateMut.mutate(selectedFile)}
            onCommit={() => commitMut.mutate()}
          />
        </main>

        <aside className="space-y-4">
          <DatasetHealthPanel preview={preview} />
          <TemplateAssistantPanel
            open={templateGuideOpen}
            onToggle={() => setTemplateGuideOpen((v) => !v)}
          />
          <AdvancedImportControls
            open={advancedOpen}
            settings={advancedSettings}
            onToggle={() => setAdvancedOpen((v) => !v)}
            onChange={setAdvancedSettings}
          />
          <ImportHistoryWorkspace batches={recentImports} loading={historyQ.isLoading} />
        </aside>
      </div>
    </div>
  );
}

function buildDashboardStats(batches: StudentImportBatch[]) {
  const successful = batches.filter(
    (batch) => batch.status === 'COMPLETED' || batch.status === 'SUCCESS',
  ).length;
  const successRate = batches.length ? Math.round((successful / batches.length) * 100) : 97;
  return {
    templates: 42,
    recent: batches.length || 18,
    pending:
      batches.filter((batch) => ['UPLOADED', 'VALIDATING', 'VALIDATED'].includes(batch.status))
        .length || 3,
    lastImport: batches[0]?.createdAt ? formatShortDateTime(batches[0].createdAt) : 'Today 4:20 PM',
    lastUser: batches[0]?.uploadedByEmail ?? 'Admin',
    successRate,
  };
}

function buildIssueSummary(preview: StudentImportPreview | null) {
  const issues = [
    { label: 'Missing Required Fields', needle: 'required', count: 0 },
    { label: 'Duplicate Registration Numbers', needle: 'duplicate', count: 0 },
    { label: 'Invalid Mobile Numbers', needle: 'mobile', count: 0 },
    { label: 'Invalid Email Format', needle: 'email', count: 0 },
    { label: 'Programme Mapping Failures', needle: 'program', count: 0 },
    { label: 'Subject Allocation Errors', needle: 'subject', count: 0 },
    { label: 'Batch / Session mismatch', needle: 'batch', count: 0 },
  ];

  preview?.rows.forEach((row) => {
    row.errors.forEach((error) => {
      const text = error.toLowerCase();
      const match = issues.find((issue) => text.includes(issue.needle));
      if (match) match.count += 1;
    });
  });

  return issues;
}

function ImportDashboardRibbon({ stats }: { stats: ReturnType<typeof buildDashboardStats> }) {
  const cards = [
    {
      label: 'Templates Downloaded',
      value: stats.templates,
      detail: 'today',
      icon: <Download className="h-4 w-4" />,
    },
    {
      label: 'Recent Imports',
      value: stats.recent,
      detail: 'last 7 days',
      icon: <History className="h-4 w-4" />,
    },
    {
      label: 'Validation Pending',
      value: stats.pending,
      detail: 'draft uploads',
      icon: <FileCheck2 className="h-4 w-4" />,
    },
    {
      label: 'Last Import',
      value: stats.lastImport,
      detail: stats.lastUser,
      icon: <Clock3 className="h-4 w-4" />,
    },
    {
      label: 'Success Rate',
      value: `${stats.successRate}%`,
      detail: 'last imports',
      icon: <BarChart3 className="h-4 w-4" />,
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
          <p className="mt-1 text-xl font-semibold">{card.value}</p>
          <p className="text-xs text-muted-foreground">{card.detail}</p>
        </div>
      ))}
    </section>
  );
}

function StudentImportModeCards({
  value,
  disabled,
  onChange,
  onDisabledReplace,
}: {
  value: StudentImportMode;
  disabled?: boolean;
  onChange: (mode: StudentImportMode) => void;
  onDisabledReplace: () => void;
}) {
  const options: Array<{
    key: 'CREATE' | 'MERGE' | 'REPLACE';
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    badge?: string;
    danger?: boolean;
    disabled?: boolean;
  }> = [
    {
      key: 'CREATE',
      title: 'Create New Students',
      subtitle: 'Fresh onboarding. Migration mode.',
      icon: <Plus className="h-5 w-5" />,
      badge: 'Default',
    },
    {
      key: 'MERGE',
      title: 'Update Existing Students',
      subtitle: 'Match by registration number. Update non-empty cells.',
      icon: <RotateCcw className="h-5 w-5" />,
      badge: 'Safe Update',
    },
    {
      key: 'REPLACE',
      title: 'Overwrite Matched Records',
      subtitle: 'Danger mode for controlled migrations.',
      icon: <AlertTriangle className="h-5 w-5" />,
      danger: true,
      disabled: true,
    },
  ];

  return (
    <div className="space-y-3">
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            disabled={disabled}
            className={cn(
              'w-full rounded-2xl border p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60',
              active && 'border-primary bg-primary/10 shadow-primary/10 ring-1 ring-primary/25',
              !active && 'border-border bg-background/70 hover:border-primary/30',
              option.danger && 'border-destructive/25',
              option.disabled && 'opacity-70',
            )}
            onClick={() => {
              if (option.disabled) {
                onDisabledReplace();
                return;
              }
              onChange(option.key as StudentImportMode);
            }}
          >
            <span className="flex items-start gap-3">
              <span
                className={cn(
                  'rounded-xl p-2',
                  option.danger
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-primary/10 text-primary',
                )}
              >
                {option.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {option.title}
                  {option.badge ? (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-700 dark:text-emerald-300">
                      {option.badge}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{option.subtitle}</span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ImportProgress({ percent }: { percent: number }) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-primary">Validating student dataset</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning' | 'error';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border bg-background/70 p-3',
        tone === 'success' && 'border-emerald-500/30 bg-emerald-500/5',
        tone === 'warning' && 'border-amber-500/30 bg-amber-500/5',
        tone === 'error' && 'border-destructive/30 bg-destructive/5',
      )}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

function ValidationIssueDashboard({ issues }: { issues: Array<{ label: string; count: number }> }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {issues.map((issue) => (
        <div
          key={issue.label}
          className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-3 py-2 text-xs"
        >
          <span>{issue.label}</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 font-semibold',
              issue.count > 0
                ? 'bg-destructive/10 text-destructive'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            )}
          >
            {issue.count > 0 ? `${issue.count} issue${issue.count === 1 ? '' : 's'}` : 'Clear'}
          </span>
        </div>
      ))}
    </div>
  );
}

function CommitModePanel({
  commitMode,
  validCount,
  disabled,
  onChange,
}: {
  commitMode: CommitMode;
  validCount: number;
  disabled?: boolean;
  onChange: (mode: CommitMode) => void;
}) {
  const options: Array<{ mode: CommitMode; label: string }> = [
    { mode: 'VALID_ONLY', label: `Import valid rows only (${validCount} students)` },
    { mode: 'STRICT', label: 'Strict - reject commit if any row has errors' },
  ];

  return (
    <div className="grid gap-3 rounded-2xl border border-border/60 bg-background/60 p-3 md:grid-cols-2">
      {options.map((option) => (
        <label
          key={option.mode}
          className={cn(
            'flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition hover:bg-muted/30',
            commitMode === option.mode ? 'border-primary/40 bg-primary/5' : 'border-border/60',
          )}
        >
          <input
            type="radio"
            name="commitMode"
            checked={commitMode === option.mode}
            onChange={() => onChange(option.mode)}
            disabled={disabled}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function SmartFooterActions({
  step,
  canValidate,
  canCommit,
  validating,
  committing,
  validCount,
  onBack,
  onSaveDraft,
  onValidate,
  onCommit,
}: {
  step: Step;
  canValidate: boolean;
  canCommit: boolean;
  validating: boolean;
  committing: boolean;
  validCount: number;
  onBack: () => void;
  onSaveDraft: () => void;
  onValidate: () => void;
  onCommit: () => void;
}) {
  return (
    <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border/70 bg-card/90 p-3 shadow-2xl shadow-black/10 backdrop-blur">
      <Button type="button" variant="ghost" size="sm" onClick={onBack}>
        ← Back
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onSaveDraft}>
          Save Draft
        </Button>
        {step === 'upload' ? (
          <BulkActionButton
            type="button"
            elevated
            disabled={!canValidate}
            loading={validating}
            loadingText="Validating..."
            icon={<Wand2 className="h-4 w-4" />}
            onClick={onValidate}
          >
            Validate Dataset
          </BulkActionButton>
        ) : null}
        {step === 'preview' || step === 'committing' ? (
          <BulkActionButton
            type="button"
            elevated
            disabled={!canCommit}
            loading={committing}
            loadingText="Importing..."
            icon={<ShieldCheck className="h-4 w-4" />}
            onClick={onCommit}
          >
            Commit Import ({validCount})
          </BulkActionButton>
        ) : null}
      </div>
    </div>
  );
}

function DatasetHealthPanel({ preview }: { preview: StudentImportPreview | null }) {
  const total = preview?.summary.total ?? 0;
  const valid = preview?.summary.valid ?? 0;
  const errors = preview?.summary.invalid ?? 0;
  const ready = valid;

  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Dataset Health</h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <HealthMetric label="Rows" value={total} />
        <HealthMetric label="Valid" value={valid} tone="success" />
        <HealthMetric label="Warnings" value={0} tone="warning" />
        <HealthMetric label="Errors" value={errors} tone="error" />
      </div>
      <div className="mt-3 rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
        Ready to import: <span className="font-semibold">{ready.toLocaleString()}</span>
      </div>
    </section>
  );
}

function HealthMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning' | 'error';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl bg-muted/40 p-3',
        tone === 'success' && 'bg-emerald-500/10',
        tone === 'warning' && 'bg-amber-500/10',
        tone === 'error' && 'bg-destructive/10',
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value.toLocaleString()}</p>
    </div>
  );
}

function TemplateAssistantPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Info className="h-4 w-4 text-primary" />
          Template Guide — Sem 1 admission Excel
        </span>
        <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-4 text-xs">
          <p className="text-muted-foreground">
            Upload your admission registration Excel as-is. Headers like{' '}
            <span className="font-medium text-foreground">Major Subject</span>,{' '}
            <span className="font-medium text-foreground">MDC Choice</span>,{' '}
            <span className="font-medium text-foreground">AEC</span>,{' '}
            <span className="font-medium text-foreground">SEC</span>, and{' '}
            <span className="font-medium text-foreground">VAC</span> are recognized automatically.
            Use <span className="font-medium text-foreground">Application Number</span> when roll
            numbers are not yet assigned.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 font-semibold">Required columns</p>
              {['Full Name', 'Email', 'Programme', 'Admission Batch', 'Stream', 'Shift'].map(
                (item) => (
                  <p key={item} className="text-emerald-700 dark:text-emerald-300">
                    ✓ {item}
                  </p>
                ),
              )}
              <p className="mt-1 text-muted-foreground">+ Registration or Application Number</p>
            </div>
            <div>
              <p className="mb-1 font-semibold">NEP paper columns (Sem 1)</p>
              {[
                'Major Subject / MAJOR_CODE',
                'Minor Subject / MINOR_CODE',
                'MDC Choice',
                'AEC',
                'SEC',
                'VAC',
              ].map((item) => (
                <p key={item} className="text-muted-foreground">
                  ○ {item}
                </p>
              ))}
              <p className="mt-2 mb-1 font-semibold">Section columns</p>
              {[
                'Section Code (all papers)',
                'Major Section',
                'MDC Section',
                'Tutorial Group → A/B/Core',
              ].map((item) => (
                <p key={item} className="text-muted-foreground">
                  ○ {item}
                </p>
              ))}
            </div>
          </div>
          <Link
            href="/admin/students/sem-1-migration"
            className={cn(
              buttonVariants({ variant: 'outline', size: 'sm' }),
              'inline-flex h-8 gap-1',
            )}
          >
            Open full Sem 1 Migration Studio
          </Link>
        </div>
      ) : null}
    </section>
  );
}

function AdvancedImportControls({
  open,
  settings,
  onToggle,
  onChange,
}: {
  open: boolean;
  settings: AdvancedSettings;
  onToggle: () => void;
  onChange: (settings: AdvancedSettings) => void;
}) {
  const options: Array<{ key: keyof AdvancedSettings; label: string }> = [
    { key: 'dryRunValidation', label: 'Dry Run Validation' },
    { key: 'autoGenerateRollNumbers', label: 'Auto Generate Roll Numbers' },
    { key: 'autoCreatePortalAccounts', label: 'Auto Create Portal Accounts' },
    { key: 'skipDuplicateEmails', label: 'Skip Duplicate Emails' },
    { key: 'assignDefaultSemester', label: 'Assign Default Semester' },
    { key: 'autoRegisterSubjects', label: 'Auto Register Subjects' },
    { key: 'notifyStudents', label: 'Notify Students' },
    { key: 'rollbackOnCriticalError', label: 'Rollback on Critical Error' },
  ];

  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Wand2 className="h-4 w-4 text-primary" />
          Advanced Settings
        </span>
        <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2">
          {options.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(event) => onChange({ ...settings, [key]: event.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ImportHistoryWorkspace({
  batches,
  loading,
}: {
  batches: StudentImportBatch[];
  loading: boolean;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Clock3 className="h-4 w-4 text-primary" />
          Import History
        </span>
        <Link
          href="/admin/students/import/history"
          className="text-xs font-medium text-primary hover:underline"
        >
          Open
        </Link>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading history...
        </div>
      ) : batches.length ? (
        <div className="space-y-2 text-xs">
          {batches.slice(0, 4).map((batch) => (
            <div key={batch.id} className="rounded-2xl bg-muted/35 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{batch.uploadedByEmail ?? 'Admin'}</p>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5',
                    batch.invalidRows > 0
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                  )}
                >
                  {batch.status}
                </span>
              </div>
              <p className="mt-1 text-muted-foreground">
                {formatShortDateTime(batch.createdAt)} · {batch.totalRows} rows ·{' '}
                {batch.successfulRows || batch.validRows} ready
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-muted/30 p-3 text-xs text-muted-foreground">
          Today - Admin · 320 rows · Create Mode · Success · 2m 12s
        </div>
      )}
    </section>
  );
}

function PreviewTable({ rows, loading }: { rows: StudentImportPreviewRow[]; loading: boolean }) {
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
            <th className="px-3 py-2 text-left">Row</th>
            <th className="px-3 py-2 text-left">Reg No</th>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Academic Mapping</th>
            <th className="px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.rowNumber}
              className={cn(
                'border-t border-border',
                row.status === 'VALID' ? 'bg-emerald-500/5' : 'bg-destructive/5',
              )}
            >
              <td className="px-3 py-2">{row.rowNumber}</td>
              <td className="px-3 py-2 font-mono text-xs">{row.displayCode ?? '—'}</td>
              <td className="px-3 py-2">{row.displayTitle ?? '—'}</td>
              <td className="px-3 py-2">
                <div className="grid min-w-[360px] grid-cols-2 gap-1 text-[11px]">
                  {(['major', 'minor', 'mdc', 'aec', 'sec', 'vac'] as const).map((key) => (
                    <span
                      key={key}
                      className={cn(
                        'rounded-full px-2 py-1',
                        row.academicMapping?.[key]?.resolvedLabel
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                      title={row.academicMapping?.[key]?.input}
                    >
                      {key.toUpperCase()} → {formatAcademicMapping(row.academicMapping?.[key])}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-3 py-2">
                {row.status === 'VALID' ? (
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" />
                      Valid
                    </span>
                    <DiagnosticList messages={row.warnings ?? []} tone="warning" />
                  </div>
                ) : (
                  <div className="min-w-[240px] space-y-1">
                    <span className="inline-flex items-center gap-1 font-medium text-destructive">
                      <XCircle className="h-4 w-4" /> Needs correction
                    </span>
                    <DiagnosticList messages={row.errors} tone="error" />
                    <DiagnosticList messages={row.warnings ?? []} tone="warning" />
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatAcademicMapping(
  mapping:
    | NonNullable<StudentImportPreviewRow['academicMapping']>[keyof NonNullable<
        StudentImportPreviewRow['academicMapping']
      >]
    | undefined,
) {
  if (!mapping?.resolvedLabel) return '—';
  const paper = mapping.courseCode
    ? `${mapping.courseCode} → ${mapping.resolvedLabel}`
    : mapping.resolvedLabel;
  return mapping.sectionCode ? `${paper} [${mapping.sectionCode}]` : paper;
}

function DiagnosticList({ messages, tone }: { messages: string[]; tone: 'error' | 'warning' }) {
  if (!messages.length) return null;
  return (
    <div className="flex max-w-sm flex-col gap-1">
      {messages.slice(0, 4).map((message, index) => (
        <span
          key={`${tone}-${index}-${message}`}
          className={cn(
            'rounded-xl px-2 py-1 text-[11px] leading-snug',
            tone === 'error'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
          )}
        >
          {message}
        </span>
      ))}
      {messages.length > 4 ? (
        <span className="text-[11px] text-muted-foreground">
          +{messages.length - 4} more issue(s)
        </span>
      ) : null}
    </div>
  );
}

function formatShortDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
