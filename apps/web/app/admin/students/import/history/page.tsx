'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useRequireAuth } from '@/hooks/use-auth';
import {
  downloadStudentImportErrorReport,
  fetchStudentImportBatches,
  fetchStudentImportPreview,
  type StudentImportBatch,
  type StudentImportPreview,
} from '@/services/students';
import { cn } from '@/utils/cn';
import { formatDisplayDateTime } from '@/utils/format-date';

const PREVIEW_PAGE_SIZE = 50;

export default function StudentImportHistoryPage() {
  const session = useRequireAuth();
  const [page, setPage] = useState(1);
  const [previewBatch, setPreviewBatch] = useState<StudentImportBatch | null>(null);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewLoading, setPreviewLoading] = useState(false);

  const canImport = useMemo(
    () =>
      session?.user.roles.some((r) =>
        ['college-admin', 'super-admin', 'university-admin'].includes(r),
      ) ?? false,
    [session],
  );

  const batches = useQuery({
    queryKey: ['student-import-batches', page],
    queryFn: () => fetchStudentImportBatches(page),
    enabled: Boolean(session) && canImport,
  });

  const openPreview = async (batch: StudentImportBatch) => {
    setPreviewBatch(batch);
    setPreviewPage(1);
    setPreviewLoading(true);
    try {
      const data = await fetchStudentImportPreview(batch.id, 1, PREVIEW_PAGE_SIZE);
      setPreview(data);
    } finally {
      setPreviewLoading(false);
    }
  };

  const loadPreviewPage = async (batchId: string, nextPage: number) => {
    setPreviewLoading(true);
    try {
      const data = await fetchStudentImportPreview(batchId, nextPage, PREVIEW_PAGE_SIZE);
      if (data) {
        setPreview(data);
        setPreviewPage(nextPage);
      }
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewBatch(null);
    setPreview(null);
    setPreviewPage(1);
  };

  if (!session) return null;

  const totalPages = batches.data?.meta.totalPages ?? 1;
  const previewTotalPages = preview
    ? Math.max(1, Math.ceil(preview.summary.total / PREVIEW_PAGE_SIZE))
    : 1;

  return (
    <DashboardShell role="admin" title="Import History">
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Review past student master import batches, validation summaries, and row-level previews.
        </p>

        {!canImport ? (
          <CompactCard>
            <CompactCardHeader
              title="Import history"
              description="You need student import permission to view batch history."
            />
          </CompactCard>
        ) : (
          <CompactCard>
            <CompactCardHeader
              title="Import batches"
              description="Validated and committed student master imports"
            />
            <CompactCardBody className="space-y-4">
              {batches.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (batches.data?.data.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No import batches yet.{' '}
                  <Link href="/admin/students/import" className="text-primary underline">
                    Upload a file
                  </Link>
                  .
                </p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">File</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Rows</th>
                        <th className="px-3 py-2">Uploaded</th>
                        <th className="px-3 py-2">By</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {(batches.data?.data ?? []).map((batch) => (
                        <tr key={batch.id} className="border-t border-border">
                          <td className="px-3 py-2">{batch.fileName}</td>
                          <td className="px-3 py-2">
                            <StatusBadge status={batch.status} />
                          </td>
                          <td className="px-3 py-2">
                            {batch.successfulRows > 0
                              ? `${batch.successfulRows}/${batch.totalRows} committed`
                              : `${batch.validRows} valid · ${batch.invalidRows} invalid`}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {formatDisplayDateTime(batch.createdAt)}
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {batch.uploadedByEmail ?? '—'}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => void openPreview(batch)}
                              >
                                Preview
                              </Button>
                              {batch.invalidRows > 0 ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => downloadStudentImportErrorReport(batch.id)}
                                >
                                  Errors
                                </Button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              ) : null}
            </CompactCardBody>
          </CompactCard>
        )}

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/students/import"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
          >
            ← Bulk import
          </Link>
          <Link
            href="/admin/students"
            className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
          >
            Student directory
          </Link>
        </div>
      </div>

      <Dialog open={Boolean(previewBatch)} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import preview</DialogTitle>
            <DialogDescription>
              {previewBatch?.fileName} · {previewBatch?.status}
            </DialogDescription>
          </DialogHeader>

          {previewLoading && !preview ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading preview…
            </div>
          ) : preview ? (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-md bg-muted px-2 py-1">
                  Total: {preview.summary.total}
                </span>
                <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-400">
                  Valid: {preview.summary.valid}
                </span>
                <span className="rounded-md bg-destructive/10 px-2 py-1 text-destructive">
                  Errors: {preview.summary.invalid}
                </span>
              </div>

              <div className="relative max-h-64 overflow-auto rounded-md border border-border">
                {previewLoading ? (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : null}
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">Row</th>
                      <th className="px-2 py-1 text-left">Reg No</th>
                      <th className="px-2 py-1 text-left">Name</th>
                      <th className="px-2 py-1 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-border">
                        <td className="px-2 py-1">{row.rowNumber}</td>
                        <td className="px-2 py-1 font-mono text-xs">{row.displayCode ?? '—'}</td>
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

              {preview.hasMore || previewTotalPages > 1 ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    Page {previewPage} of {previewTotalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={previewPage <= 1 || previewLoading}
                    onClick={() =>
                      previewBatch && void loadPreviewPage(previewBatch.id, previewPage - 1)
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7"
                    disabled={
                      previewPage >= previewTotalPages || previewLoading || !preview.hasMore
                    }
                    onClick={() =>
                      previewBatch && void loadPreviewPage(previewBatch.id, previewPage + 1)
                    }
                  >
                    Next
                  </Button>
                </div>
              ) : null}

              {preview.summary.invalid > 0 && previewBatch ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadStudentImportErrorReport(previewBatch.id)}
                >
                  Download error report
                </Button>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'COMMITTED'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
      : status === 'FAILED'
        ? 'bg-destructive/10 text-destructive'
        : status === 'VALIDATED'
          ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
          : 'bg-muted text-muted-foreground';

  return <span className={cn('rounded-md px-2 py-0.5 text-xs font-medium', tone)}>{status}</span>;
}
