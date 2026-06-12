'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  bulkGenerateRegistrations,
  type BulkGenerateMode,
  type BulkGenerateResult,
} from '@/services/admin-registration';
import { apiErrorMessage } from '@/utils/api-error';

type BulkGenerateRegistrationsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: string;
  semesterSequence: number;
  programVersionId?: string;
  admissionBatchId?: string;
  shiftId?: string;
  studentIds?: string[];
  onComplete?: (result: BulkGenerateResult) => void;
};

export function BulkGenerateRegistrationsDialog({
  open,
  onOpenChange,
  semesterId,
  semesterSequence,
  programVersionId,
  admissionBatchId,
  shiftId,
  studentIds,
  onComplete,
}: BulkGenerateRegistrationsDialogProps) {
  const [step, setStep] = useState<'configure' | 'results'>('configure');
  const [mode, setMode] = useState<BulkGenerateMode>('COMPULSORY_ONLY');
  const [submitAfter, setSubmitAfter] = useState(false);
  const [result, setResult] = useState<BulkGenerateResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setStep('configure');
      setMode('COMPULSORY_ONLY');
      setSubmitAfter(false);
      setResult(null);
      setError('');
    }
  }, [open]);

  const runMut = useMutation({
    mutationFn: () =>
      bulkGenerateRegistrations({
        semesterId,
        semesterSequence,
        mode,
        programVersionId: programVersionId || undefined,
        admissionBatchId: admissionBatchId || undefined,
        shiftId: shiftId || undefined,
        studentIds: studentIds?.length ? studentIds : undefined,
        submitAfter,
        assignMode: mode === 'FULL' ? 'ALL_CATEGORIES' : 'COMPULSORY_ONLY',
      }),
    onSuccess: (data) => {
      setResult(data);
      setStep('results');
      onComplete?.(data);
    },
    onError: (e) => setError(apiErrorMessage(e, 'Generation failed')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate semester registrations</DialogTitle>
          <DialogDescription>
            Semester {semesterSequence} · Creates drafts and optionally auto-assigns compulsory
            subjects
          </DialogDescription>
        </DialogHeader>

        {step === 'configure' ? (
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Generation mode</p>
              <div className="space-y-2">
                {(
                  [
                    ['DRAFT_ONLY', 'Draft only — create empty registrations'],
                    ['COMPULSORY_ONLY', 'Compulsory only — auto-assign Major/Minor etc.'],
                    ['PREPARE_ELECTIVES', 'Compulsory + report unfilled elective slots'],
                    ['FULL', 'Full auto-assign all categories (legacy)'],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <input
                      type="radio"
                      name="bulk-gen-mode"
                      checked={mode === value}
                      onChange={() => setMode(value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={submitAfter}
                onChange={(e) => setSubmitAfter(e.target.checked)}
              />
              Submit and allocate seats after generation
            </label>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={runMut.isPending} onClick={() => runMut.mutate()}>
                {runMut.isPending ? 'Generating…' : 'Generate'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              {result?.successful ?? 0} succeeded · {result?.failed ?? 0} failed ·{' '}
              {result?.total ?? 0} total
            </p>
            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80">
                  <tr className="border-b border-border text-left">
                    <th className="p-2">Student</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {(result?.results ?? []).map((row) => (
                    <tr key={row.studentId} className="border-b border-border/60">
                      <td className="p-2 font-mono">{row.studentId.slice(0, 8)}…</td>
                      <td className="p-2">{row.ok ? 'OK' : 'Failed'}</td>
                      <td className="p-2 text-muted-foreground">
                        {row.error ??
                          row.status ??
                          (row.electiveSlots?.length
                            ? `${row.electiveSlots.length} elective slot(s) open`
                            : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
