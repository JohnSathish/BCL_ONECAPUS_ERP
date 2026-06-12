import { PAY_SCALE_TYPES } from '@/types/payroll';

export const PAY_SCALE_LABELS: Record<string, string> = {
  COLLEGE_TEACHING: 'College Teaching Staff',
  COLLEGE_NON_TEACHING: 'College Non-Teaching Staff',
  UGC: 'UGC Teaching Staff (7th Pay)',
  STATE: 'State Scale Staff',
  CONTRACT: 'Contract Staff',
  GUEST: 'Guest Faculty',
  VISITING: 'Visiting Faculty',
  DAILY_WAGE: 'Daily Wage Staff',
};

export const PAY_STRUCTURE_LABELS: Record<string, string> = {
  DBC_UGC_7TH: 'DBC UGC 7th Pay (DA 58%)',
  DBC_TEACHING_LEGACY: 'DBC Legacy Teaching (PF ₹780 cap)',
  DBC_NON_TEACHING: 'DBC Non-Teaching (Basic + Fixed Allowance)',
  UGC_SCALE: 'UGC Pay Scale (generic)',
  COLLEGE_TEACHING: 'College Teaching (generic)',
  COLLEGE_NON_TEACHING: 'College Non-Teaching (generic)',
};

export const STAFF_CATEGORY_LABELS: Record<string, string> = {
  TEACHING: 'Teaching',
  NON_TEACHING: 'Non-Teaching',
  CONTRACT: 'Contract',
  GUEST: 'Guest',
  VISITING: 'Visiting',
  ADMIN: 'Administration',
};

export const ASSIGNMENT_REASONS = [
  'New Appointment',
  'Promotion',
  'Salary Revision',
  'Annual Increment',
  'Pay Scale Migration',
  'Transfer',
  'Correction',
] as const;

export function payScaleLabel(code: string) {
  return (
    PAY_SCALE_LABELS[code] ??
    PAY_STRUCTURE_LABELS[code] ??
    code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function staffCategoryLabel(staffType: string) {
  return (
    STAFF_CATEGORY_LABELS[staffType] ??
    staffType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function defaultPayScaleForStaffType(staffType: string): (typeof PAY_SCALE_TYPES)[number] {
  switch (staffType) {
    case 'NON_TEACHING':
    case 'ADMIN':
      return 'COLLEGE_NON_TEACHING';
    case 'CONTRACT':
      return 'CONTRACT';
    case 'GUEST':
      return 'GUEST';
    case 'VISITING':
      return 'VISITING';
    default:
      return 'COLLEGE_TEACHING';
  }
}

export function formatInr(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export type SalaryPreviewLine = {
  code: string;
  name: string;
  componentType: string;
  amount: number;
};

export function summarizeSalaryPreview(lines: SalaryPreviewLine[], loanDeduction = 0) {
  let gross = 0;
  let deductions = 0;
  const earnings: SalaryPreviewLine[] = [];
  const deductionLines: SalaryPreviewLine[] = [];

  for (const line of lines) {
    if (line.componentType === 'EARNING') {
      gross += line.amount;
      earnings.push(line);
    } else {
      deductions += line.amount;
      deductionLines.push(line);
    }
  }

  if (loanDeduction > 0) {
    const existingLoan = deductionLines.find((l) => l.code.toUpperCase() === 'LOAN');
    if (existingLoan) {
      deductions += loanDeduction - existingLoan.amount;
      existingLoan.amount = loanDeduction;
    } else {
      deductions += loanDeduction;
      deductionLines.push({
        code: 'LOAN',
        name: 'Loan Deduction',
        componentType: 'DEDUCTION',
        amount: loanDeduction,
      });
    }
  }

  return {
    earnings,
    deductionLines,
    gross,
    deductions,
    net: gross - deductions,
  };
}
