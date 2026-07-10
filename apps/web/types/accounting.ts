export type AccountingFinancialYear = {
  id: string;
  label: string;
  startYear: number;
  startDate: string;
  endDate: string;
  status: string;
  isActive: boolean;
};

export type AccountingAccountGroup = {
  id: string;
  code: string;
  name: string;
  nature: string;
  parentId?: string | null;
  sortOrder: number;
  isSystem: boolean;
  isActive: boolean;
  ledgers?: AccountingLedgerAccount[];
  currentBalance?: number;
};

export type AccountingLedgerAccount = {
  id: string;
  groupId: string;
  code: string;
  name: string;
  ledgerType: string;
  isCash: boolean;
  isBank: boolean;
  bankName?: string | null;
  accountNumber?: string | null;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  group?: AccountingAccountGroup;
};

export type AccountingVoucherType = {
  id: string;
  code: string;
  name: string;
  prefix: string;
};

export type AccountingVoucherLine = {
  id?: string;
  ledgerAccountId: string;
  entryType: 'DEBIT' | 'CREDIT';
  amount: number;
  narration?: string;
  ledgerAccount?: AccountingLedgerAccount;
};

export type AccountingVoucher = {
  id: string;
  voucherNo: string;
  voucherDate: string;
  status: string;
  narration?: string | null;
  referenceNo?: string | null;
  chequeNo?: string | null;
  paymentMode?: string | null;
  totalAmount: number;
  voucherType?: AccountingVoucherType;
  financialYear?: AccountingFinancialYear;
  lines?: AccountingVoucherLine[];
};

export type AccountingDashboardOverview = {
  financialYear: AccountingFinancialYear;
  summary: {
    todayCollection: number;
    todayCollectionChangePct: number;
    cashInHand: number;
    bankBalance: number;
    todayExpenses: number;
    outstandingReceivables: number;
    outstandingPayables: number;
    budgetUtilization: number;
    financialYearLabel: string;
  };
  charts: {
    incomeVsExpense: Array<{ label: string; income: number; expense: number }>;
    feeCollectionTrend: Array<{ label: string; amount: number }>;
    expenseDistribution: Array<{ label: string; value: number; pct: number }>;
  };
  cashPosition: {
    cash: { openingBalance: number; receipts: number; payments: number; closingBalance: number };
    bank: { openingBalance: number; receipts: number; payments: number; closingBalance: number };
  };
  feeCollection: {
    totalCollectedToday: number;
    studentsPaidToday: number;
    pendingFee: number;
    defaulters: number;
  };
  todayExpenses: Array<{ name: string; amount: number }>;
  departmentBudgets: Array<{
    id: string;
    name: string;
    allocated: number;
    spent: number;
    utilizationPct: number;
  }>;
  bankReconciliation: {
    pendingSessions: number;
    matched: number;
    unmatched: number;
  };
  approvalQueue: {
    expenseApproval: number;
    voucherApproval: number;
    vendorBills: number;
    journalApproval: number;
  };
  alerts: Array<{ level: string; title: string; message: string }>;
  recentTransactions: Array<{
    id: string;
    time: string;
    voucherNo: string;
    voucherType: string;
    ledgerName: string;
    debit: number;
    credit: number;
    narration?: string | null;
  }>;
  todayIncome: number;
  todayExpense: number;
  cashInHand: number;
  bankBalance: number;
  totalReceivables: number;
  totalPayables: number;
  monthIncome: number;
  monthExpense: number;
  fundBalance: number;
  budgetUtilization: number;
  budgetsExceeded: number;
  pendingApprovals: number;
};

export type AccountingDashboard = AccountingDashboardOverview & {
  recentTransactions?: AccountingDashboardOverview['recentTransactions'];
};

export type AccountingBook = {
  openingBalance: number;
  receipts: number;
  payments: number;
  closingBalance: number;
  entries: Array<{
    id: string;
    voucherDate: string;
    voucherNo: string;
    voucherType: string;
    entryType: string;
    amount: number;
    narration?: string | null;
    ledgerName: string;
    paymentMode?: string | null;
    chequeNo?: string | null;
    runningBalance: number;
  }>;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type AccountingSettings = {
  id: string;
  autoPostFees: boolean;
  autoPostPayroll: boolean;
  defaultCashLedgerId?: string | null;
  defaultBankLedgerId?: string | null;
  defaultIncomeLedgerId?: string | null;
  salaryExpenseLedgerId?: string | null;
  salaryPayableLedgerId?: string | null;
  payrollDeductionsLedgerId?: string | null;
};

export type AccountingVendor = {
  id: string;
  code: string;
  name: string;
  gstin?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
};

export type AccountingExpense = {
  id: string;
  expenseNo: string;
  vendorId?: string | null;
  ledgerAccountId: string;
  departmentId?: string | null;
  expenseDate: string;
  amount: number;
  gstAmount: number;
  status: string;
  description?: string | null;
  billNo?: string | null;
  vendor?: AccountingVendor | null;
  ledgerAccount?: AccountingLedgerAccount;
};

export type AccountingBudget = {
  id: string;
  financialYearId: string;
  departmentId?: string | null;
  ledgerAccountId: string;
  allocatedAmount: number;
  spent: number;
  remaining: number;
  utilizationPct: number;
  notes?: string | null;
  ledgerAccount?: AccountingLedgerAccount;
  financialYear?: AccountingFinancialYear;
};

export type AccountingFixedAsset = {
  id: string;
  code: string;
  name: string;
  category: string;
  acquisitionDate: string;
  cost: number;
  salvageValue: number;
  usefulLifeMonths: number;
  assetLedgerId: string;
  accumDepreciationLedgerId: string;
  expenseLedgerId: string;
  accumulatedDepreciation: number;
  bookValue: number;
  status: string;
  location?: string | null;
  assetLedger?: AccountingLedgerAccount;
  accumDepreciationLedger?: AccountingLedgerAccount;
  expenseLedger?: AccountingLedgerAccount;
};

export type AccountingDepreciationEntry = {
  id: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  status: string;
  postedAt?: string | null;
  asset?: AccountingFixedAsset;
  voucher?: AccountingVoucher;
};

export type AccountingBankReconciliation = {
  id: string;
  statementStartDate: string;
  statementEndDate: string;
  statementOpeningBalance: number;
  statementClosingBalance: number;
  bookOpeningBalance: number;
  bookClosingBalance: number;
  status: string;
  reconciledAt?: string | null;
  ledgerAccount?: AccountingLedgerAccount;
  lines?: AccountingBankStatementLine[];
};

export type AccountingBankStatementLine = {
  id: string;
  lineDate: string;
  description?: string | null;
  referenceNo?: string | null;
  debitAmount: number;
  creditAmount: number;
  matchStatus: string;
};

export type AccountingTrialBalanceRow = {
  ledgerId: string;
  code: string;
  name: string;
  groupName: string;
  nature: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
};

export type AccountingReportGroup = {
  groupCode: string;
  groupName: string;
  amount: number;
  ledgers: Array<{ code: string; name: string; amount: number }>;
};

export type AccountingInsights = {
  financialYear: AccountingFinancialYear;
  netProfitYtd: number;
  resultLabel: string;
  topIncome: Array<{ code: string; name: string; amount: number }>;
  topExpense: Array<{ code: string; name: string; amount: number }>;
  monthTrend: Array<{ label: string; income: number; expense: number }>;
  alerts: Array<{ level: string; message: string; count: number }>;
};

export type AccountingAuditLog = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  reason?: string | null;
  createdAt: string;
};
