'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchFeeReconciliationReport } from '@/services/fee-cycle';

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

const SOURCE_LABELS: Record<string, string> = {
  ERP_GATEWAY: 'ERP Gateway',
  SBI_ICOLLECT: 'SBI iCollect',
  BANK_TRANSFER: 'Bank Transfer',
  COLLEGE_QR: 'College QR',
  OFFICE_QR: 'Office QR',
  SCHOLARSHIP: 'Scholarship',
  ADJUSTMENT: 'Adjustment',
  EXTERNAL: 'External (legacy)',
};

export function FeeReconciliationPanel() {
  const reportQ = useQuery({
    queryKey: ['fees', 'reconciliation'],
    queryFn: () => fetchFeeReconciliationReport(),
  });

  const data = reportQ.data;
  if (reportQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading reconciliation…</p>;
  }
  if (!data) return null;

  const totals = data.totals ?? {};

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-semibold">Payment reconciliation</h2>
      <p className="text-sm text-muted-foreground">
        Collections by source — ERP gateway, SBI iCollect, bank transfer, QR, and pending external
        verification.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(totals)
          .filter(([, amount]) => Number(amount) > 0)
          .map(([key, amount]) => (
            <div key={key} className="rounded-lg border px-3 py-2">
              <p className="text-xs text-muted-foreground">{SOURCE_LABELS[key] ?? key}</p>
              <p className="text-lg font-bold">{formatInr(Number(amount))}</p>
            </div>
          ))}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-800">Pending verification</p>
          <p className="text-lg font-bold text-amber-900">
            {data.pendingVerification?.count ?? 0} ·{' '}
            {formatInr(data.pendingVerification?.amount ?? 0)}
          </p>
        </div>
      </div>

      <p className="mt-4 text-sm">
        Grand total collected: <strong>{formatInr(data.grandTotal ?? 0)}</strong>
      </p>
    </div>
  );
}
