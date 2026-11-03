export type CirculationReportKey =
  | 'all'
  | 'issued'
  | 'renewed'
  | 'returned'
  | 'current'
  | 'overdue'
  | 'late'
  | 'borrower'
  | 'departments'
  | 'librarians'
  | 'lost-damaged';

export type CirculationFilters = {
  report?: CirculationReportKey;
  from?: string;
  to?: string;
  academicYearId?: string;
  semester?: number;
  departmentId?: string;
  memberType?: string;
  borrower?: string;
  memberId?: string;
  bookTitle?: string;
  accession?: string;
  type?: 'ISSUE' | 'RENEW' | 'RETURN';
  status?: string;
  processedById?: string;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  limit?: number;
};

export type CirculationRange = { from: string; to: string; asOf: string };

export type CirculationOptions = {
  departments: { id: string; name: string }[];
  academicYears: { id: string; name: string; startDate: string; endDate: string; status: string }[];
  processors: { id: string; name: string }[];
  memberTypes: { value: string; label: string }[];
};

export type CirculationSummary = {
  range: CirculationRange;
  totalIssues: number;
  issuedCopies: number;
  totalRenewals: number;
  renewedCopies: number;
  totalReturns: number;
  returnedCopies: number;
  currentlyBorrowed: number;
  overdue: number;
  lateReturns: number;
  todayIssues: number;
  todayReturns: number;
};

export type CirculationTransactionRow = {
  id: string;
  transactionId: string;
  occurredAt: string;
  type: 'ISSUE' | 'RENEW' | 'RETURN';
  typeLabel: string;
  accession: string;
  title: string;
  author: string | null;
  department: string | null;
  borrowerName: string | null;
  borrowerCode: string | null;
  memberType: string;
  memberTypeLabel: string;
  semester: number | null;
  issuedAt: string;
  dueAt: string | null;
  currentDueAt: string;
  previousDueAt: string | null;
  renewalCount: number;
  returnedAt: string | null;
  returnedByType: string | null;
  returnedByTypeLabel: string | null;
  returnedByName: string | null;
  returnedByCode: string | null;
  processedBy: string | null;
  bookCondition: string | null;
  daysLate: number | null;
  isLate: boolean;
  fineAmount: number | null;
  fineStatus: string;
  fineStatusLabel: string;
  status: string;
  statusLabel: string;
  remarks: string | null;
  source: string;
  receiptNo: string | null;
};

export type CirculationLoanRow = {
  id: string;
  receiptNo: string | null;
  accession: string;
  title: string;
  author: string | null;
  borrowerName: string | null;
  borrowerCode: string | null;
  department: string | null;
  semester: number | null;
  memberType: string;
  memberTypeLabel: string;
  mobile: string | null;
  issuedAt: string;
  dueAt: string;
  renewalCount: number;
  overdueDays: number;
  isOverdue: boolean;
  outstandingFine: number;
  issuedBy: string | null;
  status: string;
  statusLabel: string;
};

export type CirculationIncidentRow = {
  id: string;
  occurredAt: string;
  incidentType: 'LOST' | 'DAMAGED';
  typeLabel: string;
  accession: string;
  title: string;
  author: string | null;
  borrowerName: string | null;
  borrowerCode: string | null;
  department: string | null;
  memberTypeLabel: string;
  chargeAmount: number | null;
  fineStatus: string;
  fineStatusLabel: string;
  remarks: string | null;
  recoveryStatus: string;
  recoveryStatusLabel: string;
  resolvedAt: string | null;
  reportedBy: string | null;
};

export type CirculationDepartmentRow = {
  departmentId: string | null;
  department: string;
  issues: number;
  renewals: number;
  returns: number;
  lateReturns: number;
  currentlyBorrowed: number;
  overdue: number;
  borrowers: number;
};

export type CirculationLibrarianRow = {
  processedById: string | null;
  name: string;
  issues: number;
  renewals: number;
  returns: number;
  total: number;
  lastActivityAt: string | null;
};

type Paged<K extends string, T> = {
  kind: K;
  range: CirculationRange;
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CirculationRowsResponse =
  | Paged<'transactions', CirculationTransactionRow>
  | Paged<'loans', CirculationLoanRow>
  | Paged<'incidents', CirculationIncidentRow>
  | { kind: 'departments'; range: CirculationRange; items: CirculationDepartmentRow[] }
  | { kind: 'librarians'; range: CirculationRange; items: CirculationLibrarianRow[] };

export type CirculationAnalytics = {
  range: CirculationRange;
  monthly: { month: string; issues: number; returns: number; renewals: number; overdue: number }[];
  departments: { department: string; issues: number; returns: number; renewals: number }[];
  mostBorrowedBooks: { title: string; author: string | null; count: number }[];
  topStudents: {
    name: string | null;
    code: string | null;
    department: string | null;
    count: number;
  }[];
  topStaff: {
    name: string | null;
    code: string | null;
    department: string | null;
    count: number;
  }[];
  byMemberType: { memberType: string; label: string; count: number }[];
};
