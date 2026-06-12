export type FeePriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'POSITIVE';

export type FeeStructure = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  billingFrequency: string;
  status: string;
  version: number;
  academicYearId?: string | null;
  semesterId?: string | null;
  streamId?: string | null;
  departmentId?: string | null;
  programVersionId?: string | null;
  shiftId?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  components?: FeeComponent[];
};

export type FeeComponent = {
  id?: string;
  code: string;
  name: string;
  category: string;
  amount: number;
  billingFrequency?: string;
  semesterNumbers?: number[];
  subjectCategories?: string[];
  practicalDependency?: boolean;
  priority?: number;
};

export type FeeDemandLine = {
  id?: string;
  code: string;
  name: string;
  category: string;
  amount: number;
  unitAmount?: number;
  quantity?: number;
  sourceType?: string;
};

export type FeeDemand = {
  id: string;
  studentId: string;
  demandNo: string;
  demandType: string;
  billingLayer: string;
  billingPeriod?: string | null;
  status: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  dueDate?: string | null;
  lines?: FeeDemandLine[];
};

export type FeeLedgerEntry = {
  id: string;
  entryNo: string;
  entryType: string;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  description?: string | null;
  postedAt: string;
};

export type FeePayment = {
  id: string;
  transactionNo: string;
  paymentMode: string;
  provider?: string | null;
  status: string;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  paidAt?: string | null;
};

export type FeeReceipt = {
  id: string;
  receiptNo: string;
  amount: number;
  status: string;
  issuedAt: string;
  qrPayload?: string | null;
};

export type FeeDashboard = {
  kpis: {
    todayCollection: number;
    outstanding: number;
    totalDemanded: number;
    totalCollected: number;
    renewalPending: number;
    concessions: number;
    receiptCount: number;
  };
  trends: { month: string; collected: number }[];
  defaulters: FeeDemand[];
};

export type FeeDemandPreview = {
  scope: Record<string, unknown>;
  studentCount: number;
  totalAmount: number;
  duplicateCount: number;
  rows: Array<{
    studentId: string;
    enrollmentNumber: string;
    studentName: string;
    totalAmount: number;
    duplicateDemand?: FeeDemand | null;
    lines: FeeDemandLine[];
  }>;
};

export type StudentFeeLedger = {
  studentId: string;
  summary: {
    openingBalance: number;
    charges: number;
    credits: number;
    closingBalance: number;
    entryCount: number;
  };
  entries: FeeLedgerEntry[];
  demands: FeeDemand[];
  payments: FeePayment[];
  receipts: FeeReceipt[];
};
