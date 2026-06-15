'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarClock, Download, Printer, Banknote } from 'lucide-react';
import { fetchDayClosingReport, downloadDayClosingExport } from '@/services/fee-cycle';
import { BulkReceiptPrintPanel } from '@/components/fees-module/bulk-receipt-print-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function FeeDayClosingPanel() {
  const [date, setDate] = useState(todayIso());

  const reportQ = useQuery({
    queryKey: ['fee-day-closing', date],
    queryFn: () => fetchDayClosingReport(date),
  });

  const report = reportQ.data;

  const exportCsv = () => {
    if (!report?.transactions.length) return;
    const header = ['Receipt', 'Transaction', 'Student', 'Enrollment', 'Mode', 'Amount', 'Time'];
    const lines = report.transactions.map((t) => [
      t.receiptNo ?? '',
      t.transactionNo,
      t.studentName ?? '',
      t.enrollmentNumber ?? '',
      t.paymentMode,
      String(t.amount),
      String(t.paidAt ?? ''),
    ]);
    const csv = [header, ...lines]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `day-closing-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadExport = async (format: 'xlsx' | 'pdf') => {
    const blob = (await downloadDayClosingExport(date, format)) as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `day-closing-${date}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card border-0">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5" />
              Day Closing Report
            </CardTitle>
            <CardDescription>
              Cashier-wise collection summary, payment mode split, and transaction register for
              finance reconciliation.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>Closing date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={!report?.transactions.length}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => void downloadExport('xlsx')}
              disabled={!report?.transactions.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => void downloadExport('pdf')}
              disabled={!report?.transactions.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.assign('/admin/fees/cash-register')}
            >
              <Banknote className="mr-2 h-4 w-4" />
              Cash register
            </Button>
          </div>
        </CardHeader>
      </Card>

      {reportQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading day closing report…</p>
      ) : report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total collected" value={formatInr(report.summary.totalCollected)} />
            <Metric label="Transactions" value={String(report.summary.transactionCount)} />
            <Metric label="Receipts issued" value={String(report.summary.receiptCount)} />
            <Metric
              label="Outstanding (EOD)"
              value={formatInr(report.summary.outstandingEndOfDay)}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By payment mode</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.byPaymentMode.map((row) => (
                  <div key={row.mode} className="flex justify-between text-sm">
                    <span>{row.mode.replace(/_/g, ' ')}</span>
                    <span>
                      {row.count} · <strong>{formatInr(row.amount)}</strong>
                    </span>
                  </div>
                ))}
                {!report.byPaymentMode.length ? (
                  <p className="text-sm text-muted-foreground">No collections on this date.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">By cashier</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.byCashier.map((row) => (
                  <div
                    key={row.cashierId ?? row.cashierName}
                    className="flex justify-between text-sm"
                  >
                    <span>{row.cashierName}</span>
                    <span>
                      {row.count} · <strong>{formatInr(row.amount)}</strong>
                    </span>
                  </div>
                ))}
                {!report.byCashier.length ? (
                  <p className="text-sm text-muted-foreground">No cashier collections recorded.</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Collection split</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6 text-sm">
              <span>
                Admission fees: <strong>{formatInr(report.summary.admissionCollected)}</strong>
              </span>
              <span>
                Monthly fees: <strong>{formatInr(report.summary.monthlyCollected)}</strong>
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Transaction register — {report.date}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2 pr-3">Receipt</th>
                    <th className="pb-2 pr-3">Student</th>
                    <th className="pb-2 pr-3">Enrollment</th>
                    <th className="pb-2 pr-3">Mode</th>
                    <th className="pb-2 pr-3 text-right">Amount</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {report.transactions.map((t) => (
                    <tr key={t.id} className="border-t">
                      <td className="py-2 pr-3 font-mono text-xs">
                        {t.receiptNo ?? t.transactionNo}
                      </td>
                      <td className="py-2 pr-3">{t.studentName ?? '—'}</td>
                      <td className="py-2 pr-3">{t.enrollmentNumber ?? '—'}</td>
                      <td className="py-2 pr-3">{t.paymentMode}</td>
                      <td className="py-2 pr-3 text-right font-medium">{formatInr(t.amount)}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {t.paidAt ? new Date(t.paidAt).toLocaleTimeString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.transactions.length ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No successful payments on this date.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      <BulkReceiptPrintPanel
        controlledDate={date}
        hideDatePicker
        title="Print fee receipts for this closing date"
        description="Bulk-print official fee receipts for all collections on the selected closing date — half A4 (2 per sheet) recommended."
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
