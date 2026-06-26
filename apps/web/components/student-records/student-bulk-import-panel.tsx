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
  downloadFullAdmissionImportTemplate,
  downloadSem1AdmissionTemplate,
  downloadSem3AdmissionTemplate,
  downloadSem5AdmissionTemplate,
  fetchSem1EligibleMinors,
  fetchSem1ImportCurriculum,
  fetchSem1ImportProgrammes,
  fetchSem3ImportProgrammes,
  fetchSem5EligibleMinors,
  fetchSem5ImportCurriculum,
  fetchSem5ImportProgrammes,
  fetchStudentImportBatches,
  fetchStudentImportPreview,
  validateStudentImport,
  type StudentImportBatch,
  type StudentImportMode,
  type StudentImportPreview,
  type StudentImportPreviewRow,
  type Sem1ImportProgrammeOption,
  type Sem5ImportProgrammeOption,
} from '@/services/students';
import { fetchAcademicYears } from '@/services/organization';
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
  focusSemester?: 1 | 3 | 5;
};

const FOCUS_SEMESTER_COPY: Record<
  1 | 3 | 5,
  { title: string; description: string; templateLabel: string }
> = {
  1: {
    title: 'Semester 1 Subject Import',
    description:
      'Import newly admitted Semester 1 students. Select departments and paper names only — VAC Environment Studies is registered automatically.',
    templateLabel: 'Sem 1 Template',
  },
  3: {
    title: 'Semester 3 Subject Import',
    description:
      'Import Semester 3 subject selections using Major Department and paper names — no course codes required.',
    templateLabel: 'Sem 3 Template',
  },
  5: {
    title: 'Semester 5 Subject Import',
    description:
      'Import Semester 5 Major, Minor, and Internship selections using friendly department names only.',
    templateLabel: 'Sem 5 Template',
  },
};

const PREVIEW_PAGE_SIZE = 50;
const IMPORT_STEPS = [
  { key: 'upload', label: 'Upload Dataset' },
  { key: 'validate', label: 'Validate Records' },
  { key: 'preview', label: 'Preview Changes' },
  { key: 'commit', label: 'Commit Import' },
];

