'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { fetchOfficialDocuments } from '@/services/official-documents';
import { cn } from '@/utils/cn';

function statusTone(status: string) {
  if (status === 'PUBLISHED') return 'bg-emerald-500/10 text-emerald-700';
  if (status === 'PENDING_APPROVAL') return 'bg-amber-500/10 text-amber-800';
  if (status === 'ARCHIVED') return 'bg-muted text-muted-foreground';
  return 'bg-blue-500/10 text-blue-700';
}

type Props = {
  documentType?: string;
  status?: string;
  title: string;
  description?: string;
};

export function OfficialDocumentsListPage({ documentType, status, title, description }: Props) {
  const list = useQuery({
    queryKey: ['official-documents', 'list', documentType, status],
    queryFn: () => fetchOfficialDocuments({ documentType, status, limit: 50 }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{title}</h1>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Link
          href="/admin/administration/official-documents/create"
          className={cn(buttonVariants({ size: 'sm' }), 'gap-2 rounded-xl')}
        >
          <Plus className="h-4 w-4" />
          New Document
        </Link>
      </div>

      {list.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {(list.data?.items ?? []).map((row) => (
                <tr key={row.id} className="border-t border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-3 font-mono text-xs">
                    <Link
                      href={`/admin/administration/official-documents/${row.id}`}
                      className="text-primary hover:underline"
                    >
                      {row.referenceNo ?? '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.title}</td>
                  <td className="px-4 py-3 text-xs">{row.documentType}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        statusTone(row.status),
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(row.updatedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!list.data?.items?.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No documents found.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
