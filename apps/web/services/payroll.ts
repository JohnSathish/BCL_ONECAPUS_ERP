import { api } from '@/services/api';
import type {
  HrExecutiveDashboard,
  PayAssignmentStats,
  PaySalaryComponent,
  PayStructureTemplate,
  PayrollDashboard,
  PayrollRun,
  Payslip,
  PayslipAnalytics,
  PayslipListParams,
  PayslipStats,
  EmployeePayslipHistory,
  StaffLoan,
  StaffPayAssignment,
} from '@/types/payroll';
import { downloadBlob } from '@/utils/download-blob';

export async function fetchHrExecutiveDashboard(): Promise<HrExecutiveDashboard> {
  const { data } = await api.get<HrExecutiveDashboard>('/v1/payroll/dashboard/executive');
  return data;
}

export async function fetchPayrollDashboard(): Promise<PayrollDashboard> {
  const { data } = await api.get<PayrollDashboard>('/v1/payroll/dashboard');
  return data;
}

export async function fetchPaySalaryComponents(type?: string): Promise<PaySalaryComponent[]> {
  const { data } = await api.get<PaySalaryComponent[]>('/v1/payroll/components', {
    params: { type },
  });
  return data;
}

export async function fetchPayStructures(structureType?: string): Promise<PayStructureTemplate[]> {
  const { data } = await api.get<PayStructureTemplate[]>('/v1/payroll/structures', {
    params: { structureType },
  });
  return data;
}

export async function fetchPayStructure(id: string): Promise<PayStructureTemplate> {
  const { data } = await api.get<PayStructureTemplate>(`/v1/payroll/structures/${id}`);
  return data;
}

export async function previewPayStructure(
  id: string,
  basicPay: number,
  componentOverrides?: Record<string, unknown>,
) {
  const { data } = await api.post<unknown[]>(`/v1/payroll/structures/${id}/preview`, {
    basicPay,
    componentOverrides,
  });
  return data;
}

export async function previewFormula(body: {
  basicPay: number;
  formulaJson: object;
  context?: Record<string, number>;
}) {
  const { data } = await api.post<{ amount: number; trace: unknown }>(
    '/v1/payroll/formula/preview',
    body,
  );
  return data;
}

export async function previewProfessionalTax(grossSalary: number, month: number) {
  const { data } = await api.get<{
    grossSalary: number;
    month: number;
    state?: string;
    amount: number;
    doubled: boolean;
    matchedSlab: { minGross: number; maxGross?: number; amount: number } | null;
  }>('/v1/payroll/professional-tax/preview', { params: { grossSalary, month } });
  return data;
}

export async function fetchPayAssignmentStats(): Promise<PayAssignmentStats> {
  const { data } = await api.get<PayAssignmentStats>('/v1/payroll/assignments/stats');
  return data;
}

export async function fetchPayAssignments(params?: {
  staffProfileId?: string;
  departmentId?: string;
  staffType?: string;
  designationId?: string;
  payScaleType?: string;
  status?: string;
  search?: string;
}): Promise<StaffPayAssignment[]> {
  const { data } = await api.get<StaffPayAssignment[]>('/v1/payroll/assignments', { params });
  return data;
}

export async function createPayAssignment(body: {
  staffProfileId: string;
  payStructureTemplateId: string;
  payScaleType: string;
  basicPay: number;
  effectiveFrom: string;
  notes?: string;
  pfExempt?: boolean;
  houseRent?: number;
  cpfRate?: number;
  fixedAllowance?: number;
  componentOverrides?: Record<string, unknown>;
}) {
  const { data } = await api.post('/v1/payroll/assignments', body);
  return data;
}

export async function updatePayAssignmentStatutory(
  id: string,
  body: { pfExempt?: boolean; houseRent?: number; cpfRate?: number; fixedAllowance?: number },
) {
  const { data } = await api.patch(`/v1/payroll/assignments/${id}/statutory`, body);
  return data;
}

export async function bulkCreatePayAssignments(body: {
  payStructureTemplateId: string;
  payScaleType: string;
  effectiveFrom: string;
  basicPay?: number;
  notes?: string;
  departmentId?: string;
  staffType?: string;
  staffProfileIds?: string[];
}) {
  const { data } = await api.post<{ created: number; skipped: number; total: number }>(
    '/v1/payroll/assignments/bulk',
    body,
  );
  return data;
}

export async function archivePayAssignment(id: string) {
  const { data } = await api.patch(`/v1/payroll/assignments/${id}/archive`);
  return data;
}

