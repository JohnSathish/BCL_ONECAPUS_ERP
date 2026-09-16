'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import {
  approveHrPayroll,
  calculateHrPayroll,
  fetchHrPayroll,
  fetchHrPayrollList,
  fetchHrPayslipPdf,
  finalizeHrPayroll,
  payHrPayrollLines,
  processHrPayroll,
  reverseHrPayroll,
  reviewHrPayroll,
} from '@/services/school-sis';
import { btn, btnGhost, field, HrBadge, HrCard, HrShell, inrPaise } from './hr-ui';

export function HrPayrollDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [runId, setRunId] = useState('');
  const list = useQuery({ queryKey: ['hr-pay-list'], queryFn: fetchHrPayrollList, enabled });
  const run = useQuery({
    queryKey: ['hr-pay', runId],
    queryFn: () => fetchHrPayroll(runId),
    enabled: enabled && !!runId,
  });
  const calc = useMutation({
    mutationFn: () => calculateHrPayroll({ periodMonth: month }),
    onSuccess: (d) => {
      setRunId(d.id);
      qc.invalidateQueries({ queryKey: ['hr-pay-list'] });
    },
  });
  const act = useMutation({
    mutationFn: async (kind: string) => {
      if (kind === 'review') return reviewHrPayroll(runId);
      if (kind === 'approve') return approveHrPayroll(runId);
      if (kind === 'process') return processHrPayroll(runId);
      if (kind === 'lock') return finalizeHrPayroll(runId);
      if (kind === 'reverse') return reverseHrPayroll(runId, 'Correction requested');
      return payHrPayrollLines({
        lineIds: (run.data?.lines ?? []).map((l: { id: string }) => l.id),
        paymentMode: 'NEFT',
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hr-pay', runId] });
      qc.invalidateQueries({ queryKey: ['hr-pay-list'] });
    },
  });
  const totals = run.data?.totalsJson || {};
  const lines = run.data?.lines ?? [];
  const errors = Array.isArray(totals.errorRows)
    ? totals.errorRows
    : lines.filter((l: { error?: string }) => l.error);

  return (
    <HrShell
      title={`${month} payroll`}
      extra={
        <div className="flex flex-wrap gap-2">
          <input
            type="month"
            className={field + ' w-40'}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
          <button
            type="button"
            className={btn}
            onClick={() => calc.mutate()}
            disabled={calc.isPending}
          >
            Calculate
          </button>
        </div>
      }
    >
      {calc.error ? (
        <p className="text-sm text-rose-600">
          Payroll could not be calculated. Check salary and attendance.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(list.data ?? []).map((r: { id: string; periodMonth: string; status: string }) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRunId(r.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ring-1 ${runId === r.id ? 'bg-[#1e3a8a] text-white' : 'bg-white'}`}
          >
            {r.periodMonth} · {r.status}
          </button>
        ))}
      </div>
      {run.data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <HrCard label="Employees" value={lines.length} />
            <HrCard label="Gross" value={inrPaise(totals.gross)} />
            <HrCard label="Deductions" value={inrPaise(totals.deductions)} />
            <HrCard label="Net" value={inrPaise(totals.net)} />
            <HrCard label="Status" value={run.data.status} />
            <HrCard label="Blocked" value={errors.length} hint="Cannot process" />
          </div>
          {errors.length ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {errors.length} employees cannot be processed because salary structures, attendance or
              formulas are missing.
              {(errors as Array<{ name?: string; error?: string }>).slice(0, 5).map((e, i) => (
                <span key={i} className="mt-1 block text-xs">
                  {e.name}: {e.error}
                </span>
              ))}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={() => act.mutate('review')}>
              Send for review
            </button>
            <button type="button" className={btnGhost} onClick={() => act.mutate('approve')}>
              Approve
            </button>
            <button type="button" className={btnGhost} onClick={() => act.mutate('process')}>
              Process
            </button>
            <button type="button" className={btn} onClick={() => act.mutate('pay')}>
              Mark paid (NEFT)
            </button>
            <button type="button" className={btnGhost} onClick={() => act.mutate('lock')}>
              Lock
            </button>
            <button type="button" className={btnGhost} onClick={() => act.mutate('reverse')}>
              Reverse
            </button>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Employee</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-right">Deductions</th>
                  <th className="px-3 py-2 text-right">Net</th>
                  <th className="px-3 py-2">Pay</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map(
                  (l: {
                    id: string;
                    netPaise: number;
                    grossPaise: number;
                    deductionPaise: number;
                    payStatus: string;
                    error?: string;
                    staff: { fullName: string };
                  }) => (
                    <PayrollRow key={l.id} line={l} />
                  ),
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-500">Calculate a run or select history to review.</p>
      )}
    </HrShell>
  );
}

function PayrollRow({
  line,
}: {
  line: {
    id: string;
    netPaise: number;
    grossPaise: number;
    deductionPaise: number;
    payStatus: string;
    error?: string;
    staff: { fullName: string };
    earningsJson?: Array<{ name: string; paise: number }>;
    deductionsJson?: Array<{ name: string; paise: number }>;
  };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className="border-t">
        <td className="px-3 py-2">
          <button
            type="button"
            className="text-left font-medium text-[#1e3a8a]"
            onClick={() => setOpen(!open)}
          >
            {line.staff.fullName}
          </button>
          {line.error ? <p className="text-xs text-rose-600">{line.error}</p> : null}
        </td>
        <td className="px-3 py-2 text-right">{inrPaise(line.grossPaise)}</td>
        <td className="px-3 py-2 text-right">{inrPaise(line.deductionPaise)}</td>
        <td className="px-3 py-2 text-right font-medium">{inrPaise(line.netPaise)}</td>
        <td className="px-3 py-2">
          <HrBadge tone={line.payStatus === 'PAID' ? 'green' : 'amber'}>{line.payStatus}</HrBadge>
        </td>
        <td className="px-3 py-2">
          <button
            type="button"
            className="text-xs text-[#1e3a8a]"
            onClick={async () => {
              const blob = await fetchHrPayslipPdf(line.id);
              const url = URL.createObjectURL(blob);
              window.open(url);
            }}
          >
            Payslip
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="bg-slate-50">
          <td colSpan={6} className="px-4 py-3 text-xs">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="font-semibold">Earnings</p>
                {(line.earningsJson ?? []).map((x, i) => (
                  <p key={i}>
                    {x.name} {inrPaise(x.paise)}
                  </p>
                ))}
              </div>
              <div>
                <p className="font-semibold">Deductions</p>
                {(line.deductionsJson ?? []).map((x, i) => (
                  <p key={i}>
                    {x.name} {inrPaise(x.paise)}
                  </p>
                ))}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function HrPayslipsDesk() {
  return <HrPayrollDesk />;
}
