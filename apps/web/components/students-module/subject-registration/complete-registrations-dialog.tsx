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
import { bulkCompleteRegistrations, type BulkCompleteResult } from '@/services/admin-registration';
import { apiErrorMessage } from '@/utils/api-error';

type CompleteRegistrationsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesterId: string;
  semesterSequence: number;
  programVersionId?: string;
  admissionBatchId?: string;
  shiftId?: string;
  studentIds?: string[];
  onComplete?: (result: BulkCompleteResult) => void;
};

export function CompleteRegistrationsDialog({
  open,
  onOpenChange,
  semesterId,
  semesterSequence,
  programVersionId,
  admissionBatchId,
  shiftId,
  studentIds,
  onComplete,
}: CompleteRegistrationsDialogProps) {
  const [step, setStep] = useState<'confirm' | 'results'>('confirm');
  const [result, setResult] = useState<BulkCompleteResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setStep('confirm');
      setResult(null);
      setError('');
    }
  }, [open]);

  const runMut = useMutation({
    mutationFn: () =>
      bulkCompleteRegistrations({
        semesterId: semesterId || undefined,
        semesterSequence,
        programVersionId: programVersionId || undefined,
        admissionBatchId: admissionBatchId || undefined,
        shiftId: shiftId || undefined,
        studentIds: studentIds?.length ? studentIds : undefined,
      }),
    onSuccess: (data) => {
      setResult(data);
      setStep('results');
      onComplete?.(data);
    },
    onError: (e) => setError(apiErrorMessage(e, 'Completion failed')),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete registrations</DialogTitle>
          <DialogDescription>
            Semester {semesterSequence} · Marks every registration in the current scope as
            registered (“Completed”) using the subjects already assigned — auto-assigned Major/Minor
            plus any MDC/AEC/SEC/VAC/VTC you entered.
          </DialogDescription>
        </DialogHeader>

        {step === 'confirm' ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">This will:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                <li>Confirm all assigned subject lines and clear the “Pending” badge.</li>
                <li>Skip the self-service registration-window check (admin action).</li>
                <li>
                  Skip students whose registration has no subjects or an unassigned section — fix
                  those first with Generate/auto-assign, then re-run.
                </li>
                <li>Ignore soft-deleted students automatically.</li>
              </ul>
            </div>
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={runMut.isPending} onClick={() => runMut.mutate()}>
                {runMut.isPending ? 'Completing…' : 'Complete registrations'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              {result?.completed ?? 0} completed · {result?.skipped ?? 0} skipped ·{' '}
              {result?.failed ?? 0} failed · {result?.scanned ?? 0} scanned
            </p>

            {result?.skippedSample?.length ? (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Skipped (need subjects assigned first)
                </p>
                <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <tbody>
                      {result.skippedSample.map((row) => (
                        <tr key={row.enrollment} className="border-b border-border/60">
                          <td className="p-2 font-mono">{row.enrollment}</td>
                          <td className="p-2 text-muted-foreground">{row.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {result?.failedSample?.length ? (
              <div>
                <p className="mb-1 text-xs font-medium text-destructive">Failed</p>
                <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                  <table className="w-full text-xs">
                    <tbody>
                      {result.failedSample.map((row) => (
                        <tr key={row.enrollment} className="border-b border-border/60">
                          <td className="p-2 font-mono">{row.enrollment}</td>
                          <td className="p-2 text-destructive">{row.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

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
