'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Banknote,
  CreditCard,
  Eye,
  FileSpreadsheet,
  IndianRupee,
  Mail,
  Pause,
  Play,
  Printer,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { fetchStaff } from '@/services/staff';
import {
  cancelLoanReceipt,
  createLoan,
  createLoanType,
  emailLoanReceipt,
  exportLoanRegister,
  exportReceiptRegister,
  fetchLoan,
  fetchLoanClosures,
  fetchLoanRegister,
  fetchLoanTypes,
  fetchLoans,
  fetchLoansDashboard,
  fetchMonthlyCollection,
  fetchReceiptRegister,
  openLoanClosureCertificate,
  openLoanReceiptPdf,
  recordLoanPayment,
  restructureLoan,
  searchStaffForLoan,
  type LoanTypeConfig,
  type StaffLoanRecord,
} from '@/services/loans';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type Tab =
  | 'dashboard'
  | 'create'
  | 'active'
  | 'repayments'
  | 'salary-deduction'
  | 'cash-collection'
  | 'closed'
  | 'reports'
  | 'settings';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const REPAYMENT_METHODS = [
  { value: 'SALARY_DEDUCTION', label: 'Salary Deduction' },
  { value: 'CASH', label: 'Cash Payment' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'MIXED', label: 'Mixed Method' },
];

const PAYMENT_MODES = [
  { value: 'CASH', label: 'Cash' },
  { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CHEQUE', label: 'Cheque' },
];

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function formatDate(d?: string | Date | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function inputClass(extra?: string) {
  return cn('w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm', extra);
}

function methodLabel(v: string) {
  return REPAYMENT_METHODS.find((m) => m.value === v)?.label ?? v.replace(/_/g, ' ');
}

function StatusBadge({ status, paused }: { status: string; paused?: boolean }) {
  const label = paused ? 'Paused' : status;
  const color =
    status === 'CLOSED' || status === 'COMPLETED'
      ? 'bg-emerald-100 text-emerald-800'
      : paused
        ? 'bg-amber-100 text-amber-800'
        : 'bg-blue-100 text-blue-800';
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', color)}>
      {label}
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary transition-all"
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: typeof Wallet;
  accent?: string;
}) {
  return (
    <GlassCard className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn('mt-1 text-xl font-bold', accent)}>{value}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground/60" />
      </div>
    </GlassCard>
  );
}