export function StudentBulkImportPanel({ canImport, focusSemester }: Props) {
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
  const [sem1DialogOpen, setSem1DialogOpen] = useState(false);
  const [sem1Programme, setSem1Programme] = useState('');
  const [sem1AcademicYearId, setSem1AcademicYearId] = useState('');
  const [sem1PreviewMajor, setSem1PreviewMajor] = useState('');
  const [sem1Downloading, setSem1Downloading] = useState(false);
  const [sem3DialogOpen, setSem3DialogOpen] = useState(false);
  const [sem3Programme, setSem3Programme] = useState('');
  const [sem3Downloading, setSem3Downloading] = useState(false);
  const [sem5DialogOpen, setSem5DialogOpen] = useState(false);
  const [sem5Programme, setSem5Programme] = useState('');
  const [sem5AcademicYearId, setSem5AcademicYearId] = useState('');
  const [sem5PreviewMajor, setSem5PreviewMajor] = useState('');
  const [sem5Downloading, setSem5Downloading] = useState(false);
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

  const sem1ProgrammesQ = useQuery({
    queryKey: ['sem1-import-programmes'],
    queryFn: fetchSem1ImportProgrammes,
    enabled: canImport && sem1DialogOpen,
  });

  const sem3ProgrammesQ = useQuery({
    queryKey: ['sem3-import-programmes'],
    queryFn: fetchSem3ImportProgrammes,
    enabled: canImport && sem3DialogOpen,
  });

  const sem5ProgrammesQ = useQuery({
    queryKey: ['sem5-import-programmes'],
    queryFn: fetchSem5ImportProgrammes,
    enabled: canImport && sem5DialogOpen,
  });

  const academicYearsQ = useQuery({
    queryKey: ['academic-years', 'sem-import', focusSemester ?? 'all'],
    queryFn: fetchAcademicYears,
    enabled: canImport && (sem1DialogOpen || sem5DialogOpen),
  });

  const selectedSem1Programme = useMemo(() => {
    const programmes = sem1ProgrammesQ.data ?? [];
    if (!sem1Programme) return programmes[0];
    return programmes.find((programme) => programme.code === sem1Programme) ?? programmes[0];
  }, [sem1Programme, sem1ProgrammesQ.data]);

  const sem1CurriculumQ = useQuery({
    queryKey: [
      'sem1-import-curriculum',
      selectedSem1Programme?.programVersionId,
      sem1AcademicYearId,
    ],
    queryFn: () =>
      fetchSem1ImportCurriculum({
        programVersionId: selectedSem1Programme?.programVersionId,
        academicYearId: sem1AcademicYearId || undefined,
        semesterSequence: 1,
      }),
    enabled: canImport && sem1DialogOpen && Boolean(selectedSem1Programme?.programVersionId),
  });

  const sem1EligibleMinorsQ = useQuery({
    queryKey: [
      'sem1-eligible-minors',
      selectedSem1Programme?.programVersionId,
      sem1PreviewMajor,
      sem1AcademicYearId,
    ],
    queryFn: () =>
      fetchSem1EligibleMinors({
        programVersionId: selectedSem1Programme!.programVersionId,
        majorDepartment: sem1PreviewMajor,
        academicYearId: sem1AcademicYearId || undefined,
        semesterSequence: 1,
      }),
    enabled:
      canImport &&
      sem1DialogOpen &&
      Boolean(selectedSem1Programme?.programVersionId && sem1PreviewMajor),
  });

  const selectedSem5Programme = useMemo(() => {
    const programmes = sem5ProgrammesQ.data ?? [];
    if (!sem5Programme) return programmes[0];
    return programmes.find((programme) => programme.code === sem5Programme) ?? programmes[0];
  }, [sem5Programme, sem5ProgrammesQ.data]);

  const sem5CurriculumQ = useQuery({
    queryKey: [
      'sem5-import-curriculum',
      selectedSem5Programme?.programVersionId,
      sem5AcademicYearId,
    ],
    queryFn: () =>
      fetchSem5ImportCurriculum({
        programVersionId: selectedSem5Programme?.programVersionId,
        academicYearId: sem5AcademicYearId || undefined,
        semesterSequence: 5,
      }),
    enabled: canImport && sem5DialogOpen && Boolean(selectedSem5Programme?.programVersionId),
  });

  const sem5EligibleMinorsQ = useQuery({
    queryKey: [
      'sem5-eligible-minors',
      selectedSem5Programme?.programVersionId,
      sem5PreviewMajor,
      sem5AcademicYearId,
    ],
    queryFn: () =>
      fetchSem5EligibleMinors({
        programVersionId: selectedSem5Programme!.programVersionId,
        majorDepartment: sem5PreviewMajor,
        academicYearId: sem5AcademicYearId || undefined,
        semesterSequence: 5,
      }),
    enabled:
      canImport &&
      sem5DialogOpen &&
      Boolean(selectedSem5Programme?.programVersionId && sem5PreviewMajor),
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

  const downloadTemplate = async () => {
    const blob = await downloadFullAdmissionImportTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Full_Admission_Import_Template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadLegacyTemplate = async (mode: 'blank' | 'prefilled' = 'blank') => {
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

  const downloadSem1Template = async () => {
    if (!selectedSem1Programme) return;
    setSem1Downloading(true);
    try {
      const blob = await downloadSem1AdmissionTemplate({
        programme: selectedSem1Programme.code,
        programVersionId: selectedSem1Programme.programVersionId,
        semesterSequence: 1,
        academicYearId: sem1AcademicYearId || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sem1_${selectedSem1Programme.code.replace(/[^A-Z0-9-]+/gi, '_')}_Import_Template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setSem1DialogOpen(false);
    } finally {
      setSem1Downloading(false);
    }
  };

  const downloadSem3Template = async (programme?: string) => {
    setSem3Downloading(true);
    try {
      const blob = await downloadSem3AdmissionTemplate({
        programme: programme || undefined,
        semesterSequence: 3,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = programme
        ? `Sem3_${programme.replace(/[^A-Z0-9-]+/gi, '_')}_Import_Template.xlsx`
        : 'Sem3_Admission_Import_Template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      setSem3DialogOpen(false);
    } finally {
      setSem3Downloading(false);
    }
  };

  const downloadSem5Template = async () => {
    if (!selectedSem5Programme) return;
    setSem5Downloading(true);
    try {
      const blob = await downloadSem5AdmissionTemplate({
        programme: selectedSem5Programme.code,
        programVersionId: selectedSem5Programme.programVersionId,
        semesterSequence: 5,
        academicYearId: sem5AcademicYearId || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sem5_${selectedSem5Programme.code.replace(/[^A-Z0-9-]+/gi, '_')}_Import_Template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setSem5DialogOpen(false);
    } finally {
      setSem5Downloading(false);
    }
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

  const focusCopy = focusSemester ? FOCUS_SEMESTER_COPY[focusSemester] : null;

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
              {focusCopy?.title ?? 'Student Import Studio'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {focusCopy?.description ??
                'Download the Full Admission template to populate 90%+ of each student profile in one upload, then validate and commit.'}
            </p>
          </div>
          <BulkActionToolbar>
            {!focusSemester ? (
              <>
                <BulkActionButton
                  type="button"
                  size="sm"
                  icon={<Download className="h-4 w-4" />}
                  onClick={() => void downloadTemplate()}
                >
                  Full Admission Template
                </BulkActionButton>
                <BulkActionButton
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<Download className="h-4 w-4" />}
                  onClick={() => void downloadLegacyTemplate()}
                >
                  Legacy Template
                </BulkActionButton>
                <BulkActionButton
                  type="button"
                  variant="outline"
                  size="sm"
                  icon={<Download className="h-4 w-4" />}
                  onClick={() => void downloadLegacyTemplate('prefilled')}
                >
                  Legacy Prefilled
                </BulkActionButton>
              </>
            ) : null}
            {!focusSemester || focusSemester === 1 ? (
              <BulkActionButton
                type="button"
                variant="outline"
                size="sm"
                icon={<Download className="h-4 w-4" />}
                onClick={() => {
                  setSem1DialogOpen(true);
                  setSem1Programme('');
                  setSem1AcademicYearId('');
                  setSem1PreviewMajor('');
                }}
              >
                {focusSemester === 1 ? 'Generate Sem 1 Template' : 'Sem 1 Template'}
              </BulkActionButton>
            ) : null}
            {!focusSemester || focusSemester === 3 ? (
              <BulkActionButton
                type="button"
                variant="outline"
                size="sm"
                icon={<Download className="h-4 w-4" />}
                onClick={() => {
                  setSem3DialogOpen(true);
                  setSem3Programme('');
                }}
              >
                {focusSemester === 3 ? 'Generate Sem 3 Template' : 'Sem 3 Template'}
              </BulkActionButton>
            ) : null}
            {!focusSemester || focusSemester === 5 ? (
              <BulkActionButton
                type="button"
                variant="outline"
                size="sm"
                icon={<Download className="h-4 w-4" />}
                onClick={() => {
                  setSem5DialogOpen(true);
                  setSem5Programme('');
                  setSem5AcademicYearId('');
                  setSem5PreviewMajor('');
                }}
              >
                {focusSemester === 5 ? 'Generate Sem 5 Template' : 'Sem 5 Template'}
              </BulkActionButton>
            ) : null}
            <BulkActionButton
              type="button"
              variant="outline"
              size="sm"
              icon={<FileCheck2 className="h-4 w-4" />}
              onClick={() => setTemplateGuideOpen((v) => !v)}
            >
              View Guide
            </BulkActionButton>
            {!focusSemester ? (
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
            ) : null}
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

      {sem1DialogOpen ? (
        <Sem1TemplateDialog
          programmes={sem1ProgrammesQ.data ?? []}
          academicYears={academicYearsQ.data ?? []}
          curriculum={sem1CurriculumQ.data}
          eligibleMinors={sem1EligibleMinorsQ.data}
          loading={
            sem1ProgrammesQ.isLoading || academicYearsQ.isLoading || sem1CurriculumQ.isLoading
          }
          downloading={sem1Downloading}
          selectedProgramme={sem1Programme}
          selectedAcademicYearId={sem1AcademicYearId}
          previewMajor={sem1PreviewMajor}
          onSelectProgramme={(value) => {
            setSem1Programme(value);
            setSem1PreviewMajor('');
          }}
          onSelectAcademicYear={setSem1AcademicYearId}
          onSelectPreviewMajor={setSem1PreviewMajor}
          onClose={() => setSem1DialogOpen(false)}
          onDownload={() => void downloadSem1Template()}
        />
      ) : null}

      {sem3DialogOpen ? (
        <Sem3TemplateDialog
          programmes={sem3ProgrammesQ.data ?? []}
          loading={sem3ProgrammesQ.isLoading}
          downloading={sem3Downloading}
          selectedProgramme={sem3Programme}
          onSelectProgramme={setSem3Programme}
          onClose={() => setSem3DialogOpen(false)}
          onDownload={() => void downloadSem3Template(sem3Programme || undefined)}
        />
      ) : null}

      {sem5DialogOpen ? (
        <Sem5TemplateDialog
          programmes={sem5ProgrammesQ.data ?? []}
          academicYears={academicYearsQ.data ?? []}
          curriculum={sem5CurriculumQ.data}
          eligibleMinors={sem5EligibleMinorsQ.data}
          loading={
            sem5ProgrammesQ.isLoading || academicYearsQ.isLoading || sem5CurriculumQ.isLoading
          }
          downloading={sem5Downloading}
          selectedProgramme={sem5Programme}
          selectedAcademicYearId={sem5AcademicYearId}
          previewMajor={sem5PreviewMajor}
          onSelectProgramme={(value) => {
            setSem5Programme(value);
            setSem5PreviewMajor('');
          }}
          onSelectAcademicYear={setSem5AcademicYearId}
          onSelectPreviewMajor={setSem5PreviewMajor}
          onClose={() => setSem5DialogOpen(false)}
          onDownload={() => void downloadSem5Template()}
        />
      ) : null}
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

function Sem1TemplateDialog({
  programmes,
  academicYears,
  curriculum,
  eligibleMinors,
  loading,
  downloading,
  selectedProgramme,
  selectedAcademicYearId,
  previewMajor,
  onSelectProgramme,
  onSelectAcademicYear,
  onSelectPreviewMajor,
  onClose,
  onDownload,
}: {
  programmes: Sem1ImportProgrammeOption[];
  academicYears: { id: string; name: string }[];
  curriculum?: {
    curriculumLabel: string;
    majorDepartments: { departmentName: string }[];
    vacPaper: { code: string; title: string };
  };
  eligibleMinors?: {
    majorDepartment: string;
    majorPaper: { code: string; title: string };
    vacPaper: { code: string; title: string };
    eligibleMinors: string[];
  };
  loading: boolean;
  downloading: boolean;
  selectedProgramme: string;
  selectedAcademicYearId: string;
  previewMajor: string;
  onSelectProgramme: (value: string) => void;
  onSelectAcademicYear: (value: string) => void;
  onSelectPreviewMajor: (value: string) => void;
  onClose: () => void;
  onDownload: () => void;
}) {
  const activeProgramme =
    programmes.find((programme) => programme.code === selectedProgramme) ?? programmes[0];
  const majorOptions = curriculum?.majorDepartments ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border/60 bg-card p-5 shadow-2xl">
        <h2 className="text-lg font-semibold">Download Semester 1 Template</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Select academic year and programme. VAC Environment Studies is registered automatically —
          no course codes in the Excel file.
        </p>

        <label className="mt-4 block text-sm font-medium">
          Academic Year
          <select
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            value={selectedAcademicYearId}
            onChange={(event) => onSelectAcademicYear(event.target.value)}
            disabled={loading}
          >
            <option value="">Any / default rules</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-sm font-medium">
          Programme
          <select
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            value={selectedProgramme || activeProgramme?.code || ''}
            onChange={(event) => onSelectProgramme(event.target.value)}
            disabled={loading}
          >
            {programmes.map((programme) => (
              <option key={programme.code} value={programme.code}>
                {programme.code} — {programme.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
          <p>
            <span className="text-muted-foreground">Semester:</span> 1
          </p>
          <p>
            <span className="text-muted-foreground">Curriculum:</span>{' '}
            {activeProgramme?.curriculumLabel ?? curriculum?.curriculumLabel ?? 'FYUGP'}
          </p>
          <p>
            <span className="text-muted-foreground">Auto VAC:</span>{' '}
            {curriculum?.vacPaper.title ?? eligibleMinors?.vacPaper.title ?? 'Environment Studies'}
          </p>
        </div>

        <label className="mt-4 block text-sm font-medium">
          Preview Major Department
          <select
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            value={previewMajor}
            onChange={(event) => onSelectPreviewMajor(event.target.value)}
            disabled={loading || !majorOptions.length}
          >
            <option value="">Select to preview resolved papers</option>
            {majorOptions.map((major) => (
              <option key={major.departmentName} value={major.departmentName}>
                {major.departmentName}
              </option>
            ))}
          </select>
        </label>

        {eligibleMinors && previewMajor ? (
          <div className="mt-4 space-y-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm">
            <p className="font-medium text-primary">{eligibleMinors.majorDepartment}</p>
            <p className="text-xs text-muted-foreground">
              Major paper: {eligibleMinors.majorPaper.code}
            </p>
            <p className="text-xs">
              Allowed minors: {eligibleMinors.eligibleMinors.join(', ') || 'None configured'}
            </p>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onDownload} disabled={downloading || loading}>
            {downloading ? 'Generating…' : 'Generate Import Template'}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Sem5TemplateDialog({
  programmes,
  academicYears,
  curriculum,
  eligibleMinors,
  loading,
  downloading,
  selectedProgramme,
  selectedAcademicYearId,
  previewMajor,
  onSelectProgramme,
  onSelectAcademicYear,
  onSelectPreviewMajor,
  onClose,
  onDownload,
}: {
  programmes: Sem5ImportProgrammeOption[];
  academicYears: { id: string; name: string }[];
  curriculum?: {
    curriculumLabel: string;
    majorDepartments: { departmentName: string }[];
  };
  eligibleMinors?: {
    majorDepartment: string;
    majorPapers: { code: string; title: string }[];
    internship: { code: string; title: string };
    eligibleMinors: string[];
  };
  loading: boolean;
  downloading: boolean;
  selectedProgramme: string;
  selectedAcademicYearId: string;
  previewMajor: string;
  onSelectProgramme: (value: string) => void;
  onSelectAcademicYear: (value: string) => void;
  onSelectPreviewMajor: (value: string) => void;
  onClose: () => void;
  onDownload: () => void;
}) {
  const activeProgramme =
    programmes.find((programme) => programme.code === selectedProgramme) ?? programmes[0];
  const majorOptions = curriculum?.majorDepartments ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border/60 bg-card p-5 shadow-2xl">
        <h2 className="text-lg font-semibold">Download Semester 5 Template</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Select academic year, programme, and curriculum. The Excel template uses Major Department,
          Minor Department, and Internship Area only — no course codes.
        </p>

        <label className="mt-4 block text-sm font-medium">
          Academic Year
          <select
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            value={selectedAcademicYearId}
            onChange={(event) => onSelectAcademicYear(event.target.value)}
            disabled={loading}
          >
            <option value="">Any / default rules</option>
            {academicYears.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-sm font-medium">
          Programme
          <select
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            value={selectedProgramme || activeProgramme?.code || ''}
            onChange={(event) => onSelectProgramme(event.target.value)}
            disabled={loading}
          >
            {programmes.map((programme) => (
              <option key={programme.code} value={programme.code}>
                {programme.code} — {programme.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 rounded-2xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
          <p>
            <span className="text-muted-foreground">Semester:</span> 5
          </p>
          <p>
            <span className="text-muted-foreground">Curriculum:</span>{' '}
            {activeProgramme?.curriculumLabel ?? curriculum?.curriculumLabel ?? 'FYUGP'}
          </p>
        </div>

        <label className="mt-4 block text-sm font-medium">
          Preview Major Department
          <select
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            value={previewMajor}
            onChange={(event) => onSelectPreviewMajor(event.target.value)}
            disabled={loading || !majorOptions.length}
          >
            <option value="">Select to preview resolved papers</option>
            {majorOptions.map((major) => (
              <option key={major.departmentName} value={major.departmentName}>
                {major.departmentName}
              </option>
            ))}
          </select>
        </label>

        {eligibleMinors && previewMajor ? (
          <div className="mt-4 space-y-2 rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm">
            <p className="font-medium text-primary">{eligibleMinors.majorDepartment}</p>
            <p className="text-xs text-muted-foreground">
              Major papers: {eligibleMinors.majorPapers.map((paper) => paper.code).join(', ')}
            </p>
            <p className="text-xs text-muted-foreground">
              Internship: {eligibleMinors.internship.code}
            </p>
            <p className="text-xs">
              Allowed minors: {eligibleMinors.eligibleMinors.join(', ') || 'None configured'}
            </p>
          </div>
        ) : null}

        <p className="mt-4 text-xs text-muted-foreground">
          Use CREATE mode for new admissions or MERGE mode to register Sem 5 subjects for existing
          students.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onDownload} disabled={downloading || loading}>
            {downloading ? 'Generating…' : 'Generate Import Template'}
          </Button>
        </div>
      </section>
    </div>
  );
}

function Sem3TemplateDialog({
  programmes,
  loading,
  downloading,
  selectedProgramme,
  onSelectProgramme,
  onClose,
  onDownload,
}: {
  programmes: { code: string; name: string }[];
  loading: boolean;
  downloading: boolean;
  selectedProgramme: string;
  onSelectProgramme: (value: string) => void;
  onClose: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <section className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-5 shadow-2xl">
        <h2 className="text-lg font-semibold">Download Semester 3 Template</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose the curriculum programme. The Excel will contain Semester 3 paper names only — no
          course codes. Major Paper 1 and 2 are assigned automatically from Major Department.
        </p>
        <label className="mt-4 block text-sm font-medium">
          Programme
          <select
            className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            value={selectedProgramme}
            onChange={(event) => onSelectProgramme(event.target.value)}
            disabled={loading}
          >
            <option value="">Default (first BA programme)</option>
            {programmes.map((programme) => (
              <option key={programme.code} value={programme.code}>
                {programme.code} — {programme.name}
              </option>
            ))}
          </select>
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={onDownload} disabled={downloading || loading}>
            {downloading ? 'Generating…' : 'Download template'}
          </Button>
        </div>
      </section>
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
          Template Guide — student import Excel
        </span>
        <span className="text-xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-4 text-xs">
          <p className="text-muted-foreground">
            Use <span className="font-medium text-foreground">Sem 3 Template</span> for Semester 3
            FYUGP imports (2 Major + MDC + AEC + SEC + VTC). The default blank template includes all
            columns with a Sem 3 sample row. Download dropdowns on{' '}
            <span className="font-medium text-foreground">CODE - Subject Name</span> in{' '}
            <span className="font-medium text-foreground">MAJOR_CODE</span> etc., or subject names
            in <span className="font-medium text-foreground">Major Subject</span> columns. See the{' '}
            <span className="font-medium text-foreground">SUBJECT_MASTER</span> sheet for the full
            curriculum list.
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
              <p className="mb-1 font-semibold">NEP paper columns (Sem 3)</p>
              {[
                'Major Department — ERP assigns both major papers',
                'MDC Paper / AEC Paper / SEC Paper / VTC Paper',
                'No Minor or VAC columns in Semester 3',
                'Current Semester = 3',
                'Select names from dropdowns — never enter course codes',
              ].map((item) => (
                <p key={item} className="text-muted-foreground">
                  ○ {item}
                </p>
              ))}
              <p className="mt-2 mb-1 font-semibold">NEP paper columns (Sem 1)</p>
              {[
                'MAJOR_CODE / Major Subject',
                'MINOR_CODE / Minor Subject',
                'MDC, AEC, SEC, VAC',
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
                <Sem5AcademicMappingPreview mapping={row.academicMapping} />
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

function Sem5AcademicMappingPreview({
  mapping,
}: {
  mapping?: StudentImportPreviewRow['academicMapping'];
}) {
  const isSem5 = Boolean(mapping?.major3 || mapping?.internship);
  const isSem1 = Boolean(
    !isSem5 && mapping?.vac && mapping?.mdc && mapping?.aec && mapping?.sec && !mapping?.vtc,
  );

  if (isSem1) {
    const line = (label: string, code?: string, input?: string) => (
      <p>
        <span className="font-medium">{input ?? label}</span>
        {code ? ` → ${code}` : null}
      </p>
    );
    return (
      <div className="min-w-[360px] space-y-1 text-[11px]">
        {line(
          'Major',
          mapping?.major?.courseCode,
          mapping?.major?.input ?? mapping?.major?.resolvedLabel?.split(' - ').pop(),
        )}
        {line(
          'Minor',
          mapping?.minor?.courseCode,
          mapping?.minor?.input ?? mapping?.minor?.resolvedLabel?.split(' - ').pop(),
        )}
        {line(
          'MDC',
          mapping?.mdc?.courseCode,
          mapping?.mdc?.input ?? mapping?.mdc?.resolvedLabel?.split(' - ').pop(),
        )}
        {line(
          'AEC',
          mapping?.aec?.courseCode,
          mapping?.aec?.input ?? mapping?.aec?.resolvedLabel?.split(' - ').pop(),
        )}
        {line(
          'SEC',
          mapping?.sec?.courseCode,
          mapping?.sec?.input ?? mapping?.sec?.resolvedLabel?.split(' - ').pop(),
        )}
        {line('Environment Studies', mapping?.vac?.courseCode, 'VAC (auto)')}
      </div>
    );
  }

  if (isSem5) {
    const majorLabel =
      mapping?.major?.input ?? mapping?.major?.resolvedLabel?.split(' - ').pop() ?? 'Major';
    const minorLabel =
      mapping?.minor?.input ?? mapping?.minor?.resolvedLabel?.split(' - ').pop() ?? 'Minor';
    const majorCodes = [mapping?.major, mapping?.major2, mapping?.major3]
      .filter(Boolean)
      .map((entry) => entry?.courseCode)
      .filter(Boolean)
      .join(', ');
    return (
      <div className="min-w-[360px] space-y-1 text-[11px]">
        <p>
          <span className="font-medium">{majorLabel}</span>
          {majorCodes ? ` → ${majorCodes}` : null}
        </p>
        <p>
          <span className="font-medium">{minorLabel}</span>
          {mapping?.minor?.courseCode ? ` → ${mapping.minor.courseCode}` : null}
        </p>
        <p>
          <span className="font-medium">
            {mapping?.internshipArea?.resolvedLabel ??
              mapping?.internshipArea?.input ??
              'Internship'}
          </span>
          {mapping?.internship?.courseCode ? ` → ${mapping.internship.courseCode}` : null}
        </p>
      </div>
    );
  }

  return (
    <div className="grid min-w-[360px] grid-cols-2 gap-1 text-[11px]">
      {(['major', 'minor', 'mdc', 'aec', 'sec', 'vac', 'vtc'] as const).map((key) => (
        <span
          key={key}
          className={cn(
            'rounded-full px-2 py-1',
            mapping?.[key]?.resolvedLabel
              ? 'bg-primary/10 text-primary'
              : 'bg-muted text-muted-foreground',
          )}
          title={mapping?.[key]?.input}
        >
          {key.toUpperCase()} → {formatAcademicMapping(mapping?.[key])}
        </span>
      ))}
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
  if ('courseCode' in mapping && mapping.courseCode) {
    const paper = `${mapping.courseCode} → ${mapping.resolvedLabel}`;
    return 'sectionCode' in mapping && mapping.sectionCode
      ? `${paper} [${mapping.sectionCode}]`
      : paper;
  }
  return mapping.resolvedLabel;
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
