export const UGC_EARNING_CODES = ['BASIC', 'DA', 'CPF_EMPLOYER'] as const;
export const UGC_STANDARD_DEDUCTION_CODES = [
  'CPF',
  'HOUSE_RENT',
  'LOAN',
  'TDS',
] as const;

/** Deductions excluded from UGC net unless explicitly added as manual adjustments. */
export const UGC_EXCLUDED_DEDUCTION_CODES = new Set([
  'PROFESSIONAL_TAX',
  'QUARTER_RENT',
  'ACCOM_WATER',
  'ACCOM_ELECTRICITY',
  'ACCOM_MAINTENANCE',
  'ACCOM_INTERNET',
]);

export type UgcLineInput = {
  componentCode: string;
  componentName?: string;
  componentType: string;
  amount: number | string;
};

export type UgcOtherDeduction = { code: string; name: string; amount: number };

export type UgcSalaryBreakdown = {
  basic: number;
  da: number;
  cpfEmployer: number;
  gross: number;
  grossFormula: string;
  cpfDed: number;
  houseRent: number;
  loan: number;
  tds: number;
  otherDeductions: UgcOtherDeduction[];
  totalDeductions: number;
  deductionsFormula: string;
  net: number;
  netFormula: string;
  excludedDeductions: UgcOtherDeduction[];
  /** Stored payslip net when it differs from the Excel formula (e.g. hidden ₹208 PT). */
  storedNet?: number;
  formulaMismatch: boolean;
  formulaMismatchAmount: number;
};

function lineAmt(lines: UgcLineInput[], ...codes: string[]): number {
  for (const code of codes) {
    const row = lines.find((l) => l.componentCode === code);
    if (row != null) return Number(row.amount) || 0;
  }
  return 0;
}

export function roundRupee(value: number): number {
  return Math.round(value);
}

export function isUgcEarningCode(code: string): boolean {
  return (UGC_EARNING_CODES as readonly string[]).includes(code);
}

export function isUgcStandardDeductionCode(code: string): boolean {
  return (UGC_STANDARD_DEDUCTION_CODES as readonly string[]).includes(code);
}

export function isUgcExcludedDeduction(code: string): boolean {
  return UGC_EXCLUDED_DEDUCTION_CODES.has(code) || code.startsWith('ACCOM_');
}

/** Gross = Basic + DA + CPF Employer (matches DBC UGC Excel sheet). */
export function computeUgcGross(
  basic: number,
  da: number,
  cpfEmployer: number,
): number {
  return roundRupee(basic + da + cpfEmployer);
}

/** Net = Gross − standard deductions − configured other deductions. */
export function computeUgcNet(
  gross: number,
  cpfDed: number,
  houseRent: number,
  loan: number,
  tds: number,
  otherDeductions = 0,
): number {
  return roundRupee(gross - cpfDed - houseRent - loan - tds - otherDeductions);
}

export function buildUgcBreakdownFromLines(
  lines: UgcLineInput[],
  _storedGross?: number,
  storedNet?: number,
): UgcSalaryBreakdown {
  const basic = lineAmt(lines, 'BASIC');
  const da = lineAmt(lines, 'DA');
  const cpfEmployer = lineAmt(lines, 'CPF_EMPLOYER');
  const cpfDed = lineAmt(lines, 'CPF');
  const houseRent = lineAmt(lines, 'HOUSE_RENT');
  const loan = lineAmt(lines, 'LOAN');
  const tds = lineAmt(lines, 'TDS');

  const otherDeductions: UgcOtherDeduction[] = [];
  const excludedDeductions: UgcOtherDeduction[] = [];

  for (const line of lines) {
    if (line.componentType !== 'DEDUCTION') continue;
    const amount = Number(line.amount) || 0;
    if (amount <= 0) continue;
    const code = line.componentCode;
    if (isUgcStandardDeductionCode(code)) continue;
    const entry = {
      code,
      name: line.componentName ?? code,
      amount,
    };
    if (isUgcExcludedDeduction(code)) excludedDeductions.push(entry);
    else otherDeductions.push(entry);
  }

  const otherTotal = otherDeductions.reduce((sum, row) => sum + row.amount, 0);
  const gross = computeUgcGross(basic, da, cpfEmployer);
  const totalDeductions = cpfDed + houseRent + loan + tds + otherTotal;
  const net = computeUgcNet(gross, cpfDed, houseRent, loan, tds, otherTotal);
  const storedNetVal =
    storedNet != null && Number.isFinite(storedNet)
      ? roundRupee(storedNet)
      : undefined;
  const formulaMismatch =
    storedNetVal != null && Math.abs(storedNetVal - net) >= 1;
  const formulaMismatchAmount = formulaMismatch ? storedNetVal! - net : 0;

  const grossParts = [
    `Basic ${basic.toLocaleString('en-IN')}`,
    `DA ${da.toLocaleString('en-IN')}`,
    `CPF Employer ${cpfEmployer.toLocaleString('en-IN')}`,
  ];
  const dedParts = [
    `CPF ${cpfDed.toLocaleString('en-IN')}`,
    `House Rent ${houseRent.toLocaleString('en-IN')}`,
    `Loan ${loan.toLocaleString('en-IN')}`,
    `TDS ${tds.toLocaleString('en-IN')}`,
    ...otherDeductions.map(
      (row) => `${row.name} ${row.amount.toLocaleString('en-IN')}`,
    ),
  ];

  return {
    basic,
    da,
    cpfEmployer,
    gross,
    grossFormula: `${grossParts.join(' + ')} = ${gross.toLocaleString('en-IN')}`,
    cpfDed,
    houseRent,
    loan,
    tds,
    otherDeductions,
    totalDeductions,
    deductionsFormula: `${dedParts.join(' + ')} = ${totalDeductions.toLocaleString('en-IN')}`,
    net,
    netFormula: `${gross.toLocaleString('en-IN')} − ${totalDeductions.toLocaleString('en-IN')} = ${net.toLocaleString('en-IN')}`,
    excludedDeductions,
    storedNet: storedNetVal,
    formulaMismatch,
    formulaMismatchAmount,
  };
}

/** Re-sync payslip header totals from line items using DBC UGC Excel formulas. */
export function syncUgcPayslipTotalsFromLines(
  lines: UgcLineInput[],
  storedNet?: number,
): {
  gross: number;
  totalDeductions: number;
  net: number;
  breakdown: UgcSalaryBreakdown;
} {
  const breakdown = buildUgcBreakdownFromLines(lines, undefined, storedNet);
  return {
    gross: breakdown.gross,
    totalDeductions: breakdown.totalDeductions,
    net: breakdown.net,
    breakdown,
  };
}

export type UgcComputedLine = {
  code: string;
  name: string;
  componentType: string;
  amount: number;
};

/** Recompute payslip totals using DBC UGC Excel formulas (ignores hidden/system deductions). */
export function finalizeUgcPayslipTotals(computed: UgcComputedLine[]): {
  gross: number;
  deductions: number;
  net: number;
  excluded: UgcOtherDeduction[];
} {
  const lines: UgcLineInput[] = computed.map((line) => ({
    componentCode: line.code,
    componentName: line.name,
    componentType: line.componentType,
    amount: line.amount,
  }));
  const breakdown = buildUgcBreakdownFromLines(lines);
  return {
    gross: breakdown.gross,
    deductions: breakdown.totalDeductions,
    net: breakdown.net,
    excluded: breakdown.excludedDeductions,
  };
}
