'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { schoolDocumentDisplayStatus } from '@/lib/school-document-display-status';
import { schoolDocumentPreviewKind } from '@/lib/school-document-blob';
import { PAYMENT_REJECT_REASONS } from '@/lib/school-office/application-status';
import { SchoolOfficeStatusBadge } from '@/components/school-office/status-badge';
import {
  SchoolOfficeSummaryCards,
  SchoolOfficeWorkQueueTable,
} from '@/components/school-office/work-queue-table';
import { SchoolOfficeReviewSidePanel } from '@/components/school-office/review-side-panel';
import {
  downloadSchoolOfficeDocument,
  fetchSchoolOfficeApplications,
  fetchSchoolOfficeSummary,
  rejectSchoolPayment,
  verifySchoolPayment,
} from '@/services/school-admissions';

export type PaymentQueueMode = 'all' | 'pending' | 'verified' | 'rejected';

function paymentFilterParams(mode: PaymentQueueMode): {
  paymentStatus?: string;
} {
  if (mode === 'verified') return { paymentStatus: 'PAID' };
  // pending/rejected/all: load broadly and refine client-side by receipt status
  return {};
}

export function SchoolPaymentWorkspace({ mode }: { mode: PaymentQueueMode }) {
  const enabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>(PAYMENT_REJECT_REASONS[0]);
  const [otherReason, setOtherReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [receiptKind, setReceiptKind] = useState<'image' | 'pdf' | 'other'>('other');

  const summary = useQuery({
    queryKey: ['school-office-summary'],
    queryFn: fetchSchoolOfficeSummary,
    enabled,
  });

  const list = useQuery({
    queryKey: ['school-office-payments', mode, search, category],
    queryFn: () =>
      fetchSchoolOfficeApplications({
        search: search || undefined,
        category: category || undefined,
        ...paymentFilterParams(mode),
        limit: 100,
      }),
    enabled,
  });

  const rows = useMemo(() => {
    const data = list.data?.data ?? [];
    return data.filter((app) => {
      const receipt = (app.receiptVerificationStatus ?? '').toUpperCase();
      if (mode === 'pending') {
        return receipt === 'PENDING';
      }
      if (mode === 'verified') {
        return app.paymentStatus === 'PAID' || receipt === 'VERIFIED';
      }
      if (mode === 'rejected') {
        return receipt === 'REJECTED';
      }
      return Boolean(
        app.documents?.some((d) => d.slotCode === 'PAYMENT_RECEIPT') ||
        app.paymentStatus === 'PAID' ||
        receipt,
      );
    });
  }, [list.data?.data, mode]);

  const reviewing = rows.find((r) => r.id === reviewId) ?? null;

  const openReview = async (id: string) => {
    setError(null);
    setReviewId(id);
    if (receiptUrl) URL.revokeObjectURL(receiptUrl);
    setReceiptUrl(null);
    setReceiptKind('other');
    try {
      const blob = await downloadSchoolOfficeDocument(id, 'PAYMENT_RECEIPT');
      const url = URL.createObjectURL(blob);
      setReceiptKind(schoolDocumentPreviewKind(blob));
      setReceiptUrl(url);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const closeReview = () => {
    if (receiptUrl) URL.revokeObjectURL(receiptUrl);
    setReceiptUrl(null);
    setReceiptKind('other');
    setReviewId(null);
  };

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['school-office-payments'] });
    await queryClient.invalidateQueries({ queryKey: ['school-office-summary'] });
  };

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
      closeReview();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const title =
    mode === 'pending'
      ? 'Pending Verification'
      : mode === 'verified'
        ? 'Verified Payments'
        : mode === 'rejected'
          ? 'Rejected Payments'
          : 'Payment Dashboard';

  return (
    <div className="space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--school-erp-muted)]">
          Fee &amp; Payments
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--school-erp-primary)]">{title}</h1>
        <p className="mt-1 text-sm text-[var(--school-erp-muted)]">
          Verify admission fee receipts in a dedicated work queue.
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <Link href="/admin/school-admissions/payments" className="underline">
            Dashboard
          </Link>
          <Link href="/admin/school-admissions/payments/pending" className="underline">
            Pending
          </Link>
          <Link href="/admin/school-admissions/payments/verified" className="underline">
            Verified
          </Link>
          <Link href="/admin/school-admissions/payments/rejected" className="underline">
            Rejected
          </Link>
        </div>
      </div>

      {mode === 'all' ? (
        <SchoolOfficeSummaryCards
          cards={[
            { id: 'total', label: 'Total Payments', value: summary.data?.total ?? '—' },
            {
              id: 'pending',
              label: 'Pending Verification',
              value: summary.data?.pendingPaymentVerification ?? '—',
            },
            {
              id: 'verified',
              label: 'Verified',
              value: summary.data?.verifiedPayments ?? '—',
            },
            {
              id: 'rejected',
              label: 'Rejected',
              value: summary.data?.rejectedPayments ?? '—',
            },
            {
              id: 'received',
              label: 'Total Amount Received',
              value: `₹${summary.data?.amountReceived ?? 0}`,
            },
            {
              id: 'pending-amt',
              label: 'Amount Pending Verification',
              value: `₹${summary.data?.amountPendingVerification ?? 0}`,
            },
          ]}
        />
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Input
          className="max-w-xs"
          placeholder="Search application no. / name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-10 rounded-md border px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          <option value="GENERAL_UR">General / UR</option>
          <option value="SC">SC</option>
          <option value="ST">ST</option>
          <option value="OBC">OBC</option>
          <option value="OTHER">Other</option>
        </select>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <SchoolOfficeWorkQueueTable
        columns={[
          { key: 'appNo', header: 'Application No.' },
          { key: 'name', header: 'Candidate Name' },
          { key: 'parent', header: 'Parent Name' },
          { key: 'amount', header: 'Amount' },
          { key: 'reference', header: 'Payment Reference / Transaction ID' },
          { key: 'date', header: 'Payment Date' },
          { key: 'receipt', header: 'Receipt' },
          { key: 'status', header: 'Status' },
          { key: 'action', header: 'Action' },
        ]}
        rows={rows.map((app) => {
          const receiptStatus = (app.receiptVerificationStatus ?? '').toUpperCase();
          const hasReceipt =
            Boolean(app.documents?.some((d) => d.slotCode === 'PAYMENT_RECEIPT')) ||
            ['PENDING', 'VERIFIED', 'REJECTED'].includes(receiptStatus);
          const display = schoolDocumentDisplayStatus({
            uploaded: hasReceipt,
            verificationStatus: receiptStatus || null,
          });
          const statusLabel = display.displayLabel;
          const tone = display.tone;
          return {
            id: app.id,
            cells: {
              appNo: (
                <Link
                  href={`/admin/school-admissions/${app.id}?tab=payment`}
                  className="font-medium underline"
                >
                  {app.applicationNumber}
                </Link>
              ),
              name: app.childName || app.firstName,
              parent: app.fatherName || '—',
              amount: `₹${app.applicationFee ?? 100}`,
              reference: app.paymentReference?.trim() || '—',
              date: app.submittedAt
                ? new Date(app.submittedAt).toLocaleDateString('en-IN')
                : new Date(app.createdAt).toLocaleDateString('en-IN'),
              receipt: (
                <button type="button" className="underline" onClick={() => void openReview(app.id)}>
                  View Receipt
                </button>
              ),
              status: <SchoolOfficeStatusBadge label={statusLabel} tone={tone} />,
              action: (
                <Button type="button" size="sm" onClick={() => void openReview(app.id)}>
                  Review
                </Button>
              ),
            },
          };
        })}
        emptyMessage={list.isLoading ? 'Loading…' : 'No payments in this queue.'}
      />

      <SchoolOfficeReviewSidePanel
        open={Boolean(reviewing)}
        title="Payment Review"
        subtitle={
          reviewing
            ? `${reviewing.applicationNumber} · ${reviewing.childName || reviewing.firstName}`
            : undefined
        }
        onClose={closeReview}
        footer={
          reviewing ? (
            <div className="space-y-3">
              <div>
                <Label>Rejection reason</Label>
                <select
                  className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                >
                  {PAYMENT_REJECT_REASONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
              {rejectReason === 'Other' ? (
                <Input
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.target.value)}
                  placeholder="Describe the issue"
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      verifySchoolPayment(reviewing.id, {
                        paymentReference: reviewing.paymentReference?.trim() || undefined,
                      }),
                    )
                  }
                >
                  Verify Payment
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy || (rejectReason === 'Other' && otherReason.trim().length < 3)}
                  onClick={() =>
                    void run(() =>
                      rejectSchoolPayment(
                        reviewing.id,
                        rejectReason === 'Other' ? otherReason.trim() : rejectReason,
                      ),
                    )
                  }
                >
                  Reject Payment
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {reviewing ? (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Application No.</dt>
                <dd className="font-medium">{reviewing.applicationNumber}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Candidate</dt>
                <dd>{reviewing.childName || reviewing.firstName}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Amount</dt>
                <dd>₹{reviewing.applicationFee ?? 100}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">
                  Payment Reference / Transaction ID
                </dt>
                <dd className="font-mono">{reviewing.paymentReference?.trim() || '—'}</dd>
              </div>
            </dl>
            <div className="overflow-hidden rounded-lg border bg-slate-50">
              {receiptUrl ? (
                receiptKind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={receiptUrl}
                    alt="Payment receipt"
                    className="mx-auto max-h-[420px] w-full object-contain"
                  />
                ) : receiptKind === 'pdf' ? (
                  <iframe
                    title="Payment receipt"
                    src={receiptUrl}
                    className="h-[420px] w-full bg-white"
                  />
                ) : (
                  <div className="space-y-3 p-6 text-center">
                    <p className="text-slate-600">Preview is not available for this file type.</p>
                    <Button type="button" variant="outline" asChild>
                      <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                        Open receipt
                      </a>
                    </Button>
                  </div>
                )
              ) : (
                <p className="p-6 text-center text-slate-500">
                  {error ? 'Receipt could not be loaded.' : 'Loading receipt…'}
                </p>
              )}
            </div>
            {receiptUrl ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" asChild>
                  <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                    Open in new tab
                  </a>
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </SchoolOfficeReviewSidePanel>
    </div>
  );
}
