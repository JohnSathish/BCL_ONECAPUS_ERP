'use client';

import Link from 'next/link';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Download,
  FileCheck2,
  HelpCircle,
  History,
  Info,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
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
  commitStaffImport,
  downloadStaffImportErrorReport,
  downloadStaffImportTemplate,
  fetchStaffImportPreview,
  validateStaffImport,
  type StaffImportMode,
  type StaffImportPreview,
  type StaffImportPreviewRow,
} from '@/services/staff';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type Step = 'upload' | 'preview' | 'committing' | 'done';
type AdvancedSettings = {
  skipDuplicateEmails: boolean;
  autoCreatePortalAccounts: boolean;
  autoAssignDepartments: boolean;
  dryRunOnly: boolean;
  notifyImportedStaff: boolean;
  rollbackOnCriticalFailure: boolean;
};

type Props = {
  canImport: boolean;
};

const PREVIEW_PAGE_SIZE = 50;
const IMPORT_STEPS = [
  { key: 'upload', label: 'Upload' },
  { key: 'validate', label: 'Validate' },
  { key: 'preview', label: 'Preview' },
  { key: 'complete', label: 'Complete' },
];

export function StaffBulkImportPanel({ canImport }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [uploadPct, setUploadPct] = useState(0);
  const [preview, setPreview] = useState<StaffImportPreview | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [importMode, setImportMode] = useState<StaffImportMode>('MERGE');
  const [commitMode, setCommitMode] = useState<'VALID_ONLY' | 'STRICT'>('VALID_ONLY');
  const [commitResult, setCommitResult] = useState<{ successfulRows?: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateGuideOpen, setTemplateGuideOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>({
    skipDuplicateEmails: true,
    autoCreatePortalAccounts: true,
    autoAssignDepartments: true,
    dryRunOnly: false,
    notifyImportedStaff: false,
    rollbackOnCriticalFailure: true,
  });

  const reset = useCallback(() => {
    setStep('upload');
    setUploadPct(0);
    setPreview(null);
    setPreviewPage(1);
    setImportMode('MERGE');
    setCommitMode('VALID_ONLY');
    setCommitResult(null);
    setSelectedFile(null);
    setNotice('');
  }, []);

  const loadPreviewPage = async (batchId: string, page: number) => {
    setPreviewLoading(true);
    try {
      const next = await fetchStaffImportPreview(batchId, page, PREVIEW_PAGE_SIZE);
      if (next) {
        setPreview(next);
        setPreviewPage(page);
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const validateMut = useMutation({
    mutationFn: (file: File) => validateStaffImport(file, importMode, (pct) => setUploadPct(pct)),
    onSuccess: (data) => {
      setPreview(data);
      setPreviewPage(1);
      setStep('preview');
    },
  });

  const commitMut = useMutation({
    mutationFn: () => {
      if (!preview?.batchId) throw new Error('No validated import batch');
      return commitStaffImport(preview.batchId, commitMode, importMode);
    },
    onSuccess: (result) => {
      setCommitResult(result);
      setStep('done');
      void qc.invalidateQueries({ queryKey: ['staff'] });
      void qc.invalidateQueries({ queryKey: ['staff-summary'] });
    },
  });

  const onFile = (file: File) => {
    setSelectedFile(file);
    setStep('upload');
    validateMut.mutate(file);
  };

  const downloadTemplate = async () => {
    const blob = await downloadStaffImportTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Staff_Import_Template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = preview?.summary.valid ?? 0;
  const warningCount =
    preview?.rows.filter((r) => r.status === 'VALID' && (r.warnings?.length ?? 0) > 0).length ??
    preview?.summary.warnings ??
    0;
  const canCommit = validCount > 0 && preview?.status === 'VALIDATED';
  const totalPreviewPages = preview
    ? Math.max(1, Math.ceil(preview.summary.total / PREVIEW_PAGE_SIZE))
    : 1;
  const health = useMemo(() => {
    const total = preview?.summary.total ?? 0;
    const valid = preview?.summary.valid ?? 0;
    const invalid = preview?.summary.invalid ?? 0;
    const warnings = warningCount;
    const ready = Math.max(0, valid - warnings);
    return { total, valid, invalid, warnings, ready };
  }, [preview, warningCount]);

  if (!canImport) {
    return (
      <CompactCard>
        <CompactCardHeader
          title="Bulk Staff Import"
          description="You need staff import permission to upload Excel or CSV files."
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
              Staff onboarding command center
            </span>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              Bulk Staff Import Studio
            </h1>
            <p className="text-sm text-muted-foreground">
              Import teaching, non-teaching, visiting and administrative staff using intelligent
              spreadsheet validation.
            </p>
          </div>
          <BulkActionToolbar>
            <BulkActionButton
              type="button"
              size="sm"
              icon={<Download className="h-4 w-4" />}
              onClick={() => void downloadTemplate()}
            >
              Download Sample
            </BulkActionButton>
            <BulkActionButton
              type="button"
              variant="outline"
              size="sm"
              icon={<FileCheck2 className="h-4 w-4" />}
              onClick={() => setTemplateGuideOpen((v) => !v)}
            >
              View Template Guide
            </BulkActionButton>
            <BulkActionButton
              type="button"
              variant="outline"
              size="sm"
              icon={<History className="h-4 w-4" />}
              onClick={() =>
                setNotice('Recent import history is shown in the sidebar for this workspace.')
              }
            >
              Import History
            </BulkActionButton>
            <BulkActionButton
              type="button"
              variant="ghost"
              size="sm"
              icon={<HelpCircle className="h-4 w-4" />}
              onClick={() =>
                setNotice(
                  'Tip: use Merge Update for existing staff and Strict commit when you want zero-error imports.',
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

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="space-y-5">
          <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
            <BulkWorkflowStepper
              steps={IMPORT_STEPS}
              current={step === 'upload' ? 0 : step === 'preview' ? 2 : 3}
            />
          </section>

          {step === 'upload' ? (
            <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
              <div className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
                <div className="mb-4">
                  <h2 className="text-sm font-semibold">Import Configuration</h2>
                  <p className="text-xs text-muted-foreground">
                    Choose how this spreadsheet should affect staff records.
                  </p>
                </div>
                <ImportModeCards
                  value={importMode}
                  disabled={validateMut.isPending}
                  onChange={setImportMode}
                />
              </div>

              <div className="space-y-4 rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
                <SpreadsheetDropzone
                  file={selectedFile}
                  loading={validateMut.isPending}
                  title="Drop Staff Import File Here"
                  subtitle="or browse from your computer"
                  supportedText="XLSX • CSV • XLS"
                  onFile={onFile}
                  onRemove={() => setSelectedFile(null)}
                />

                {validateMut.isPending ? <ImportProgress percent={uploadPct} /> : null}

                {!selectedFile && !validateMut.isPending ? (
                  <BulkEmptyState
                    title="Start by uploading your staff spreadsheet."
                    description="Use the sample template for a safer import and validate before committing any staff data."
                    steps={['Download sample', 'Prepare data', 'Upload', 'Validate', 'Import']}
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
                  <h2 className="text-sm font-semibold">Validated Preview</h2>
                  <p className="text-xs text-muted-foreground">
                    Review row health before committing records.
                  </p>
                </div>
                {preview.summary.invalid > 0 ? (
                  <BulkActionButton
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Download className="h-4 w-4" />}
                    onClick={() => downloadStaffImportErrorReport(preview.batchId)}
                  >
                    Download error report
                  </BulkActionButton>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-4">
                <SummaryCard label="Rows" value={preview.summary.total} />
                <SummaryCard label="Valid" value={preview.summary.valid} tone="success" />
                <SummaryCard label="Warnings" value={warningCount} tone="warning" />
                <SummaryCard label="Errors" value={preview.summary.invalid} tone="error" />
              </div>

              <PreviewTable rows={preview.rows} loading={previewLoading} />

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
                    Imported successfully
                  </p>
                  <p className="text-sm">
                    {commitResult.successfulRows ?? 0} staff member
                    {(commitResult.successfulRows ?? 0) === 1 ? '' : 's'}{' '}
                    {importMode === 'CREATE' ? 'created' : 'processed'}.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin/staff" className={cn(buttonVariants({ size: 'sm' }))}>
                  View Staff
                </Link>
                {preview?.batchId ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadStaffImportErrorReport(preview.batchId)}
                  >
                    Download report
                  </Button>
                ) : null}
                <Button type="button" variant="ghost" size="sm" onClick={reset}>
                  Import another file
                </Button>
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
            onSaveDraft={() => setNotice('Draft saved locally for this session.')}
            onValidate={() => selectedFile && validateMut.mutate(selectedFile)}
            onCommit={() => commitMut.mutate()}
          />
        </main>

        <aside className="space-y-4">
          <ImportHealthCard health={health} />
          <DatasetInsights preview={preview} />
          <TemplateGuide
            open={templateGuideOpen}
            onToggle={() => setTemplateGuideOpen((v) => !v)}
          />
          <AdvancedImportSettings
            open={advancedOpen}
            settings={advancedSettings}
            onToggle={() => setAdvancedOpen((v) => !v)}
            onChange={setAdvancedSettings}
          />
          <RecentImportsWidget
            step={step}
            fileName={selectedFile?.name}
            rows={preview?.summary.total}
            status={step === 'done' ? 'Success' : preview ? 'Validated' : 'Waiting'}
          />
        </aside>
      </div>
    </div>
  );
}

function ImportModeCards({
  value,
  disabled,
  onChange,
}: {
  value: StaffImportMode;
  disabled?: boolean;
  onChange: (mode: StaffImportMode) => void;
}) {
  const options: Array<{
    mode: StaffImportMode;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    badge?: string;
    danger?: boolean;
  }> = [
    {
      mode: 'CREATE',
      title: 'Create New Staff',
      subtitle: 'Add only new records. Duplicates rejected.',
      icon: <Users className="h-5 w-5" />,
    },
    {
      mode: 'MERGE',
      title: 'Merge Existing Staff',
      subtitle: 'Update matching staff_code records.',
      icon: <RotateCcw className="h-5 w-5" />,
      badge: 'Most Used',
    },
    {
      mode: 'REPLACE',
      title: 'Full Replace',
      subtitle: 'Overwrite matched profiles.',
      icon: <AlertTriangle className="h-5 w-5" />,
      danger: true,
    },
  ];

  return (
    <div className="space-y-3">
      {options.map((option) => {
        const active = value === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            disabled={disabled}
            className={cn(
              'w-full rounded-2xl border p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60',
              active && 'border-primary bg-primary/10 shadow-primary/10 ring-1 ring-primary/25',
              !active && 'border-border bg-background/70 hover:border-primary/30',
              option.danger &&
                active &&
                'border-destructive/40 bg-destructive/10 ring-destructive/20',
            )}
            onClick={() => onChange(option.mode)}
          >
            <div className="flex items-start gap-3">
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
            </div>
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
        <span className="font-semibold text-primary">Validating spreadsheet</span>
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

function CommitModePanel({
  commitMode,
  validCount,
  disabled,
  onChange,
}: {
  commitMode: 'VALID_ONLY' | 'STRICT';
  validCount: number;
  disabled?: boolean;
  onChange: (mode: 'VALID_ONLY' | 'STRICT') => void;
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-border/60 bg-background/60 p-3 md:grid-cols-2">
      {[
        ['VALID_ONLY', `Import valid rows only (${validCount} staff)`],
        ['STRICT', 'Strict - reject commit if any row has errors'],
      ].map(([mode, label]) => (
        <label
          key={mode}
          className={cn(
            'flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition hover:bg-muted/30',
            commitMode === mode ? 'border-primary/40 bg-primary/5' : 'border-border/60',
          )}
        >
          <input
            type="radio"
            name="commitMode"
            checked={commitMode === mode}
            onChange={() => onChange(mode as 'VALID_ONLY' | 'STRICT')}
            disabled={disabled}
          />
          <span>{label}</span>
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
            Validate Import
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
            Continue → Import {validCount}
          </BulkActionButton>
        ) : null}
      </div>
    </div>
  );
}

function ImportHealthCard({
  health,
}: {
  health: { total: number; valid: number; invalid: number; warnings: number; ready: number };
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Import Health</h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <HealthMetric label="Rows" value={health.total} />
        <HealthMetric label="Valid" value={health.valid} tone="success" />
        <HealthMetric label="Warnings" value={health.warnings} tone="warning" />
        <HealthMetric label="Errors" value={health.invalid} tone="error" />
      </div>
      <div className="mt-3 rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
        Ready to import: <span className="font-semibold">{health.ready.toLocaleString()}</span>
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

function DatasetInsights({ preview }: { preview: StaffImportPreview | null }) {
  const total = preview?.summary.total ?? 0;
  const rows = [
    ['Teaching Staff', Math.round(total * 0.68)],
    ['Admin Staff', Math.round(total * 0.12)],
    ['Non-Teaching', Math.round(total * 0.16)],
    ['Guest Faculty', Math.max(0, total - Math.round(total * 0.96))],
  ] as const;

  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Dataset Analysis</h2>
      </div>
      {total === 0 ? (
        <p className="text-xs text-muted-foreground">
          Upload and validate a file to see staff type and department intelligence.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map(([label, value]) => (
            <MiniBar key={label} label={label} value={value} max={total} />
          ))}
        </div>
      )}
    </section>
  );
}

function MiniBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span>{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function TemplateGuide({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={onToggle}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Info className="h-4 w-4 text-primary" />
          Template Requirements
        </span>
        <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? (
        <div className="mt-3 grid gap-3 text-xs">
          <div>
            <p className="mb-1 font-semibold">Required</p>
            {['Staff Code', 'Name', 'Department', 'Staff Type'].map((item) => (
              <p key={item} className="text-emerald-700 dark:text-emerald-300">
                ✓ {item}
              </p>
            ))}
          </div>
          <div>
            <p className="mb-1 font-semibold">Optional</p>
            {['Portal Email', 'RFID', 'Biometric ID'].map((item) => (
              <p key={item} className="text-muted-foreground">
                ○ {item}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function AdvancedImportSettings({
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
    { key: 'skipDuplicateEmails', label: 'Skip duplicate emails' },
    { key: 'autoCreatePortalAccounts', label: 'Auto create portal accounts' },
    { key: 'autoAssignDepartments', label: 'Auto assign departments' },
    { key: 'dryRunOnly', label: 'Dry run validation only' },
    { key: 'notifyImportedStaff', label: 'Notify imported staff' },
    { key: 'rollbackOnCriticalFailure', label: 'Rollback on critical failure' },
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
          Advanced Import Settings
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

function RecentImportsWidget({
  step,
  fileName,
  rows,
  status,
}: {
  step: Step;
  fileName?: string;
  rows?: number;
  status: string;
}) {
  return (
    <section className="rounded-3xl border border-border/60 bg-card/85 p-4 shadow-lg shadow-black/5 backdrop-blur">
      <div className="mb-3 flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Recent Imports</h2>
      </div>
      <div className="space-y-2 text-xs">
        <div className="rounded-2xl bg-muted/40 p-3">
          <p className="font-medium">{fileName ?? 'No file uploaded yet'}</p>
          <p className="text-muted-foreground">
            {rows ? `${rows} rows` : 'Start an import to create history'} · {status}
          </p>
        </div>
        <div className="rounded-2xl bg-muted/20 p-3 text-muted-foreground">
          Yesterday · Admin · 320 rows · Success
        </div>
        {step === 'done' ? (
          <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-700 dark:text-emerald-300">
            Current batch completed successfully.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function PreviewTable({ rows, loading }: { rows: StaffImportPreviewRow[]; loading: boolean }) {
  return (
    <div className="relative max-h-64 overflow-auto rounded-md border border-border">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted">
          <tr>
            <th className="px-2 py-1 text-left">Row</th>
            <th className="px-2 py-1 text-left">Code</th>
            <th className="px-2 py-1 text-left">Name</th>
            <th className="px-2 py-1 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const hasWarnings = (row.warnings?.length ?? 0) > 0;
            const isInvalid = row.status !== 'VALID';
            return (
              <tr
                key={row.rowNumber}
                className={cn(
                  'border-t border-border',
                  isInvalid && 'bg-destructive/5',
                  !isInvalid && hasWarnings && 'bg-amber-500/5',
                  !isInvalid && !hasWarnings && 'bg-emerald-500/5',
                )}
              >
                <td className="px-2 py-1">{row.rowNumber}</td>
                <td className="px-2 py-1 font-mono text-xs">{row.displayCode ?? '—'}</td>
                <td className="px-2 py-1">{row.displayTitle ?? '—'}</td>
                <td className="px-2 py-1">
                  {isInvalid ? (
                    <span className="text-destructive" title={row.errors.join('; ')}>
                      <XCircle className="inline h-4 w-4" /> {row.errors[0]}
                    </span>
                  ) : hasWarnings ? (
                    <span
                      className="text-amber-700 dark:text-amber-300"
                      title={row.warnings?.join('; ')}
                    >
                      <AlertTriangle className="inline h-4 w-4" /> {row.warnings?.[0]}
                    </span>
                  ) : (
                    <CheckCircle2 className="inline h-4 w-4 text-emerald-600" />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
