'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Banknote,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  Link2,
  Loader2,
  Mail,
  MessageSquare,
  Printer,
  QrCode,
  RotateCcw,
  Search,
  Ticket,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {
  cancelFeeReceipt,
  bulkGenerateCycleDemands,
  cancelPaymentRequest,
  createPaymentRequest,
  exportFeeReport,
  fetchFeeSettings,
  fetchPaymentRequest,
  fetchPaymentRequests,
  fetchStudentFeeAccount,
  generateMonthlyDemands,
  generateMonthlyDemandsForPeriods,
  openFeeReceiptPdf,
  refundFeePayment,
  saveFeeReceiptPdf,
  sendDueReminders,
  sendReceiptNotification,
  simulateFeePayment,
} from '@/services/fee-cycle';
import { fetchFeeDashboard, fetchFeeReport } from '@/services/fees';
import { collectFee } from '@/services/fees';
import { fetchStudents } from '@/services/students';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useAuth } from '@/hooks/use-auth';
import { hasPermission } from '@/lib/permissions/portal-access';
import type { StudentDirectoryRow } from '@/types/students';
import type {
  FeeDemandRow,
  FeePaymentRequest,
  MonthlyFeeTrackerMonth,
  PayableFeeItem,
  StudentFeeAccount,
} from '@/types/fee-cycle';
import { BulkReceiptPrintPanel } from '@/components/fees-module/bulk-receipt-print-panel';
import { FeeCollectionPaymentFields } from '@/components/fees-module/fee-collection-method-card';
import { FeePaymentHistoryCard } from '@/components/fees-module/fee-payment-history-card';
import { MonthlyFeeSetupGuide } from '@/components/fees-module/monthly-fee-setup-guide';
import {
  buildCollectionPayload,
  enabledDeskPaymentMethods,
  validateDeskPaymentForm,
  type DeskPaymentFormValues,
  type DeskPaymentMethodId,
} from '@/lib/fee-collection-methods';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
const MONTHLY_DEMAND_TYPE = 'MONTHLY_TUITION';

