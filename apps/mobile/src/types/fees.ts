export type PayableFeeItem = {
  id: string;
  demandId: string;
  label: string;
  amount: number;
  fineAmount: number;
  type: 'DEMAND';
  periodLabel?: string | null;
  demandType?: string | null;
};

export type MonthlyTrackerMonth = {
  period: string;
  month: number;
  shortLabel: string;
  label: string;
  status: 'PAID' | 'PENDING' | 'NOT_GENERATED';
  demandId: string | null;
  amount: number | null;
  balanceAmount: number | null;
  payable: boolean;
};

export type MonthlyTracker = {
  year: number;
  months: MonthlyTrackerMonth[];
  paidMonths: number;
  pendingMonths: number;
};

export type AdmissionCycleStatus = {
  cycleId: string;
  cycleName: string;
  covers: string;
  configuredAmount: number;
  status: 'PAID' | 'PARTIAL' | 'PENDING' | 'NOT_GENERATED';
  demandId: string | null;
  totalAmount: number | null;
  balanceAmount: number | null;
};

export type PaymentHistoryRow = {
  id: string;
  amount: number;
  paidAt: string;
  paymentSourceLabel: string;
  feeHeads: string[];
  receiptNo?: string | null;
};

export type StudentFeeAccount = {
  studentId: string;
  summary: {
    totalDemand: number;
    totalPaid: number;
    outstanding: number;
    overdue: number;
    totalDue?: number;
    currentDue?: number;
    admissionOutstanding?: number;
    monthlyOutstanding?: number;
  };
  admissionFeeStatus?: { status: string; outstanding: number };
  monthlyFeeStatus?: {
    status: string;
    outstanding: number;
    paidMonths: number;
    pendingMonths: number;
  };
  admissionCycles?: AdmissionCycleStatus[];
  monthlyTracker?: MonthlyTracker;
  paymentHistory?: PaymentHistoryRow[];
  payableItems?: PayableFeeItem[];
  receipts: Array<{ id: string; receiptNo: string; amount: number; issuedAt: string }>;
  studentPortal?: {
    onlineEnabled: boolean;
    officePaymentEnabled: boolean;
    officeMethods: string[];
    showPayAtOffice: boolean;
    showOnlineOnlyMessage: boolean;
    allowAdvanceMonthlyPayment?: boolean;
  };
};

export type FeeFinanceSettings = {
  onlinePaymentEnabled: boolean;
};

export type PaymentCheckout = {
  provider: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId?: string;
  mode: 'LIVE' | 'SAFE_MOCK';
  paymentId?: string;
};

export type InitiatePaymentResponse = {
  payment: { id: string; transactionNo: string; amount: number };
  checkout: PaymentCheckout;
};
