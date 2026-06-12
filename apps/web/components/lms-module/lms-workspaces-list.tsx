'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { CompactCard, CompactCardBody, CompactCardHeader } from '@/components/erp/compact-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { withApiStartupRetry } from '@/lib/http/wait-for-api';
import { fetchLmsWorkspaces } from '@/services/lms';
import { isApiUnavailableError } from '@/utils/api-error';

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
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <div className="space-y-2">
                  <p className="font-medium text-destructive">
                    {isApiUnavailableError(workspaces.error)
                      ? 'Cannot reach the API. It may still be starting after a code change.'
                      : 'Failed to load workspaces.'}
                  </p>
                  <p className="text-muted-foreground">
                    Confirm the terminal shows{' '}
                    <code className="rounded bg-muted px-1">
                      Nest application successfully started
                    </code>
                    , then retry.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void workspaces.refetch()}
                  >
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {!workspaces.isLoading && !workspaces.isError
            ? items.map((ws) => (
                <Link
                  key={ws.id}
                  href={`/admin/academics/lms/workspaces/${ws.id}`}
                  className="block rounded-lg border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <p className="font-medium">{ws.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {ws.workspaceType} · Sem {ws.semesterNo} · {ws._count?.materials ?? 0} materials
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
