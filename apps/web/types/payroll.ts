export type PaySalaryComponent = {
  id: string;
  code: string;
  name: string;
  componentType: string;
  category: string;
  isStatutory: boolean;
  sortOrder: number;
  isActive: boolean;
};

export type PayStructureTemplate = {
  id: string;
  code: string;
  name: string;
  structureType: string;
  payScaleTypes: string[];
  status: string;
  components?: Array<{
    id: string;
    formulaJson: Record<string, unknown>;
    paySalaryComponent: PaySalaryComponent;
  }>;
};

export type StaffPayAssignment = {
  id: string;
  staffProfileId: string;
  payScaleType: string;
  basicPay: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  notes?: string | null;
  staffProfile?: {
    fullName: string;
    employeeCode: string;
    staffType: string;
    photoUrl?: string | null;
    mobile?: string | null;
    basicPay?: number | null;
    designation?: { id: string; label: string } | null;
    department?: { id: string; name: string } | null;
  };
  payStructureTemplate?: { id?: string; code: string; name: string; structureType: string };
  componentOverrides?: Record<string, unknown> | null;
};

export type PayAssignmentStats = {
  totalAssigned: number;
  teachingStaff: number;
  nonTeachingStaff: number;
  ugcScaleStaff: number;
  stateScaleStaff: number;
  contractStaff: number;
  collegeTeachingStaff: number;
  collegeNonTeachingStaff: number;
  byPayScale: Array<{ payScaleType: string; count: number }>;
};

export type PayrollRun = {
  id: string;
  month: number;
  year: number;
  payScaleType: string | null;
  label: string | null;
  status: string;
  locked: boolean;
  employeeCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  paidAt?: string | null;
};

export type Payslip = {
  id: string;
  month: number;
  year: number;
  payScaleType: string;
  grossSalary: number;
  totalDeductions: number;
  netSalary: number;
  status: string;
  pdfPath: string | null;
  emailSentAt?: string | null;
  payrollRunId?: string;
  payrollRun?: { id: string; status: string; paidAt: string | null; payScaleType: string | null };
  staffProfile?: {
    id?: string;
    fullName: string;
    employeeCode: string;
    photoUrl?: string | null;
    staffType?: string;
    mobile?: string | null;
    email?: string | null;
    department?: { id: string; name: string } | null;
    designation?: { id: string; label: string } | null;
  };
};

export type PayslipStats = {
  totalCount: number;
  teachingCount: number;
  teachingGross: number;
  teachingNet: number;
  nonTeachingCount: number;
  nonTeachingGross: number;
  nonTeachingNet: number;
  grossTotal: number;
  deductionsTotal: number;
  netTotal: number;
  pendingCount: number;
  publishedCount: number;
  paidCount: number;
  cancelledCount: number;
};

export type PayslipAnalytics = {
  monthlyPayrollTrend: Array<{
    label: string;
    month: number;
    year: number;
    value: number;
    employeeCount: number;
  }>;
  departmentWise: Array<{ label: string; value: number }>;
  teachingVsNonTeaching: Array<{ label: string; value: number }>;
  loanRecovery: number;
  pfContribution: { employer: number; employee: number; total: number };
};

export type PayslipListParams = {
  month?: number;
  year?: number;
  status?: string;
  payScaleType?: string;
  departmentId?: string;
  staffType?: string;
  search?: string;
  payrollRunId?: string;
  staffProfileId?: string;
  fromMonth?: number;
  fromYear?: number;
  toMonth?: number;
  toYear?: number;
  financialYear?: number;
  periodPreset?: 'current' | '3m' | '6m' | '12m' | 'fy' | 'custom';
};

export type EmployeePayslipHistory = {
  staff: {
    id: string;
    fullName: string;
    employeeCode: string;
    photoUrl?: string | null;
    department?: { name: string } | null;
    designation?: { label: string } | null;
  };
  payslips: Array<{
    id: string;
    month: number;
    year: number;
    label: string;
    grossSalary: number;
    totalDeductions: number;
    netSalary: number;
    status: string;
    paidAt: string | null;
    pdfPath: string | null;
  }>;
  totals: { gross: number; net: number; deductions: number };
  periodCount: number;
};

export type StaffLoan = {
  id: string;
  loanNumber: string;
  loanType: string;
  principalAmount: number;
  monthlyDeduction: number;
  balanceAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  status: string;
  staffProfile?: { fullName: string; employeeCode: string };
};

export type HrExecutiveDashboard = {
  totalStaff: number;
  teachingStaff: number;
  nonTeachingStaff: number;
  contractStaff: number;
  guestFaculty: number;
  staffOnLeaveToday: number;
  newJoinings: number;
  retiringSoon: number;
  payrollDue: number;
  activeLoans: number;
  loanOutstanding: number;
  monthlyPayrollCost: number;
  departmentStrength: Array<{ label: string; value: number }>;
  genderDistribution: Array<{ label: string; value: number }>;
  salaryCostByDepartment: Array<{ label: string; value: number }>;
  ageDistribution: Array<{ label: string; value: number }>;
  experienceDistribution: Array<{ label: string; value: number }>;
  staffByPayScale: Array<{ label: string; value: number }>;
  monthlyPayrollTrend: Array<{
    label: string;
    month: number;
    year: number;
    value: number;
    employeeCount: number;
  }>;
};

export type PayrollDashboard = {
  totalEmployees: number;
  staffByType: Array<{ staffType: string; count: number }>;
  staffByPayScale: Array<{ payScaleType: string; count: number }>;
  monthlyPayrollCost: number;
  yearlyPayrollCost: number;
  loanOutstanding: number;
  activeLoans: number;
  pfLiability: number;
  salaryTrend: Array<{ month: number; year: number; totalNet: number; employeeCount: number }>;
};

export const PAY_SCALE_TYPES = [
  'COLLEGE_TEACHING',
  'COLLEGE_NON_TEACHING',
  'UGC',
  'STATE',
  'CONTRACT',
  'GUEST',
  'VISITING',
  'DAILY_WAGE',
] as const;
