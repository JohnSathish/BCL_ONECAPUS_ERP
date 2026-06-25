'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { verifyOfficialDocumentPublic } from '@/services/official-documents';

export default function VerifyDocumentPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [result, setResult] = useState<Awaited<
    ReturnType<typeof verifyOfficialDocumentPublic>
  > | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    verifyOfficialDocumentPublic(token)
      .then(setResult)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg items-center justify-center p-6">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verifying document…
        </p>
      </main>
    );
  }

  if (!result?.valid) {
    return (
      <main className="mx-auto max-w-lg space-y-4 p-6">
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" />
          <h1 className="text-lg font-semibold">Verification Failed</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          {result?.message ?? 'This document could not be verified.'}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg space-y-4 p-6">
      <div className="flex items-center gap-2 text-emerald-600">
        <CheckCircle2 className="h-5 w-5" />
        <h1 className="text-lg font-semibold">Authentic Official Document</h1>
      </div>
      <dl className="space-y-2 rounded-2xl border border-border/60 bg-card p-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Reference No.</dt>
          <dd className="font-mono font-semibold">{result.referenceNo}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Title</dt>
          <dd>{result.title}</dd>
        </div>
        {result.subject ? (
          <div>
            <dt className="text-xs text-muted-foreground">Subject</dt>
            <dd>{result.subject}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs text-muted-foreground">Issued by</dt>
          <dd>
            {result.issuerName}
            {result.designation ? ` — ${result.designation}` : ''}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Published</dt>
          <dd>{result.publishedAt ? new Date(result.publishedAt).toLocaleString() : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Status</dt>
          <dd>{result.status}</dd>
        </div>
      </dl>
      {result.hasPdf && result.verifyUrl ? (
        <a
          href={`/api/v1/verify/official-document/${token}/pdf`}
          className="inline-block text-sm text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          View PDF
        </a>
      ) : null}
    </main>
  );
}
