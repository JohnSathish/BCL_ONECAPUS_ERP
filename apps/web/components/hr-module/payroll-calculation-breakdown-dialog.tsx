'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  formatInr,
  type PayrollExcelValidationRow,
  type StateSalaryBreakdown,
  type UgcSalaryBreakdown,
} from '@/components/hr-module/payroll-statement-utils';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffName: string;
  employeeCode: string;
  scale: 'UGC' | 'STATE';
  breakdown: UgcSalaryBreakdown | StateSalaryBreakdown;
  validation?: PayrollExcelValidationRow | null;
};

function UgcFormulaReceipt({ breakdown }: { breakdown: UgcSalaryBreakdown }) {
  const earningRows = [
    { label: 'Basic', amount: breakdown.basic },
    { label: 'DA', amount: breakdown.da },
    { label: 'CPF Employer', amount: breakdown.cpfEmployer },
  ];
  const deductionRows = [
    { label: 'CPF Deduction', amount: breakdown.cpfDed },
    { label: 'House Rent', amount: breakdown.houseRent },
    { label: 'Loan', amount: breakdown.loan },
    { label: 'TDS', amount: breakdown.tds },
    ...breakdown.otherDeductions.map((row) => ({ label: row.name, amount: row.amount })),
  ];
  return (
    <FormulaReceipt
      earningRows={earningRows}
      gross={breakdown.gross}
      deductionRows={deductionRows}
      totalDeductions={breakdown.totalDeductions}
      net={breakdown.net}
      netFormula={breakdown.netFormula}
    />
  );
}

function StateFormulaReceipt({ breakdown }: { breakdown: StateSalaryBreakdown }) {
  const earningRows = [
    { label: 'Basic', amount: breakdown.basic },
    { label: 'CPF Employer', amount: breakdown.cpfEmployer },
    { label: 'DA (51%)', amount: breakdown.da },
    { label: 'HCA', amount: breakdown.hca },
    { label: 'HR (15%)', amount: breakdown.hra },
    { label: 'MA', amount: breakdown.ma },
  ];
  const deductionRows = [
    { label: 'CPF Deduction', amount: breakdown.cpfDed },
    { label: 'Loan', amount: breakdown.loan },
    { label: 'TDS', amount: breakdown.tds },
    ...breakdown.otherDeductions.map((row) => ({ label: row.name, amount: row.amount })),
  ];
  return (
    <FormulaReceipt
      earningRows={earningRows}
      gross={breakdown.gross}
      deductionRows={deductionRows}
      totalDeductions={breakdown.totalDeductions}
      net={breakdown.net}
      netFormula={breakdown.netFormula}
    />
  );
}

function FormulaReceipt({
  earningRows,
  gross,
  deductionRows,
  totalDeductions,
  net,
  netFormula,
}: {
  earningRows: Array<{ label: string; amount: number }>;
  gross: number;
  deductionRows: Array<{ label: string; amount: number }>;
  totalDeductions: number;
  net: number;
  netFormula: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4 font-mono text-sm">
      {earningRows.map((row) => (
        <div key={row.label} className="flex justify-between gap-6 py-0.5">
          <span className="text-muted-foreground">{row.label.padEnd(18)}</span>
          <span className="tabular-nums">₹{formatInr(row.amount)}</span>
        </div>
      ))}
      <div className="my-2 border-t border-dashed" />
      <div className="flex justify-between gap-6 py-0.5 font-semibold">
        <span>Gross</span>
        <span className="tabular-nums">₹{formatInr(gross)}</span>
      </div>
      <div className="mt-4" />
      {deductionRows.map((row) => (
        <div key={row.label} className="flex justify-between gap-6 py-0.5">
          <span className="text-muted-foreground">{row.label.padEnd(18)}</span>
          <span className="tabular-nums">₹{formatInr(row.amount)}</span>
        </div>
      ))}
      <div className="my-2 border-t border-dashed" />
      <div className="flex justify-between gap-6 py-0.5 font-semibold">
        <span>Total Deduction</span>
        <span className="tabular-nums">₹{formatInr(totalDeductions)}</span>
      </div>
      <div className="my-3 border-t" />
      <div className="flex justify-between gap-6 py-0.5 text-base font-bold text-primary">
        <span>Net Salary</span>
        <span className="tabular-nums">₹{formatInr(net)}</span>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">{netFormula}</p>
    </div>
  );
}

export function PayrollCalculationBreakdownDialog({
  open,
  onOpenChange,
  staffName,
  employeeCode,
  scale,
  breakdown,
  validation,
}: Props) {
  const excel = validation?.excel ?? null;
  const hasExcelMismatch = validation?.mismatch ?? false;
  const formulaMismatch = breakdown.formulaMismatch;
  const excludedLabel =
    scale === 'UGC'
      ? 'Excluded from UGC net (not in college Excel)'
      : 'Excluded from State Scale net (not in college Excel)';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Calculation Breakdown</DialogTitle>
          <DialogDescription>
            {staffName}
            {employeeCode ? ` · ${employeeCode}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {scale === 'STATE' ? (
            <StateFormulaReceipt breakdown={breakdown as StateSalaryBreakdown} />
          ) : (
            <UgcFormulaReceipt breakdown={breakdown as UgcSalaryBreakdown} />
          )}

          {breakdown.excludedDeductions.length > 0 && (
            <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <h4 className="font-semibold text-amber-800 dark:text-amber-200">{excludedLabel}</h4>
              <ul className="mt-2 space-y-0.5 text-muted-foreground">
                {breakdown.excludedDeductions.map((row) => (
                  <li key={row.code}>
                    {row.name}: ₹{formatInr(row.amount)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {formulaMismatch && (
            <section className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm">
              <h4 className="font-semibold text-destructive">Stored Net Mismatch</h4>
              <p className="mt-1 text-muted-foreground">
                Payslip stored net (₹{formatInr(breakdown.storedNet ?? 0)}) differs from the Excel
                formula net (₹{formatInr(breakdown.net)}) by ₹
                {formatInr(Math.abs(breakdown.formulaMismatchAmount))}. Recalculate the payroll run
                to sync stored totals.
              </p>
            </section>
          )}

          {excel && (
            <section
              className={`rounded-lg border p-3 text-sm ${
                hasExcelMismatch
                  ? 'border-destructive/50 bg-destructive/5'
                  : 'border-emerald-500/40 bg-emerald-500/5'
              }`}
            >
              <h4 className="font-semibold">
                {hasExcelMismatch
                  ? 'Excel Formula Validation — Calculation Mismatch'
                  : 'Excel Formula Validation — Match'}
              </h4>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">ERP Net (formula)</p>
                  <p className="font-semibold tabular-nums">₹{formatInr(breakdown.net)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Excel Net</p>
                  <p className="font-semibold tabular-nums">₹{formatInr(excel.net)}</p>
                </div>
              </div>
              {hasExcelMismatch && validation && (
                <p className="mt-2 text-destructive">
                  Difference: ₹{formatInr(Math.abs(validation.deltaNet))}
                  {validation.mismatchFields.length > 0
                    ? ` · Fields: ${validation.mismatchFields.join(', ')}`
                    : ''}
                </p>
              )}
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
