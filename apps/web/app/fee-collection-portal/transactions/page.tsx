'use client';

import { useQuery } from '@tanstack/react-query';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import { fetchCenterTransactions } from '@/services/fee-collection-centers';
import { openCenterReceiptPdf } from '@/services/fee-collection-centers';
import { apiErrorMessage } from '@/utils/api-error';
import { useState } from 'react';

function inr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function FeeCollectionTransactionsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const txQ = useQuery({
    queryKey: ['fcc', 'transactions'],
    queryFn: () => fetchCenterTransactions(),
  });

  if (txQ.isLoading) return <p className="text-sm text-slate-400">Loading history…</p>;
  if (txQ.isError) {
    return <QueryErrorPanel title="Unable to load transactions" error={txQ.error} />;
  }

  const rows = txQ.data ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold text-white">Collection history</h2>
        <p className="text-sm text-slate-400">Your center’s gateway payments only.</p>
      </div>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-slate-400">
            <tr>
              <th className="px-3 py-2">Txn</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Paid at</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-slate-500">
                  No transactions yet.
                </td>
              </tr>
            ) : (
              rows.map((t) => {
                const receipt = t.receipts?.[0];
                return (
                  <tr key={t.id} className="border-t border-white/5 text-slate-200">
                    <td className="px-3 py-2 font-mono text-xs">{t.transactionNo}</td>
                    <td>{inr(t.amount)}</td>
                    <td>{t.status}</td>
                    <td>{t.paidAt ? new Date(t.paidAt).toLocaleString() : '—'}</td>
                    <td>
                      {receipt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={downloading === receipt.id}
                          onClick={async () => {
                            setDownloading(receipt.id);
                            setError(null);
                            try {
                              await openCenterReceiptPdf(receipt.id);
                            } catch (err) {
                              setError(apiErrorMessage(err));
                            } finally {
                              setDownloading(null);
                            }
                          }}
                        >
                          {receipt.receiptNo}
                        </Button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
