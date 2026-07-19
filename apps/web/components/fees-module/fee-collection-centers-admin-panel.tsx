'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  blockFeeCollectionCenter,
  fetchAdminCenterTransactions,
  fetchCenterReports,
  listFeeCollectionCenters,
  reactivateFeeCollectionCenter,
  resetFeeCollectionCenterPassword,
  reviewFeeCollectionCenter,
  suspendFeeCollectionCenter,
  type FeeCollectionCenterRow,
} from '@/services/fee-collection-centers';
import { apiErrorMessage } from '@/utils/api-error';

function inr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'APPROVED'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'PENDING_APPROVAL'
        ? 'bg-amber-100 text-amber-900'
        : status === 'REJECTED' || status === 'BLOCKED'
          ? 'bg-rose-100 text-rose-800'
          : 'bg-slate-100 text-slate-700';
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone}`}>{status}</span>;
}

export function FeeCollectionCentersAdminPanel() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING_APPROVAL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [reason, setReason] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'center'>('daily');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const centersQ = useQuery({
    queryKey: ['fcc', 'admin', 'centers', status, search],
    queryFn: () =>
      listFeeCollectionCenters({
        status: status || undefined,
        search: search || undefined,
      }),
  });

  const txQ = useQuery({
    queryKey: ['fcc', 'admin', 'tx', selectedId],
    queryFn: () =>
      fetchAdminCenterTransactions({
        centerId: selectedId || undefined,
      }),
  });

  const reportQ = useQuery({
    queryKey: ['fcc', 'admin', 'report', reportType],
    queryFn: () => fetchCenterReports(reportType),
  });

  const actionMut = useMutation({
    mutationFn: async (input: {
      kind: 'approve' | 'reject' | 'suspend' | 'block' | 'reactivate' | 'password';
      id: string;
    }) => {
      if (input.kind === 'approve') {
        return reviewFeeCollectionCenter(input.id, 'APPROVE');
      }
      if (input.kind === 'reject') {
        return reviewFeeCollectionCenter(input.id, 'REJECT', reason || undefined);
      }
      if (input.kind === 'suspend') {
        return suspendFeeCollectionCenter(input.id, reason || undefined);
      }
      if (input.kind === 'block') {
        return blockFeeCollectionCenter(input.id, reason || undefined);
      }
      if (input.kind === 'reactivate') {
        return reactivateFeeCollectionCenter(input.id);
      }
      return resetFeeCollectionCenterPassword(input.id, newPassword);
    },
    onSuccess: async () => {
      setMsg('Updated.');
      setError(null);
      setReason('');
      setNewPassword('');
      await qc.invalidateQueries({ queryKey: ['fcc', 'admin'] });
    },
    onError: (err) => {
      setError(apiErrorMessage(err));
      setMsg(null);
    },
  });

  const centers = centersQ.data ?? [];
  const selected = useMemo(
    () => centers.find((c) => c.id === selectedId) ?? null,
    [centers, selectedId],
  );

  function exportCsv(rows: Array<Record<string, unknown>>, filename: string) {
    if (!rows.length) return;
    const keys = Object.keys(rows[0]!);
    const lines = [
      keys.join(','),
      ...rows.map((r) =>
        keys
          .map((k) => {
            const v = r[k];
            const s = v == null ? '' : String(v);
            return `"${s.replace(/"/g, '""')}"`;
          })
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Status filter</Label>
          <select
            className="mt-1 block rounded-md border px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="PENDING_APPROVAL">Pending approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        </div>
        <div className="min-w-[220px] flex-1">
          <Label>Search</Label>
          <Input
            className="mt-1"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Business / owner / email"
          />
        </div>
      </div>

      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {centersQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading centers…</p>
      ) : centersQ.isError ? (
        <QueryErrorPanel title="Unable to load centers" error={centersQ.error} />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Business</th>
                <th>Owner</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Verified</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {centers.map((c: FeeCollectionCenterRow) => (
                <tr key={c.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{c.businessName}</td>
                  <td>{c.ownerName}</td>
                  <td>
                    <div>{c.email}</div>
                    <div className="text-xs text-muted-foreground">{c.mobileNumber}</div>
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="text-xs">
                    Email {c.emailVerifiedAt ? '✓' : '—'} · OTP {c.mobileVerifiedAt ? '✓' : '—'}
                  </td>
                  <td>
                    <Button size="sm" variant="outline" onClick={() => setSelectedId(c.id)}>
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <section className="space-y-3 rounded-lg border p-4">
          <h3 className="font-medium">{selected.businessName}</h3>
          <p className="text-sm text-muted-foreground">
            {selected.district}, {selected.state} · Status <StatusBadge status={selected.status} />
          </p>
          {selected.rejectedReason ? (
            <p className="text-sm text-rose-700">Reason: {selected.rejectedReason}</p>
          ) : null}
          <div>
            <Label>Remarks / reason</Label>
            <Input className="mt-1" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={actionMut.isPending}
              onClick={() => actionMut.mutate({ kind: 'approve', id: selected.id })}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={actionMut.isPending}
              onClick={() => actionMut.mutate({ kind: 'reject', id: selected.id })}
            >
              Reject
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={actionMut.isPending}
              onClick={() => actionMut.mutate({ kind: 'suspend', id: selected.id })}
            >
              Suspend
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={actionMut.isPending}
              onClick={() => actionMut.mutate({ kind: 'block', id: selected.id })}
            >
              Block
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={actionMut.isPending}
              onClick={() => actionMut.mutate({ kind: 'reactivate', id: selected.id })}
            >
              Reactivate
            </Button>
          </div>
          <div className="flex flex-wrap items-end gap-2 border-t pt-3">
            <div>
              <Label>Reset operator password</Label>
              <Input
                className="mt-1"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (min 8)"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={actionMut.isPending || newPassword.length < 8}
              onClick={() => actionMut.mutate({ kind: 'password', id: selected.id })}
            >
              Reset password
            </Button>
          </div>
        </section>
      ) : null}

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium">Center transactions</h3>
          <p className="text-xs text-muted-foreground">
            {selectedId ? `Filtered to selected center` : 'All center-portal payments'}
          </p>
        </div>
        {txQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1">Txn</th>
                  <th>Center</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {(txQ.data ?? []).slice(0, 50).map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="py-1 font-mono text-xs">{t.transactionNo}</td>
                    <td>{t.collectionCenterName ?? '—'}</td>
                    <td>{inr(t.amount)}</td>
                    <td>{t.status}</td>
                    <td>{t.receipts?.[0]?.receiptNo ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Report</Label>
            <select
              className="mt-1 block rounded-md border px-3 py-2 text-sm"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as typeof reportType)}
            >
              <option value="daily">Daily</option>
              <option value="monthly">Monthly</option>
              <option value="center">Center-wise</option>
            </select>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              exportCsv(
                (reportQ.data?.rows ?? []) as Array<Record<string, unknown>>,
                `fee-center-${reportType}.csv`,
              )
            }
          >
            Export CSV
          </Button>
        </div>
        {reportQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading report…</p>
        ) : (
          <pre className="max-h-64 overflow-auto rounded bg-muted/40 p-3 text-xs">
            {JSON.stringify(reportQ.data?.rows ?? [], null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
