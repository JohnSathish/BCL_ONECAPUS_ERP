export type PayslipLine = {
  componentCode: string;
  componentName?: string;
  componentType?: string;
  amount: number | string;
};

export type StatementPayslip = {
  id?: string;
  grossSalary: number | string;
  netSalary: number | string;
  staffProfile?: { fullName?: string; employeeCode?: string };
  lines?: PayslipLine[];
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
  storedNet?: number;
  formulaMismatch: boolean;
  formulaMismatchAmount: number;
};

const UGC_STANDARD_DEDUCTIONS = new Set(['CPF', 'HOUSE_RENT', 'LOAN', 'TDS']);
const UGC_EXCLUDED = new Set([
  'PROFESSIONAL_TAX',
  'QUARTER_RENT',
  'ACCOM_WATER',
  'ACCOM_ELECTRICITY',
  'ACCOM_MAINTENANCE',
  'ACCOM_INTERNET',
]);

export function lineAmount(lines: PayslipLine[] | undefined, ...codes: string[]): number {
  if (!lines?.length) return 0;
  for (const code of codes) {
    const row = lines.find((l) => l.componentCode === code);
    if (row != null) return Number(row.amount) || 0;
  }
  return 0;
}

function isExcludedDeduction(code: string): boolean {
  return UGC_EXCLUDED.has(code) || code.startsWith('ACCOM_');
}

/** Gross = Basic + DA + CPF Employer — matches DBC UGC Excel sheet. */
export function computeUgcGross(basic: number, da: number, cpfEmployer: number): number {
  return Math.round(basic + da + cpfEmployer);
}

/** Net = Gross − CPF − House Rent − Loan − TDS − other configured deductions. */
export function computeUgcNet(
  gross: number,
  cpfDed: number,
  houseRent: number,
  loan: number,
  tds: number,
  otherDeductions = 0,
): number {
  return Math.round(gross - cpfDed - houseRent - loan - tds - otherDeductions);
}

export function buildUgcBreakdown(ps: StatementPayslip): UgcSalaryBreakdown {
  const lines = ps.lines ?? [];
  const basic = lineAmount(lines, 'BASIC');
  const da = lineAmount(lines, 'DA');
  const cpfEmployer = lineAmount(lines, 'CPF_EMPLOYER');
  const cpfDed = lineAmount(lines, 'CPF');
  const houseRent = lineAmount(lines, 'HOUSE_RENT');
  const loan = lineAmount(lines, 'LOAN');
  const tds = lineAmount(lines, 'TDS');

  const otherDeductions: UgcOtherDeduction[] = [];
  const excludedDeductions: UgcOtherDeduction[] = [];

  for (const line of lines) {
    if (line.componentType !== 'DEDUCTION') continue;
    const amount = Number(line.amount) || 0;
    if (amount <= 0) continue;
    const code = line.componentCode;
    if (UGC_STANDARD_DEDUCTIONS.has(code)) continue;
    const entry = { code, name: line.componentName ?? code, amount };
    if (isExcludedDeduction(code)) excludedDeductions.push(entry);
    else otherDeductions.push(entry);
  }

  const otherTotal = otherDeductions.reduce((sum, row) => sum + row.amount, 0);
  const gross = computeUgcGross(basic, da, cpfEmployer);
  const totalDeductions = cpfDed + houseRent + loan + tds + otherTotal;
  const net = computeUgcNet(gross, cpfDed, houseRent, loan, tds, otherTotal);
  const storedNetVal = Number(ps.netSalary);
  const storedNet =
    Number.isFinite(storedNetVal) && storedNetVal > 0 ? Math.round(storedNetVal) : undefined;
  const formulaMismatch = storedNet != null && Math.abs(storedNet - net) >= 1;
  const formulaMismatchAmount = formulaMismatch ? storedNet! - net : 0;

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
    ...otherDeductions.map((row) => `${row.name} ${row.amount.toLocaleString('en-IN')}`),
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
    storedNet,
    formulaMismatch,
    formulaMismatchAmount,
  };
}

