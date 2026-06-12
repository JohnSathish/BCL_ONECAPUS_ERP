export type PayslipLine = { componentCode: string; amount: number | string };

export type StatementPayslip = {
  grossSalary: number | string;
  netSalary: number | string;
  staffProfile?: { fullName?: string; employeeCode?: string };
  lines?: PayslipLine[];
};

export function lineAmount(lines: PayslipLine[] | undefined, ...codes: string[]): number {
  if (!lines?.length) return 0;
  for (const code of codes) {
    const row = lines.find((l) => l.componentCode === code);
    if (row != null) return Number(row.amount) || 0;
  }
  return 0;
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
  };
}

export function nonTeachingStatementRow(ps: StatementPayslip, sl: number) {
  const lines = ps.lines ?? [];
  const basic = lineAmount(lines, 'BASIC');
  const allowance = lineAmount(lines, 'ALLOWANCE', 'FIXED_ALLOWANCE');
  const pf = lineAmount(lines, 'PF', 'PF_EMPLOYEE');
  const professionalTax = lineAmount(lines, 'PROFESSIONAL_TAX');
  const loan = lineAmount(lines, 'LOAN');
  const gross = Number(ps.grossSalary) || basic + allowance;
  const net = Number(ps.netSalary) || gross - pf - professionalTax - loan;

  return {
    sl,
    employeeCode: ps.staffProfile?.employeeCode ?? '',
    name: ps.staffProfile?.fullName ?? '',
    basic,
    allowance,
    gross,
    pf,
    professionalTax,
    loan,
    net,
  };
}

export function ugcStatementRow(ps: StatementPayslip, sl: number) {
  const lines = ps.lines ?? [];
  const basic = lineAmount(lines, 'BASIC');
  const da = lineAmount(lines, 'DA');
  const cpfEmployer = lineAmount(lines, 'CPF_EMPLOYER');
  const cpfDed = lineAmount(lines, 'CPF');
  const houseRent = lineAmount(lines, 'HOUSE_RENT');
  const loan = lineAmount(lines, 'LOAN');
  const professionalTax = lineAmount(lines, 'PROFESSIONAL_TAX');
  const gross = Number(ps.grossSalary) || basic + da + cpfEmployer;
  const net = Number(ps.netSalary) || gross - cpfDed - houseRent - loan - professionalTax;

  return {
    sl,
    employeeCode: ps.staffProfile?.employeeCode ?? '',
    name: ps.staffProfile?.fullName ?? '',
    basic,
    da,
    cpfEmployer,
    cpfDed,
    professionalTax,
    houseRent,
    loan,
    gross,
    net,
  };
}

export function formatInr(value: number) {
  return value.toLocaleString('en-IN');
}
