'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Input } from '@/components/ui/input';
import { withApiStartupRetry } from '@/lib/http/wait-for-api';
import { fetchLmsWorkspaces, formatLmsWorkspaceMeta } from '@/services/lms';

export function LmsWorkspacesList() {
  const [q, setQ] = useState('');
  const workspaces = useQuery({
    queryKey: ['lms', 'workspaces', { q }],
    queryFn: () => withApiStartupRetry(() => fetchLmsWorkspaces({ q: q || undefined, limit: 50 })),
    retry: false,
  });

  const items = workspaces.data?.data ?? [];
  const total = workspaces.data?.meta?.total;

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search workspaces…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md"
      />
      <CompactCard>
        <CompactCardHeader title="Subject workspaces" />
        <CompactCardBody className="space-y-2">
          {workspaces.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading workspaces…
            </div>
          ) : null}

          {workspaces.isError ? (
            <QueryErrorPanel
              title="Unable to load workspaces"
              error={workspaces.error}
              onRetry={() => void workspaces.refetch()}
              isRetrying={workspaces.isFetching}
            />
          ) : null}

          {!workspaces.isLoading && !workspaces.isError
            ? items.map((ws) => (
                <Link
                  key={ws.id}
                  href={`/admin/academics/lms/workspaces/${ws.id}`}
                  className="block rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{ws.title}</p>
                    {ws.workspaceType === 'POOL' ? (
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Prefer for shared materials
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatLmsWorkspaceMeta(ws)}
                  </p>
                </Link>
              ))
            : null}

          {!workspaces.isLoading && !workspaces.isError && items.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No workspaces match your search. Run provision from the LMS dashboard if this tenant
              is new.
            </p>
          ) : null}

          {!workspaces.isLoading && !workspaces.isError && items.length > 0 && total != null ? (
            <p className="pt-1 text-xs text-muted-foreground">
              Showing {items.length} of {total} workspace{total === 1 ? '' : 's'}
            </p>
          ) : null}
        </CompactCardBody>
      </CompactCard>
    </div>
  );
}
