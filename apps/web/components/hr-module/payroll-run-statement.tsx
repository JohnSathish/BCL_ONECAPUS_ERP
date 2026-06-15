'use client';

import { Calculator, Download, Upload } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/erp/glass-card';
import { PayrollCalculationBreakdownDialog } from '@/components/hr-module/payroll-calculation-breakdown-dialog';
import {
  formatInr,
  legacyTeachingStatementRow,
  nonTeachingStatementRow,
  stateStatementRow,
  type PayrollExcelValidationResult,
  type StatementPayslip,
  type StateSalaryBreakdown,
  type UgcSalaryBreakdown,
  ugcStatementRow,
} from '@/components/hr-module/payroll-statement-utils';
import { exportBulkSalarySheet, validatePayrollRunExcel } from '@/services/payroll';
import { apiErrorMessage } from '@/utils/api-error';

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
  const isState = scale === 'STATE';
  const isNonTeaching = scale === 'COLLEGE_NON_TEACHING';
  const hasExcelValidation = isUgc || isState;
  const payslips = [...(run.payslips ?? [])].sort((a, b) =>
    (a.staffProfile?.fullName ?? '').localeCompare(b.staffProfile?.fullName ?? ''),
  );

  const [validationMode, setValidationMode] = useState(false);
  const [validationResult, setValidationResult] = useState<PayrollExcelValidationResult | null>(
    null,
  );
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [breakdownRow, setBreakdownRow] = useState<{
    name: string;
    employeeCode: string;
    payslipId?: string;
    scale: 'UGC' | 'STATE';
    breakdown: UgcSalaryBreakdown | StateSalaryBreakdown;
  } | null>(null);

  const validationByPayslipId = useMemo(() => {
    const map = new Map<string, PayrollExcelValidationResult['mismatches'][number]>();
    for (const row of validationResult?.mismatches ?? []) {
      map.set(row.payslipId, row);
    }
    return map;
  }, [validationResult]);

  const mismatchCount = useMemo(
    () => (validationResult?.mismatches ?? []).filter((row) => row.mismatch).length,
    [validationResult],
  );

  const handleExcelUpload = useCallback(
    async (file: File) => {
      setValidationLoading(true);
      setValidationError(null);
      try {
        const result = (await validatePayrollRunExcel(runId, file)) as PayrollExcelValidationResult;
        setValidationResult(result);
        setValidationMode(true);
      } catch (err) {
        setValidationError(apiErrorMessage(err, 'Excel validation failed'));
      } finally {
        setValidationLoading(false);
      }
    },
    [runId],
  );

  const openBreakdown = useCallback(
    (
      row: ReturnType<typeof ugcStatementRow> | ReturnType<typeof stateStatementRow>,
      scaleType: 'UGC' | 'STATE',
    ) => {
      setBreakdownRow({
        name: row.name,
        employeeCode: row.employeeCode,
        payslipId: row.payslipId,
        scale: scaleType,
        breakdown: row.breakdown,
      });
      setBreakdownOpen(true);
    },
    [],
  );

  const nonTeachingRows = isNonTeaching
    ? payslips.map((ps, i) => nonTeachingStatementRow(ps, i + 1))
    : [];
  const legacyRows =
    !isUgc && !isNonTeaching && !isState
      ? payslips.map((ps, i) => legacyTeachingStatementRow(ps, i + 1))
      : [];
  const ugcRows = isUgc ? payslips.map((ps, i) => ugcStatementRow(ps, i + 1)) : [];
  const stateRows = isState ? payslips.map((ps, i) => stateStatementRow(ps, i + 1)) : [];

  const nonTeachingTotals = nonTeachingRows.reduce(
    (acc, r) => ({
      basic: acc.basic + r.basic,
      allowance: acc.allowance + r.allowance,
      gross: acc.gross + r.gross,
      pf: acc.pf + r.pf,
      houseRent: acc.houseRent + r.houseRent,
      loan: acc.loan + r.loan,
      net: acc.net + r.net,
    }),
    { basic: 0, allowance: 0, gross: 0, pf: 0, houseRent: 0, loan: 0, net: 0 },
  );

  const legacyTotals = legacyRows.reduce(
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
  );

  const stateTotals = stateRows.reduce(
    (acc, r) => ({
      basic: acc.basic + r.basic,
      cpfEmployer: acc.cpfEmployer + r.cpfEmployer,
      da: acc.da + r.da,
      hca: acc.hca + r.hca,
      hra: acc.hra + r.hra,
      ma: acc.ma + r.ma,
      cpfDed: acc.cpfDed + r.cpfDed,
      loan: acc.loan + r.loan,
      gross: acc.gross + r.gross,
      net: acc.net + r.net,
    }),
    {
      basic: 0,
      cpfEmployer: 0,
      da: 0,
      hca: 0,
      hra: 0,
      ma: 0,
      cpfDed: 0,
      loan: 0,
      gross: 0,
      net: 0,
    },
  );

  const exportLayout = isNonTeaching
    ? 'DBC_NON_TEACHING'
    : isState
      ? 'DBC_STATE_NON_TEACHING'
      : undefined;

  const ugcTotals = ugcRows.reduce(
    (acc, r) => ({
      basic: acc.basic + r.basic,
      da: acc.da + r.da,
      cpfEmployer: acc.cpfEmployer + r.cpfEmployer,
      cpfDed: acc.cpfDed + r.cpfDed,
      houseRent: acc.houseRent + r.houseRent,
      loan: acc.loan + r.loan,
      tds: acc.tds + r.tds,
      gross: acc.gross + r.gross,
      net: acc.net + r.net,
    }),
    { basic: 0, da: 0, cpfEmployer: 0, cpfDed: 0, houseRent: 0, loan: 0, tds: 0, gross: 0, net: 0 },
  );

  if (!payslips.length) {
    return (
      <GlassCard className="p-4 text-sm text-muted-foreground">
        Calculate this payroll run to view the salary statement for verification.
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard className="p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Salary Statement — Verify Before Publish</h3>
            <p className="text-xs text-muted-foreground">
              {MONTHS[run.month - 1]} {run.year} · {scale} · {run.status} · {payslips.length} staff
            </p>
            {isState && (
              <p className="mt-1 text-xs text-muted-foreground">
                Gross = Basic + CPF Employer + DA + HCA + HR + MA · Net = Gross − CPF − Loan
              </p>
            )}
            {isUgc && (
              <p className="mt-1 text-xs text-muted-foreground">
                Gross = Basic + DA + CPF Employer · Net = Gross − CPF − House Rent − Loan − TDS −
                Other
              </p>
            )}
            {validationMode && validationResult && (
              <p
                className={`mt-1 text-xs font-medium ${
                  mismatchCount > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                Excel validation: {validationResult.matched} matched
                {mismatchCount > 0
                  ? ` · ${mismatchCount} calculation mismatch(es)`
                  : ' · all rows match'}
              </p>
            )}
            {validationError && <p className="mt-1 text-xs text-destructive">{validationError}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasExcelValidation && (
              <>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={validationMode}
                    onChange={(e) => setValidationMode(e.target.checked)}
                    className="rounded"
                  />
                  Excel Formula Validation Mode
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleExcelUpload(file);
                    e.target.value = '';
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={validationLoading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1 h-3 w-3" />
                  {validationLoading ? 'Validating…' : 'Upload Reference Excel'}
                </Button>
              </>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => exportBulkSalarySheet(runId, scale, exportLayout)}
            >
              <Download className="mr-1 h-3 w-3" /> Export Excel
            </Button>
          </div>
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
                  <th className="px-2 py-2 text-right">H. Rent</th>
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
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatInr(r.allowance)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.gross)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.pf)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatInr(r.houseRent)}
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
                    {formatInr(nonTeachingTotals.houseRent)}
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
          ) : isState ? (
            <table className="w-full min-w-[1280px] text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-2 py-2">Sl</th>
                  <th className="px-2 py-2">Code</th>
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2 text-right">Basic</th>
                  <th className="px-2 py-2 text-right">CPF (Employer)</th>
                  <th className="px-2 py-2 text-right">DA</th>
                  <th className="px-2 py-2 text-right">HCA</th>
                  <th className="px-2 py-2 text-right">HR</th>
                  <th className="px-2 py-2 text-right">MA</th>
                  <th className="px-2 py-2 text-right">Gross</th>
                  <th className="px-2 py-2 text-right">CPF Ded.</th>
                  <th className="px-2 py-2 text-right">Loan</th>
                  <th className="px-2 py-2 text-right">Net</th>
                  {validationMode && <th className="px-2 py-2">Excel</th>}
                  <th className="px-2 py-2 w-24">Formula</th>
                </tr>
              </thead>
              <tbody>
                {stateRows.map((r) => {
                  const validation = r.payslipId
                    ? validationByPayslipId.get(r.payslipId)
                    : undefined;
                  const excelMismatch = validationMode && validation?.mismatch;
                  const formulaMismatch = r.breakdown.formulaMismatch;
                  const rowMismatch = excelMismatch || formulaMismatch;
                  return (
                    <tr
                      key={r.employeeCode}
                      className={`border-b hover:bg-muted/20 ${
                        rowMismatch ? 'bg-destructive/10 hover:bg-destructive/15' : ''
                      }`}
                    >
                      <td className="px-2 py-1.5 tabular-nums">{r.sl}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.employeeCode}</td>
                      <td className="px-2 py-1.5">{r.name}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.basic)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatInr(r.cpfEmployer)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.da)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.hca)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.hra)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.ma)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.gross)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.cpfDed)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.loan)}</td>
                      <td
                        className={`px-2 py-1.5 text-right font-medium tabular-nums ${
                          rowMismatch ? 'text-destructive underline decoration-destructive' : ''
                        }`}
                      >
                        {formatInr(r.net)}
                        {rowMismatch && (
                          <span className="ml-1 block text-[10px] font-normal">
                            {excelMismatch ? 'Calculation Mismatch' : 'Formula Mismatch'}
                          </span>
                        )}
                      </td>
                      {validationMode && (
                        <td className="px-2 py-1.5 text-[10px]">
                          {validation?.excel ? (
                            <>
                              <span className="text-muted-foreground">Excel: </span>
                              <span className={rowMismatch ? 'text-destructive' : ''}>
                                {formatInr(validation.excel.net)}
                              </span>
                              {validation.deltaNet !== 0 && (
                                <span className="block text-destructive">
                                  Δ {validation.deltaNet > 0 ? '+' : ''}
                                  {formatInr(validation.deltaNet)}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-destructive">No Excel row</span>
                          )}
                        </td>
                      )}
                      <td className="px-1 py-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-[10px]"
                          title="Show salary formula breakdown"
                          onClick={() => openBreakdown(r, 'STATE')}
                        >
                          <Calculator className="h-3 w-3" />
                          Show Formula
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-2 py-2" colSpan={3}>
                    TOTAL
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(stateTotals.basic)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(stateTotals.cpfEmployer)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInr(stateTotals.da)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(stateTotals.hca)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(stateTotals.hra)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInr(stateTotals.ma)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(stateTotals.gross)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(stateTotals.cpfDed)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(stateTotals.loan)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(stateTotals.net)}
                  </td>
                  {validationMode && <td colSpan={2} />}
                </tr>
              </tbody>
            </table>
          ) : isUgc ? (
            <table className="w-full min-w-[1180px] text-xs">
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
                  <th className="px-2 py-2 text-right">TDS</th>
                  <th className="px-2 py-2 text-right">H. Rent</th>
                  <th className="px-2 py-2 text-right">Loan</th>
                  <th className="px-2 py-2 text-right">Net</th>
                  {validationMode && <th className="px-2 py-2">Excel</th>}
                  <th className="px-2 py-2 w-24">Formula</th>
                </tr>
              </thead>
              <tbody>
                {ugcRows.map((r) => {
                  const validation = r.payslipId
                    ? validationByPayslipId.get(r.payslipId)
                    : undefined;
                  const excelMismatch = validationMode && validation?.mismatch;
                  const formulaMismatch = r.breakdown.formulaMismatch;
                  const rowMismatch = excelMismatch || formulaMismatch;
                  return (
                    <tr
                      key={r.employeeCode}
                      className={`border-b hover:bg-muted/20 ${
                        rowMismatch ? 'bg-destructive/10 hover:bg-destructive/15' : ''
                      }`}
                    >
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
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.tds)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {formatInr(r.houseRent)}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.loan)}</td>
                      <td
                        className={`px-2 py-1.5 text-right font-medium tabular-nums ${
                          rowMismatch ? 'text-destructive underline decoration-destructive' : ''
                        }`}
                      >
                        {formatInr(r.net)}
                        {rowMismatch && (
                          <span className="ml-1 block text-[10px] font-normal">
                            {excelMismatch ? 'Calculation Mismatch' : 'Formula Mismatch'}
                          </span>
                        )}
                      </td>
                      {validationMode && (
                        <td className="px-2 py-1.5 text-[10px]">
                          {validation?.excel ? (
                            <>
                              <span className="text-muted-foreground">Excel: </span>
                              <span className={rowMismatch ? 'text-destructive' : ''}>
                                {formatInr(validation.excel.net)}
                              </span>
                              {validation.deltaNet !== 0 && (
                                <span className="block text-destructive">
                                  Δ {validation.deltaNet > 0 ? '+' : ''}
                                  {formatInr(validation.deltaNet)}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-destructive">No Excel row</span>
                          )}
                        </td>
                      )}
                      <td className="px-1 py-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 px-2 text-[10px]"
                          title="Show salary formula breakdown"
                          onClick={() => openBreakdown(r, 'UGC')}
                        >
                          <Calculator className="h-3 w-3" />
                          Show Formula
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-2 py-2" colSpan={3}>
                    TOTAL
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(ugcTotals.basic)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInr(ugcTotals.da)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(ugcTotals.cpfEmployer)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(ugcTotals.gross)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(ugcTotals.cpfDed)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInr(ugcTotals.tds)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(ugcTotals.houseRent)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInr(ugcTotals.loan)}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{formatInr(ugcTotals.net)}</td>
                  {validationMode && <td colSpan={2} />}
                </tr>
              </tbody>
            </table>
          ) : (
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
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatInr(r.pfEmployer)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.gross)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{formatInr(r.ppf)}</td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatInr(r.houseRent)}
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
                    {formatInr(legacyTotals.basic)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(legacyTotals.pfEmployer)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(legacyTotals.gross)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(legacyTotals.ppf)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(legacyTotals.houseRent)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(legacyTotals.loan)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatInr(legacyTotals.net)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {hasExcelValidation &&
          validationMode &&
          validationResult &&
          (validationResult.excelOnly.length > 0 || validationResult.erpOnly.length > 0) && (
            <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
              {validationResult.excelOnly.length > 0 && (
                <p>
                  <span className="font-medium text-foreground">In Excel only: </span>
                  {validationResult.excelOnly.join(', ')}
                </p>
              )}
              {validationResult.erpOnly.length > 0 && (
                <p className="mt-1">
                  <span className="font-medium text-foreground">In ERP only: </span>
                  {validationResult.erpOnly.join(', ')}
                </p>
              )}
            </div>
          )}
      </GlassCard>

      {breakdownRow && (
        <PayrollCalculationBreakdownDialog
          open={breakdownOpen}
          onOpenChange={setBreakdownOpen}
          staffName={breakdownRow.name}
          employeeCode={breakdownRow.employeeCode}
          scale={breakdownRow.scale}
          breakdown={breakdownRow.breakdown}
          validation={
            breakdownRow.payslipId
              ? (validationByPayslipId.get(breakdownRow.payslipId) ?? null)
              : null
          }
        />
      )}
    </>
  );
}
