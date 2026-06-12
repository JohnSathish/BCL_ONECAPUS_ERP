'use client';

import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileSpreadsheet, Loader2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  commitCourseImport,
  downloadCourseImportErrorReport,
  fetchCourseImportBatches,
  fetchCourseImportPreview,
  validateCourseImport,
} from '@/services/programs';
import type { CourseImportPreview, CourseImportPreviewRow } from '@/types/programs';
import { cn } from '@/utils/cn';

type Step = 'upload' | 'preview' | 'committing' | 'done';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CourseImportDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('upload');
  const [uploadPct, setUploadPct] = useState(0);
  const [preview, setPreview] = useState<CourseImportPreview | null>(null);
  const [mode, setMode] = useState<'VALID_ONLY' | 'STRICT'>('VALID_ONLY');
  const [commitResult, setCommitResult] = useState<{
    successfulRows?: number;
    failedRows?: number;
  } | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const reset = useCallback(() => {
    setStep('upload');
    setUploadPct(0);
    setPreview(null);
    setMode('VALID_ONLY');
    setCommitResult(null);
    setShowHistory(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const history = useQuery({
    queryKey: ['catalog', 'course-import-batches'],
    queryFn: () => fetchCourseImportBatches(1),
    enabled: open && showHistory,
  });

  const validateMut = useMutation({
    mutationFn: (file: File) => validateCourseImport(file, (pct) => setUploadPct(pct)),
    onSuccess: async (data) => {
      if (data.async) {
        setStep('preview');
        setPreview(data);
        pollUntilValidated(data.batchId);
        return;
      }
      setPreview(data);
      setStep('preview');
    },
  });

  const pollUntilValidated = async (batchId: string) => {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const next = await fetchCourseImportPreview(batchId);
      if (!next) continue;
      if (next.status === 'VALIDATED' || next.status === 'FAILED') {
        setPreview(next);
        return;
      }
    }
  };

  const commitMut = useMutation({
    mutationFn: () => {
      if (!preview?.batchId) throw new Error('No batch');
      return commitCourseImport(preview.batchId, mode);
    },
    onSuccess: async (result) => {
      if (result.async) {
        setStep('committing');
        await pollUntilCommitted(result.batchId);
        return;
      }
      setCommitResult(result);
      setStep('done');
      await qc.invalidateQueries({ queryKey: ['catalog', 'courses'] });
    },
  });

  const pollUntilCommitted = async (batchId: string) => {
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const batches = await fetchCourseImportBatches(1);
      const batch = batches.data.find((b) => b.id === batchId);
      if (!batch) continue;
      if (batch.status === 'COMMITTED') {
        setCommitResult({
          successfulRows: batch.successfulRows,
          failedRows: batch.failedRows,
        });
        setStep('done');
        await qc.invalidateQueries({ queryKey: ['catalog', 'courses'] });
        return;
      }
      if (batch.status === 'FAILED') {
        setCommitResult({ successfulRows: 0, failedRows: batch.invalidRows });
        setStep('done');
        return;
      }
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStep('upload');
    validateMut.mutate(file);
    e.target.value = '';
  };

  const validCount = preview?.summary.valid ?? 0;
  const canCommit = validCount > 0 && preview?.status === 'VALIDATED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import courses from Excel</DialogTitle>
          <DialogDescription>
            Upload Course_Import_Template.xlsx. Review validation results before confirming.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 hover:bg-muted/30">
              <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm font-medium">
                {validateMut.isPending ? 'Validating…' : 'Choose .xlsx file'}
              </span>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={validateMut.isPending}
                onChange={onFile}
              />
            </label>
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
              {preview.status === 'VALIDATING' || step === 'committing' ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Processing…
                </span>
              ) : null}
            </div>

            <PreviewTable rows={preview.rows} />

            {preview.hasMore ? (
              <p className="text-xs text-muted-foreground">
                Showing first {preview.rows.length} rows. Download error report after import for
                full details.
              </p>
            ) : null}

            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="text-sm font-medium">Import mode</p>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="importMode"
                  checked={mode === 'VALID_ONLY'}
                  onChange={() => setMode('VALID_ONLY')}
                  disabled={step === 'committing'}
                />
                <span>
                  Import valid rows only ({validCount} course{validCount === 1 ? '' : 's'})
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="importMode"
                  checked={mode === 'STRICT'}
                  onChange={() => setMode('STRICT')}
                  disabled={step === 'committing'}
                />
                <span>Strict — all or nothing (fails if any row has errors)</span>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
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
                  'Confirm import'
                )}
              </Button>
              {preview.summary.invalid > 0 && preview.status === 'VALIDATED' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => downloadCourseImportErrorReport(preview.batchId)}
                >
                  Download error report
                </Button>
              ) : null}
              <Button type="button" variant="ghost" onClick={reset}>
                Upload another file
              </Button>
            </div>
          </div>
        ) : null}

        {step === 'done' ? (
          <div className="space-y-4">
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Import complete. {commitResult?.successfulRows ?? 0} course(s) added.
            </p>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : null}

        <div className="border-t border-border pt-4">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? 'Hide' : 'Show'} import history
          </Button>
          {showHistory && history.data ? (
            <ul className="mt-2 max-h-40 space-y-2 overflow-y-auto text-xs">
              {history.data.data.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5"
                >
                  <span>
                    {b.fileName} · {b.status} · {b.successfulRows}/{b.totalRows} imported
                  </span>
                  {b.invalidRows > 0 && b.status === 'COMMITTED' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => downloadCourseImportErrorReport(b.id)}
                    >
                      Errors
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PreviewTable({ rows }: { rows: CourseImportPreviewRow[] }) {
  return (
    <div className="max-h-64 overflow-auto rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-muted/80 text-xs uppercase">
          <tr>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Error</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.rowNumber} className="border-t border-border/60">
              <td className="px-3 py-2">
                {r.status === 'VALID' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-label="Valid" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" aria-label="Error" />
                )}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{r.displayCode ?? '—'}</td>
              <td className="px-3 py-2">{r.displayTitle ?? '—'}</td>
              <td className="px-3 py-2 text-xs text-destructive">
                {r.errors.length ? r.errors.join('; ') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
