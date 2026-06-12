'use client';

import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';

type Props = {
  batchId: string | null;
  result: {
    async?: boolean;
    applied?: number;
    errors?: number;
    total?: number;
    message?: string;
  } | null;
  onStartOver?: () => void;
};

export function BulkUpdateResultStep({ batchId, result, onStartOver }: Props) {
  if (!result) {
    return <p className="text-sm text-muted-foreground">Apply the batch to see results.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 to-card px-4 py-4 shadow-lg">
        <h2 className="text-sm font-semibold text-primary">
          {result.async ? 'Bulk update queued' : 'Bulk update complete'}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {result.message ??
            (result.async
              ? 'Large batch is processing in the background. Check batch history for status.'
              : `Applied ${result.applied ?? 0} of ${result.total ?? 0} students. ${result.errors ?? 0} errors.`)}
        </p>
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

      {onStartOver ? (
        <button type="button" className="text-xs text-primary underline" onClick={onStartOver}>
          Start another bulk update
        </button>
      ) : null}
    </div>
  );
}
