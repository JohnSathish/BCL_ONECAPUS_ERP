import { api } from '@/services/api';
import { downloadBlob } from '@/utils/download-blob';

export type LoanTypeConfig = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  maxAmount?: number | null;
  defaultInstallment?: number | null;
  interestApplicable: boolean;
  interestRate?: number | null;
  isActive: boolean;
  sortOrder: number;
};

export type StaffLoanRecord = {
  id: string;
  loanNumber: string;
  loanType: string;
  principalAmount: number;
  balanceAmount: number;
  totalRecovered: number;
  monthlyDeduction: number;
  salaryDeductionAmount: number | null;
  repaymentMethod: string;
  status: string;
  paused: boolean;
  progressPercent: number;
  loanDate?: string;
  expectedCloseDate?: string | null;
  staffProfile?: {
    id: string;
    fullName: string;
    employeeCode: string;
    photoUrl?: string | null;
    department?: { name: string } | null;
    designation?: { label: string } | null;
    basicPay?: number | null;
  };
  loanTypeConfig?: { code: string; name: string } | null;
};

export type LoanDashboard = {
  totalActiveLoans: number;
  totalLoanAmountIssued: number;
  outstandingBalance: number;
  monthlyCollection: number;
  overdueLoans: number;
  loansClosingThisMonth: number;
  loanDistributionByType: Array<{ type: string; count: number; outstanding: number }>;
  departmentWise: Array<{ department: string; count: number; outstanding: number }>;
  monthlyRecoveryTrend: Array<{ month: number; year: number; amount: number }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    transactionType: string;
    paymentDate: string;
    staffName: string;
    loanNumber: string;
  }>;
  salaryDeductionLoans: number;
  cashCollectionLoans: number;
};

export async function fetchLoansDashboard(): Promise<LoanDashboard> {
  const { data } = await api.get<LoanDashboard>('/v1/loans/dashboard');
  return data;
}

export async function fetchLoanTypes(all = false): Promise<LoanTypeConfig[]> {
  const { data } = await api.get<LoanTypeConfig[]>('/v1/loans/types', {
    params: all ? { all: 'true' } : {},
  });
  return data;
}

export async function fetchLoans(params?: {
  staffProfileId?: string;
  status?: string;
  repaymentMethod?: string;
  search?: string;
}): Promise<StaffLoanRecord[]> {
  const { data } = await api.get<StaffLoanRecord[]>('/v1/loans', { params });
  return data;
}

export async function fetchLoan(id: string) {
  const { data } = await api.get(`/v1/loans/${id}`);
  return data;
}

export async function searchStaffForLoan(q: string) {
  const { data } = await api.get('/v1/loans/staff/search', { params: { q } });
  return data as Array<{
    id: string;
    fullName: string;
    employeeCode: string;
    photoUrl?: string | null;
    department?: { name: string };
    designation?: { label: string };
    basicPay?: number | null;
  }>;
}

export async function createLoan(body: {
  staffProfileId: string;
  loanTypeConfigId?: string;
  loanType: string;
  principalAmount: number;
  repaymentMethod: string;
  salaryDeductionAmount?: number;
  monthlyInstallment?: number;
  loanDate: string;
  repaymentStartDate?: string;
  expectedCloseDate?: string;
  notes?: string;
}) {
  const { data } = await api.post('/v1/loans', body);
  return data;
}

export async function recordLoanPayment(
  loanId: string,
  body: {
    amount: number;
    paymentMode: string;
    paymentDate: string;
    transactionReference?: string;
    remarks?: string;
  },
) {
  const { data } = await api.post(`/v1/loans/${loanId}/payments`, body);
  return data as {
    transaction: { id: string; receiptNumber: string; amount: number; documentUrl?: string };
    closed: boolean;
    receiptPdfUrl?: string;
    closureCertificateUrl?: string;
  };
}

export async function openLoanReceiptPdf(transactionId: string) {
  const res = await api.get(`/v1/loans/transactions/${transactionId}/receipt/pdf`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data as Blob);
  window.open(url, '_blank');
}

export async function openLoanClosureCertificate(loanId: string) {
  const res = await api.get(`/v1/loans/${loanId}/closure-certificate/pdf`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data as Blob);
  window.open(url, '_blank');
}

export async function cancelLoanReceipt(transactionId: string, reason: string) {
  const { data } = await api.post(`/v1/loans/transactions/${transactionId}/cancel`, { reason });
  return data;
}

export async function emailLoanReceipt(transactionId: string, email?: string) {
  const { data } = await api.post(`/v1/loans/transactions/${transactionId}/email`, { email });
  return data as { sent: boolean; message: string; pdfPath?: string };
}

export async function fetchReceiptRegister(params?: { from?: string; to?: string }) {
  const { data } = await api.get('/v1/loans/reports/receipt-register', { params });
  return data;
}

export async function fetchMonthlyCollection(month: number, year: number) {
  const { data } = await api.get('/v1/loans/reports/monthly-collection', {
    params: { month, year },
  });
  return data;
}

export async function fetchLoanClosures() {
  const { data } = await api.get('/v1/loans/reports/closures');
  return data;
}

export async function exportReceiptRegister() {
  const res = await api.get('/v1/loans/reports/receipt-register/export', { responseType: 'blob' });
  downloadBlob(res.data as Blob, 'loan-receipt-register.xlsx');
}

export async function restructureLoan(
  loanId: string,
  body: {
    salaryDeductionAmount?: number;
    monthlyInstallment?: number;
    repaymentMethod?: string;
    paused?: boolean;
    expectedCloseDate?: string;
    remarks?: string;
  },
) {
  const { data } = await api.patch(`/v1/loans/${loanId}/restructure`, body);
  return data;
}

export async function createLoanType(body: Partial<LoanTypeConfig>) {
  const { data } = await api.post('/v1/loans/types', body);
  return data;
}

export async function exportLoanRegister() {
  const res = await api.get('/v1/loans/reports/register/export', { responseType: 'blob' });
  downloadBlob(res.data as Blob, 'loan-register.xlsx');
}

export async function fetchLoanRegister() {
  const { data } = await api.get('/v1/loans/reports/register');
  return data;
}
