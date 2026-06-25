'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Archive, Clock3, FileCheck2, FileText, Loader2, Plus, Printer } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { fetchOfficialDocumentsDashboard } from '@/services/official-documents';
import { cn } from '@/utils/cn';

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/85 p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-semibold', tone)}>{value}</p>
    </div>
  );
}

export function OfficialDocumentsDashboardPage() {
  const dash = useQuery({
    queryKey: ['official-documents', 'dashboard'],
    queryFn: fetchOfficialDocumentsDashboard,
  });

  if (dash.isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading dashboard…
      </p>
    );
  }

  const data = dash.data;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Official Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Institutional notices, circulars, and office orders with DBC letterhead and approval
            workflow. Committee notices remain under Governance.
          </p>
        </div>
        <Link
          href="/admin/administration/official-documents/create"
          className={cn(buttonVariants({ size: 'sm' }), 'gap-2 rounded-xl')}
        >
          <Plus className="h-4 w-4" />
          Create Document
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total" value={data.stats.total} />
        <StatCard label="Today" value={data.stats.today} />
        <StatCard label="This Month" value={data.stats.thisMonth} />
        <StatCard
          label="Pending Approval"
          value={data.stats.pendingApproval}
          tone="text-amber-600"
        />
        <StatCard label="Published" value={data.stats.published} tone="text-emerald-600" />
        <StatCard label="Drafts" value={data.stats.drafts} />
        <StatCard label="Archived" value={data.stats.archived} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border/60 bg-card/85 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Clock3 className="h-4 w-4" />
            Pending Principal Approval
          </h2>
          {data.stats.pendingApproval === 0 ? (
            <p className="mt-3 text-xs text-muted-foreground">No documents awaiting approval.</p>
          ) : (
            <div className="mt-3 space-y-2">
              <Link
                href="/admin/administration/official-documents?status=PENDING_APPROVAL"
                className="text-sm text-primary hover:underline"
              >
                View {data.stats.pendingApproval} pending document(s)
              </Link>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/85 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <FileCheck2 className="h-4 w-4" />
            Frequently Used Templates
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.frequentTemplates.map((tpl) => (
              <li key={tpl.id} className="flex justify-between gap-2">
                <span>{tpl.name}</span>
                <span className="text-xs text-muted-foreground">{tpl.documentType}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/administration/official-documents/templates"
            className="mt-3 inline-block text-xs text-primary hover:underline"
          >
            Manage templates
          </Link>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/85 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Printer className="h-4 w-4" />
            Recently Printed
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.recentlyPrinted.length ? (
              data.recentlyPrinted.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/admin/administration/official-documents/${row.id}`}
                    className="hover:text-primary"
                  >
                    {row.referenceNo ?? row.title}
                  </Link>
                  <span className="ml-2 text-xs text-muted-foreground">×{row.printCount}</span>
                </li>
              ))
            ) : (
              <li className="text-xs text-muted-foreground">No prints yet.</li>
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-border/60 bg-card/85 p-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Archive className="h-4 w-4" />
            Latest Activity
          </h2>
          <ul className="mt-3 max-h-48 space-y-2 overflow-auto text-xs">
            {data.recentActivity.map((row) => (
              <li
                key={row.id}
                className="flex justify-between gap-2 border-b border-border/40 pb-2"
              >
                <span>
                  <strong>{row.action}</strong>
                  {row.document?.title ? ` — ${row.document.title}` : ''}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {new Date(row.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/administration/official-documents/notices"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <FileText className="mr-2 h-4 w-4" />
          Notices
        </Link>
        <Link
          href="/admin/administration/official-documents/archive"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Archive
        </Link>
        <Link
          href="/admin/administration/official-documents/search"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Search
        </Link>
        <Link
          href="/admin/administration/official-documents/signatures"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Digital Signatures
        </Link>
        <Link
          href="/admin/administration/official-documents/settings"
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          Settings
        </Link>
      </div>
    </div>
  );
}