function StaffCard({
  staff,
}: {
  staff: {
    fullName: string;
    employeeCode: string;
    photoUrl?: string | null;
    department?: { name: string } | null;
    designation?: { label: string } | null;
    basicPay?: number | null;
  };
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-semibold">
        {staff.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={staff.photoUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          staff.fullName.slice(0, 2).toUpperCase()
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{staff.fullName}</p>
        <p className="text-xs text-muted-foreground">
          {staff.employeeCode}
          {staff.department?.name ? ` · ${staff.department.name}` : ''}
          {staff.designation?.label ? ` · ${staff.designation.label}` : ''}
        </p>
        {staff.basicPay != null ? (
          <p className="text-xs font-medium text-primary">
            Basic Pay: {formatInr(Number(staff.basicPay))}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function LoanRow({ loan, onView }: { loan: StaffLoanRecord; onView: (id: string) => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{loan.loanNumber}</span>
          <StatusBadge status={loan.status} paused={loan.paused} />
        </div>
        <p className="text-sm">{loan.staffProfile?.fullName ?? '—'}</p>
        <p className="text-xs text-muted-foreground">
          {loan.loanTypeConfig?.name ?? loan.loanType} · {methodLabel(loan.repaymentMethod)}
        </p>
        <div className="mt-2 max-w-xs">
          <ProgressBar percent={loan.progressPercent} />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>Recovered {formatInr(loan.totalRecovered)}</span>
            <span>Outstanding {formatInr(loan.balanceAmount)}</span>
          </div>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={() => onView(loan.id)}>
        <Eye className="mr-1 h-3.5 w-3.5" /> View
      </Button>
    </div>
  );
}

export function HrLoansPage() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const now = new Date();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [detailLoanId, setDetailLoanId] = useState<string | null>(null);

  const [staffSearch, setStaffSearch] = useState('');
  const [showStaffResults, setShowStaffResults] = useState(false);
  const debouncedStaffSearch = useDebouncedValue(staffSearch, 300);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<{
    id: string;
    fullName: string;
    employeeCode: string;
    photoUrl?: string | null;
    department?: { name: string };
    designation?: { label: string };
    basicPay?: number | null;
  } | null>(null);
  const [createForm, setCreateForm] = useState({
    loanTypeConfigId: '',
    loanType: 'Staff Welfare Loan',
    principalAmount: 0,
    repaymentMethod: 'SALARY_DEDUCTION',
    salaryDeductionAmount: 0,
    monthlyInstallment: 0,
    loanDate: now.toISOString().slice(0, 10),
    repaymentStartDate: now.toISOString().slice(0, 10),
    notes: '',
  });

  const [paymentForm, setPaymentForm] = useState({
    loanId: '',
    amount: 0,
    paymentMode: 'CASH',
    paymentDate: now.toISOString().slice(0, 10),
    transactionReference: '',
    remarks: '',
  });
  const [lastReceipt, setLastReceipt] = useState<{
    transactionId: string;
    receiptNumber: string;
    closed?: boolean;
    loanId?: string;
  } | null>(null);
  const [reportType, setReportType] = useState<'register' | 'receipts' | 'monthly' | 'closures'>(
    'register',
  );
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1);
  const [reportYear, setReportYear] = useState(now.getFullYear());

  const [typeForm, setTypeForm] = useState({
    code: '',
    name: '',
    description: '',
    maxAmount: 0,
    defaultInstallment: 0,
    interestApplicable: false,
    interestRate: 0,
  });

  const dashboardQ = useQuery({
    queryKey: ['loans', 'dashboard'],
    queryFn: fetchLoansDashboard,
    enabled: enabled && tab === 'dashboard',
  });

  const typesQ = useQuery({
    queryKey: ['loans', 'types'],
    queryFn: () => fetchLoanTypes(true),
    enabled,
  });

  const activeLoansQ = useQuery({
    queryKey: ['loans', 'list', 'active', search],
    queryFn: () => fetchLoans({ status: 'ACTIVE', search: search || undefined }),
    enabled: enabled && ['active', 'salary-deduction', 'cash-collection'].includes(tab),
  });

  const pausedLoansQ = useQuery({
    queryKey: ['loans', 'list', 'paused'],
    queryFn: () => fetchLoans({ status: 'PAUSED' }),
    enabled: enabled && tab === 'active',
  });

  const closedLoansQ = useQuery({
    queryKey: ['loans', 'list', 'closed', search],
    queryFn: () => fetchLoans({ status: 'CLOSED', search: search || undefined }),
    enabled: enabled && tab === 'closed',
  });

  const allActiveQ = useQuery({
    queryKey: ['loans', 'list', 'all-active'],
    queryFn: () => fetchLoans({ status: 'ACTIVE' }),
    enabled: enabled && tab === 'repayments',
  });

  const registerQ = useQuery({
    queryKey: ['loans', 'register'],
    queryFn: fetchLoanRegister,
    enabled: enabled && tab === 'reports' && reportType === 'register',
  });

  const receiptRegisterQ = useQuery({
    queryKey: ['loans', 'receipt-register'],
    queryFn: () => fetchReceiptRegister(),
    enabled: enabled && tab === 'reports' && reportType === 'receipts',
  });

  const monthlyCollectionQ = useQuery({
    queryKey: ['loans', 'monthly-collection', reportMonth, reportYear],
    queryFn: () => fetchMonthlyCollection(reportMonth, reportYear),
    enabled: enabled && tab === 'reports' && reportType === 'monthly',
  });

  const closuresQ = useQuery({
    queryKey: ['loans', 'closures'],
    queryFn: fetchLoanClosures,
    enabled: enabled && tab === 'reports' && reportType === 'closures',
  });

  const staffQ = useQuery({
    queryKey: ['loans', 'staff-search', debouncedStaffSearch],
    queryFn: async () => {
      const q = debouncedStaffSearch.trim();
      try {
        return await searchStaffForLoan(q);
      } catch {
        const res = await fetchStaff({ search: q, limit: 20, status: 'ACTIVE' });
        return res.data.map((row) => ({
          id: row.id,
          fullName: row.fullName,
          employeeCode: row.employeeCode,
          photoUrl: row.photoUrl,
          department: row.department ? { name: row.department } : undefined,
          designation: row.designation ? { label: row.designation } : undefined,
          basicPay: null,
        }));
      }
    },
    enabled: enabled && tab === 'create' && debouncedStaffSearch.trim().length >= 2,
  });

  const detailQ = useQuery({
    queryKey: ['loans', 'detail', detailLoanId],
    queryFn: () => fetchLoan(detailLoanId!),
    enabled: enabled && !!detailLoanId,
  });

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['loans'] });

  const createMut = useMutation({
    mutationFn: createLoan,
    onSuccess: () => {
      setMessage('Loan created successfully');
      setSelectedStaffId('');
      setSelectedStaff(null);
      setStaffSearch('');
      setShowStaffResults(false);
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Failed to create loan')),
  });

  const paymentMut = useMutation({
    mutationFn: ({
      loanId,
      body,
    }: {
      loanId: string;
      body: Parameters<typeof recordLoanPayment>[1];
    }) => recordLoanPayment(loanId, body),
    onSuccess: (result) => {
      setMessage(`Payment recorded — Receipt ${result.transaction.receiptNumber}`);
      setLastReceipt({
        transactionId: result.transaction.id,
        receiptNumber: result.transaction.receiptNumber,
        closed: result.closed,
        loanId: paymentForm.loanId,
      });
      setPaymentForm((f) => ({ ...f, amount: 0, transactionReference: '', remarks: '' }));
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Payment failed')),
  });

  const restructureMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof restructureLoan>[1] }) =>
      restructureLoan(id, body),
    onSuccess: () => {
      setMessage('Loan updated');
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Update failed')),
  });

  const typeMut = useMutation({
    mutationFn: createLoanType,
    onSuccess: () => {
      setMessage('Loan type added');
      setTypeForm({
        code: '',
        name: '',
        description: '',
        maxAmount: 0,
        defaultInstallment: 0,
        interestApplicable: false,
        interestRate: 0,
      });
      invalidate();
    },
    onError: (e) => setError(apiErrorMessage(e, 'Failed to add loan type')),
  });

  const salaryDeductionLoans = useMemo(
    () =>
      (activeLoansQ.data ?? []).filter((l) =>
        ['SALARY_DEDUCTION', 'MIXED'].includes(l.repaymentMethod),
      ),
    [activeLoansQ.data],
  );

  const cashCollectionLoans = useMemo(
    () =>
      (activeLoansQ.data ?? []).filter((l) =>
        ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'MIXED'].includes(l.repaymentMethod),
      ),
    [activeLoansQ.data],
  );

  const displayLoans = useMemo(() => {
    if (tab === 'salary-deduction') return salaryDeductionLoans;
    if (tab === 'cash-collection') return cashCollectionLoans;
    if (tab === 'active') return [...(activeLoansQ.data ?? []), ...(pausedLoansQ.data ?? [])];
    return activeLoansQ.data ?? [];
  }, [tab, activeLoansQ.data, pausedLoansQ.data, salaryDeductionLoans, cashCollectionLoans]);

  const applyLoanType = (t: LoanTypeConfig) => {
    setCreateForm((f) => ({
      ...f,
      loanTypeConfigId: t.id,
      loanType: t.name,
      monthlyInstallment: Number(t.defaultInstallment ?? 0),
      salaryDeductionAmount: Number(t.defaultInstallment ?? 0),
      principalAmount:
        Number(t.maxAmount ?? 0) > 0
          ? Math.min(f.principalAmount || Number(t.maxAmount), Number(t.maxAmount))
          : f.principalAmount,
    }));
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'create', label: 'Create Loan' },
    { key: 'active', label: 'Active Loans' },
    { key: 'repayments', label: 'Repayments' },
    { key: 'salary-deduction', label: 'Salary Deduction' },
    { key: 'cash-collection', label: 'Cash Collection' },
    { key: 'closed', label: 'Closed Loans' },
    { key: 'reports', label: 'Reports' },
    { key: 'settings', label: 'Settings' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Loans & Advances</h2>
          <p className="text-sm text-muted-foreground">
            Staff welfare loans, salary advances, repayments, payroll deductions, and recovery
            tracking.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => invalidate()}>
          <RefreshCw className="mr-1 h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setError('');
            }}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              tab === t.key
                ? 'bg-background shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {tab === 'dashboard' && dashboardQ.data ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <KpiCard
              label="Active Loans"
              value={String(dashboardQ.data.totalActiveLoans)}
              icon={Wallet}
            />
            <KpiCard
              label="Total Issued"
              value={formatInr(dashboardQ.data.totalLoanAmountIssued)}
              icon={IndianRupee}
            />
            <KpiCard
              label="Outstanding"
              value={formatInr(dashboardQ.data.outstandingBalance)}
              icon={TrendingUp}
              accent="text-amber-600"
            />
            <KpiCard
              label="This Month Recovery"
              value={formatInr(dashboardQ.data.monthlyCollection)}
              icon={Banknote}
              accent="text-emerald-600"
            />
            <KpiCard
              label="Overdue"
              value={String(dashboardQ.data.overdueLoans)}
              icon={CreditCard}
              accent={dashboardQ.data.overdueLoans > 0 ? 'text-red-600' : undefined}
            />
            <KpiCard
              label="Closing This Month"
              value={String(dashboardQ.data.loansClosingThisMonth)}
              icon={FileSpreadsheet}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GlassCard className="p-4">
              <h3 className="mb-3 font-semibold">Loan Distribution by Type</h3>
              {(dashboardQ.data.loanDistributionByType ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No active loans</p>
              ) : (
                <div className="space-y-2">
                  {dashboardQ.data.loanDistributionByType.map((row) => (
                    <div key={row.type} className="flex items-center justify-between text-sm">
                      <span>
                        {row.type} ({row.count})
                      </span>
                      <span className="font-medium">{formatInr(row.outstanding)}</span>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-4">
              <h3 className="mb-3 font-semibold">Department-wise Outstanding</h3>
              {(dashboardQ.data.departmentWise ?? []).slice(0, 8).map((row) => (
                <div
                  key={row.department}
                  className="flex items-center justify-between border-b border-border/30 py-2 text-sm last:border-0"
                >
                  <span>
                    {row.department} ({row.count})
                  </span>
                  <span className="font-medium">{formatInr(row.outstanding)}</span>
                </div>
              ))}
            </GlassCard>

            <GlassCard className="p-4">
              <h3 className="mb-3 font-semibold">Monthly Recovery Trend</h3>
              <div className="flex items-end gap-1 h-24">
                {dashboardQ.data.monthlyRecoveryTrend.map((m) => {
                  const max = Math.max(
                    ...dashboardQ.data!.monthlyRecoveryTrend.map((x) => x.amount),
                    1,
                  );
                  const h = Math.round((m.amount / max) * 100);
                  return (
                    <div
                      key={`${m.year}-${m.month}`}
                      className="flex flex-1 flex-col items-center gap-1"
                    >
                      <div
                        className="w-full rounded-t bg-primary/70"
                        style={{ height: `${Math.max(4, h)}%` }}
                        title={formatInr(m.amount)}
                      />
                      <span className="text-[9px] text-muted-foreground">
                        {MONTH_LABELS[m.month - 1]?.slice(0, 3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </GlassCard>

            <GlassCard className="p-4">
              <h3 className="mb-3 font-semibold">Recent Payments</h3>
              {(dashboardQ.data.recentPayments ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments yet</p>
              ) : (
                dashboardQ.data.recentPayments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between border-b border-border/30 py-2 text-sm last:border-0"
                  >
                    <div>
                      <p className="font-medium">{p.staffName}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.loanNumber} · {methodLabel(p.transactionType)} ·{' '}
                        {formatDate(p.paymentDate)}
                      </p>
                    </div>
                    <span className="font-semibold text-emerald-600">{formatInr(p.amount)}</span>
                  </div>
                ))
              )}
            </GlassCard>
          </div>
        </div>
      ) : null}

      {tab === 'create' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="space-y-4 p-4">
            <h3 className="font-semibold">Search Staff</h3>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                className={inputClass('pl-9')}
                placeholder="Name, employee code, or mobile..."
                value={staffSearch}
                onChange={(e) => {
                  setStaffSearch(e.target.value);
                  setShowStaffResults(true);
                  if (!e.target.value.trim()) {
                    setSelectedStaffId('');
                    setSelectedStaff(null);
                  }
                }}
                onFocus={() => setShowStaffResults(true)}
              />
              {showStaffResults && staffSearch.trim().length >= 2 ? (
                <div className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg">
                  {staffQ.isLoading || staffSearch !== debouncedStaffSearch ? (
                    <p className="p-3 text-xs text-muted-foreground">Searching staff…</p>
                  ) : staffQ.isError ? (
                    <p className="p-3 text-xs text-rose-600">
                      {apiErrorMessage(staffQ.error, 'Staff search failed')}
                    </p>
                  ) : (staffQ.data ?? []).length ? (
                    (staffQ.data ?? []).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          setSelectedStaffId(s.id);
                          setSelectedStaff(s);
                          setStaffSearch(s.fullName);
                          setShowStaffResults(false);
                        }}
                        className={cn(
                          'flex w-full flex-col border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/60',
                          selectedStaffId === s.id && 'bg-primary/5',
                        )}
                      >
                        <span className="font-medium">{s.fullName}</span>
                        <span className="text-xs text-muted-foreground">{s.employeeCode}</span>
                      </button>
                    ))
                  ) : (
                    <p className="p-3 text-xs text-muted-foreground">
                      No staff found for &ldquo;{debouncedStaffSearch}&rdquo;
                    </p>
                  )}
                </div>
              ) : staffSearch.trim().length > 0 && staffSearch.trim().length < 2 ? (
                <p className="mt-1 text-xs text-muted-foreground">Type at least 2 characters…</p>
              ) : null}
            </div>
            {selectedStaff ? <StaffCard staff={selectedStaff} /> : null}
          </GlassCard>

          <GlassCard className="space-y-3 p-4">
            <h3 className="font-semibold">Loan Details</h3>
            <label className="block text-xs font-medium text-muted-foreground">Loan Type</label>
            <select
              className={inputClass()}
              value={createForm.loanTypeConfigId}
              onChange={(e) => {
                const t = (typesQ.data ?? []).find((x) => x.id === e.target.value);
                if (t) applyLoanType(t);
              }}
            >
              <option value="">Custom / Manual</option>
              {(typesQ.data ?? [])
                .filter((t) => t.isActive)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
            {!createForm.loanTypeConfigId ? (
              <input
                className={inputClass()}
                placeholder="Loan type name"
                value={createForm.loanType}
                onChange={(e) => setCreateForm({ ...createForm, loanType: e.target.value })}
              />
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Loan Amount</label>
                <input
                  type="number"
                  className={inputClass()}
                  value={createForm.principalAmount || ''}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, principalAmount: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Repayment Method</label>
                <select
                  className={inputClass()}
                  value={createForm.repaymentMethod}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, repaymentMethod: e.target.value })
                  }
                >
                  {REPAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Loan Date</label>
                <input
                  type="date"
                  className={inputClass()}
                  value={createForm.loanDate}
                  onChange={(e) => setCreateForm({ ...createForm, loanDate: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Repayment Start</label>
                <input
                  type="date"
                  className={inputClass()}
                  value={createForm.repaymentStartDate}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, repaymentStartDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Monthly Installment
                </label>
                <input
                  type="number"
                  className={inputClass()}
                  value={createForm.monthlyInstallment || ''}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, monthlyInstallment: Number(e.target.value) })
                  }
                />
              </div>
              {['SALARY_DEDUCTION', 'MIXED'].includes(createForm.repaymentMethod) ? (
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">
                    Salary Deduction / Month
                  </label>
                  <input
                    type="number"
                    className={inputClass()}
                    value={createForm.salaryDeductionAmount || ''}
                    onChange={(e) =>
                      setCreateForm({
                        ...createForm,
                        salaryDeductionAmount: Number(e.target.value),
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
            <textarea
              className={inputClass()}
              rows={2}
              placeholder="Remarks"
              value={createForm.notes}
              onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
            />
            <Button
              disabled={!selectedStaffId || !createForm.principalAmount}
              onClick={() =>
                createMut.mutate({
                  staffProfileId: selectedStaffId,
                  loanTypeConfigId: createForm.loanTypeConfigId || undefined,
                  loanType: createForm.loanType,
                  principalAmount: createForm.principalAmount,
                  repaymentMethod: createForm.repaymentMethod,
                  salaryDeductionAmount: createForm.salaryDeductionAmount || undefined,
                  monthlyInstallment: createForm.monthlyInstallment || undefined,
                  loanDate: createForm.loanDate,
                  repaymentStartDate: createForm.repaymentStartDate,
                  notes: createForm.notes || undefined,
                })
              }
            >
              <Plus className="mr-1 h-4 w-4" /> Create Loan
            </Button>
          </GlassCard>
        </div>
      ) : null}

      {['active', 'salary-deduction', 'cash-collection'].includes(tab) ? (
        <GlassCard className="p-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                className={inputClass('pl-9')}
                placeholder="Search loans..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {displayLoans.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No loans found</p>
          ) : (
            displayLoans.map((l) => <LoanRow key={l.id} loan={l} onView={setDetailLoanId} />)
          )}
        </GlassCard>
      ) : null}

      {tab === 'closed' ? (
        <GlassCard className="p-4">
          <div className="mb-4">
            <input
              className={inputClass()}
              placeholder="Search closed loans..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {(closedLoansQ.data ?? []).map((l) => (
            <LoanRow key={l.id} loan={l} onView={setDetailLoanId} />
          ))}
        </GlassCard>
      ) : null}

      {tab === 'repayments' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="space-y-3 p-4">
            <h3 className="font-semibold">Record Payment</h3>
            <label className="text-xs text-muted-foreground">Select Loan</label>
            <select
              className={inputClass()}
              value={paymentForm.loanId}
              onChange={(e) => {
                const loan = (allActiveQ.data ?? []).find((l) => l.id === e.target.value);
                setPaymentForm({
                  ...paymentForm,
                  loanId: e.target.value,
                  amount: loan ? Math.min(loan.balanceAmount, loan.monthlyDeduction || 0) : 0,
                });
              }}
            >
              <option value="">Choose active loan...</option>
              {(allActiveQ.data ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.loanNumber} — {l.staffProfile?.fullName} (Bal {formatInr(l.balanceAmount)})
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Amount (any value)
                </label>
                <input
                  type="number"
                  className={inputClass()}
                  value={paymentForm.amount || ''}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, amount: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Payment Mode</label>
                <select
                  className={inputClass()}
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Payment Date</label>
                <input
                  type="date"
                  className={inputClass()}
                  value={paymentForm.paymentDate}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Transaction Reference
                </label>
                <input
                  className={inputClass()}
                  placeholder="UPI ref / Cheque no / Bank ref"
                  value={paymentForm.transactionReference}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, transactionReference: e.target.value })
                  }
                />
              </div>
            </div>
            <textarea
              className={inputClass()}
              rows={2}
              placeholder="Remarks"
              value={paymentForm.remarks}
              onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Receipt number is generated automatically (e.g. LN-RCP-2026-000001)
            </p>
            <Button
              disabled={!paymentForm.loanId || !paymentForm.amount}
              onClick={() =>
                paymentMut.mutate({
                  loanId: paymentForm.loanId,
                  body: {
                    amount: paymentForm.amount,
                    paymentMode: paymentForm.paymentMode,
                    paymentDate: paymentForm.paymentDate,
                    transactionReference: paymentForm.transactionReference || undefined,
                    remarks: paymentForm.remarks || undefined,
                  },
                })
              }
            >
              Record Payment & Generate Receipt
            </Button>
            {lastReceipt ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="font-semibold text-emerald-800">
                  Receipt {lastReceipt.receiptNumber}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openLoanReceiptPdf(lastReceipt.transactionId)}
                  >
                    <Printer className="mr-1 h-3.5 w-3.5" /> Print / Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      emailLoanReceipt(lastReceipt.transactionId).then((r) => setMessage(r.message))
                    }
                  >
                    <Mail className="mr-1 h-3.5 w-3.5" /> Email Receipt
                  </Button>
                  {lastReceipt.closed && lastReceipt.loanId ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openLoanClosureCertificate(lastReceipt.loanId!)}
                    >
                      Closure Certificate
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </GlassCard>
          <GlassCard className="p-4">
            <h3 className="mb-3 font-semibold">Active Loans — Quick Pay</h3>
            {(allActiveQ.data ?? []).slice(0, 10).map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between border-b py-2 text-sm last:border-0"
              >
                <div>
                  <p className="font-medium">{l.staffProfile?.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.loanNumber} · Outstanding {formatInr(l.balanceAmount)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPaymentForm((f) => ({
                      ...f,
                      loanId: l.id,
                      amount: l.monthlyDeduction || 0,
                    }));
                  }}
                >
                  Pay
                </Button>
              </div>
            ))}
          </GlassCard>
        </div>
      ) : null}

      {tab === 'reports' ? (
        <GlassCard className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={inputClass('w-auto min-w-[180px]')}
              value={reportType}
              onChange={(e) => setReportType(e.target.value as typeof reportType)}
            >
              <option value="register">Loan Register</option>
              <option value="receipts">Receipt Register</option>
              <option value="monthly">Monthly Collection</option>
              <option value="closures">Loan Closures</option>
            </select>
            {reportType === 'monthly' ? (
              <>
                <select
                  className={inputClass('w-auto')}
                  value={reportMonth}
                  onChange={(e) => setReportMonth(Number(e.target.value))}
                >
                  {MONTH_LABELS.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  className={inputClass('w-24')}
                  value={reportYear}
                  onChange={(e) => setReportYear(Number(e.target.value))}
                />
              </>
            ) : null}
            {reportType === 'register' ? (
              <Button size="sm" variant="outline" onClick={() => exportLoanRegister()}>
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Export Excel
              </Button>
            ) : null}
            {reportType === 'receipts' ? (
              <Button size="sm" variant="outline" onClick={() => exportReceiptRegister()}>
                <FileSpreadsheet className="mr-1 h-4 w-4" /> Export Receipts
              </Button>
            ) : null}
          </div>
          {reportType === 'register' && registerQ.data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-2">Loan #</th>
                    <th className="py-2 pr-2">Staff</th>
                    <th className="py-2 pr-2">Type</th>
                    <th className="py-2 pr-2">Principal</th>
                    <th className="py-2 pr-2">Outstanding</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(registerQ.data as Array<Record<string, unknown>>).map((row, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-2 pr-2">{String(row.loanNumber ?? '')}</td>
                      <td className="py-2 pr-2">{String(row.staffName ?? '')}</td>
                      <td className="py-2 pr-2">{String(row.loanType ?? '')}</td>
                      <td className="py-2 pr-2">
                        {formatInr(Number(row.principal ?? row.principalAmount ?? 0))}
                      </td>
                      <td className="py-2 pr-2">
                        {formatInr(Number(row.outstanding ?? row.balanceAmount ?? 0))}
                      </td>
                      <td className="py-2">{String(row.status ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {reportType === 'receipts' && receiptRegisterQ.data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Receipt #</th>
                    <th className="py-2">Date</th>
                    <th className="py-2">Staff</th>
                    <th className="py-2">Mode</th>
                    <th className="py-2">Amount</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(receiptRegisterQ.data as Array<Record<string, unknown>>).map((row, i) => (
                    <tr key={i} className="border-b border-border/40">
                      <td className="py-2">{String(row.receiptNumber ?? '')}</td>
                      <td className="py-2">{formatDate(String(row.paymentDate ?? ''))}</td>
                      <td className="py-2">{String(row.staffName ?? '')}</td>
                      <td className="py-2">{methodLabel(String(row.transactionType ?? ''))}</td>
                      <td className="py-2">{formatInr(Number(row.amount ?? 0))}</td>
                      <td className="py-2">{String(row.status ?? 'ACTIVE')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {reportType === 'monthly' && monthlyCollectionQ.data ? (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <KpiCard
                  label="Total Collection"
                  value={formatInr(
                    Number(
                      (monthlyCollectionQ.data as { totalCollection?: number }).totalCollection ??
                        0,
                    ),
                  )}
                  icon={Banknote}
                />
                <KpiCard
                  label="Cash / Manual"
                  value={formatInr(
                    Number(
                      (monthlyCollectionQ.data as { cashCollection?: number }).cashCollection ?? 0,
                    ),
                  )}
                  icon={Wallet}
                />
                <KpiCard
                  label="Salary Deduction"
                  value={formatInr(
                    Number(
                      (monthlyCollectionQ.data as { salaryDeduction?: number }).salaryDeduction ??
                        0,
                    ),
                  )}
                  icon={IndianRupee}
                />
              </div>
            </div>
          ) : null}
          {reportType === 'closures' && closuresQ.data ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Loan #</th>
                    <th className="py-2">Staff</th>
                    <th className="py-2">Recovered</th>
                    <th className="py-2">Closed</th>
                    <th className="py-2">Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    closuresQ.data as Array<{
                      id: string;
                      loanNumber: string;
                      staffName: string;
                      totalRecovered: number;
                      closedAt?: string;
                    }>
                  ).map((row) => (
                    <tr key={row.id} className="border-b border-border/40">
                      <td className="py-2">{row.loanNumber}</td>
                      <td className="py-2">{row.staffName}</td>
                      <td className="py-2">{formatInr(row.totalRecovered)}</td>
                      <td className="py-2">{formatDate(row.closedAt)}</td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openLoanClosureCertificate(row.id)}
                        >
                          PDF
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </GlassCard>
      ) : null}

      {tab === 'settings' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="space-y-3 p-4">
            <h3 className="font-semibold">Add Loan Type</h3>
            <input
              className={inputClass()}
              placeholder="Code (e.g. WELFARE)"
              value={typeForm.code}
              onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })}
            />
            <input
              className={inputClass()}
              placeholder="Name"
              value={typeForm.name}
              onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
            />
            <input
              className={inputClass()}
              placeholder="Description"
              value={typeForm.description}
              onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                className={inputClass()}
                placeholder="Max amount"
                value={typeForm.maxAmount || ''}
                onChange={(e) => setTypeForm({ ...typeForm, maxAmount: Number(e.target.value) })}
              />
              <input
                type="number"
                className={inputClass()}
                placeholder="Default installment"
                value={typeForm.defaultInstallment || ''}
                onChange={(e) =>
                  setTypeForm({ ...typeForm, defaultInstallment: Number(e.target.value) })
                }
              />
            </div>
            <Button
              disabled={!typeForm.code || !typeForm.name}
              onClick={() => typeMut.mutate(typeForm)}
            >
              <Plus className="mr-1 h-4 w-4" /> Add Type
            </Button>
          </GlassCard>
          <GlassCard className="p-4">
            <h3 className="mb-3 font-semibold">Configured Loan Types</h3>
            {(typesQ.data ?? []).map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between border-b py-2 text-sm last:border-0"
              >
                <div>
                  <p className="font-medium">
                    {t.name} <span className="text-xs text-muted-foreground">({t.code})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Max {t.maxAmount ? formatInr(Number(t.maxAmount)) : '—'} · Default EMI{' '}
                    {t.defaultInstallment ? formatInr(Number(t.defaultInstallment)) : '—'}
                  </p>
                </div>
                <StatusBadge status={t.isActive ? 'ACTIVE' : 'CLOSED'} />
              </div>
            ))}
          </GlassCard>
        </div>
      ) : null}

      {detailLoanId && detailQ.data ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDetailLoanId(null)}
        >
          <GlassCard
            className="max-h-[90vh] w-full max-w-2xl overflow-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const loan = detailQ.data as StaffLoanRecord & {
                transactions?: Array<{
                  id: string;
                  amount: number;
                  transactionType: string;
                  paymentDate: string;
                  receiptNumber?: string;
                  remarks?: string;
                }>;
              };
              return (
                <>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold">{loan.loanNumber}</h3>
                      <p className="text-sm text-muted-foreground">
                        {loan.loanTypeConfig?.name ?? loan.loanType}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setDetailLoanId(null)}>
                      Close
                    </Button>
                  </div>
                  {loan.staffProfile ? <StaffCard staff={loan.staffProfile} /> : null}
                  <div className="my-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg bg-muted/30 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Original</p>
                      <p className="font-bold">{formatInr(loan.principalAmount)}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Recovered</p>
                      <p className="font-bold text-emerald-700">{formatInr(loan.totalRecovered)}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3 text-center">
                      <p className="text-xs text-muted-foreground">Outstanding</p>
                      <p className="font-bold text-amber-700">{formatInr(loan.balanceAmount)}</p>
                    </div>
                  </div>
                  <ProgressBar percent={loan.progressPercent} />
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">Method:</span>{' '}
                      {methodLabel(loan.repaymentMethod)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Monthly:</span>{' '}
                      {formatInr(loan.salaryDeductionAmount ?? loan.monthlyDeduction)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Loan Date:</span>{' '}
                      {formatDate(loan.loanDate)}
                    </p>
                    <p>
                      <span className="text-muted-foreground">Expected Close:</span>{' '}
                      {formatDate(loan.expectedCloseDate)}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {loan.status !== 'CLOSED' ? (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            restructureMut.mutate({
                              id: loan.id,
                              body: { paused: !loan.paused },
                            })
                          }
                        >
                          {loan.paused ? (
                            <Play className="mr-1 h-3.5 w-3.5" />
                          ) : (
                            <Pause className="mr-1 h-3.5 w-3.5" />
                          )}
                          {loan.paused ? 'Resume Deduction' : 'Pause Deduction'}
                        </Button>
                      </>
                    ) : null}
                    {loan.status === 'CLOSED' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openLoanClosureCertificate(loan.id)}
                      >
                        Download Closure Certificate
                      </Button>
                    ) : null}
                  </div>
                  <h4 className="mb-2 mt-5 font-semibold">Repayment History</h4>
                  {(loan.transactions ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">No transactions yet</p>
                  ) : (
                    <div className="space-y-0 border-l-2 border-primary/30 pl-4">
                      {(loan.transactions ?? []).map((tx) => {
                        const isManual = ['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE'].includes(
                          tx.transactionType,
                        );
                        const isPayroll = tx.transactionType === 'SALARY_DEDUCTION';
                        const receiptLabel = tx.receiptNumber
                          ? tx.receiptNumber
                          : isPayroll
                            ? 'Auto Payroll'
                            : '—';
                        return (
                          <div key={tx.id} className="relative pb-4">
                            <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium">
                                  {formatInr(tx.amount)} — {methodLabel(tx.transactionType)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(tx.paymentDate)} · {receiptLabel}
                                  {(tx as { status?: string }).status === 'CANCELLED'
                                    ? ' · CANCELLED'
                                    : ''}
                                </p>
                                {tx.remarks ? (
                                  <p className="text-xs italic text-muted-foreground">
                                    {tx.remarks}
                                  </p>
                                ) : null}
                              </div>
                              {isManual && (tx as { status?: string }).status !== 'CANCELLED' ? (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openLoanReceiptPdf(tx.id)}
                                  >
                                    <Printer className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
