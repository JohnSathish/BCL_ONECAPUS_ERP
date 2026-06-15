export type FeeHeadMaster = {
  id: string;
  code: string;
  name: string;
  amount: number;
  currency: string;
  category: string;
  sortOrder: number;
  isActive: boolean;
};

export type FeeHeadListResponse = {
  heads: FeeHeadMaster[];
  totalAmount: number;
  count: number;
};

export type AcademicFeeCycleLine = {
  id: string;
  feeHeadId: string;
  amount: number;
  sortOrder: number;
  feeHead?: FeeHeadMaster;
};

export type AcademicFeeCycle = {
  id: string;
  code: string;
  name: string;
  academicYearId?: string | null;
  programId?: string | null;
  departmentId?: string | null;
  shiftId?: string | null;
  fyugpYear?: number | null;
  startSemester: number;
  endSemester: number;
  totalAmount: number;
  currency: string;
  status: string;
  description?: string | null;
  applicableSemesters?: string;
  lines?: AcademicFeeCycleLine[];
};

export type StudentFeeCycleStatus = {
  cycleId: string;
  cycleCode: string;
  cycleName: string;
  covers: string;
  configuredAmount: number;
  status: 'PAID' | 'PARTIAL' | 'PENDING' | 'NOT_GENERATED';
  demandId: string | null;
  demandNo: string | null;
  totalAmount: number | null;
  paidAmount: number | null;
  balanceAmount: number | null;
};