export async function backfillPayAssignments() {
  const { data } = await api.post('/v1/payroll/assignments/backfill');
  return data;
}

export async function fetchPayrollRuns(params?: {
  month?: number;
  year?: number;
  payScaleType?: string;
}) {
  const { data } = await api.get<PayrollRun[]>('/v1/payroll/runs', { params });
  return data;
}

export async function createPayrollRun(body: {
  month: number;
  year: number;
  payScaleType?: string;
  label?: string;
}) {
  const { data } = await api.post<PayrollRun>('/v1/payroll/runs', body);
  return data;
}

export async function getPayrollRun(id: string) {
  const { data } = await api.get<PayrollRun & { payslips: unknown[] }>(`/v1/payroll/runs/${id}`);
  return data;
}

export async function calculatePayrollRun(id: string) {
  const { data } = await api.post(`/v1/payroll/runs/${id}/calculate`);
  return data;
}

export async function verifyPayrollRun(id: string) {
  const { data } = await api.post(`/v1/payroll/runs/${id}/verify`);
  return data;
}

export async function approvePayrollRun(id: string) {
  const { data } = await api.post(`/v1/payroll/runs/${id}/approve`);
  return data;
}

export async function publishPayrollRun(id: string) {
  const { data } = await api.post(`/v1/payroll/runs/${id}/publish`);
  return data;
}

export async function reopenPayrollRun(id: string) {
  const { data } = await api.post(`/v1/payroll/runs/${id}/reopen`);
  return data;
}

export async function fetchPayslips(params?: PayslipListParams) {
  const { data } = await api.get<Payslip[]>('/v1/payroll/payslips', { params });
  return data;
}

export async function fetchPayslipStats(params?: PayslipListParams) {
  const { data } = await api.get<PayslipStats>('/v1/payroll/payslips/stats', { params });
  return data;
}

export async function fetchPayslipAnalytics(params?: PayslipListParams) {
  const { data } = await api.get<PayslipAnalytics>('/v1/payroll/payslips/analytics', { params });
  return data;
}

export async function regeneratePayslip(payslipId: string) {
  const { data } = await api.post(`/v1/payroll/payslips/${payslipId}/regenerate`);
  return data;
}

export async function regenerateAllPayslips(params?: PayslipListParams) {
  const { data } = await api.post('/v1/payroll/payslips/regenerate', null, { params });
  return data;
}

export async function emailPayslip(payslipId: string) {
  const { data } = await api.post(`/v1/payroll/payslips/${payslipId}/email`);
  return data;
}

export async function downloadPayslipsZip(params?: PayslipListParams) {
  const res = await api.get('/v1/payroll/payslips/download-zip', { params, responseType: 'blob' });
  downloadBlob(res.data, 'payslips.zip');
}

export async function fetchEmployeePayslipHistory(staffProfileId: string) {
  const { data } = await api.get<EmployeePayslipHistory>(
    `/v1/payroll/payslips/employee/${staffProfileId}/history`,
  );
  return data;
}

export async function downloadMergedPayslips(
  params: PayslipListParams,
  filename = 'payslips-merged.pdf',
) {
  const res = await api.get('/v1/payroll/payslips/merged-pdf', { params, responseType: 'blob' });
  downloadBlob(res.data, filename);
}

export async function downloadEmployeeMergedPayslips(
  staffProfileId: string,
  params: PayslipListParams,
) {
  const res = await api.get(`/v1/payroll/payslips/employee/${staffProfileId}/merged-pdf`, {
    params,
    responseType: 'blob',
  });
  downloadBlob(res.data, `payslips-${staffProfileId}.pdf`);
}

export async function downloadSalaryCertificate(staffProfileId: string, financialYear?: number) {
  const res = await api.get(`/v1/payroll/payslips/employee/${staffProfileId}/salary-certificate`, {
    params: financialYear ? { financialYear } : undefined,
    responseType: 'blob',
  });
  downloadBlob(res.data, 'salary-certificate.pdf');
}

export async function downloadMyMergedPayslips(params: PayslipListParams) {
  const res = await api.get('/v1/staff/me/payroll/payslips/merged-pdf', {
    params,
    responseType: 'blob',
  });
  downloadBlob(res.data, 'my-payslips.pdf');
}

export async function downloadMyPayslipsZip(params: PayslipListParams) {
  const res = await api.get('/v1/staff/me/payroll/payslips/download-zip', {
    params,
    responseType: 'blob',
  });
  downloadBlob(res.data, 'my-payslips.zip');
}

