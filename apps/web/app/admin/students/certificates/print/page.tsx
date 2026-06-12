'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled, useRequireAuth } from '@/hooks/use-auth';
import { fetchCertificateIssue } from '@/services/certificates';
import '@/styles/certificate-print.css';

function CertificatePrintPageContent() {
  useRequireAuth();
  const authReady = useAuthQueryEnabled();
  const searchParams = useSearchParams();
  const printedRef = useRef(false);

  const issueId = searchParams.get('issueId') ?? '';
  const autoprint = searchParams.get('autoprint') === '1';

  useEffect(() => {
    document.body.classList.add('certificate-print-mode');
    return () => document.body.classList.remove('certificate-print-mode');
  }, []);

  const issueQ = useQuery({
    queryKey: ['certificates', 'issue', issueId],
    queryFn: () => fetchCertificateIssue(issueId),
    enabled: authReady && Boolean(issueId),
  });

  const ready = Boolean(
    issueId && issueQ.isSuccess && !issueQ.isFetching && issueQ.data?.renderedHtml,
  );

  useEffect(() => {
    if (!autoprint || !ready || printedRef.current) return;
    printedRef.current = true;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [autoprint, ready]);

  const issue = issueQ.data;

  return (
    <div className="certificate-print-shell">
      <div className="certificate-print-toolbar no-print">
        <div>
          <p className="text-sm font-semibold text-gray-900">Certificate Print Preview</p>
          <p className="text-xs text-gray-600">
            {issue
              ? `${issue.category?.name ?? 'Certificate'} · ${issue.certificateNo}`
              : 'A4 portrait layout optimized for print and Save as PDF'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => window.close()}>
            <X className="mr-2 h-3.5 w-3.5" />
            Close
          </Button>
          <Button size="sm" onClick={() => window.print()} disabled={!ready}>
            <Printer className="mr-2 h-3.5 w-3.5" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      {!issueId ? (
        <p className="certificate-print-loading">
          Missing certificate issue ID. Close this tab and use Print from the certificates
          workspace.
        </p>
      ) : issueQ.isLoading || issueQ.isFetching ? (
        <p className="certificate-print-loading">Preparing certificate for print…</p>
      ) : issueQ.isError ? (
        <p className="certificate-print-loading">
          Unable to load certificate. Check your session and try again.
        </p>
      ) : (
        <div
          className="certificate-print-document"
          dangerouslySetInnerHTML={{ __html: issue?.renderedHtml ?? '' }}
        />
      )}
    </div>
  );
}

export default function CertificatePrintPage() {
  return (
    <Suspense fallback={<p className="certificate-print-loading">Loading print view…</p>}>
      <CertificatePrintPageContent />
    </Suspense>
  );
}
