'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Link2, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { QueryErrorPanel } from '@/components/erp/query-error-panel';
import { apiErrorMessage } from '@/utils/api-error';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import {
  downloadSettlementReconExport,
  downloadSettlementTemplate,
  fetchSettlementBatches,
  fetchSettlementDashboard,
  fetchSettlementLines,
  importSettlementCsv,
  linkSettlementLinePayment,
  markSettlementLineManualReview,
  markSettlementLineReconciled,
  rematchSettlementBatch,
  searchSettlementPayments,
  updateSettlementLineRemarks,
  type FeeSettlementLine,
  type FeeSettlementPaymentHit,
} from '@/services/fee-settlement-reconciliation';

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  MATCHED: 'default',
  RECONCILED: 'default',
  PENDING: 'secondary',
  UNMATCHED: 'destructive',
  AMOUNT_MISMATCH: 'destructive',
  DUPLICATE: 'destructive',
  MANUAL_REVIEW: 'outline',
  SETTLEMENT_PENDING: 'outline',
};

export function FeeSettlementReconciliationPanel() {
  const qc = useQueryClient();
  const [batchId, setBatchId] = useState<string>('');
  const [exceptionsOnly, setExceptionsOnly] = useState(true);
  const [matchStatus, setMatchStatus] = useState('');
  const [provider, setProvider] = useState('RAZORPAY');
  const [message, setMessage] = useState('');
  const [linkPaymentId, setLinkPaymentId] = useState<Record<string, string>>({});
  const [linkSearch, setLinkSearch] = useState<Record<string, string>>({});
  const [remarksDraft, setRemarksDraft] = useState<Record<string, string>>({});

  const dashQ = useQuery({
    queryKey: ['fee-settlement-recon', 'dashboard', batchId || 'all'],
    queryFn: () => fetchSettlementDashboard(batchId || undefined),
  });

  const batchesQ = useQuery({
    queryKey: ['fee-settlement-recon', 'batches'],
    queryFn: () => fetchSettlementBatches(20),
  });

  const linesQ = useQuery({
    queryKey: ['fee-settlement-recon', 'lines', batchId, exceptionsOnly, matchStatus],
    queryFn: () =>
      fetchSettlementLines({
        batchId: batchId || undefined,
        exceptionsOnly: matchStatus ? false : exceptionsOnly,
        matchStatus: matchStatus || undefined,
        limit: 200,
      }),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['fee-settlement-recon'] });
  };

  const importMut = useMutation({
    mutationFn: (file: File) => importSettlementCsv(file, { provider, autoMatch: true }),
    onSuccess: (batch) => {
      setBatchId(batch.id);
      setMessage(
        `Imported ${batch.rowCount} rows · matched ${batch.matchedCount} · exceptions ${batch.exceptionCount}`,
      );
      invalidate();
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const rematchMut = useMutation({
    mutationFn: (id: string) => rematchSettlementBatch(id),
    onSuccess: () => {
      setMessage('Auto-match completed (includes unsettled ERP scan)');
      invalidate();
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const reconcileMut = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks?: string }) =>
      markSettlementLineReconciled(id, remarks),
    onSuccess: () => invalidate(),
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const reviewMut = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks?: string }) =>
      markSettlementLineManualReview(id, remarks),
    onSuccess: () => invalidate(),
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const linkMut = useMutation({
    mutationFn: ({ id, paymentId, remarks }: { id: string; paymentId: string; remarks?: string }) =>
      linkSettlementLinePayment(id, paymentId, remarks),
    onSuccess: () => {
      setMessage('Payment linked');
      invalidate();
    },
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const remarksMut = useMutation({
    mutationFn: ({ id, remarks }: { id: string; remarks: string }) =>
      updateSettlementLineRemarks(id, remarks),
    onSuccess: () => invalidate(),
    onError: (err) => setMessage(apiErrorMessage(err)),
  });

  const kpis = dashQ.data?.kpis;
  const lines = linesQ.data ?? [];
  const batches = batchesQ.data ?? [];

  const busy =
    importMut.isPending ||
    rematchMut.isPending ||
    reconcileMut.isPending ||
    reviewMut.isPending ||
    linkMut.isPending;

  const statusOptions = useMemo(
    () => [
      '',
      'PENDING',
      'MATCHED',
      'RECONCILED',
      'AMOUNT_MISMATCH',
      'DUPLICATE',
      'UNMATCHED',
      'MANUAL_REVIEW',
      'SETTLEMENT_PENDING',
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Fee settlement reconciliation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Import gateway settlement CSV/Excel, auto-match ERP payments, flag unsettled ERP rows, and
          clear exceptions. Provider preset improves fee/GST/net column mapping.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="provider">Provider preset</Label>
            <select
              id="provider"
              className="mt-1 flex h-10 w-40 rounded-md border border-input bg-background px-3 text-sm"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
            >
              <option value="RAZORPAY">Razorpay</option>
              <option value="BILLDESK">BillDesk</option>
              <option value="ATOM">Atom</option>
              <option value="CASHFREE">Cashfree</option>
              <option value="GENERIC">Generic</option>
            </select>
          </div>
          <div>
            <Label htmlFor="settlement-file">Settlement file</Label>
            <Input
              id="settlement-file"
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="mt-1 max-w-xs"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importMut.mutate(file);
                e.target.value = '';
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void downloadSettlementTemplate()}
          >
            <Download className="mr-1 h-4 w-4" />
            Template
          </Button>
          {batchId ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => rematchMut.mutate(batchId)}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Re-run match
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              void downloadSettlementReconExport({
                batchId: batchId || undefined,
                report: 'daily',
              })
            }
          >
            Export daily
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              void downloadSettlementReconExport({
                batchId: batchId || undefined,
                report: 'exceptions',
              })
            }
          >
            Export exceptions
          </Button>
        </div>

        {importMut.isPending ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Importing & matching…
          </p>
        ) : null}
        {message ? <p className="mt-3 text-sm text-foreground">{message}</p> : null}
      </div>

      {dashQ.isError ? (
        <QueryErrorPanel
          title="Unable to load reconciliation dashboard"
          error={dashQ.error}
          onRetry={() => void dashQ.refetch()}
          isRetrying={dashQ.isFetching}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <Kpi label="Settlement lines" value={String(kpis?.totalLines ?? 0)} />
          <Kpi label="Matched" value={String(kpis?.matched ?? 0)} />
          <Kpi label="Exceptions" value={String(kpis?.exceptions ?? 0)} />
          <Kpi label="Settlement pending" value={String(kpis?.settlementPending ?? 0)} />
          <Kpi label="Unmatched" value={String(kpis?.unmatched ?? 0)} />
          <Kpi label="Gross" value={formatInr(kpis?.totalGross ?? 0)} />
          <Kpi label="Gateway fees" value={formatInr(kpis?.totalFees ?? 0)} />
          <Kpi label="Tax / GST" value={formatInr(kpis?.totalTax ?? 0)} />
          <Kpi label="Net settled" value={formatInr(kpis?.totalNet ?? 0)} />
          <Kpi label="Amount mismatch" value={String(kpis?.amountMismatch ?? 0)} />
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="batch">Batch</Label>
            <select
              id="batch"
              className="mt-1 flex h-10 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
            >
              <option value="">All batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {(b.fileName || b.provider) +
                    ` · ${b.rowCount} rows · ${new Date(b.createdAt).toLocaleString()}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              className="mt-1 flex h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={matchStatus}
              onChange={(e) => {
                setMatchStatus(e.target.value);
                if (e.target.value) setExceptionsOnly(false);
              }}
            >
              {statusOptions.map((s) => (
                <option key={s || 'all'} value={s}>
                  {s || 'All statuses'}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input
              type="checkbox"
              checked={exceptionsOnly && !matchStatus}
              onChange={(e) => {
                setExceptionsOnly(e.target.checked);
                if (e.target.checked) setMatchStatus('');
              }}
            />
            Exceptions only
          </label>
        </div>

        {linesQ.isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading lines…</p>
        ) : linesQ.isError ? (
          <div className="mt-4">
            <QueryErrorPanel
              title="Unable to load settlement lines"
              error={linesQ.error}
              onRetry={() => void linesQ.refetch()}
              isRetrying={linesQ.isFetching}
            />
          </div>
        ) : lines.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No lines yet. Import a settlement CSV/Excel to begin.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b text-xs text-muted-foreground">
                <tr>
                  <th className="px-2 py-2">#</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Gateway / UTR</th>
                  <th className="px-2 py-2">Gross / Fee / Tax / Net</th>
                  <th className="px-2 py-2">ERP payment</th>
                  <th className="px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <SettlementLineRow
                    key={line.id}
                    line={line}
                    busy={busy}
                    linkValue={linkPaymentId[line.id] ?? ''}
                    searchValue={linkSearch[line.id] ?? ''}
                    remarksValue={remarksDraft[line.id] ?? line.remarks ?? ''}
                    onLinkValue={(v) => setLinkPaymentId((prev) => ({ ...prev, [line.id]: v }))}
                    onSearchValue={(v) => setLinkSearch((prev) => ({ ...prev, [line.id]: v }))}
                    onRemarksValue={(v) => setRemarksDraft((prev) => ({ ...prev, [line.id]: v }))}
                    onReconcile={() =>
                      reconcileMut.mutate({
                        id: line.id,
                        remarks: remarksDraft[line.id] ?? line.remarks,
                      })
                    }
                    onReview={() =>
                      reviewMut.mutate({
                        id: line.id,
                        remarks: remarksDraft[line.id] ?? line.remarks,
                      })
                    }
                    onLink={() => {
                      const paymentId = linkPaymentId[line.id]?.trim();
                      if (!paymentId) {
                        setMessage('Select or enter an ERP payment to link');
                        return;
                      }
                      linkMut.mutate({
                        id: line.id,
                        paymentId,
                        remarks: remarksDraft[line.id] ?? line.remarks,
                      });
                    }}
                    onSaveRemarks={() =>
                      remarksMut.mutate({
                        id: line.id,
                        remarks: remarksDraft[line.id] ?? '',
                      })
                    }
                    onPickPayment={(hit) => {
                      setLinkPaymentId((prev) => ({
                        ...prev,
                        [line.id]: hit.id,
                      }));
                      setLinkSearch((prev) => ({
                        ...prev,
                        [line.id]: `${hit.transactionNo} · ${hit.studentName ?? ''}`,
                      }));
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function SettlementLineRow({
  line,
  busy,
  linkValue,
  searchValue,
  remarksValue,
  onLinkValue,
  onSearchValue,
  onRemarksValue,
  onReconcile,
  onReview,
  onLink,
  onSaveRemarks,
  onPickPayment,
}: {
  line: FeeSettlementLine;
  busy: boolean;
  linkValue: string;
  searchValue: string;
  remarksValue: string;
  onLinkValue: (v: string) => void;
  onSearchValue: (v: string) => void;
  onRemarksValue: (v: string) => void;
  onReconcile: () => void;
  onReview: () => void;
  onLink: () => void;
  onSaveRemarks: () => void;
  onPickPayment: (hit: FeeSettlementPaymentHit) => void;
}) {
  const debouncedSearch = useDebouncedValue(searchValue, 300);
  const searchQ = useQuery({
    queryKey: ['fee-settlement-payment-search', line.id, debouncedSearch],
    queryFn: () => searchSettlementPayments(debouncedSearch, 8),
    enabled: !line.paymentId && debouncedSearch.trim().length >= 2,
  });

  return (
    <tr className="border-b align-top">
      <td className="px-2 py-3 text-muted-foreground">{line.lineNo}</td>
      <td className="px-2 py-3">
        <Badge variant={STATUS_VARIANT[line.matchStatus] ?? 'secondary'}>{line.matchStatus}</Badge>
        {line.matchMethod ? (
          <p className="mt-1 text-xs text-muted-foreground">via {line.matchMethod}</p>
        ) : null}
      </td>
      <td className="px-2 py-3">
        <p className="font-mono text-xs">
          {line.gatewayPaymentId || line.gatewayOrderId || line.gatewayTransactionId || '—'}
        </p>
        {line.utr ? <p className="text-xs text-muted-foreground">UTR {line.utr}</p> : null}
        {line.receiptNo ? (
          <p className="text-xs text-muted-foreground">Rcpt {line.receiptNo}</p>
        ) : null}
      </td>
      <td className="px-2 py-3">
        <p>{formatInr(line.grossAmount)}</p>
        <p className="text-xs text-muted-foreground">
          Fee {formatInr(line.feeCharges)} · Tax {formatInr(line.taxAmount)}
        </p>
        <p className="text-xs font-medium">Net {formatInr(line.netAmount)}</p>
        {line.amountDifference != null && Math.abs(line.amountDifference) > 0.01 ? (
          <p className="text-xs text-amber-700">Diff {formatInr(line.amountDifference)}</p>
        ) : null}
      </td>
      <td className="px-2 py-3">
        {line.payment ? (
          <>
            <p className="font-medium">{line.payment.transactionNo}</p>
            <p className="text-xs text-muted-foreground">
              {line.payment.studentName || 'Student'} · {formatInr(line.payment.amount)}
            </p>
            {line.payment.admissionNo ? (
              <p className="text-xs text-muted-foreground">{line.payment.admissionNo}</p>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Not linked</p>
        )}
      </td>
      <td className="px-2 py-3">
        <div className="flex max-w-md flex-col gap-2">
          <Input
            placeholder="Remarks"
            value={remarksValue}
            onChange={(e) => onRemarksValue(e.target.value)}
            className="h-8"
          />
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={onSaveRemarks}
            >
              Save note
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={busy || !line.paymentId || line.matchStatus === 'RECONCILED'}
              onClick={onReconcile}
            >
              Mark reconciled
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onReview}>
              Manual review
            </Button>
          </div>
          {!line.paymentId ? (
            <div className="relative space-y-1">
              <div className="flex gap-1">
                <Input
                  placeholder="Search txn / UTR / admission / name"
                  value={searchValue}
                  onChange={(e) => {
                    onSearchValue(e.target.value);
                    onLinkValue('');
                  }}
                  className="h-8"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy || !linkValue}
                  onClick={onLink}
                >
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {searchQ.data && searchQ.data.length > 0 ? (
                <ul className="absolute z-10 max-h-48 w-full overflow-auto rounded-md border bg-popover text-xs shadow">
                  {searchQ.data.map((hit) => (
                    <li key={hit.id}>
                      <button
                        type="button"
                        className="w-full px-2 py-1.5 text-left hover:bg-muted"
                        onClick={() => onPickPayment(hit)}
                      >
                        <span className="font-medium">{hit.transactionNo}</span>
                        {' · '}
                        {formatInr(hit.amount)}
                        {hit.studentName ? ` · ${hit.studentName}` : ''}
                        {hit.admissionNo ? ` (${hit.admissionNo})` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {linkValue ? (
                <p className="text-[11px] text-muted-foreground">
                  Selected payment id: {linkValue.slice(0, 8)}…
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
