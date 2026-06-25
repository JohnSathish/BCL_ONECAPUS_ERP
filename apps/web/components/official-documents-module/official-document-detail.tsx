'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Archive, CheckCircle2, Download, Loader2, Printer, Send, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { OfficialDocumentsShell } from '@/components/official-documents-module/official-documents-shell';
import {
  approveOfficialDocument,
  archiveOfficialDocument,
  downloadOfficialDocumentPdf,
  fetchOfficialDocument,
  recordOfficialDocumentPrint,
  rejectOfficialDocument,
  submitOfficialDocumentForApproval,
} from '@/services/official-documents';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

export function OfficialDocumentDetailPage({ id }: { id: string }) {
  const qc = useQueryClient();
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(false);

  const doc = useQuery({
    queryKey: ['official-documents', id],
    queryFn: () => fetchOfficialDocument(id),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['official-documents'] });
    void qc.invalidateQueries({ queryKey: ['official-documents', id] });
  };

  const submitMut = useMutation({
    mutationFn: () => submitOfficialDocumentForApproval(id),
    onSuccess: invalidate,
  });

  const approveMut = useMutation({
    mutationFn: () => approveOfficialDocument(id),
    onSuccess: invalidate,
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectOfficialDocument(id, rejectNote),
    onSuccess: () => {
      setShowReject(false);
      setRejectNote('');
      invalidate();
    },
  });

  const archiveMut = useMutation({
    mutationFn: () => archiveOfficialDocument(id),
    onSuccess: invalidate,
  });

  const printMut = useMutation({
    mutationFn: async () => {
      await recordOfficialDocumentPrint(id);
      const blob = await downloadOfficialDocumentPdf(id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    },
    onSuccess: invalidate,
  });

  const downloadMut = useMutation({
    mutationFn: async () => {
      const blob = await downloadOfficialDocumentPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${doc.data?.referenceNo ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: invalidate,
  });

  if (doc.isLoading) {
    return (
      <OfficialDocumentsShell>
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading document…
        </p>
      </OfficialDocumentsShell>
    );
  }

  const row = doc.data;
  if (!row) {
    return (
      <OfficialDocumentsShell>
        <p className="text-sm text-destructive">Document not found.</p>
      </OfficialDocumentsShell>
    );
  }

  return (
    <OfficialDocumentsShell title={row.title}>
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/admin/administration/official-documents"
              className="text-xs text-primary hover:underline"
            >
              ← Official Documents
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">{row.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {row.referenceNo ? `Ref. ${row.referenceNo}` : 'Draft — no reference yet'} ·{' '}
              {row.documentType} · v{row.currentVersion}
            </p>
          </div>
          <span
            className={cn(
              'rounded-full px-3 py-1 text-xs font-semibold',
              row.status === 'PUBLISHED' && 'bg-emerald-500/10 text-emerald-700',
              row.status === 'PENDING_APPROVAL' && 'bg-amber-500/10 text-amber-800',
              row.status === 'DRAFT' && 'bg-blue-500/10 text-blue-700',
              row.status === 'ARCHIVED' && 'bg-muted text-muted-foreground',
            )}
          >
            {row.status}
          </span>
        </div>

        {row.rejectionNote ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            Rejected: {row.rejectionNote}
          </div>
        ) : null}

        <div className="rounded-2xl border border-border/60 bg-card/85 p-5">
          {row.salutation ? <p className="mb-3 font-semibold">{row.salutation}</p> : null}
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: row.bodyHtml }}
          />
          {row.issuer ? (
            <div className="mt-8 text-right text-sm">
              <p className="font-semibold">{row.issuer.name}</p>
              <p className="text-muted-foreground">{row.issuer.designation}</p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {row.status === 'DRAFT' ? (
            <Button size="sm" disabled={submitMut.isPending} onClick={() => submitMut.mutate()}>
              {submitMut.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Submit for Approval
            </Button>
          ) : null}

          {row.status === 'PENDING_APPROVAL' ? (
            <>
              <Button size="sm" disabled={approveMut.isPending} onClick={() => approveMut.mutate()}>
                {approveMut.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                )}
                Approve & Publish
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowReject((v) => !v)}>
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </>
          ) : null}

          {row.status === 'PUBLISHED' ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={printMut.isPending}
                onClick={() => printMut.mutate()}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={downloadMut.isPending}
                onClick={() => downloadMut.mutate()}
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={archiveMut.isPending}
                onClick={() => archiveMut.mutate()}
              >
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </Button>
              <Link
                href={`/verify/document/${row.verifyToken}`}
                target="_blank"
                className="text-xs text-primary hover:underline self-center"
              >
                Public verify link
              </Link>
            </>
          ) : null}
        </div>

        {showReject ? (
          <div className="rounded-xl border border-border/60 p-4">
            <label className="block text-xs font-medium">
              Rejection reason
              <textarea
                className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm"
                rows={3}
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </label>
            <Button
              className="mt-2"
              size="sm"
              variant="destructive"
              disabled={!rejectNote.trim() || rejectMut.isPending}
              onClick={() => rejectMut.mutate()}
            >
              Confirm Reject
            </Button>
          </div>
        ) : null}

        {(submitMut.isError || approveMut.isError || rejectMut.isError) && (
          <p className="text-sm text-destructive">
            {apiErrorMessage(
              submitMut.error ?? approveMut.error ?? rejectMut.error,
              'Action failed',
            )}
          </p>
        )}

        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          <div>Created: {new Date(row.createdAt).toLocaleString()}</div>
          <div>
            Prints: {row.printCount} · Downloads: {row.downloadCount}
          </div>
          {row.publishedAt ? (
            <div>Published: {new Date(row.publishedAt).toLocaleString()}</div>
          ) : null}
        </div>
      </div>
    </OfficialDocumentsShell>
  );
}