/** DBC legacy teaching sheet: Basic, PF employer, Gross, PPF total, H.Rent, Loan, Net */
export function legacyTeachingStatementRow(ps: StatementPayslip, sl: number) {
  const lines = ps.lines ?? [];
  const basic = lineAmount(lines, 'BASIC');
  const pfEmployer = lineAmount(lines, 'PF_EMPLOYER', 'PF_EARNING', 'PF');
  const ppfEmployee = lineAmount(lines, 'PF_EMPLOYEE');
  const ppfEmployer = lineAmount(lines, 'PPF');
  const ppfTotal = ppfEmployee + ppfEmployer > 0 ? ppfEmployee + ppfEmployer : pfEmployer * 2;
  const houseRent = lineAmount(lines, 'HOUSE_RENT');
  const loan = lineAmount(lines, 'LOAN');
  const gross = Number(ps.grossSalary) || basic + pfEmployer;
  const net = Number(ps.netSalary) || gross - ppfTotal - houseRent - loan;

  return {
    payslipId: ps.id,
    sl,
    employeeCode: ps.staffProfile?.employeeCode ?? '',
    name: ps.staffProfile?.fullName ?? '',
    basic,
    pfEmployer,
    gross,
    ppf: ppfTotal,
    houseRent,
    loan,
    net,
    payslip: ps,
  };
}

export function nonTeachingStatementRow(ps: StatementPayslip, sl: number) {
  const lines = ps.lines ?? [];
  const basic = lineAmount(lines, 'BASIC');
  const allowance = lineAmount(lines, 'ALLOWANCE', 'FIXED_ALLOWANCE');
  const pfEmployer = lineAmount(lines, 'PF_EMPLOYER', 'PF_EARNING');
  const pf = lineAmount(lines, 'PF', 'PF_EMPLOYEE');
  const houseRent = lineAmount(lines, 'HOUSE_RENT');
  const loan = lineAmount(lines, 'LOAN');
  const gross = Number(ps.grossSalary) || Math.round(basic + allowance + pfEmployer);
  const net = Number(ps.netSalary) || gross - pf - houseRent - loan;

  return {
    payslipId: ps.id,
    sl,
    employeeCode: ps.staffProfile?.employeeCode ?? '',
    name: ps.staffProfile?.fullName ?? '',
    basic,
    allowance,
    gross,
    pf,
    houseRent,
    loan,
    net,
    payslip: ps,
  };
}

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
  otherDeductions: UgcOtherDeduction[];
  totalDeductions: number;
  deductionsFormula: string;
  net: number;
  netFormula: string;
  excludedDeductions: UgcOtherDeduction[];
  storedNet?: number;
  formulaMismatch: boolean;
  formulaMismatchAmount: number;
};

const STATE_STANDARD_DEDUCTIONS = new Set(['CPF', 'LOAN', 'TDS']);

export function computeStateGross(
  basic: number,
  cpfEmployer: number,
  da: number,
  hca: number,
  hra: number,
  ma: number,
): number {
  return Math.round(basic + cpfEmployer + da + hca + hra + ma);
}

export function computeStateNet(
  gross: number,
  cpfDed: number,
  loan: number,
  tds: number,
  otherDeductions = 0,
): number {
  return Math.round(gross - cpfDed - loan - tds - otherDeductions);
}

