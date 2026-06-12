export const LOAN_REPAYMENT_METHODS = [
  'SALARY_DEDUCTION',
  'CASH',
  'BANK_TRANSFER',
  'UPI',
  'CHEQUE',
  'MIXED',
] as const;

export type LoanRepaymentMethod = (typeof LOAN_REPAYMENT_METHODS)[number];

export const LOAN_PAYMENT_TYPES = [
  'SALARY_DEDUCTION',
  'CASH',
  'BANK_TRANSFER',
  'UPI',
  'CHEQUE',
] as const;

export const LOAN_STATUSES = [
  'ACTIVE',
  'PAUSED',
  'CLOSED',
  'COMPLETED',
] as const;

export const DEFAULT_LOAN_TYPES = [
  {
    code: 'WELFARE',
    name: 'Staff Welfare Loan',
    defaultInstallment: 5000,
    maxAmount: 500000,
  },
  {
    code: 'EMERGENCY',
    name: 'Emergency Loan',
    defaultInstallment: 3000,
    maxAmount: 100000,
  },
  {
    code: 'MEDICAL',
    name: 'Medical Loan',
    defaultInstallment: 5000,
    maxAmount: 200000,
  },
  {
    code: 'SALARY_ADVANCE',
    name: 'Salary Advance',
    defaultInstallment: 2000,
    maxAmount: 50000,
  },
  {
    code: 'FESTIVAL',
    name: 'Festival Advance',
    defaultInstallment: 5000,
    maxAmount: 100000,
  },
  {
    code: 'VEHICLE',
    name: 'Vehicle Loan',
    defaultInstallment: 10000,
    maxAmount: 1000000,
  },
  {
    code: 'EDUCATION',
    name: 'Education Loan',
    defaultInstallment: 5000,
    maxAmount: 300000,
  },
] as const;

export function usesSalaryDeduction(method: string): boolean {
  return method === 'SALARY_DEDUCTION' || method === 'MIXED';
}

export function usesManualPayment(method: string): boolean {
  return ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'MIXED'].includes(method);
}
