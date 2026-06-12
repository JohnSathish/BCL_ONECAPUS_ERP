'use client';

import { Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/erp/glass-card';
import {
  formatInr,
  legacyTeachingStatementRow,
  nonTeachingStatementRow,
  type StatementPayslip,
  ugcStatementRow,
} from '@/components/hr-module/payroll-statement-utils';
import { exportBulkSalarySheet } from '@/services/payroll';

type RunDetail = {
  month: number;
  year: number;
  payScaleType: string | null;
  status: string;
  payslips: StatementPayslip[];
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function PayrollRunStatement({ runId, run }: { runId: string; run: RunDetail }) {
  const scale = run.payScaleType ?? 'COLLEGE_TEACHING';
  const isUgc = scale === 'UGC';
  const isNonTeaching = scale === 'COLLEGE_NON_TEACHING';
  const payslips = [...(run.payslips ?? [])].sort((a, b) =>
    (a.staffProfile?.fullName ?? '').localeCompare(b.staffProfile?.fullName ?? ''),
  );

  const nonTeachingRows = isNonTeaching
    ? payslips.map((ps, i) => nonTeachingStatementRow(ps, i + 1))
    : [];
  const legacyRows =
    !isUgc && !isNonTeaching ? payslips.map((ps, i) => legacyTeachingStatementRow(ps, i + 1)) : [];
  const ugcRows = isUgc ? payslips.map((ps, i) => ugcStatementRow(ps, i + 1)) : [];

  const exportLayoutKey = isNonTeaching ? 'DBC_NON_TEACHING' : scale;

  const nonTeachingTotals = nonTeachingRows.reduce(
    (acc, r) => ({
      basic: acc.basic + r.basic,
      allowance: acc.allowance + r.allowance,
      gross: acc.gross + r.gross,
      pf: acc.pf + r.pf,
      professionalTax: acc.professionalTax + r.professionalTax,
      loan: acc.loan + r.loan,
      net: acc.net + r.net,
    }),
    { basic: 0, allowance: 0, gross: 0, pf: 0, professionalTax: 0, loan: 0, net: 0 },
  );

  const totals = isNonTeaching
    ? nonTeachingTotals
    : !isUgc
      ? legacyRows.reduce(
          (acc, r) => ({
            basic: acc.basic + r.basic,
            pfEmployer: acc.pfEmployer + r.pfEmployer,
            gross: acc.gross + r.gross,
            ppf: acc.ppf + r.ppf,
            houseRent: acc.houseRent + r.houseRent,
            loan: acc.loan + r.loan,
            net: acc.net + r.net,
          }),
          { basic: 0, pfEmployer: 0, gross: 0, ppf: 0, houseRent: 0, loan: 0, net: 0 },
        )
      : ugcRows.reduce(
          (acc, r) => ({
            basic: acc.basic + r.basic,
            da: acc.da + r.da,
            cpfEmployer: acc.cpfEmployer + r.cpfEmployer,
            cpfDed: acc.cpfDed + r.cpfDed,
            professionalTax: acc.professionalTax + r.professionalTax,
            houseRent: acc.houseRent + r.houseRent,
            loan: acc.loan + r.loan,
            gross: acc.gross + r.gross,
            net: acc.net + r.net,
          }),
          {
            basic: 0,
            da: 0,
            cpfEmployer: 0,
            cpfDed: 0,
            professionalTax: 0,
            houseRent: 0,
            loan: 0,
            gross: 0,
            net: 0,
          },
        );

  if (!payslips.length) {
    return (
      <GlassCard className="p-4 text-sm text-muted-foreground">
        Calculate this payroll run to view the salary statement for verification.
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Salary Statement — Verify Before Publish</h3>
          <p className="text-xs text-muted-foreground">
            {MONTHS[run.month - 1]} {run.year} · {scale} · {run.status} · {payslips.length} staff
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            exportBulkSalarySheet(runId, scale, isNonTeaching ? 'DBC_NON_TEACHING' : undefined)
          }
        >
          <Download className="mr-1 h-3 w-3" /> Export Excel
        </Button>
      </div>

      <div className="overflow-auto rounded border">
        {isNonTeaching ? (
          <table className="w-full min-w-[1020px] text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-2 py-2">Sl</th>
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2 text-right">Basic</th>
                <th className="px-2 py-2 text-right">Fixed Allowance</th>
                <th className="px-2 py-2 text-right">Gross</th>
                <th className="px-2 py-2 text-right">PF</th>
                <th className="px-2 py-2 text-right">PT</th>
                <th className="px-2 py-2 text-right">Loan</th>
                <th className="px-2 py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {nonTeachingRows.map((r) => (
                <tr key={r.employeeCode} className="border-b hover:bg-muted/20">
                  <td className="px-2 py-1.5 tabular-nums">{r.sl}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{r.employeeCode}</td>
                  <td className="px-2 py-1.5">{r.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.basic)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.allowance)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.gross)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.pf)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatInr(r.professionalTax)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.loan)}</td>
                  <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                    {formatInr(r.net)}
                  </td>
                </tr>
              ))}
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-2 py-2" colSpan={3}>
                  TOTAL
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(nonTeachingTotals.basic)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(nonTeachingTotals.allowance)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(nonTeachingTotals.gross)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(nonTeachingTotals.pf)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(nonTeachingTotals.professionalTax)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(nonTeachingTotals.loan)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(nonTeachingTotals.net)}
                </td>
              </tr>
            </tbody>
          </table>
        ) : !isUgc ? (
          <table className="w-full min-w-[960px] text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-2 py-2">Sl</th>
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2 text-right">Basic</th>
                <th className="px-2 py-2 text-right">PF (Employer)</th>
                <th className="px-2 py-2 text-right">Gross</th>
                <th className="px-2 py-2 text-right">PPF</th>
                <th className="px-2 py-2 text-right">H. Rent</th>
                <th className="px-2 py-2 text-right">Loan</th>
                <th className="px-2 py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {legacyRows.map((r) => (
                <tr key={r.employeeCode} className="border-b hover:bg-muted/20">
                  <td className="px-2 py-1.5 tabular-nums">{r.sl}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{r.employeeCode}</td>
                  <td className="px-2 py-1.5">{r.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.basic)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.pfEmployer)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.gross)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.ppf)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.houseRent)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.loan)}</td>
                  <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                    {formatInr(r.net)}
                  </td>
                </tr>
              ))}
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-2 py-2" colSpan={3}>
                  TOTAL
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.basic as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.pfEmployer as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.gross as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.ppf as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.houseRent as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.loan as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.net as number)}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[1100px] text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-2 py-2">Sl</th>
                <th className="px-2 py-2">Code</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2 text-right">Basic</th>
                <th className="px-2 py-2 text-right">DA</th>
                <th className="px-2 py-2 text-right">CPF (Employer)</th>
                <th className="px-2 py-2 text-right">Gross</th>
                <th className="px-2 py-2 text-right">CPF Ded.</th>
                <th className="px-2 py-2 text-right">PT</th>
                <th className="px-2 py-2 text-right">H. Rent</th>
                <th className="px-2 py-2 text-right">Loan</th>
                <th className="px-2 py-2 text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {ugcRows.map((r) => (
                <tr key={r.employeeCode} className="border-b hover:bg-muted/20">
                  <td className="px-2 py-1.5 tabular-nums">{r.sl}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{r.employeeCode}</td>
                  <td className="px-2 py-1.5">{r.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.basic)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.da)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatInr(r.cpfEmployer)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.gross)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.cpfDed)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatInr(r.professionalTax)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.houseRent)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.loan)}</td>
                  <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                    {formatInr(r.net)}
                  </td>
                </tr>
              ))}
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-2 py-2" colSpan={3}>
                  TOTAL
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.basic as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.da as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.cpfEmployer as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.gross as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.cpfDed as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.professionalTax as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.houseRent as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.loan as number)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatInr(totals.net as number)}
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </GlassCard>
  );
}
