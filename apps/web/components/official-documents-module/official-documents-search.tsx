'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Loader2, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { DOCUMENT_TYPE_OPTIONS, fetchOfficialDocuments } from '@/services/official-documents';
import { cn } from '@/utils/cn';

export function OfficialDocumentsSearchPage() {
  const [q, setQ] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [status, setStatus] = useState('');
  const [submitted, setSubmitted] = useState('');

  const search = useQuery({
    queryKey: ['official-documents', 'search', submitted],
    queryFn: () =>
      fetchOfficialDocuments({
        q: submitted || undefined,
        documentType: documentType || undefined,
        status: status || undefined,
        limit: 100,
      }),
    enabled: Boolean(submitted),
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Search Documents</h1>
      <form
        className="grid gap-3 rounded-2xl border border-border/60 bg-card/85 p-4 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q.trim() || documentType || status || '*');
        }}
      >
        <input
          className="rounded-xl border border-border px-3 py-2 text-sm md:col-span-2"
          placeholder="Reference, title, keywords…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded-xl border border-border px-3 py-2 text-sm"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
        >
          <option value="">All types</option>
          {DOCUMENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-border px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <Button type="submit" size="sm" className="md:col-span-4 w-fit gap-2">
          <Search className="h-4 w-4" />
          Search
        </Button>
      </form>

      {search.isFetching ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Searching…
        </p>
      ) : null}

      {search.data ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">{search.data.total} result(s)</p>
          {search.data.items.map((row) => (
            <Link
              key={row.id}
              href={`/admin/administration/official-documents/${row.id}`}
              className="block rounded-xl border border-border/60 px-4 py-3 hover:bg-muted/30"
            >
              <div className="flex justify-between gap-2">
                <span className="font-medium">{row.title}</span>
                <span
                  className={cn('text-xs', row.referenceNo ? 'font-mono' : 'text-muted-foreground')}
                >
                  {row.referenceNo ?? 'DRAFT'}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.documentType} · {row.status} · {new Date(row.updatedAt).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