export async function downloadMySalaryCertificate(financialYear?: number) {
  const res = await api.get('/v1/staff/me/payroll/salary-certificate/pdf', {
    params: financialYear ? { financialYear } : undefined,
    responseType: 'blob',
  });
  downloadBlob(res.data, 'salary-certificate.pdf');
}

export async function fetchStaffLoans(staffProfileId?: string, status?: string) {
  const { data } = await api.get<StaffLoan[]>('/v1/payroll/loans', {
    params: { staffProfileId, status },
  });
  return data;
}

export async function createStaffLoan(body: {
  staffProfileId: string;
  loanType: string;
  principalAmount: number;
  monthlyDeduction: number;
  startDate: string;
}) {
  const { data } = await api.post('/v1/payroll/loans', body);
  return data;
}

export async function fetchPfCpfEntries(params?: {
  month?: number;
  year?: number;
  staffProfileId?: string;
}) {
  const { data } = await api.get('/v1/payroll/pf-cpf', { params });
  return data;
}

export type StaffPfConfigRecord = {
  id: string | null;
  staffProfileId: string;
  pfEnabled: boolean;
  employeePfApplicable: boolean;
  employerPfApplicable: boolean;
  pfScheme: string;
  pfSchemeLabel?: string;
  employeePfAmount: number | null;
  employerPfAmount: number | null;
  pfAccountNumber: string | null;
  uanNumber: string | null;
  effectiveFrom: string;
  remarks: string | null;
  updatedAt: string | null;
};

export type StaffPfHistoryEntry = {
  id: string;
  action: string;
  snapshot: Record<string, unknown>;
  effectiveFrom: string | null;
  createdAt: string;
};

export async function fetchStaffPfConfig(staffProfileId: string) {
  const { data } = await api.get<{ staff: { fullName: string }; config: StaffPfConfigRecord }>(
    `/v1/payroll/pf-config/staff/${staffProfileId}`,
  );
  return data;
}

export async function fetchStaffPfHistory(staffProfileId: string) {
  const { data } = await api.get<StaffPfHistoryEntry[]>(
    `/v1/payroll/pf-config/staff/${staffProfileId}/history`,
  );
  return data;
}

export async function upsertStaffPfConfig(
  staffProfileId: string,
  body: {
    pfEnabled: boolean;
    employeePfApplicable?: boolean;
    employerPfApplicable?: boolean;
    pfScheme?: string;
    employeePfAmount?: number | null;
    employerPfAmount?: number | null;
    pfAccountNumber?: string | null;
    uanNumber?: string | null;
    effectiveFrom: string;
    remarks?: string | null;
  },
) {
  const { data } = await api.post<StaffPfConfigRecord>(
    `/v1/payroll/pf-config/staff/${staffProfileId}`,
    body,
  );
  return data;
}

export async function bulkUpdateStaffPfConfig(body: {
  staffProfileIds: string[];
  pfEnabled?: boolean;
  employeePfApplicable?: boolean;
  employerPfApplicable?: boolean;
  pfScheme?: string;
  employeePfAmount?: number | null;
  employerPfAmount?: number | null;
  effectiveFrom?: string;
  remarks?: string | null;
}) {
  const { data } = await api.post<{ total: number; updated: number; failed: number }>(
    '/v1/payroll/pf-config/bulk',
    body,
  );
  return data;
}

export async function fetchPfEnrolledReport(params?: {
  departmentId?: string;
  payScaleType?: string;
}) {
  const { data } = await api.get<{ count: number; rows: unknown[] }>(
    '/v1/payroll/pf-config/reports/enrolled',
    { params },
  );
  return data;
}

export async function fetchPfExemptReport(params?: {
  departmentId?: string;
  payScaleType?: string;
}) {
  const { data } = await api.get<{ count: number; rows: unknown[] }>(
    '/v1/payroll/pf-config/reports/exempt',
    { params },
  );
  return data;
}

export async function fetchPfMonthlyReport(month: number, year: number) {
  const { data } = await api.get<{
    count: number;
    totalEmployee: number;
    totalEmployer: number;
    totalDeposit: number;
    rows: unknown[];
  }>('/v1/payroll/pf-config/reports/monthly', { params: { month, year } });
  return data;
}

export async function fetchPfByDepartment(month: number, year: number) {
  const { data } = await api.get<unknown[]>('/v1/payroll/pf-config/reports/by-department', {
    params: { month, year },
  });
  return data;
}

