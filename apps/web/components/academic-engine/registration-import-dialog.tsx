'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileSpreadsheet, Loader2, XCircle } from 'lucide-react';

import { PageTabs } from '@/components/erp/page-tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  commitRegistrationImport,
  downloadRegistrationImportErrorReport,
  downloadRegistrationImportTemplate,
  downloadWideRegistrationImportTemplate,
  validateRegistrationImport,
  type RegistrationImportFormat,
  type RegistrationImportPreview,
} from '@/services/admin-registration';
import { cn } from '@/utils/cn';

type Step = 'upload' | 'preview' | 'committing' | 'done';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: string;
  semesterSequence: number;
};

export function RegistrationImportDialog({
  open,
  onOpenChange,
  semesterId,
  semesterSequence,
}: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [format, setFormat] = useState<RegistrationImportFormat>('wide');
  const [uploadPct, setUploadPct] = useState(0);
  const [preview, setPreview] = useState<RegistrationImportPreview | null>(null);
  const [mode, setMode] = useState<'VALID_ONLY' | 'STRICT'>('VALID_ONLY');
  const [submitAfterImport, setSubmitAfterImport] = useState(true);
  const [freezeAfterImport, setFreezeAfterImport] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    successfulRows?: number;
    studentsProcessed?: number;
  } | null>(null);

  const reset = useCallback(() => {
    setStep('upload');
    setFormat('wide');
    setUploadPct(0);
    setPreview(null);
    setMode('VALID_ONLY');
    setSubmitAfterImport(true);
    setFreezeAfterImport(false);
    setCommitResult(null);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const validateMut = useMutation({
    mutationFn: (file: File) =>
      validateRegistrationImport(
        file,
        {
          format,
          semesterId: semesterId || undefined,
          semesterSequence: semesterId ? semesterSequence : undefined,
          submitAfterImport,
          freezeAfterImport,
        },
        (pct) => setUploadPct(pct),
      ),
    onSuccess: (data) => {
      setPreview(data);
      setStep('preview');
    },
  });

  const commitMut = useMutation({
    mutationFn: () => {
      if (!preview?.batchId) throw new Error('No batch');
      return commitRegistrationImport({
        batchId: preview.batchId,
        semesterId: semesterId || undefined,
        semesterSequence: semesterId ? semesterSequence : undefined,
        mode,
        submitAfterImport,
        freezeAfterImport,
      });
    },
    onSuccess: (result) => {
      setCommitResult(result);
      setStep('done');
      void qc.invalidateQueries({ queryKey: ['admin-registrations'] });
    },
  });

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep('upload');
    validateMut.mutate(file);
    e.target.value = '';
  };

  const downloadTemplate = async () => {
    const blob =
      format === 'wide'
        ? await downloadWideRegistrationImportTemplate()
        : await downloadRegistrationImportTemplate();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      format === 'wide'
        ? 'Registration_Wide_Import_Template.xlsx'
        : 'Registration_Import_Template.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadErrors = async () => {
    if (!preview?.batchId) return;
    const blob = await downloadRegistrationImportErrorReport(preview.batchId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Registration_Import_Errors.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = preview?.summary.valid ?? 0;
  const canCommit = validCount > 0 && preview?.status === 'VALIDATED';
  const longFormatBlocked = format === 'long' && !semesterId;
  const wideUsesDefaultSemester = format === 'wide' && Boolean(semesterId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import subject registrations</DialogTitle>
          <DialogDescription>
            {format === 'wide'
              ? 'Wide format: one row per student with category columns (migration default).'
              : `Long format: one row per student per NEP category for semester ${semesterSequence}.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <PageTabs
              tabs={[
                { id: 'wide' as const, label: 'Wide format' },
                { id: 'long' as const, label: 'Long format (advanced)' },
              ]}
              active={format}
              onChange={setFormat}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void downloadTemplate()}
              >
                Download {format === 'wide' ? 'wide' : 'long'} template
              </Button>
            </div>

            {format === 'wide' ? (
              <p className="text-xs text-muted-foreground">
                Each row includes a Semester column. Per-row semester is used for validation and
                commit.
                {wideUsesDefaultSemester
                  ? ` Active registration window (sem ${semesterSequence}) is passed as the API default.`
                  : ' Configure a registration window to supply the optional default calendar semester.'}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Long format requires the active registration window semester before importing.
              </p>
            )}

            <label
              className={cn(
                'flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8',
                longFormatBlocked
                  ? 'cursor-not-allowed opacity-60'
                  : 'cursor-pointer hover:bg-muted/30',
              )}
            >
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm font-medium">
                {validateMut.isPending ? 'Validating…' : 'Choose .xlsx file'}
              </span>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={validateMut.isPending || longFormatBlocked}
                onChange={onFile}
              />
            </label>

            {longFormatBlocked ? (
              <p className="text-sm text-destructive">
                No active registration window — configure a semester window first for long-format
                import.
              </p>
            ) : null}

            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={submitAfterImport}
                  onChange={(e) => setSubmitAfterImport(e.target.checked)}
                />
                Submit and allocate seats after import
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={freezeAfterImport}
                  onChange={(e) => setFreezeAfterImport(e.target.checked)}
                />
                Freeze registration for imported students
              </label>
            </div>

            {validateMut.isPending ? (
              <div className="space-y-1">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Upload {uploadPct}%</p>
              </div>
            ) : null}

            {validateMut.isError ? (
              <p className="text-sm text-destructive">
                {(validateMut.error as Error).message || 'Validation failed'}
              </p>
            ) : null}
          </div>
        )}

        {(step === 'preview' || step === 'committing') && preview ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded-md bg-muted px-2 py-1">Total: {preview.summary.total}</span>
              <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-400">
                Valid: {preview.summary.valid}
              </span>
              <span className="rounded-md bg-destructive/10 px-2 py-1 text-destructive">
                Errors: {preview.summary.invalid}
              </span>
              <span className="rounded-md bg-muted px-2 py-1">
                Format: {format === 'wide' ? 'Wide' : 'Long'}
              </span>
            </div>

            {preview.summary.invalid > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void downloadErrors()}
              >
                Download error report
              </Button>
            ) : null}

            <div className="max-h-64 overflow-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="px-2 py-1 text-left">Row</th>
                    <th className="px-2 py-1 text-left">Reg No</th>
                    <th className="px-2 py-1 text-left">Selection</th>
                    <th className="px-2 py-1 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber} className="border-t border-border">
                      <td className="px-2 py-1">{row.rowNumber}</td>
                      <td className="px-2 py-1">{row.displayCode ?? '—'}</td>
                      <td className="px-2 py-1">{row.displayTitle ?? '—'}</td>
                      <td className="px-2 py-1">
                        {row.status === 'VALID' ? (
                          <CheckCircle2 className="inline h-4 w-4 text-emerald-600" />
                        ) : (
                          <span className="text-destructive" title={row.errors.join('; ')}>
                            <XCircle className="inline h-4 w-4" /> {row.errors[0]}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {preview.hasMore ? (
              <p className="text-xs text-muted-foreground">
                Showing first {preview.rows.length} rows. Download the error report for full
                details.
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <select
                className="h-9 rounded-md border border-border bg-card px-2 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value as 'VALID_ONLY' | 'STRICT')}
              >
                <option value="VALID_ONLY">Import valid rows only</option>
                <option value="STRICT">Strict (reject if any errors)</option>
              </select>
              <Button
                type="button"
                disabled={!canCommit || commitMut.isPending || step === 'committing'}
                onClick={() => commitMut.mutate()}
              >
                {commitMut.isPending || step === 'committing' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing…
                  </>
                ) : (
                  `Import ${validCount} row(s)`
                )}
              </Button>
              <Button type="button" variant="ghost" onClick={reset}>
                Upload another file
              </Button>
            </div>
            {commitMut.isError ? (
              <p className="text-sm text-destructive">
                {(commitMut.error as Error).message || 'Import failed'}
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 'done' && commitResult ? (
          <div
            className={cn(
              'space-y-3 rounded-lg border p-4',
              'border-emerald-500/30 bg-emerald-500/5',
            )}
          >
            <p className="font-medium text-emerald-800 dark:text-emerald-300">Import complete</p>
            <p className="text-sm">
              {commitResult.successfulRows ?? 0} row(s) imported
              {commitResult.studentsProcessed != null
                ? ` for ${commitResult.studentsProcessed} student(s).`
                : '.'}
            </p>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
