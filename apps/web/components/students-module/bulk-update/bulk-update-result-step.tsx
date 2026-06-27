'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  fetchBulkUpdateBatch,
  getBulkUpdateApplyProgress,
  type BulkUpdateApplyProgress,
} from '@/services/student-bulk-update';
import { cn } from '@/utils/cn';

type ApplyResult = {
  async?: boolean;
  applied?: number;
  errors?: number;
  total?: number;
  message?: string;
};

type Props = {
  batchId: string | null;
  result: ApplyResult | null;
  onStartOver?: () => void;
};

function BulkUpdateProgressBar({ progress }: { progress: BulkUpdateApplyProgress }) {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          {progress.indeterminate ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          ) : null}
          {progress.label}
        </span>
        {!progress.indeterminate && progress.total > 0 ? <span>{progress.percent}%</span> : null}
      </div>
      <Progress
        value={progress.indeterminate ? 8 : progress.percent}
        className={cn('h-2.5', progress.indeterminate && '[&>div]:animate-pulse')}
      />
      {progress.total > 0 ? (
        <p className="text-xs text-muted-foreground">
          {progress.processed} of {progress.total} students processed
        </p>
      ) : null}
    </div>
  );
}

export function BulkUpdateResultStep({ batchId, result, onStartOver }: Props) {
  const [displayResult, setDisplayResult] = useState<ApplyResult | null>(result);
  const [progress, setProgress] = useState<BulkUpdateApplyProgress | null>(null);

  useEffect(() => {
    setDisplayResult(result);
  }, [result]);

  const batchQuery = useQuery({
    queryKey: ['bulk-update', 'batch', batchId, 'result-poll'],
    queryFn: async () => {
      const batch = await fetchBulkUpdateBatch(batchId!);
      const nextProgress = getBulkUpdateApplyProgress(batch);
      setProgress(nextProgress);

      if (batch.status === 'APPLIED' || batch.status === 'FAILED') {
        setDisplayResult({
          async: false,
          applied: batch.appliedCount,
          errors: batch.errorCount,
          total: batch.validCount || batch.studentCount,
          message:
            batch.status === 'FAILED'
              ? `Bulk update failed. ${batch.appliedCount} updated, ${batch.errorCount} errors.`
              : `Updated ${batch.appliedCount} students. ${batch.errorCount} errors.`,
        });
      }

      return batch;
    },
    enabled:
      Boolean(batchId) &&
      (Boolean(displayResult?.async) || batchQuery.data?.status === 'PROCESSING'),
    refetchInterval: (query) =>
      query.state.data?.status === 'PROCESSING' || displayResult?.async ? 2000 : false,
  });

  if (!displayResult) {
    return <p className="text-sm text-muted-foreground">Apply the batch to see results.</p>;
  }

  const isProcessing = Boolean(displayResult.async) || batchQuery.data?.status === 'PROCESSING';

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-card px-4 py-4 shadow-lg">
        <h2 className="text-sm font-semibold text-primary">
          {isProcessing ? 'Bulk update in progress' : 'Bulk update complete'}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {displayResult.message ??
            (isProcessing
              ? 'Applying changes to student records. This page updates automatically.'
              : `Applied ${displayResult.applied ?? 0} of ${displayResult.total ?? 0} students. ${displayResult.errors ?? 0} errors.`)}
        </p>
        {progress && isProcessing ? <BulkUpdateProgressBar progress={progress} /> : null}
        {isProcessing && progress?.processed === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            If progress stays at 0%, go back to Preview and click Apply again.
          </p>
        ) : null}
      </div>

      {batchId ? (
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/students/bulk-update/history?batch=${batchId}`}
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            View batch details
          </Link>
          <Link
            href="/admin/students/bulk-update/history"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Batch history
          </Link>
          <Link
            href="/admin/students/audit"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Audit logs
          </Link>
          <Link
            href={`/admin/students/bulk-update/history?batch=${batchId}`}
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            Download audit report
          </Link>
        </div>
      ) : null}

      {onStartOver && !isProcessing ? (
        <button type="button" className="text-xs text-primary underline" onClick={onStartOver}>
          Start another bulk update
        </button>
      ) : null}
    </div>
  );
}