export async function fetchPfByPayStructure(month: number, year: number) {
  const { data } = await api.get<unknown[]>('/v1/payroll/pf-config/reports/by-pay-structure', {
    params: { month, year },
  });
  return data;
}

export async function fetchPfRegister(month: number, year: number) {
  const { data } = await api.get<{
    summary: {
      enrolledStaff: number;
      exemptStaff: number;
      contributingThisMonth: number;
      totalEmployeeContribution: number;
      totalEmployerContribution: number;
      totalPfDeposit: number;
    };
    contributions: unknown[];
  }>('/v1/payroll/pf-config/reports/register', { params: { month, year } });
  return data;
}

export async function fetchSalaryRevisions(staffProfileId?: string) {
  const { data } = await api.get('/v1/payroll/revisions', { params: { staffProfileId } });
  return data;
}

export async function fetchIncrementBatches() {
  const { data } = await api.get('/v1/payroll/increments');
  return data;
}

export async function createIncrementBatch(body: {
  name: string;
  incrementType: string;
  incrementValue: number;
  effectiveFrom: string;
  filterJson?: Record<string, unknown>;
}) {
  const { data } = await api.post('/v1/payroll/increments', body);
  return data;
}

export async function applyIncrementBatch(id: string) {
  const { data } = await api.post(`/v1/payroll/increments/${id}/apply`);
  return data;
}

export async function previewIncrementBatch(id: string) {
  const { data } = await api.get(`/v1/payroll/increments/${id}/preview`);
  return data as {
    batch: {
      id: string;
      name: string;
      incrementType: string;
      incrementValue: number;
      effectiveFrom: string;
      status: string;
    };
    rows: Array<{
      staffProfileId: string;
      staffName: string;
      employeeCode: string;
      department: string;
      designation: string;
      previousBasicPay: number;
      newBasicPay: number;
      change: number;
    }>;
    summary: { staffCount: number; totalIncrease: number };
  };
}

export async function markPayrollRunPaid(id: string) {
  const { data } = await api.post(`/v1/payroll/runs/${id}/mark-paid`);
  return data;
}

export async function fetchBankTransferData(runId: string) {
  const { data } = await api.get('/v1/payroll/reports/bank-file', { params: { runId } });
  return data;
}

export async function exportBankTransferFile(runId: string, format: 'xlsx' | 'csv' = 'xlsx') {
  const res = await api.get('/v1/payroll/reports/bank-file/export', {
    params: { runId, format },
    responseType: 'blob',
  });
  downloadBlob(res.data as Blob, `bank-transfer.${format === 'csv' ? 'csv' : 'xlsx'}`);
}

