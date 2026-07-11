'use client';

import { formatBytes, KpiCard, SimpleBarChart } from './qb-shared';
import type { QuestionBankDashboard } from '@/types/question-bank';
import { apiErrorMessage } from '@/utils/api-error';

type Props = {
  data?: QuestionBankDashboard;
  isError?: boolean;
  error?: unknown;
};

export function QuestionBankDashboardPanel({ data, isError, error }: Props) {
  const kpis = data?.kpis;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Question Paper Repository</h2>
        <p className="text-sm text-muted-foreground">
          Overview of uploads, approvals, storage, and downloads.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Papers" value={kpis?.totalPapers ?? '—'} />
        <KpiCard label="Published" value={kpis?.publishedPapers ?? '—'} />
        <KpiCard label="Approved" value={kpis?.approvedPapers ?? '—'} />
        <KpiCard label="Pending" value={kpis?.pendingPapers ?? kpis?.pendingApprovals ?? '—'} />
        <KpiCard label="Uploaded Today" value={kpis?.uploadedToday ?? '—'} />
        <KpiCard label="Downloads This Month" value={kpis?.downloadsThisMonth ?? '—'} />
        <KpiCard label="Departments" value={kpis?.departments ?? '—'} />
        <KpiCard
          label="Storage Used"
          value={formatBytes(kpis?.storageUsedBytes)}
          hint={
            kpis?.topPaper
              ? `Top: ${kpis.topPaper.paperCode} (${kpis.topPaper.downloads})`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SimpleBarChart title="Papers by department" items={data?.papersByDepartment ?? []} />
        <SimpleBarChart title="Papers by exam year" items={data?.papersByYear ?? []} />
        <SimpleBarChart title="Status mix" items={data?.statusMix ?? []} />
      </div>

      {data?.mostDownloaded?.length ? (
        <div className="rounded-xl border p-4">
          <h4 className="mb-3 text-sm font-semibold">Most downloaded</h4>
          <ul className="divide-y text-sm">
            {data.mostDownloaded.map((row) => (
              <li key={row.id} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="font-medium">{row.paperCode}</span> — {row.paperName}
                </span>
                <span className="text-muted-foreground">{row.downloads}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {isError ? <p className="text-sm text-destructive">{apiErrorMessage(error)}</p> : null}
    </div>
  );
}