export function buildStateBreakdown(ps: StatementPayslip): StateSalaryBreakdown {
  const lines = ps.lines ?? [];
  const basic = lineAmount(lines, 'BASIC');
  const cpfEmployer = lineAmount(lines, 'CPF_EMPLOYER');
  const da = lineAmount(lines, 'DA');
  const hca = lineAmount(lines, 'HCA');
  const hra = lineAmount(lines, 'HRA');
  const ma = lineAmount(lines, 'MA');
  const cpfDed = lineAmount(lines, 'CPF');
  const loan = lineAmount(lines, 'LOAN');
  const tds = lineAmount(lines, 'TDS');

  const otherDeductions: UgcOtherDeduction[] = [];
  const excludedDeductions: UgcOtherDeduction[] = [];

  for (const line of lines) {
    if (line.componentType !== 'DEDUCTION') continue;
    const amount = Number(line.amount) || 0;
    if (amount <= 0) continue;
    const code = line.componentCode;
    if (STATE_STANDARD_DEDUCTIONS.has(code)) continue;
    const entry = { code, name: line.componentName ?? code, amount };
    if (isExcludedDeduction(code)) excludedDeductions.push(entry);
    else otherDeductions.push(entry);
  }

  const otherTotal = otherDeductions.reduce((sum, row) => sum + row.amount, 0);
  const gross = computeStateGross(basic, cpfEmployer, da, hca, hra, ma);
  const totalDeductions = cpfDed + loan + tds + otherTotal;
  const net = computeStateNet(gross, cpfDed, loan, tds, otherTotal);
  const storedNetVal = Number(ps.netSalary);
  const storedNet =
    Number.isFinite(storedNetVal) && storedNetVal > 0 ? Math.round(storedNetVal) : undefined;
  const formulaMismatch = storedNet != null && Math.abs(storedNet - net) >= 1;
  const formulaMismatchAmount = formulaMismatch ? storedNet! - net : 0;

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
    ...otherDeductions.map((row) => `${row.name} ${row.amount.toLocaleString('en-IN')}`),
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
    storedNet,
    formulaMismatch,
    formulaMismatchAmount,
  };
}

export function stateStatementRow(ps: StatementPayslip, sl: number) {
  const breakdown = buildStateBreakdown(ps);
  return {
    payslipId: ps.id,
    sl,
    employeeCode: ps.staffProfile?.employeeCode ?? '',
    name: ps.staffProfile?.fullName ?? '',
    basic: breakdown.basic,
    cpfEmployer: breakdown.cpfEmployer,
    da: breakdown.da,
    hca: breakdown.hca,
    hra: breakdown.hra,
    ma: breakdown.ma,
    cpfDed: breakdown.cpfDed,
    loan: breakdown.loan,
    gross: breakdown.gross,
    net: breakdown.net,
    breakdown,
    payslip: ps,
  };
}

export function ugcStatementRow(ps: StatementPayslip, sl: number) {
  const breakdown = buildUgcBreakdown(ps);

  return {
    payslipId: ps.id,
    sl,
    employeeCode: ps.staffProfile?.employeeCode ?? '',
    name: ps.staffProfile?.fullName ?? '',
    basic: breakdown.basic,
    da: breakdown.da,
    cpfEmployer: breakdown.cpfEmployer,
    cpfDed: breakdown.cpfDed,
    houseRent: breakdown.houseRent,
    loan: breakdown.loan,
    tds: breakdown.tds,
    otherDeductions: breakdown.otherDeductions,
    gross: breakdown.gross,
    net: breakdown.net,
    breakdown,
    payslip: ps,
  };
}

export function formatInr(value: number) {
  return value.toLocaleString('en-IN');
}

export type PayrollSalaryBreakdown = UgcSalaryBreakdown | StateSalaryBreakdown;

export type PayrollExcelValidationRow = {
  payslipId: string;
  employeeCode: string;
  name: string;
  erp: PayrollSalaryBreakdown;
  excel: PayrollSalaryBreakdown | null;
  deltaNet: number;
  mismatch: boolean;
  mismatchFields: string[];
  matchMethod: string | null;
};

export type PayrollExcelValidationResult = {
  sheetName: string | null;
  matched: number;
  mismatches: PayrollExcelValidationRow[];
  excelOnly: string[];
  erpOnly: string[];
};
