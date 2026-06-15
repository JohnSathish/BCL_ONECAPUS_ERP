'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Banknote, Download, Printer } from 'lucide-react';
import { downloadFeeReportExport } from '@/services/fee-cycle';
import { fetchFeeReport } from '@/services/fees';
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

type CashRegisterRow = {
  date: string;
  receiptNo: string;
  transactionNo: string;
  studentName: string;
  amount: number;
  paymentMode: string;
  collectedBy: string;
};

export function FeeCashRegisterPanel() {
  const [date, setDate] = useState(todayIso());

  const reportQ = useQuery({
    queryKey: ['fee-cash-register', date],
    queryFn: () =>
      fetchFeeReport('cash-register', { from: date, to: date }) as Promise<{
        type: string;
        total: number;
        cashTotal: number;
        count: number;
        rows: CashRegisterRow[];
      }>,
  });

  const report = reportQ.data;

  const exportCsv = async () => {
    const res = await downloadFeeReportExport('cash-register', 'csv', { from: date, to: date });
    if (res && 'content' in res && res.content) {
      const blob = new Blob([res.content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename ?? `cash-register-${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const downloadExport = async (format: 'xlsx' | 'pdf') => {
    const blob = (await downloadFeeReportExport('cash-register', format, {
      from: date,
      to: date,
    })) as Blob;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cash-register-${date}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card border-0">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Daily Cash Register
            </CardTitle>
            <CardDescription>
              Manual collections — cash, cheque, and demand draft — with receipt number, student,
              amount, and collector audit trail.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label>Register date</Label>
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
            <Button
              variant="outline"
              onClick={() => void exportCsv()}
              disabled={!report?.rows.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              onClick={() => void downloadExport('xlsx')}
              disabled={!report?.rows.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => void downloadExport('pdf')}
              disabled={!report?.rows.length}
            >
              <Download className="mr-2 h-4 w-4" />
              Export PDF
            </Button>
          </div>
        </CardHeader>
      </Card>

      {reportQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading cash register…</p>
      ) : report ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Total manual collections" value={formatInr(report.total)} />
            <Metric label="Cash collected" value={formatInr(report.cashTotal)} />
            <Metric label="Receipts" value={String(report.count)} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Register — {date}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="pb-2 pr-3">Receipt</th>
                    <th className="pb-2 pr-3">Student</th>
                    <th className="pb-2 pr-3">Mode</th>
                    <th className="pb-2 pr-3 text-right">Amount</th>
                    <th className="pb-2 pr-3">Collected by</th>
                    <th className="pb-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={`${row.transactionNo}-${row.receiptNo}`} className="border-t">
                      <td className="py-2 pr-3 font-mono text-xs">{row.receiptNo}</td>
                      <td className="py-2 pr-3">{row.studentName}</td>
                      <td className="py-2 pr-3">{row.paymentMode}</td>
                      <td className="py-2 pr-3 text-right font-medium">{formatInr(row.amount)}</td>
                      <td className="py-2 pr-3">{row.collectedBy}</td>
                      <td className="py-2 text-xs text-muted-foreground">
                        {row.date ? new Date(row.date).toLocaleTimeString('en-IN') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!report.rows.length ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No manual collections on this date.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
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