function formatInr(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function isMonthlyPayable(p: PayableFeeItem) {
  return p.demandType === MONTHLY_DEMAND_TYPE || p.label.toLowerCase().includes('monthly');
}

function formatPeriodLabel(period?: string | null, periodLabel?: string) {
  if (periodLabel) return periodLabel;
  if (period?.match(/^\d{4}-\d{2}$/)) {
    const [y, m] = period.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleString('en-IN', {
      month: 'long',
      year: 'numeric',
    });
  }
  return period ?? '—';
}

function semLabel(n?: number | null) {
  return n ? `Semester ${ROMAN[n - 1] ?? n}` : '—';
}

function dueTone(account?: StudentFeeAccount) {
  if (!account) return 'neutral';
  if (account.summary.outstanding <= 0) return 'clear';
  if (account.summary.overdue > 0) return 'overdue';
  return 'partial';
}

export type FeeCollectionDeskVariant = 'setup' | 'collection';

export function FeeCollectionDesk({ variant = 'setup' }: { variant?: FeeCollectionDeskVariant }) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const permissions = session?.user?.permissions ?? [];
  const roles = session?.user?.roles ?? [];
  const canCollectCash =
    hasPermission(permissions, roles, 'fees:cash:collect') ||
    hasPermission(permissions, roles, 'fees:manage');
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 300);
  const [studentId, setStudentId] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<StudentDirectoryRow | null>(null);
  const [selectedPayables, setSelectedPayables] = useState<Set<string>>(new Set());
  const [monthsToGenerate, setMonthsToGenerate] = useState<Set<string>>(new Set());
  const [expandedDemand, setExpandedDemand] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [lastReceiptId, setLastReceiptId] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState(false);
  const [activeRequest, setActiveRequest] = useState<FeePaymentRequest | null>(null);
  const [activeCheckout, setActiveCheckout] = useState<{
    qrImageUrl?: string | null;
    paymentLinkUrl?: string | null;
    mode: string;
    paymentId?: string;
    expiresAt: string;
    requestNo: string;
  } | null>(null);
  const [payChannel, setPayChannel] = useState<'OFFICE_QR' | 'PAYMENT_LINK'>('OFFICE_QR');
  const [manualReference, setManualReference] = useState('');
  const [paymentMethodId, setPaymentMethodId] = useState<DeskPaymentMethodId | ''>('');
  const [paymentFormValues, setPaymentFormValues] = useState<DeskPaymentFormValues>({});

  const settingsQ = useQuery({ queryKey: ['fee-settings'], queryFn: fetchFeeSettings });
  const dashboardQ = useQuery({ queryKey: ['fees', 'dashboard'], queryFn: fetchFeeDashboard });
  const defaultersQ = useQuery({
    queryKey: ['fees', 'defaulters-report'],
    queryFn: () => fetchFeeReport('defaulters'),
  });

  const typeaheadQ = useQuery({
    queryKey: ['fee-desk-student-typeahead', debouncedQuery],
    queryFn: async () => {
      const res = await fetchStudents({ search: debouncedQuery.trim(), limit: 8 });
      return res.data;
    },
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  const suggestions = typeaheadQ.data ?? [];
  const showSuggestions =
    searchFocused &&
    debouncedQuery.trim().length >= 2 &&
    (typeaheadQ.isFetching || typeaheadQ.isFetched);

  const accountQ = useQuery({
    queryKey: ['fee-account', studentId],
    queryFn: () => fetchStudentFeeAccount(studentId),
    enabled: Boolean(studentId),
  });

  const account = accountQ.data;
  const payables = account?.payableItems ?? [];
  const notGeneratedCycles = (account?.admissionCycles ?? []).filter(
    (c) => c.status === 'NOT_GENERATED',
  );
  const currentBillingPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const currentMonthTracker = account?.monthlyTracker?.months?.find(
    (m) => m.period === currentBillingPeriod,
  );
  const monthlyPayables = payables.filter(isMonthlyPayable);
  const otherPayables = payables.filter((p) => !isMonthlyPayable(p));
  const monthlyNeedsActivation =
    Boolean(account) &&
    monthlyPayables.length === 0 &&
    (account?.monthlyTracker?.pendingMonths ?? 0) === 0;
  const monthlyNotGenerated =
    Boolean(account) &&
    (monthlyNeedsActivation ||
      currentMonthTracker?.status === 'NOT_GENERATED' ||
      account?.monthlyFeeStatus?.status === 'NOT_GENERATED');

  const paymentRequestsQ = useQuery({
    queryKey: ['fee-payment-requests', studentId],
    queryFn: () => fetchPaymentRequests({ studentId }),
    enabled: Boolean(studentId),
    refetchInterval: activeRequest?.status === 'PENDING' ? 3000 : false,
  });

  const activeRequestQ = useQuery({
    queryKey: ['fee-payment-request', activeRequest?.id],
    queryFn: () => fetchPaymentRequest(activeRequest!.id),
    enabled: Boolean(activeRequest?.id && activeRequest.status === 'PENDING'),
    refetchInterval: 3000,
  });

  useEffect(() => {
    const row = activeRequestQ.data;
    if (!row) return;
    if (row.status === 'PAID') {
      setActiveRequest(row);
      setLastReceiptId(row.receiptId ?? null);
      setMessage(`Payment successful — receipt issued.`);
      void accountQ.refetch();
      void dashboardQ.refetch();
      void paymentRequestsQ.refetch();
    } else if (row.status === 'EXPIRED' || row.status === 'CANCELLED') {
      setActiveRequest(row);
      setActiveCheckout(null);
    }
  }, [activeRequestQ.data?.status, activeRequestQ.data?.id]);

  useEffect(() => {
    setSelectedPayables(new Set());
    setMonthsToGenerate(new Set());
    setPaymentMethodId('');
    setPaymentFormValues({});
  }, [studentId]);

  const selectedTotal = useMemo(() => {
    return payables.filter((p) => selectedPayables.has(p.id)).reduce((s, p) => s + p.amount, 0);
  }, [payables, selectedPayables]);

  const selectedBreakdown = useMemo(() => {
    return payables
      .filter((p) => selectedPayables.has(p.id))
      .map((p) => ({
        id: p.id,
        title: isMonthlyPayable(p)
          ? formatPeriodLabel(p.period, p.periodLabel)
          : (p.periodLabel ?? p.label),
        subtitle: p.label,
        amount: p.amount,
        isMonthly: isMonthlyPayable(p),
      }));
  }, [payables, selectedPayables]);

  const selectedDemandIds = useMemo(
    () => new Set(payables.filter((p) => selectedPayables.has(p.id)).map((p) => p.demandId)),
    [payables, selectedPayables],
  );

  async function runExplicitSearch() {
    const q = query.trim();
    if (!q) return;
    let rows = debouncedQuery.trim() === q ? suggestions : [];
    if (!rows.length) {
      const res = await fetchStudents({ search: q, limit: 8 });
      rows = res.data;
    }
    if (rows.length === 1) {
      selectStudent(rows[0]);
    } else if (!rows.length) {
      setMessage('No student found. Try enrollment no, roll no, name, mobile, Aadhaar, or RFID.');
      setStudentId('');
      setSelectedStudent(null);
    } else {
      setSearchFocused(true);
      setMessage('');
    }
  }

  const qrRequestMut = useMutation({
    mutationFn: () => {
      const demandIds = [
        ...new Set(payables.filter((p) => selectedPayables.has(p.id)).map((p) => p.demandId)),
      ];
      return createPaymentRequest({
        studentId,
        demandIds,
        channel: payChannel,
      });
    },
    onSuccess: (res) => {
      setActiveRequest(res.request);
      setActiveCheckout({
        qrImageUrl: res.checkout.qrImageUrl,
        paymentLinkUrl: res.checkout.paymentLinkUrl,
        mode: res.checkout.mode,
        paymentId: res.payment.id,
        expiresAt: res.checkout.expiresAt,
        requestNo: res.checkout.requestNo,
      });
      setMessage(
        `Payment request ${res.checkout.requestNo} created. Valid for ${settingsQ.data?.paymentRequestExpiryMinutes ?? 15} minutes.`,
      );
      void paymentRequestsQ.refetch();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Failed to generate payment request')),
  });

  const deskCollectMut = useMutation({
    mutationFn: () => {
      const modes = settingsQ.data?.collectionModes;
      const method = enabledDeskPaymentMethods(modes).find((m) => m.id === paymentMethodId);
      const validationError = validateDeskPaymentForm(method, paymentFormValues, selectedTotal);
      if (validationError) throw new Error(validationError);
      if (method!.id === 'cash' && !canCollectCash) {
        throw new Error('You do not have permission to collect cash.');
      }
      const demandIds = [
        ...new Set(payables.filter((p) => selectedPayables.has(p.id)).map((p) => p.demandId)),
      ];
      const collectorName = session?.user?.displayName ?? session?.user?.email ?? 'Cashier';
      return collectFee(
        buildCollectionPayload(
          method!,
          paymentFormValues,
          studentId,
          demandIds,
          selectedTotal,
          collectorName,
        ),
      );
    },
    onSuccess: (res) => {
      if (res.pendingClearance) {
        setMessage(
          `Cheque recorded — pending clearance. Reference ${res.payment?.externalReference ?? ''}. Fees will be marked paid after accounts clears the cheque.`,
        );
      } else {
        setLastReceiptId(res.receipt?.id ?? null);
        setMessage(
          isCollection
            ? `Payment collected — receipt ${res.receipt?.receiptNo ?? 'issued'}. Print receipt, then click Next student.`
            : `Payment collected — receipt ${res.receipt?.receiptNo ?? 'issued'}.`,
        );
      }
      setPaymentFormValues({});
      void accountQ.refetch();
      void dashboardQ.refetch();
    },
    onError: (e) =>
      setMessage(
        e instanceof Error && e.message && !('response' in e)
          ? e.message
          : apiErrorMessage(e, 'Collection failed'),
      ),
  });

  const cancelRequestMut = useMutation({
    mutationFn: (id: string) => cancelPaymentRequest(id, 'Cancelled at desk'),
    onSuccess: () => {
      setActiveRequest(null);
      setActiveCheckout(null);
      setMessage('Payment request cancelled.');
      void paymentRequestsQ.refetch();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Cancel failed')),
  });

  const simulateMut = useMutation({
    mutationFn: (paymentId: string) => simulateFeePayment(paymentId),
    onSuccess: (res) => {
      if (res.receipt?.id) setLastReceiptId(res.receipt.id);
      setMessage(`Mock payment completed — receipt ${res.receipt?.receiptNo ?? 'issued'}.`);
      void accountQ.refetch();
      void dashboardQ.refetch();
      if (activeRequest?.id) void activeRequestQ.refetch();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Simulation failed')),
  });

  const cycleGenMut = useMutation({
    mutationFn: () => {
      const sem = selectedStudent?.semester ?? account?.student?.semester ?? 1;
      return bulkGenerateCycleDemands({
        semesterNumber: sem,
        studentIds: [studentId],
        publish: true,
      });
    },
    onSuccess: () => {
      setMessage('Admission fee demands generated for this student.');
      void accountQ.refetch();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Demand generation failed')),
  });

  const bulkGenMut = useMutation({
    mutationFn: () => generateMonthlyDemands(),
    onSuccess: (res: { created?: number; skipped?: number; billingPeriod?: string }) => {
      setMessage(
        `Monthly generation complete — ${res.created ?? 0} created, ${res.skipped ?? 0} skipped (${res.billingPeriod ?? currentBillingPeriod}).`,
      );
      void accountQ.refetch();
      void dashboardQ.refetch();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Monthly generation failed')),
  });

  const monthlyGenMut = useMutation({
    mutationFn: (monthsAhead: number) => generateMonthlyDemands({ studentId, monthsAhead }),
    onSuccess: (res: {
      created?: boolean | number;
      skipped?: boolean | number;
      reason?: string;
      preview?: { totalAmount?: number; billingPeriod?: string };
      demands?: Array<{ period: string; amount: number }>;
      startPeriod?: string;
      endPeriod?: string;
    }) => {
      if (typeof res.created === 'number') {
        const range =
          res.startPeriod && res.endPeriod && res.startPeriod !== res.endPeriod
            ? `${res.startPeriod} → ${res.endPeriod}`
            : (res.startPeriod ?? currentBillingPeriod);
        setMessage(
          `Generated ${res.created} monthly demand(s) (${range}). Select the months below, then collect payment.`,
        );
      } else if (res.created) {
        setMessage(
          `Monthly fee demand generated for ${res.preview?.billingPeriod ?? currentBillingPeriod} — ${formatInr(res.preview?.totalAmount ?? 0)}.`,
        );
      } else {
        setMessage(res.reason ?? 'Monthly fee was not generated for this student.');
      }
      void accountQ.refetch();
      void dashboardQ.refetch();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Monthly fee generation failed')),
  });

  const generateSelectedMonthsMut = useMutation({
    mutationFn: (periods: string[]) => generateMonthlyDemandsForPeriods(studentId, periods),
    onSuccess: async (_results, periods) => {
      setMonthsToGenerate(new Set());
      const refetched = await accountQ.refetch();
      const items = refetched.data?.payableItems ?? [];
      const monthlyIds = new Set(items.filter(isMonthlyPayable).map((p) => p.id));
      setSelectedPayables((prev) => {
        const nonMonthly = [...prev].filter((id) => !monthlyIds.has(id));
        const next = new Set(nonMonthly);
        for (const period of periods) {
          const item = items.find((p) => isMonthlyPayable(p) && p.period === period);
          if (item) next.add(item.id);
        }
        return next;
      });
      setMessage(
        periods.length > 0
          ? `Generated ${periods.length} month(s) and added to payment selection.`
          : 'Months added to payment selection.',
      );
      void dashboardQ.refetch();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Monthly fee generation failed')),
  });

  function setMonthlyPayableSelection(ids: string[]) {
    setSelectedPayables((prev) => {
      const nonMonthly = [...prev].filter((id) => !monthlyPayables.some((p) => p.id === id));
      return new Set([...nonMonthly, ...ids]);
    });
  }

  function isMonthChecked(m: MonthlyFeeTrackerMonth) {
    if (m.status === 'PAID') return false;
    if (m.status === 'PENDING' && m.demandId) {
      return selectedPayables.has(`demand-${m.demandId}`);
    }
    if (m.status === 'NOT_GENERATED') {
      return monthsToGenerate.has(m.period);
    }
    return false;
  }

  function toggleMonthSelection(m: MonthlyFeeTrackerMonth) {
    if (m.status === 'PAID') return;
    if (m.status === 'PENDING' && m.demandId) {
      const id = `demand-${m.demandId}`;
      setSelectedPayables((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }
    if (m.status === 'NOT_GENERATED' && m.period >= currentBillingPeriod) {
      setMonthsToGenerate((prev) => {
        const next = new Set(prev);
        if (next.has(m.period)) next.delete(m.period);
        else next.add(m.period);
        return next;
      });
    }
  }

  function quickSelectMonths(count: number) {
    const months = account?.monthlyTracker?.months ?? [];
    const eligible = months
      .filter((m) => m.status !== 'PAID' && m.period >= currentBillingPeriod)
      .slice(0, count);
    const pendingIds: string[] = [];
    const toGenerate: string[] = [];

    for (const m of eligible) {
      if (m.status === 'PENDING' && m.demandId) {
        pendingIds.push(`demand-${m.demandId}`);
      } else if (m.status === 'NOT_GENERATED') {
        toGenerate.push(m.period);
      }
    }

    if (toGenerate.length) {
      generateSelectedMonthsMut.mutate(toGenerate, {
        onSuccess: () => {
          if (pendingIds.length) setMonthlyPayableSelection(pendingIds);
        },
      });
      if (pendingIds.length) setMonthlyPayableSelection(pendingIds);
    } else {
      setMonthsToGenerate(new Set());
      setMonthlyPayableSelection(pendingIds);
      setMessage(`Selected ${pendingIds.length} month(s) for payment.`);
    }
  }

  function clearMonthlySelection() {
    setMonthsToGenerate(new Set());
    setSelectedPayables((prev) => {
      const nonMonthly = [...prev].filter((id) => !monthlyPayables.some((p) => p.id === id));
      return new Set(nonMonthly);
    });
  }

  function clearAllSelection() {
    setSelectedPayables(new Set());
    setMonthsToGenerate(new Set());
  }

  function removeFromSelection(payableId: string) {
    const payable = payables.find((p) => p.id === payableId);
    setSelectedPayables((prev) => {
      const next = new Set(prev);
      next.delete(payableId);
      return next;
    });
    if (payable?.period && isMonthlyPayable(payable)) {
      setMonthsToGenerate((prev) => {
        const next = new Set(prev);
        next.delete(payable.period!);
        return next;
      });
    }
  }

  function toggleDemandInPayment(demandId: string) {
    const payable = payables.find((p) => p.demandId === demandId);
    if (!payable) return;
    if (selectedPayables.has(payable.id)) {
      removeFromSelection(payable.id);
    } else {
      setSelectedPayables((prev) => new Set([...prev, payable.id]));
    }
  }

  const payableByDemandId = useMemo(() => {
    const map = new Map<string, PayableFeeItem>();
    for (const p of payables) map.set(p.demandId, p);
    return map;
  }, [payables]);

  const monthlySelectedTotal = useMemo(() => {
    return monthlyPayables
      .filter((p) => selectedPayables.has(p.id))
      .reduce((s, p) => s + p.amount, 0);
  }, [monthlyPayables, selectedPayables]);

  function selectAllPendingMonthly() {
    if (!monthlyPayables.length) {
      setMessage('No pending monthly fees — select gray months and generate first.');
      return;
    }
    setMonthsToGenerate(new Set());
    setMonthlyPayableSelection(monthlyPayables.map((p) => p.id));
  }

  const remindersMut = useMutation({
    mutationFn: () => sendDueReminders(),
    onSuccess: (res) => setMessage(res.message),
    onError: (e) => setMessage(apiErrorMessage(e, 'Failed to send reminders')),
  });

  const sendReceiptMut = useMutation({
    mutationFn: (channels: Array<'EMAIL' | 'SMS' | 'WHATSAPP'>) => {
      if (!lastReceiptId) throw new Error('No receipt selected');
      return sendReceiptNotification(lastReceiptId, channels);
    },
    onSuccess: (res) => setMessage(res.message),
    onError: (e) => setMessage(apiErrorMessage(e, 'Failed to send receipt')),
  });

  const cancelReceiptMut = useMutation({
    mutationFn: (receiptId: string) => {
      const reason = window.prompt('Reason for cancelling this receipt?');
      if (!reason?.trim()) throw new Error('Cancellation cancelled');
      return cancelFeeReceipt(receiptId, reason.trim());
    },
    onSuccess: (res) => {
      setMessage(res.message);
      void accountQ.refetch();
      void dashboardQ.refetch();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Cancel failed')),
  });

  const refundMut = useMutation({
    mutationFn: (payload: { receiptId: string; amount: number }) => {
      const reason = window.prompt('Reason for refund?');
      if (!reason?.trim()) throw new Error('Refund cancelled');
      return refundFeePayment({
        receiptId: payload.receiptId,
        amount: payload.amount,
        reason: reason.trim(),
      });
    },
    onSuccess: (res) => {
      setMessage(res.message);
      void accountQ.refetch();
      void dashboardQ.refetch();
    },
    onError: (e) => setMessage(apiErrorMessage(e, 'Refund failed')),
  });

  function selectStudent(row: StudentDirectoryRow) {
    setStudentId(row.id);
    setSelectedStudent(row);
    setSearchFocused(false);
    setQuery(row.enrollmentNumber || row.rollNumber || row.fullName);
    setMessage('');
    setSelectedPayables(new Set());
    setMonthsToGenerate(new Set());
    setExpandedDemand(null);
    setActiveRequest(null);
    setActiveCheckout(null);
    setLastReceiptId(null);
  }

  function togglePayable(id: string) {
    setSelectedPayables((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const tone = dueTone(account);
  const kpis = dashboardQ.data?.kpis;
  const defaulterRows =
    (defaultersQ.data as { rows?: unknown[] })?.rows ?? dashboardQ.data?.defaulters ?? [];
  const collectionModes = settingsQ.data?.collectionModes;
  const upiQrEnabled = collectionModes?.upi_qr ?? settingsQ.data?.officeQrEnabled !== false;
  const deskPaymentMethods = enabledDeskPaymentMethods(collectionModes);
  const selectedDeskMethod = deskPaymentMethods.find((m) => m.id === paymentMethodId);
  const collectorName = session?.user?.displayName ?? session?.user?.email ?? 'Cashier';
  const isCollection = variant === 'collection';

  function resetForNextStudent() {
    setStudentId('');
    setSelectedStudent(null);
    setQuery('');
    setSelectedPayables(new Set());
    setMonthsToGenerate(new Set());
    setExpandedDemand(null);
    setActiveRequest(null);
    setActiveCheckout(null);
    setLastReceiptId(null);
    setManualReference('');
    setPaymentMethodId('');
    setPaymentFormValues({});
    setMessage('Ready for next student — scan roll number or search.');
    window.setTimeout(() => searchRef.current?.focus(), 80);
  }

  useEffect(() => {
    if (!isCollection) return;
    searchRef.current?.focus();
  }, [isCollection]);

  const searchCard = (
    <Card
      className={cn(
        'glass-card border-0',
        isCollection && 'border border-primary/20 shadow-md shadow-primary/5',
      )}
    >
      <CardHeader className={cn('pb-3', isCollection && 'pb-2')}>
        <CardTitle
          className={cn(
            'flex items-center gap-2',
            isCollection ? 'text-lg font-bold' : 'text-base',
          )}
        >
          <Search className={cn(isCollection ? 'h-6 w-6 text-primary' : 'h-5 w-5')} />
          {isCollection ? 'Find student to collect fee' : 'Search student — outstanding fees'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Enrollment no · Roll no · Application no · Name · Mobile · Aadhaar · RFID · Barcode · ABC
          ID
        </p>
        <div className="flex flex-wrap gap-2">
          <div
            className={cn('relative min-w-[280px] flex-1', isCollection ? 'max-w-3xl' : 'max-w-xl')}
          >
            <Input
              ref={searchRef}
              className={cn('pr-9', isCollection && 'h-12 text-base')}
              placeholder={
                isCollection
                  ? 'Scan barcode or type enrollment / roll / name / mobile / ABC ID'
                  : 'Enrollment No / Roll No / Name / Mobile'
              }
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchFocused(true);
                if (message.includes('No student')) setMessage('');
              }}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => window.setTimeout(() => setSearchFocused(false), 180)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && query.trim()) void runExplicitSearch();
                if (e.key === 'Escape') setSearchFocused(false);
              }}
              autoFocus={scanMode || isCollection}
              autoComplete="off"
            />
            {typeaheadQ.isFetching && debouncedQuery.trim().length >= 2 ? (
              <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            ) : null}

            {showSuggestions ? (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-card shadow-lg">
                {typeaheadQ.isFetching && !suggestions.length ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">Searching…</p>
                ) : suggestions.length ? (
                  <>
                    <p className="sticky top-0 border-b bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
                      {suggestions.length} student{suggestions.length === 1 ? '' : 's'} found
                    </p>
                    {suggestions.map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectStudent(row)}
                        className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5 text-left text-sm last:border-0 hover:bg-muted/70"
                      >
                        <span>
                          <strong>{row.fullName}</strong>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {row.enrollmentNumber}
                            {row.rollNumber ? ` · Roll ${row.rollNumber}` : ''}
                            {row.mobileNumber ? ` · ${row.mobileNumber}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-xs text-muted-foreground">
                          {row.programme ?? '—'}
                          {row.shift ? ` · ${row.shift}` : ''}
                        </span>
                      </button>
                    ))}
                  </>
                ) : (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    No students match &ldquo;{debouncedQuery.trim()}&rdquo;
                  </p>
                )}
              </div>
            ) : null}
          </div>
          <Button
            size={isCollection ? 'default' : 'default'}
            className={cn(isCollection && 'h-12 px-6')}
            disabled={!query.trim() || typeaheadQ.isFetching}
            onClick={() => void runExplicitSearch()}
          >
            Search
          </Button>
          <Button
            variant="outline"
            className={cn(isCollection && 'h-12')}
            onClick={() => {
              setScanMode(true);
              searchRef.current?.focus();
              setMessage('Scan mode — scan ID card or RFID barcode, then press Enter.');
            }}
          >
            <QrCode className="mr-2 h-4 w-4" />
            Scan ID card
          </Button>
          {isCollection && account ? (
            <Button variant="secondary" className="h-12" onClick={resetForNextStudent}>
              Next student
            </Button>
          ) : null}
        </div>

        {message && !account && !showSuggestions ? (
          <p
            className={cn(
              'text-sm',
              message.includes('failed') || message.includes('No student')
                ? 'text-destructive'
                : 'text-muted-foreground',
            )}
          >
            {message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );

  const cashierKpis =
    isCollection && account ? (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Banknote}
          label="Admission paid (this student)"
          value={formatInr(account.summary.admissionPaid ?? 0)}
          sub="Cycle 1 = ₹10,600 for new admits"
        />
        <KpiCard
          icon={Wallet}
          label="Monthly paid (this student)"
          value={formatInr(account.summary.monthlyPaid ?? 0)}
        />
        <KpiCard
          icon={BarChart3}
          label="Outstanding (this student)"
          value={formatInr(account.summary.outstanding)}
        />
        <KpiCard
          icon={FileText}
          label="Total paid (this student)"
          value={formatInr(account.summary.totalPaid)}
        />
      </div>
    ) : (
      <div
        className={cn(
          'grid gap-3',
          isCollection ? 'sm:grid-cols-2 lg:grid-cols-5' : 'sm:grid-cols-2 xl:grid-cols-4',
        )}
      >
        <KpiCard
          icon={Wallet}
          label={isCollection ? "Today's collection (college)" : "Today's collections"}
          value={formatInr(kpis?.todayCollection ?? 0)}
        />
        {isCollection ? (
          <>
            <KpiCard
              icon={Banknote}
              label="Monthly collected (college)"
              value={formatInr(kpis?.monthlyCollection ?? 0)}
            />
            <KpiCard
              icon={BarChart3}
              label="Admission collected (college)"
              value={formatInr(kpis?.admissionCollection ?? 0)}
              sub="All students — not the searched student"
            />
          </>
        ) : null}
        <KpiCard
          icon={FileText}
          label="Receipts today"
          value={String(kpis?.receiptCount ?? '—')}
          sub={isCollection ? undefined : 'receipts issued'}
        />
        <KpiCard
          icon={Users}
          label={isCollection ? 'Students with dues' : 'Students with dues'}
          value={String(kpis?.defaulterCount ?? defaulterRows.length)}
        />
        {!isCollection ? (
          <KpiCard
            icon={BarChart3}
            label="Pending dues"
            value={formatInr(kpis?.outstanding ?? 0)}
          />
        ) : (
          <KpiCard
            icon={BarChart3}
            label="Outstanding (college)"
            value={formatInr(kpis?.outstanding ?? 0)}
          />
        )}
      </div>
    );

  return (
    <div className="space-y-4">
      {isCollection ? (
        <>
          <div className="sticky top-0 z-20 -mx-1 rounded-xl bg-background/95 px-1 py-1 backdrop-blur supports-[backdrop-filter]:bg-background/90">
            {searchCard}
          </div>
          {cashierKpis}
        </>
      ) : (
        <>
          {cashierKpis}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkGenMut.isPending}
              onClick={() => bulkGenMut.mutate()}
            >
              Generate monthly fees
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={remindersMut.isPending}
              onClick={() => remindersMut.mutate()}
            >
              <Bell className="mr-2 h-4 w-4" />
              {remindersMut.isPending ? 'Sending…' : 'Send due reminders'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const res = await exportFeeReport('collections', 'csv');
                downloadCsv(res.content ?? '', res.filename ?? 'collections.csv');
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export collection report
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const res = await exportFeeReport('outstanding', 'csv');
                downloadCsv(res.content ?? '', res.filename ?? 'outstanding.csv');
              }}
            >
              <Download className="mr-2 h-4 w-4" />
              Export outstanding report
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.assign('/admin/fees/day-closing')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Day closing report
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.location.assign('/admin/fees/cash-register')}
            >
              <Banknote className="mr-2 h-4 w-4" />
              Cash register
            </Button>
          </div>

          <BulkReceiptPrintPanel
            extraReceiptIds={account?.receipts?.slice(0, 5).map((r) => r.id)}
          />

          <MonthlyFeeSetupGuide compact />

          {message && !account && !isCollection ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {message}
            </div>
          ) : null}

          {searchCard}
        </>
      )}

      {/* ERP desk split */}
      {account && selectedStudent ? (
        <div className="grid gap-4 xl:grid-cols-12">
          {/* Student profile */}
          <div className="space-y-4 xl:col-span-3">
            <StudentSummaryCard account={account} student={selectedStudent} tone={tone} />
            <FeePaymentHistoryCard
              rows={account.paymentHistory ?? []}
              onUpdated={() => void accountQ.refetch()}
            />
            {monthlyNeedsActivation ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                <p className="font-semibold">Monthly fee not activated</p>
                <p className="mt-1 text-xs">
                  No monthly demand exists for this student yet. Use{' '}
                  <strong>Select months to pay</strong> below — tick the months needed, then click{' '}
                  <strong>Generate selected months</strong>.
                </p>
              </div>
            ) : null}
            <FeeTimeline tracker={account.monthlyTracker} monthlyFees={account.monthlyFees} />
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() =>
                window.location.assign(
                  `/admin/fees/external-payments?studentId=${encodeURIComponent(studentId)}`,
                )
              }
            >
              Record external payment (SBI / bank / QR)
            </Button>
            <HallTicketCard hallTicket={account.hallTicket} />
          </div>

          {/* Fee ledger + payable */}
          <div className="space-y-4 xl:col-span-5">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Fee ledger</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Tick <strong>Pay</strong> to include a fee; uncheck to remove it before collecting
                  payment.
                </p>
              </CardHeader>
              <CardContent className="max-h-[320px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="w-10 pb-2 pr-2">Pay</th>
                      <th className="pb-2 pr-2">Fee type</th>
                      <th className="pb-2 pr-2">Month / period</th>
                      <th className="pb-2 pr-2 text-right">Amount</th>
                      <th className="pb-2 pr-2 text-right">Paid</th>
                      <th className="pb-2 pr-2 text-right">Balance</th>
                      <th className="pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(account.demands ?? []).map((row) => (
                      <LedgerRow
                        key={row.demandId}
                        row={row}
                        payable={payableByDemandId.get(row.demandId)}
                        selected={selectedDemandIds.has(row.demandId)}
                        expanded={expandedDemand === row.demandId}
                        onTogglePay={() => toggleDemandInPayment(row.demandId)}
                        onToggle={() =>
                          setExpandedDemand((id) => (id === row.demandId ? null : row.demandId))
                        }
                      />
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            <MonthlyMonthPickerCard
              tracker={account.monthlyTracker}
              monthlyStatus={account.monthlyFeeStatus?.status}
              currentPeriod={currentBillingPeriod}
              monthlyPayables={monthlyPayables}
              selectedPayables={selectedPayables}
              monthsToGenerate={monthsToGenerate}
              monthlySelectedTotal={monthlySelectedTotal}
              isMonthChecked={isMonthChecked}
              onToggleMonth={toggleMonthSelection}
              onQuickSelect={quickSelectMonths}
              onSelectAllPending={selectAllPendingMonthly}
              onClearMonths={clearMonthlySelection}
              onRemoveMonth={toggleMonthSelection}
              onGenerateSelected={() => generateSelectedMonthsMut.mutate([...monthsToGenerate])}
              onGenerateCurrent={() => monthlyGenMut.mutate(1)}
              showCurrentGenerate={monthlyNotGenerated}
              generating={monthlyGenMut.isPending || generateSelectedMonthsMut.isPending}
            />

            <AdmissionFeeCard
              cycles={account.admissionCycles}
              notGeneratedCount={notGeneratedCycles.length}
              onGenerate={notGeneratedCycles.length ? () => cycleGenMut.mutate() : undefined}
              generating={cycleGenMut.isPending}
            />

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Other outstanding fees</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Admission and session fees. Monthly tuition is selected in the month picker above.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {otherPayables.length ? (
                  otherPayables.map((item) => (
                    <label
                      key={item.id}
                      className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2"
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedPayables.has(item.id)}
                        onChange={() => togglePayable(item.id)}
                      />
                      <div className="flex-1">
                        <p className="font-medium">{item.label}</p>
                        {item.fineAmount > 0 ? (
                          <p className="text-xs text-rose-600">
                            Includes late fine {formatInr(item.fineAmount)}
                          </p>
                        ) : null}
                      </div>
                      <span className="font-semibold">{formatInr(item.amount)}</span>
                    </label>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No other dues — use month picker for tuition.
                  </p>
                )}
                <div className="flex justify-between border-t pt-3 text-base font-bold">
                  <span>Total selected (all fees)</span>
                  <span>{formatInr(selectedTotal)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment facilitation — sticky on desktop for cashier flow */}
          <div className="space-y-4 xl:col-span-4 xl:sticky xl:top-20 xl:max-h-[calc(100vh-5rem)] xl:self-start xl:overflow-y-auto">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="h-4 w-4" />
                  {isCollection ? 'Quick collection' : 'Payment facilitation'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Select fees → choose payment method → enter transaction details → collect receipt.
                </p>

                <div className="rounded-lg border bg-muted/30 px-3 py-2">
                  {selectedBreakdown.length ? (
                    <>
                      <ul className="mb-2 space-y-1.5 border-b pb-2 text-sm">
                        {selectedBreakdown.map((item) => (
                          <li key={item.id} className="flex items-start justify-between gap-2">
                            <span className="min-w-0 flex-1">
                              <span className="font-medium">{item.title}</span>
                              {item.isMonthly ? (
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  Monthly tuition
                                </span>
                              ) : (
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {item.subtitle}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 font-semibold">{formatInr(item.amount)}</span>
                            <button
                              type="button"
                              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-rose-100 hover:text-rose-700"
                              title="Remove from payment"
                              onClick={() => removeFromSelection(item.id)}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="mb-2 h-7 px-2 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                        onClick={clearAllSelection}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Remove all selected
                      </Button>
                    </>
                  ) : (
                    <p className="mb-2 text-xs text-muted-foreground">
                      Select months or fees to collect payment.
                    </p>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total selected</span>
                    <span className="font-bold">{formatInr(selectedTotal)}</span>
                  </div>
                </div>

                <FeeCollectionPaymentFields
                  collectionModes={collectionModes}
                  methodId={paymentMethodId}
                  values={paymentFormValues}
                  collectedByName={collectorName}
                  onMethodChange={setPaymentMethodId}
                  onValuesChange={setPaymentFormValues}
                />

                {paymentMethodId && paymentMethodId !== 'gateway' ? (
                  <Button
                    className="w-full"
                    disabled={
                      !selectedTotal ||
                      !payables.length ||
                      deskCollectMut.isPending ||
                      !paymentMethodId
                    }
                    onClick={() => deskCollectMut.mutate()}
                  >
                    {deskCollectMut.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving…
                      </>
                    ) : selectedDeskMethod?.pendingClearance ? (
                      <>
                        <Banknote className="mr-2 h-4 w-4" />
                        Submit cheque (pending clearance)
                      </>
                    ) : (
                      <>
                        <Banknote className="mr-2 h-4 w-4" />
                        Collect & generate receipt
                      </>
                    )}
                  </Button>
                ) : !paymentMethodId ? (
                  <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    Select a <strong>payment method</strong> above before collecting.
                  </p>
                ) : null}

                {(upiQrEnabled && paymentMethodId === 'gateway') ||
                (upiQrEnabled && !paymentMethodId) ? (
                  <div className="space-y-2 border-t pt-3">
                    <Label className="block">Online gateway — UPI QR / payment link</Label>
                    <div className="flex flex-wrap gap-2">
                      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm">
                        <input
                          type="radio"
                          name="payChannel"
                          checked={payChannel === 'OFFICE_QR'}
                          onChange={() => setPayChannel('OFFICE_QR')}
                        />
                        Dynamic UPI QR
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm">
                        <input
                          type="radio"
                          name="payChannel"
                          checked={payChannel === 'PAYMENT_LINK'}
                          onChange={() => setPayChannel('PAYMENT_LINK')}
                        />
                        Payment link
                      </label>
                    </div>
                  </div>
                ) : null}

                {(upiQrEnabled && paymentMethodId === 'gateway') ||
                (upiQrEnabled && !paymentMethodId) ? (
                  <Button
                    className="w-full"
                    disabled={!selectedTotal || qrRequestMut.isPending || !payables.length}
                    onClick={() => qrRequestMut.mutate()}
                  >
                    {qrRequestMut.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating…
                      </>
                    ) : payChannel === 'OFFICE_QR' ? (
                      <>
                        <QrCode className="mr-2 h-4 w-4" />
                        Generate payment QR
                      </>
                    ) : (
                      <>
                        <Link2 className="mr-2 h-4 w-4" />
                        Generate payment link
                      </>
                    )}
                  </Button>
                ) : null}

                {activeCheckout && activeRequest?.status === 'PENDING' ? (
                  <PaymentRequestPanel
                    checkout={activeCheckout}
                    request={activeRequest}
                    onCancel={() => activeRequest && cancelRequestMut.mutate(activeRequest.id)}
                    onSimulate={() =>
                      activeCheckout.paymentId && simulateMut.mutate(activeCheckout.paymentId)
                    }
                    simulating={simulateMut.isPending}
                    cancelling={cancelRequestMut.isPending}
                  />
                ) : null}

                {activeRequest?.status === 'PAID' ? (
                  <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-2 text-emerald-900">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                      <div>
                        <p className="font-semibold">Payment successful</p>
                        {lastReceiptId ? (
                          <p className="text-sm">
                            Receipt:{' '}
                            {account.receipts.find((r) => r.id === lastReceiptId)?.receiptNo ??
                              lastReceiptId}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={!lastReceiptId}
                        onClick={() => lastReceiptId && void openFeeReceiptPdf(lastReceiptId)}
                      >
                        <Printer className="mr-2 h-4 w-4" />
                        Print receipt
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!lastReceiptId || sendReceiptMut.isPending}
                        onClick={() => sendReceiptMut.mutate(['WHATSAPP'])}
                      >
                        <MessageSquare className="mr-1 h-3.5 w-3.5" />
                        Send WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!lastReceiptId || sendReceiptMut.isPending}
                        onClick={() => sendReceiptMut.mutate(['EMAIL'])}
                      >
                        <Mail className="mr-1 h-3.5 w-3.5" />
                        Send email
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setActiveRequest(null);
                          setActiveCheckout(null);
                        }}
                      >
                        New payment
                      </Button>
                    </div>
                  </div>
                ) : null}

                {activeRequest?.status === 'EXPIRED' ? (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>QR expired. Generate a new payment request to continue.</p>
                  </div>
                ) : null}

                {message ? (
                  <div
                    className={cn(
                      'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
                      message.includes('successful') ||
                        message.includes('created') ||
                        message.includes('generated')
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : 'border-rose-200 bg-rose-50 text-rose-900',
                    )}
                  >
                    {message.includes('failed') || message.includes('No student') ? (
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <p>{message}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Payment requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(paymentRequestsQ.data ?? []).slice(0, 8).map((req) => (
                  <div
                    key={req.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{req.requestNo}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatInr(Number(req.amount))} · {req.channel.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <PaymentStatusBadge status={req.status} />
                  </div>
                ))}
                {!paymentRequestsQ.data?.length ? (
                  <p className="text-sm text-muted-foreground">No payment requests yet.</p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Recent receipts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {account.receipts.slice(0, 5).map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div>
                      <span className="font-medium">{r.receiptNo}</span>
                      <span className="ml-2 text-muted-foreground">{formatInr(r.amount)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void openFeeReceiptPdf(r.id)}
                      >
                        <Printer className="mr-1 h-3 w-3" />
                        Print
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void saveFeeReceiptPdf(r.id, r.receiptNo)}
                      >
                        <Download className="mr-1 h-3 w-3" />
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={cancelReceiptMut.isPending}
                        onClick={() => cancelReceiptMut.mutate(r.id)}
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={refundMut.isPending}
                        onClick={() => refundMut.mutate({ receiptId: r.id, amount: r.amount })}
                      >
                        Refund
                      </Button>
                    </div>
                  </div>
                ))}
                {!account.receipts.length ? (
                  <p className="text-sm text-muted-foreground">No receipts yet.</p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : isCollection ? (
        <div className="rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 px-6 py-16 text-center">
          <Search className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-lg font-semibold">Search or scan to begin fee collection</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Use the search bar above — scan a roll number or enrollment barcode and press Enter for
            the next student.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function StudentSummaryCard({
  account,
  student,
  tone,
}: {
  account: StudentFeeAccount;
  student: StudentDirectoryRow;
  tone: string;
}) {
  const s = account.student;
  return (
    <Card
      className={cn(
        'border-2',
        tone === 'clear' && 'border-emerald-300 bg-emerald-50/50',
        tone === 'partial' && 'border-amber-300 bg-amber-50/50',
        tone === 'overdue' && 'border-rose-300 bg-rose-50/50',
      )}
    >
      <CardContent className="space-y-2 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">{s?.name ?? student.fullName}</h2>
            <p className="font-mono text-sm text-muted-foreground">
              {s?.enrollmentNumber ?? student.enrollmentNumber}
            </p>
            {student.rollNumber ? (
              <p className="text-xs text-muted-foreground">Roll: {student.rollNumber}</p>
            ) : null}
          </div>
          <DueBadge tone={tone} />
        </div>
        <p className="text-sm">{s?.program ?? student.programme}</p>
        <p className="text-sm text-muted-foreground">
          {semLabel(s?.semester ?? student.semester)}
          {s?.shift || student.shift ? ` · ${s?.shift ?? student.shift} shift` : ''}
        </p>
        <p className="text-sm">Mobile: {s?.mobile ?? student.mobileNumber ?? '—'}</p>
        <p className="text-sm">Status: {s?.status ?? (student.isActive ? 'Active' : 'Inactive')}</p>
        <div className="grid grid-cols-2 gap-2 border-t pt-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="font-bold text-rose-700">{formatInr(account.summary.outstanding)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last payment</p>
            <p className="font-bold">
              {account.lastPayment ? formatInr(account.lastPayment.amount) : '—'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FinancialSnapshot({ account }: { account: StudentFeeAccount }) {
  const admissionStatus = account.admissionFeeStatus?.status ?? '—';
  const monthlyStatus = account.monthlyFeeStatus?.status ?? '—';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Financial snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <Row label="Total demand" value={formatInr(account.summary.totalDemand)} />
        <Row label="Admission paid" value={formatInr(account.summary.admissionPaid ?? 0)} />
        <Row label="Monthly paid" value={formatInr(account.summary.monthlyPaid ?? 0)} />
        <Row label="Total paid" value={formatInr(account.summary.totalPaid)} />
        <Row label="Outstanding" value={formatInr(account.summary.outstanding)} bold />
        <Row label="Admission fee" value={admissionStatus} />
        <Row
          label="Monthly fee"
          value={
            (account.monthlyTracker?.pendingMonths ?? 0) === 0 &&
            (account.monthlyTracker?.paidMonths ?? 0) === 0 &&
            (account.monthlyFees?.length ?? 0) === 0
              ? 'Not generated — activate below'
              : monthlyStatus === 'NOT_GENERATED'
                ? 'Not generated — activate below'
                : monthlyStatus === 'PAID'
                  ? `Clear (${account.monthlyTracker?.paidMonths ?? 0} months paid)`
                  : `${monthlyStatus} · ${account.monthlyTracker?.pendingMonths ?? 0} pending`
          }
        />
        {(account.summary.scholarshipTotal ?? 0) > 0 ? (
          <Row label="Scholarship" value={formatInr(account.summary.scholarshipTotal!)} />
        ) : null}
        {(account.summary.concessionTotal ?? 0) > 0 ? (
          <Row label="Concession" value={formatInr(account.summary.concessionTotal!)} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function FeeTimeline({
  tracker,
  monthlyFees,
}: {
  tracker?: StudentFeeAccount['monthlyTracker'];
  monthlyFees: StudentFeeAccount['monthlyFees'];
}) {
  if (tracker?.months?.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Monthly fee tracker · {tracker.year}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-1.5">
            {tracker.months.map((m) => (
              <div
                key={m.period}
                className={cn(
                  'rounded-md border px-1 py-1.5 text-center text-[10px] font-semibold',
                  m.status === 'PAID' && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                  m.status === 'PENDING' && 'border-rose-200 bg-rose-50 text-rose-800',
                  m.status === 'NOT_GENERATED' && 'border-slate-200 bg-slate-50 text-slate-500',
                )}
                title={m.label}
              >
                {m.shortLabel}
                <div className="text-[9px] font-normal">
                  {m.status === 'PAID' ? '✓' : m.status === 'PENDING' ? '✗' : '—'}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Paid {tracker.paidMonths} · Pending {tracker.pendingMonths}
            {tracker.months.some(
              (m) =>
                m.status === 'NOT_GENERATED' &&
                m.period >=
                  `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
            ) ? (
              <span> · Gray = not generated — select in &quot;Select months to pay&quot;</span>
            ) : null}
          </p>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...monthlyFees].sort((a, b) => a.period.localeCompare(b.period));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Fee timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sorted.map((m) => (
          <div key={m.demandId} className="flex items-center justify-between text-sm">
            <span>{m.monthLabel}</span>
            <span className="flex items-center gap-2">
              {m.status === 'PAID' ? (
                <Badge className="bg-emerald-100 text-emerald-800">Paid</Badge>
              ) : m.balanceAmount > 0 ? (
                <Badge className="bg-rose-100 text-rose-800">Due</Badge>
              ) : (
                <Badge variant="secondary">Upcoming</Badge>
              )}
            </span>
          </div>
        ))}
        {!sorted.length ? (
          <p className="text-sm text-muted-foreground">No monthly history.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function HallTicketCard({ hallTicket }: { hallTicket?: StudentFeeAccount['hallTicket'] }) {
  if (!hallTicket) return null;
  return (
    <Card
      className={
        hallTicket.blocked ? 'border-rose-200 bg-rose-50/40' : 'border-emerald-200 bg-emerald-50/40'
      }
    >
      <CardContent className="flex items-start gap-2 pt-5">
        <Ticket className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-semibold">
            Hall ticket: {hallTicket.blocked ? 'Blocked' : 'Eligible'}
          </p>
          {hallTicket.blocked ? (
            <p className="text-xs text-rose-800">
              Outstanding {formatInr(hallTicket.outstandingAmount)}
            </p>
          ) : (
            <p className="text-xs text-emerald-800">Fees clear for examination</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AdmissionFeeCard({
  cycles,
  notGeneratedCount,
  onGenerate,
  generating,
}: {
  cycles: StudentFeeAccount['admissionCycles'];
  notGeneratedCount?: number;
  onGenerate?: () => void;
  generating?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Admission & session fee</CardTitle>
          {notGeneratedCount ? (
            <Button size="sm" variant="outline" disabled={generating} onClick={onGenerate}>
              {generating ? 'Generating…' : `Generate demands (${notGeneratedCount})`}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {cycles.map((c) => (
          <div key={c.cycleId} className="rounded-lg border px-3 py-2 text-sm">
            <p className="font-medium">{c.cycleName}</p>
            <p className="text-xs text-muted-foreground">{c.covers}</p>
            <p className="mt-1 font-semibold">
              {formatInr(c.totalAmount ?? c.configuredAmount)}
              {c.paidAmount != null && c.paidAmount > 0 ? (
                <span className="font-normal text-muted-foreground">
                  {' '}
                  · paid {formatInr(c.paidAmount)}
                </span>
              ) : null}
              {' · '}
              <StatusPill status={c.status} />
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function MonthlyMonthPickerCard({
  tracker,
  monthlyStatus,
  currentPeriod,
  monthlyPayables,
  selectedPayables,
  monthsToGenerate,
  monthlySelectedTotal,
  isMonthChecked,
  onToggleMonth,
  onQuickSelect,
  onSelectAllPending,
  onClearMonths,
  onRemoveMonth,
  onGenerateSelected,
  onGenerateCurrent,
  showCurrentGenerate,
  generating,
}: {
  tracker?: StudentFeeAccount['monthlyTracker'];
  monthlyStatus?: string;
  currentPeriod: string;
  monthlyPayables: PayableFeeItem[];
  selectedPayables: Set<string>;
  monthsToGenerate: Set<string>;
  monthlySelectedTotal: number;
  isMonthChecked: (m: MonthlyFeeTrackerMonth) => boolean;
  onToggleMonth: (m: MonthlyFeeTrackerMonth) => void;
  onQuickSelect: (count: number) => void;
  onSelectAllPending: () => void;
  onClearMonths: () => void;
  onRemoveMonth: (m: MonthlyFeeTrackerMonth) => void;
  onGenerateSelected: () => void;
  onGenerateCurrent: () => void;
  showCurrentGenerate: boolean;
  generating: boolean;
}) {
  const [year, month] = currentPeriod.split('-');
  const periodLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
  const quickOptions = [1, 2, 3, 6];
  const months = tracker?.months ?? [];
  const selectableFuture = months.filter((m) => m.status !== 'PAID' && m.period >= currentPeriod);

  function monthAmount(m: MonthlyFeeTrackerMonth) {
    if (m.balanceAmount != null && m.balanceAmount > 0) return m.balanceAmount;
    if (m.amount != null && m.amount > 0) return m.amount;
    const payable = monthlyPayables.find((p) => p.period === m.period);
    return payable?.amount ?? null;
  }

  const selectedMonthItems = months.filter((m) => isMonthChecked(m) && m.status !== 'PAID');

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Select months to pay</CardTitle>
        <p className="text-xs text-muted-foreground">
          Tick one or more months — pay only what the student wants. Uncheck or click{' '}
          <strong>Remove</strong> on a month to take it out before payment.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <StatusPill status={monthlyStatus ?? 'NOT_GENERATED'} />
        </div>
        {tracker ? (
          <div className="flex justify-between">
            <span className="text-muted-foreground">This year</span>
            <span>
              Paid {tracker.paidMonths} · Pending {tracker.pendingMonths}
            </span>
          </div>
        ) : null}

        {months.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {months.map((m) => {
              const checked = isMonthChecked(m);
              const disabled =
                m.status === 'PAID' || (m.status === 'NOT_GENERATED' && m.period < currentPeriod);
              const amount = monthAmount(m);
              return (
                <label
                  key={m.period}
                  className={cn(
                    'flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-2 py-2 text-center transition-colors',
                    m.status === 'PAID' &&
                      'cursor-default border-emerald-200 bg-emerald-50/60 opacity-80',
                    m.status === 'PENDING' && checked && 'border-primary bg-primary/5',
                    m.status === 'PENDING' && !checked && 'border-rose-200 bg-rose-50/40',
                    m.status === 'NOT_GENERATED' &&
                      m.period >= currentPeriod &&
                      (checked ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-slate-50'),
                    m.status === 'NOT_GENERATED' &&
                      m.period < currentPeriod &&
                      'cursor-not-allowed border-slate-100 bg-slate-50 opacity-50',
                    disabled && m.status !== 'PAID' && 'cursor-not-allowed',
                  )}
                  title={m.label}
                >
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => onToggleMonth(m)}
                  />
                  <span className="text-xs font-semibold">{m.shortLabel}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {m.status === 'PAID'
                      ? 'Paid'
                      : amount != null
                        ? formatInr(amount)
                        : m.status === 'NOT_GENERATED'
                          ? 'Not generated'
                          : 'Due'}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No monthly tracker for this year.</p>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-xs text-muted-foreground">Quick select from {periodLabel}:</span>
          {quickOptions.map((n) => (
            <Button
              key={n}
              size="sm"
              variant="secondary"
              disabled={generating || selectableFuture.length < n}
              onClick={() => onQuickSelect(n)}
            >
              {n} {n === 1 ? 'month' : 'months'}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            disabled={generating || !monthlyPayables.length}
            onClick={onSelectAllPending}
          >
            All pending
          </Button>
          <Button size="sm" variant="ghost" disabled={generating} onClick={onClearMonths}>
            Remove all months
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {monthsToGenerate.size > 0 ? (
            <Button size="sm" disabled={generating} onClick={onGenerateSelected}>
              {generating
                ? 'Generating…'
                : `Generate ${monthsToGenerate.size} selected month${monthsToGenerate.size > 1 ? 's' : ''}`}
            </Button>
          ) : null}
          <Button size="sm" variant="outline" disabled={generating} onClick={onGenerateCurrent}>
            {generating
              ? 'Generating…'
              : showCurrentGenerate
                ? `Generate ${periodLabel}`
                : `Regenerate ${periodLabel}`}
          </Button>
        </div>

        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Monthly fees selected</p>
              {selectedMonthItems.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedMonthItems.map((m) => (
                    <span
                      key={m.period}
                      className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium"
                    >
                      {m.label}
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-rose-100 hover:text-rose-700"
                        title={`Remove ${m.label}`}
                        onClick={() => onRemoveMonth(m)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-0.5 text-xs font-normal text-muted-foreground">
                  No months selected
                </p>
              )}
            </div>
            <span className="shrink-0 font-semibold">
              {formatInr(monthlySelectedTotal)}
              {monthsToGenerate.size > 0 ? (
                <span className="ml-1 block text-right text-xs font-normal text-amber-700">
                  +{monthsToGenerate.size} to generate
                </span>
              ) : null}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LedgerRow({
  row,
  payable,
  selected,
  expanded,
  onTogglePay,
  onToggle,
}: {
  row: FeeDemandRow;
  payable?: PayableFeeItem;
  selected?: boolean;
  expanded: boolean;
  onTogglePay?: () => void;
  onToggle: () => void;
}) {
  const periodDisplay = formatPeriodLabel(row.period, row.periodLabel);
  const isMonthly = row.demandType === MONTHLY_DEMAND_TYPE;
  const canPay = Boolean(payable) && row.balanceAmount > 0;

  return (
    <>
      <tr
        className={cn(
          'border-t hover:bg-muted/40',
          selected && 'bg-primary/5 ring-1 ring-inset ring-primary/20',
        )}
      >
        <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
          {canPay ? (
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={Boolean(selected)}
              title={selected ? 'Remove from payment' : 'Include in payment'}
              onChange={() => onTogglePay?.()}
            />
          ) : (
            <span className="inline-block w-4 text-center text-xs text-muted-foreground">—</span>
          )}
        </td>
        <td className="cursor-pointer py-2 pr-2" onClick={onToggle}>
          <span>{row.feeType}</span>
          {isMonthly ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">Tuition fee</span>
          ) : null}
          {selected ? (
            <span className="mt-0.5 block text-xs font-medium text-primary">
              Selected for payment
            </span>
          ) : null}
        </td>
        <td className="cursor-pointer py-2 pr-2" onClick={onToggle}>
          <span className="font-medium">{periodDisplay}</span>
          {row.period && row.period !== periodDisplay ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">{row.period}</span>
          ) : null}
        </td>
        <td className="cursor-pointer py-2 pr-2 text-right" onClick={onToggle}>
          {formatInr(row.totalAmount)}
        </td>
        <td className="cursor-pointer py-2 pr-2 text-right" onClick={onToggle}>
          {formatInr(row.paidAmount)}
        </td>
        <td className="cursor-pointer py-2 pr-2 text-right font-medium" onClick={onToggle}>
          {formatInr(row.balanceAmount)}
        </td>
        <td className="cursor-pointer py-2" onClick={onToggle}>
          <StatusPill status={row.status} />
        </td>
      </tr>
      {expanded && row.lines?.length ? (
        <tr className="bg-muted/20">
          <td colSpan={7} className="px-4 py-2">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Breakdown</p>
            <ul className="space-y-0.5 text-xs">
              {row.lines.map((line) => (
                <li key={line.code} className="flex justify-between">
                  <span>{line.name}</span>
                  <span>{formatInr(line.amount)}</span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function PaymentRequestPanel({
  checkout,
  request,
  onCancel,
  onSimulate,
  simulating,
  cancelling,
}: {
  checkout: {
    qrImageUrl?: string | null;
    paymentLinkUrl?: string | null;
    mode: string;
    paymentId?: string;
    expiresAt: string;
    requestNo: string;
  };
  request: FeePaymentRequest;
  onCancel: () => void;
  onSimulate: () => void;
  simulating: boolean;
  cancelling: boolean;
}) {
  const expiresMs = new Date(checkout.expiresAt).getTime() - Date.now();
  const minsLeft = Math.max(0, Math.ceil(expiresMs / 60_000));

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Reference: {checkout.requestNo}</p>
          <p className="text-xs text-muted-foreground">
            Amount {formatInr(Number(request.amount))} · Valid for {minsLeft} min
          </p>
        </div>
        <PaymentStatusBadge status={request.status} />
      </div>

      {checkout.qrImageUrl && request.channel !== 'PAYMENT_LINK' ? (
        <div className="flex flex-col items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={checkout.qrImageUrl}
            alt="UPI payment QR"
            className="h-56 w-56 rounded-lg border bg-white p-2"
          />
          <p className="text-center text-xs text-muted-foreground">
            Student scans with PhonePe, GPay, Paytm, or BHIM UPI
          </p>
        </div>
      ) : null}

      {checkout.paymentLinkUrl ? (
        <div className="space-y-2">
          <Label className="text-xs">Payment link</Label>
          <div className="flex gap-2">
            <Input readOnly value={checkout.paymentLinkUrl} className="text-xs" />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(checkout.paymentLinkUrl!);
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" asChild>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Pay college fees: ${checkout.paymentLinkUrl}`)}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageSquare className="mr-1 h-3.5 w-3.5" />
                WhatsApp
              </a>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a
                href={`sms:?body=${encodeURIComponent(`Pay college fees: ${checkout.paymentLinkUrl}`)}`}
              >
                <MessageSquare className="mr-1 h-3.5 w-3.5" />
                SMS
              </a>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a
                href={`mailto:?subject=${encodeURIComponent('College fee payment')}&body=${encodeURIComponent(checkout.paymentLinkUrl)}`}
              >
                <Mail className="mr-1 h-3.5 w-3.5" />
                Email
              </a>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Waiting for payment confirmation…
      </div>

      <div className="flex flex-wrap gap-2">
        {checkout.mode === 'MOCK' && checkout.paymentId ? (
          <Button size="sm" variant="secondary" disabled={simulating} onClick={onSimulate}>
            {simulating ? 'Processing…' : 'Simulate payment (dev)'}
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" disabled={cancelling} onClick={onCancel}>
          <XCircle className="mr-1 h-3.5 w-3.5" />
          Cancel request
        </Button>
      </div>
    </div>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cls =
    s === 'PAID'
      ? 'bg-emerald-100 text-emerald-800'
      : s === 'PENDING'
        ? 'bg-amber-100 text-amber-800'
        : s === 'EXPIRED'
          ? 'bg-slate-100 text-slate-600'
          : 'bg-rose-100 text-rose-800';
  return <Badge className={cn('text-[10px] uppercase', cls)}>{status}</Badge>;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1 text-xl font-bold">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-bold' : ''}>{value}</span>
    </div>
  );
}

function DueBadge({ tone }: { tone: string }) {
  if (tone === 'clear') return <Badge className="bg-emerald-500">No dues</Badge>;
  if (tone === 'overdue') return <Badge className="bg-rose-500">Overdue</Badge>;
  return <Badge className="bg-amber-500">Partial dues</Badge>;
}

function StatusPill({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cls =
    s === 'PAID'
      ? 'text-emerald-700'
      : s === 'PARTIAL' || s === 'PENDING'
        ? 'text-amber-700'
        : 'text-rose-700';
  return <span className={cn('text-xs font-semibold uppercase', cls)}>{status}</span>;
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
