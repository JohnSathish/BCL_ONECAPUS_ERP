export const STATE_EARNING_CODES = [
  'BASIC',
  'CPF_EMPLOYER',
  'DA',
  'HCA',
  'HRA',
  'MA',
] as const;
export const STATE_STANDARD_DEDUCTION_CODES = ['CPF', 'LOAN', 'TDS'] as const;

export const STATE_EXCLUDED_DEDUCTION_CODES = new Set([
  'PROFESSIONAL_TAX',
  'QUARTER_RENT',
  'ACCOM_WATER',
  'ACCOM_ELECTRICITY',
  'ACCOM_MAINTENANCE',
  'ACCOM_INTERNET',
]);

export type StateLineInput = {
  componentCode: string;
  componentName?: string;
  componentType: string;
  amount: number | string;
};

export type StateOtherDeduction = {
  code: string;
  name: string;
  amount: number;
};

export type StateSalaryBreakdown = {
  basic: number;
  cpfEmployer: number;
  da: number;
  hca: number;
  hra: number;
  ma: number;
  gross: number;
  grossFormula: string;
  cpfDed: number;
  loan: number;
  tds: number;
  otherDeductions: StateOtherDeduction[];
  totalDeductions: number;
  deductionsFormula: string;
  net: number;
  netFormula: string;
  excludedDeductions: StateOtherDeduction[];
  storedNet?: number;
  formulaMismatch: boolean;
  formulaMismatchAmount: number;
};

function lineAmt(lines: StateLineInput[], ...codes: string[]): number {
  for (const code of codes) {
    const row = lines.find((l) => l.componentCode === code);
    if (row != null) return Number(row.amount) || 0;
  }
  return 0;
}

export function roundRupee(value: number): number {
  return Math.round(value);
}

export function isStateEarningCode(code: string): boolean {
  return (STATE_EARNING_CODES as readonly string[]).includes(code);
}

export function isStateStandardDeductionCode(code: string): boolean {
  return (STATE_STANDARD_DEDUCTION_CODES as readonly string[]).includes(code);
}

export function isStateExcludedDeduction(code: string): boolean {
  return STATE_EXCLUDED_DEDUCTION_CODES.has(code) || code.startsWith('ACCOM_');
}

/** Gross = Basic + CPF Employer + DA + HCA + HR + MA (DBC State Scale Excel). */
export function computeStateGross(
  basic: number,
  cpfEmployer: number,
  da: number,
  hca: number,
  hra: number,
  ma: number,
): number {
  return roundRupee(basic + cpfEmployer + da + hca + hra + ma);
}

export function computeStateNet(
  gross: number,
  cpfDed: number,
  loan: number,
  tds: number,
  otherDeductions = 0,
): number {
  return roundRupee(gross - cpfDed - loan - tds - otherDeductions);
}

export function buildStateBreakdownFromLines(
  lines: StateLineInput[],
  _storedGross?: number,
  storedNet?: number,
): StateSalaryBreakdown {
  const basic = lineAmt(lines, 'BASIC');
  const cpfEmployer = lineAmt(lines, 'CPF_EMPLOYER');
  const da = lineAmt(lines, 'DA');
  const hca = lineAmt(lines, 'HCA');
  const hra = lineAmt(lines, 'HRA');
  const ma = lineAmt(lines, 'MA');
  const cpfDed = lineAmt(lines, 'CPF');
  const loan = lineAmt(lines, 'LOAN');
  const tds = lineAmt(lines, 'TDS');

  const otherDeductions: StateOtherDeduction[] = [];
  const excludedDeductions: StateOtherDeduction[] = [];

  for (const line of lines) {
    if (line.componentType !== 'DEDUCTION') continue;
    const amount = Number(line.amount) || 0;
    if (amount <= 0) continue;
    const code = line.componentCode;
    if (isStateStandardDeductionCode(code)) continue;
    const entry = {
      code,
      name: line.componentName ?? code,
      amount,
    };
    if (isStateExcludedDeduction(code)) excludedDeductions.push(entry);
    else otherDeductions.push(entry);
  }

  const otherTotal = otherDeductions.reduce((sum, row) => sum + row.amount, 0);
  const gross = computeStateGross(basic, cpfEmployer, da, hca, hra, ma);
  const totalDeductions = cpfDed + loan + tds + otherTotal;
  const net = computeStateNet(gross, cpfDed, loan, tds, otherTotal);
  const storedNetVal =
    storedNet != null && Number.isFinite(storedNet)
      ? roundRupee(storedNet)
      : undefined;
  const formulaMismatch =
    storedNetVal != null && Math.abs(storedNetVal - net) >= 1;
  const formulaMismatchAmount = formulaMismatch ? storedNetVal! - net : 0;

  const grossParts = [
    `Basic ${basic.toLocaleString('en-IN')}`,
    `CPF Employer ${cpfEmployer.toLocaleString('en-IN')}`,
    `DA ${da.toLocaleString('en-IN')}`,
    `HCA ${hca.toLocaleString('en-IN')}`,
    `HR ${hra.toLocaleString('en-IN')}`,
    `MA ${ma.toLocaleString('en-IN')}`,
  ];
  const dedParts = [
    `CPF ${cpfDed.toLocaleString('en-IN')}`,
    `Loan ${loan.toLocaleString('en-IN')}`,
    `TDS ${tds.toLocaleString('en-IN')}`,
    ...otherDeductions.map(
      (row) => `${row.name} ${row.amount.toLocaleString('en-IN')}`,
    ),
  ];

  return {
    basic,
    cpfEmployer,
    da,
    hca,
    hra,
    ma,
    gross,
    grossFormula: `${grossParts.join(' + ')} = ${gross.toLocaleString('en-IN')}`,
    cpfDed,
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

export function finalizeStatePayslipTotals(
  computed: Array<{
    code: string;
    name: string;
    componentType: string;
    amount: number;
  }>,
): { gross: number; deductions: number; net: number } {
  const breakdown = buildStateBreakdownFromLines(
    computed.map((line) => ({
      componentCode: line.code,
      componentName: line.name,
      componentType: line.componentType,
      amount: line.amount,
    })),
  );
  return {
    gross: breakdown.gross,
    deductions: breakdown.totalDeductions,
    net: breakdown.net,
  };
}