export type MonthlyFeeTrackerMonth = {
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

export type MonthlyFeeTracker = {
  year: number;
  months: MonthlyFeeTrackerMonth[];
  paidMonths: number;
  pendingMonths: number;
};

export type FeePaymentHistoryRow = {
  id: string;
  transactionNo: string;
  amount: number;
  paidAt: string;
  paymentSource: string;
  paymentSourceLabel: string;
  externalReference?: string | null;
  receiptId?: string | null;
  receiptNo?: string | null;
  feeHeads: string[];
  remarks?: string | null;
};

export type FeeLedgerRow = {
  id: string;
  entryNo: string;
  entryType: string;
  postedAt: string;
  description?: string | null;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
  feeHead?: string | null;
  paymentSource?: string | null;
  paymentSourceLabel?: string | null;
};

export type ExternalFeePayment = {
  id: string;
  entryNo: string;
  studentId: string;
  paymentSource: string;
  paymentSourceLabel?: string;
  externalReference?: string | null;
  transactionDate: string;
  amount: number;
  remarks?: string | null;
  attachmentUrls: string[];
  demandIds: string[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  paymentId?: string | null;
  receiptId?: string | null;
  student?: {
    id: string;
    name: string;
    enrollmentNumber: string;
    rollNumber?: string | null;
    mobile?: string | null;
    program?: string;
    shift?: string | null;
  } | null;
};

export type StudentFeeAccount = {
  studentId: string;
  student?: {
    enrollmentNumber: string;
    rollNumber?: string | null;
    name: string;
    mobile?: string | null;
    program: string;
    shift?: string | null;
    semester?: number | null;
    status?: string;
  } | null;
  summary: {
    totalDemand: number;
    totalPaid: number;
    outstanding: number;
    overdue: number;
    totalArrears: number;
    totalDue: number;
    concessionTotal?: number;
    scholarshipTotal?: number;
    admissionOutstanding?: number;
    monthlyOutstanding?: number;
    currentDue?: number;
  };
  admissionFeeStatus?: {
    status: string;
    outstanding: number;
    paidCycles: number;
    pendingCycles: number;
    cycles: StudentFeeCycleStatus[];
  };
  monthlyFeeStatus?: {
    status: string;
    outstanding: number;
    paidMonths: number;
    pendingMonths: number;
    months: MonthlyFeeStatus[];
  };
  admissionCycles: StudentFeeCycleStatus[];
  admissionDemands?: FeeDemandRow[];
  monthlyFees: MonthlyFeeStatus[];
  monthlyTracker?: MonthlyFeeTracker;
  paymentHistory?: FeePaymentHistoryRow[];
  feeLedger?: FeeLedgerRow[];
  demands?: FeeDemandRow[];
  payableItems?: PayableFeeItem[];
  hallTicket?: { blocked: boolean; outstandingAmount: number; reasons: string[] };
  lastPayment?: { amount: number; receiptNo: string; issuedAt: string } | null;
  arrears: number;
  receipts: Array<{ id: string; receiptNo: string; amount: number; issuedAt: string }>;
  ledger?: unknown;
  collectionModes?: CollectionModesConfig;
  availablePaymentMethods?: Array<{ key: CollectionModeKey; label: string }>;
  studentPortal?: FeeFinanceSettings['studentPortal'];
  concessions?: Array<{
    id: string;
    type: string;
    schemeName: string;
    approvedAmount: number;
    calculationType: string;
    value: number;
    approvedAt?: string | Date | null;
    reason?: string | null;
  }>;
};

export type FeeDemandRow = {
  demandId: string;
  demandNo?: string;
  demandType: string;
  feeType: string;
  period?: string | null;
  periodLabel?: string;
  label: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  fineAmount: number;
  concessionAmount: number;
  dueDate?: string | null;
  status: string;
  lines?: Array<{ code: string; name: string; amount: number }>;
};

export type PayableFeeItem = {
  id: string;
  demandId: string;
  demandType?: string;
  period?: string | null;
  periodLabel?: string;
  label: string;
  amount: number;
  fineAmount: number;
  type: 'DEMAND';
};

export type MonthlyFeeStatus = {
  demandId: string;
  period: string;
  monthLabel: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: string;
};

export type CollectionModeKey =
  | 'gateway'
  | 'upi_qr'
  | 'sbi_icollect'
  | 'bank_transfer'
  | 'cash'
  | 'cheque'
  | 'dd'
  | 'scholarship'
  | 'fee_waiver';

export type CollectionModesConfig = Record<CollectionModeKey, boolean>;

export type FeeReceiptListItem = {
  id: string;
  receiptNo: string;
  amount: number;
  issuedAt: string;
  status: string;
  studentName: string;
  enrollmentNumber: string | null;
};

export type FeeFinanceSettings = {
  monthlyDueDay: number;
  lateFeeEnabled: boolean;
  lateFeeMode: string;
  lateFeeAmount: number;
  receiptPrefix: string;
  cashReceiptPrefix?: string;
  onlinePaymentEnabled: boolean;
  cashCollectionEnabled: boolean;
  collectionModes?: CollectionModesConfig;
  availablePaymentMethods?: Array<{ key: CollectionModeKey; label: string }>;
  studentPortal?: {
    onlineEnabled: boolean;
    officePaymentEnabled: boolean;
    officeMethods: string[];
    showPayAtOffice: boolean;
    showOnlineOnlyMessage: boolean;
    allowAdvanceMonthlyPayment?: boolean;
  };
  paymentRequestExpiryMinutes: number;
  officeQrEnabled: boolean;
  blockHallTicketOnDue: boolean;
  blockRegistrationOnDue: boolean;
  receiptTemplate?: 'full' | 'half' | 'thermal';
  metadata?: Record<string, unknown>;
};

export type FeePaymentRequest = {
  id: string;
  requestNo: string;
  studentId: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  channel: string;
  demandIds: string[];
  feeItems?: Array<{ demandId: string; label: string; amount: number }>;
  paymentId?: string | null;
  paymentLinkUrl?: string | null;
  qrImageUrl?: string | null;
  upiReference?: string | null;
  expiresAt: string;
  paidAt?: string | null;
  receiptId?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type PaymentRequestCheckout = {
  mode: 'LIVE' | 'MOCK';
  amount: number;
  requestNo: string;
  reference: string;
  expiresAt: string;
  qrImageUrl?: string | null;
  paymentLinkUrl?: string | null;
  orderId?: string | null;
  keyId?: string;
};

export type MonthlyFeePlan = {
  id: string;
  code: string;
  name: string;
  majorSlug?: string | null;
  status: string;
  lines?: Array<{ id?: string; code: string; name: string; amount: number }>;
};

export type ScholarshipScheme = {
  id: string;
  code: string;
  name: string;
  schemeType: string;
  calculationType: string;
  value: number;
  isActive: boolean;
};