export async function openPayslipPdf(payslipId: string) {
  const res = await api.get(`/v1/payroll/payslips/${payslipId}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  window.open(url, '_blank');
}

export async function addPayslipAdjustment(
  runId: string,
  body: {
    staffProfileId: string;
    label: string;
    adjustmentType: 'EARNING' | 'DEDUCTION';
    amount: number;
    notes?: string;
  },
) {
  const { data } = await api.post(`/v1/payroll/runs/${runId}/adjustments`, body);
  return data;
}

export async function applyArrearToRun(arrearBatchId: string, runId: string) {
  const { data } = await api.post(`/v1/payroll/arrears/${arrearBatchId}/apply/${runId}`);
  return data;
}

export async function createSalaryRevision(body: {
  staffPayAssignmentId: string;
  revisionType: string;
  newBasicPay: number;
  effectiveFrom: string;
  notes?: string;
}) {
  const { data } = await api.post('/v1/payroll/revisions', body);
  return data;
}

export async function fetchPayrollAuditLogs(params?: { entityType?: string; entityId?: string }) {
  const { data } = await api.get('/v1/payroll/audit-logs', { params });
  return data;
}

export async function updatePayStructure(
  id: string,
  body: {
    name?: string;
    description?: string;
    components?: Array<{ paySalaryComponentId: string; formulaJson: object; sortOrder?: number }>;
  },
) {
  const { data } = await api.patch(`/v1/payroll/structures/${id}`, body);
  return data;
}

export async function fetchRunExclusions(runId: string) {
  const { data } = await api.get(`/v1/payroll/runs/${runId}/exclusions`);
  return data;
}

export async function excludeStaffFromRun(runId: string, staffProfileId: string, reason?: string) {
  const { data } = await api.post(`/v1/payroll/runs/${runId}/exclusions`, {
    staffProfileId,
    reason,
  });
  return data;
}

export async function includeStaffInRun(runId: string, staffProfileId: string) {
  const { data } = await api.delete(`/v1/payroll/runs/${runId}/exclusions/${staffProfileId}`);
  return data;
}

export async function fetchRunAdjustments(runId: string) {
  const { data } = await api.get(`/v1/payroll/runs/${runId}/adjustments`);
  return data;
}

export async function removePayslipAdjustment(adjustmentId: string) {
  const { data } = await api.delete(`/v1/payroll/adjustments/${adjustmentId}`);
  return data;
}

export async function fetchArrearBatches() {
  const { data } = await api.get('/v1/payroll/arrears');
  return data;
}

export async function fetchPayrollSettings() {
  const { data } = await api.get('/v1/payroll/settings');
  return data;
}

export async function updatePayrollSettings(body: Record<string, unknown>) {
  const { data } = await api.patch('/v1/payroll/settings', body);
  return data;
}

export async function exportSalaryRegister(runId: string) {
  const res = await api.get(`/v1/payroll/reports/salary-register`, {
    params: { runId },
    responseType: 'blob',
  });
  downloadBlob(res.data, 'salary-register.xlsx');
}

export async function exportBulkSalarySheet(
  runId: string,
  payScaleType: string,
  layoutKey?: string,
) {
  const res = await api.get(`/v1/payroll/reports/bulk-sheet`, {
    params: { runId, payScaleType, ...(layoutKey ? { layoutKey } : {}) },
    responseType: 'blob',
  });
  downloadBlob(res.data, `${layoutKey ?? payScaleType}-salary.xlsx`);
}

export async function fetchDepartmentWiseSalary(month: number, year: number) {
  const { data } = await api.get('/v1/payroll/reports/department-wise', {
    params: { month, year },
  });
  return data;
}

export async function fetchBankFileScaffold(bank: string) {
  const { data } = await api.get('/v1/payroll/reports/bank-file', { params: { bank } });
  return data;
}

// Staff portal
export async function fetchMyPayslips() {
  const { data } = await api.get<Payslip[]>('/v1/staff/me/payroll/payslips');
  return data;
}

export async function fetchMyLoans() {
  const { data } = await api.get<StaffLoan[]>('/v1/staff/me/payroll/loans');
  return data;
}

export async function fetchMyPfSummary() {
  const { data } = await api.get('/v1/staff/me/payroll/pf-summary');
  return data;
}

export async function downloadMyPayslipPdf(id: string) {
  const res = await api.get(`/v1/staff/me/payroll/payslips/${id}/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data as Blob);
  window.open(url, '_blank');
}

export async function fetchMySalaryHistory() {
  const { data } = await api.get<{
    currentAssignment: {
      basicPay: number;
      payScaleType: string;
      effectiveFrom: string;
      structureName: string | null;
    } | null;
    revisions: Array<{
      id: string;
      revisionType: string;
      effectiveFrom: string;
      previousBasicPay: number | null;
      newBasicPay: number | null;
      notes: string | null;
    }>;
    payslipTimeline: Array<{
      id: string;
      label: string;
      month: number;
      year: number;
      grossSalary: number;
      netSalary: number;
      totalDeductions: number;
      emailSentAt: string | null;
      paidAt: string | null;
    }>;
  }>('/v1/staff/me/payroll/salary-history');
  return data;
}

export async function fetchMyTaxSummary(year?: number) {
  const { data } = await api.get<{
    year: number;
    ytdGross: number;
    ytdNet: number;
    ytdTds: number;
    ytdProfessionalTax: number;
    monthsWithPayslips: number;
    monthlyBreakdown: Array<{
      month: number;
      label: string;
      gross: number;
      net: number;
      tds: number;
      professionalTax: number;
    }>;
    form16Available: boolean;
    projectedAnnualTax: number;
    projectedMonthlyTds: number;
    note: string;
  }>('/v1/staff/me/payroll/tax-summary', { params: year ? { year } : {} });
  return data;
}

export async function emailPayrollRunPayslips(runId: string) {
  const { data } = await api.post<{ sent: number; skipped: number; failed: number; total: number }>(
    `/v1/payroll/runs/${runId}/email-payslips`,
  );
  return data;
}

export async function previewTds(monthlyGross: number) {
  const { data } = await api.get('/v1/payroll/tds/preview', { params: { monthlyGross } });
  return data as {
    monthlyTaxableGross: number;
    annualGross: number;
    taxableAfterDeduction: number;
    annualTax: number;
    monthlyTds: number;
    regime: string;
  };
}
