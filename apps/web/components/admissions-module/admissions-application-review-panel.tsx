'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FileText, History, IndianRupee } from 'lucide-react';
import {
  DEFAULT_APPLICATION_FEE,
  DEFAULT_ADMISSION_FEE_MIN,
} from '@/components/admissions-portal/cycle-settings';
import { APPLICANT_FORM_STEPS, DOC_SLOTS } from '@/components/admissions-portal/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  fetchAdmissionAuditLog,
  fetchApplicationDocuments,
  markApplicationAdmissionFee,
  markApplicationPayment,
  sendAdmissionOffer,
  updateApplicationStatus,
  verifyDocument,
  downloadApplicationPdf,
} from '@/services/admissions';
import type { AdmissionApplication } from '@/types/admissions';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type Props = {
  application: AdmissionApplication | null;
  canManage: boolean;
  onEnroll?: () => void;
  enrolling?: boolean;
};

export function AdmissionsApplicationReviewPanel({
  application,
  canManage,
  onEnroll,
  enrolling,
}: Props) {
  const qc = useQueryClient();
  const [activeSection, setActiveSection] = useState(0);
  const [paymentRef, setPaymentRef] = useState('');
  const [admissionFeeRef, setAdmissionFeeRef] = useState('');
  const [admissionFeeAmount, setAdmissionFeeAmount] = useState('');
  const [docRemarks, setDocRemarks] = useState<Record<string, string>>({});

  const appId = application?.id;

  const documents = useQuery({
    queryKey: ['admissions', 'documents', appId],
    queryFn: () => fetchApplicationDocuments(appId!),
    enabled: Boolean(appId),
  });

  const audit = useQuery({
    queryKey: ['admissions', 'audit', 'application', appId],
    queryFn: () => fetchAdmissionAuditLog('application', appId!),
    enabled: Boolean(appId),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admissions'] });
    if (appId) {
      qc.invalidateQueries({ queryKey: ['admissions', 'documents', appId] });
      qc.invalidateQueries({ queryKey: ['admissions', 'audit', 'application', appId] });
    }
  };

  const verifyMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'VERIFIED' | 'REJECTED' }) =>
      verifyDocument(id, { status, remarks: docRemarks[id] }),
    onSuccess: invalidate,
  });

  const paymentMut = useMutation({
    mutationFn: () => {
      const fd = (application?.formData ?? {}) as Record<string, Record<string, unknown>>;
      const meta = (fd.payment ?? {}) as { amountPaise?: number };
      const recorded = application?.amountPaid != null ? Number(application.amountPaid) : null;
      const amount =
        meta.amountPaise != null ? meta.amountPaise / 100 : (recorded ?? DEFAULT_APPLICATION_FEE);
      return markApplicationPayment(appId!, {
        status: 'PAID',
        paymentReference: paymentRef || undefined,
        amountPaid: amount,
      });
    },
    onSuccess: invalidate,
  });

  const statusMut = useMutation({
    mutationFn: (status: string) => updateApplicationStatus(appId!, status),
    onSuccess: invalidate,
  });

  const admissionFeeMut = useMutation({
    mutationFn: (payload: {
      status: string;
      admissionFeeReference?: string;
      admissionFeeAmount?: number;
    }) => markApplicationAdmissionFee(appId!, payload),
    onSuccess: invalidate,
  });

  useEffect(() => {
    if (!application) return;
    setAdmissionFeeAmount(
      application.admissionFeeAmount != null ? String(Number(application.admissionFeeAmount)) : '',
    );
  }, [application?.id, application?.admissionFeeAmount]);

  const offerMut = useMutation({
    mutationFn: () => sendAdmissionOffer(appId!),
    onSuccess: invalidate,
  });

  if (!application) {
    return (
      <Card className="glass-card border-0 lg:sticky lg:top-4">
        <CardContent className="flex min-h-[320px] items-center justify-center p-8 text-center text-sm text-muted-foreground">
          Select an application to review form data, documents, payment, and audit history.
        </CardContent>
      </Card>
    );
  }

  const formData = (application.formData ?? {}) as Record<string, Record<string, unknown>>;
  const paymentMeta = (formData.payment ?? {}) as {
    razorpayOrderId?: string;
    amountPaise?: number;
    currency?: string;
    createdAt?: string;
  };
  const razorpayOrderId = paymentMeta.razorpayOrderId;
  const paymentReference = application.paymentReference;
  const isRazorpayPayment = Boolean(razorpayOrderId || paymentReference?.startsWith('pay_'));
  const amountPaid = application.amountPaid != null ? Number(application.amountPaid) : null;
  const section = APPLICANT_FORM_STEPS[activeSection];

  return (
    <Card className="glass-card border-0 lg:sticky lg:top-4">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-lg">
              {application.applicationNumber} — {application.firstName} {application.lastName}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {application.email}
              {application.cycle ? ` · ${application.cycle.title}` : ''}
            </p>
          </div>
          <StatusPill status={application.status} />
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <MetaPill label="Progress" value={`${application.progressPercent ?? 0}%`} />
          <MetaPill label="Payment" value={application.paymentStatus ?? 'PENDING'} />
          <MetaPill label="Documents" value={application.documentVerificationStatus ?? 'PENDING'} />
          <MetaPill label="Merit" value={String(application.meritScore)} />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <section>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4" />
            Application form
          </p>
          <div className="flex flex-wrap gap-1">
            {APPLICANT_FORM_STEPS.map((s, idx) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveSection(idx)}
                className={cn(
                  'rounded-lg px-2 py-1 text-xs transition',
                  activeSection === idx
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {s.short}
              </button>
            ))}
          </div>
          <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-border bg-muted/20 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {section?.title}
            </p>
            <FormSectionPreview data={formData[section?.key ?? ''] ?? {}} />
          </div>
        </section>

        <section>
          <p className="mb-2 text-sm font-medium">Documents</p>
          <div className="space-y-2">
            {DOC_SLOTS.map(({ code, label }) => {
              const doc =
                documents.data?.find((d) => d.slotCode === code) ??
                application.documents?.find((d) => d.slotCode === code);
              return (
                <div key={code} className="rounded-xl border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc ? doc.verificationStatus : 'Not uploaded'}
                      </p>
                    </div>
                    {doc?.fileUrl ? (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : null}
                  </div>
                  {doc && canManage ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Input
                        className="h-8 max-w-[200px] text-xs"
                        placeholder="Remarks"
                        value={docRemarks[doc.id] ?? ''}
                        onChange={(e) =>
                          setDocRemarks((prev) => ({ ...prev, [doc.id]: e.target.value }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={verifyMut.isPending}
                        onClick={() => verifyMut.mutate({ id: doc.id, status: 'VERIFIED' })}
                      >
                        Verify
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={verifyMut.isPending}
                        onClick={() => verifyMut.mutate({ id: doc.id, status: 'REJECTED' })}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {canManage ? (
          <section className="rounded-xl border border-border p-3">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <IndianRupee className="h-4 w-4" />
              Application fee (₹{DEFAULT_APPLICATION_FEE} registration)
            </p>

            <div className="mb-3 grid gap-2 text-xs sm:grid-cols-2">
              <PaymentDetail label="Status" value={application.paymentStatus ?? 'PENDING'} />
              <PaymentDetail
                label="Channel"
                value={
                  application.paymentStatus === 'WAIVED'
                    ? 'Waived'
                    : isRazorpayPayment
                      ? 'Razorpay (online)'
                      : application.paymentStatus === 'PAID'
                        ? 'Office / manual'
                        : '—'
                }
              />
              {amountPaid != null ? (
                <PaymentDetail label="Amount" value={`₹${amountPaid.toLocaleString('en-IN')}`} />
              ) : null}
              {razorpayOrderId ? (
                <PaymentDetail label="Razorpay order" value={razorpayOrderId} mono />
              ) : null}
              {paymentReference ? (
                <PaymentDetail
                  label={isRazorpayPayment ? 'Razorpay payment' : 'Reference'}
                  value={paymentReference}
                  mono
                />
              ) : null}
              {paymentMeta.createdAt ? (
                <PaymentDetail
                  label="Order created"
                  value={new Date(paymentMeta.createdAt).toLocaleString()}
                />
              ) : null}
            </div>

            {application.paymentStatus !== 'PAID' && application.paymentStatus !== 'WAIVED' ? (
              <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
                <div className="space-y-1">
                  <Label className="text-xs">Reference</Label>
                  <Input
                    className="h-8"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="Txn / receipt no."
                  />
                </div>
                <Button
                  size="sm"
                  disabled={paymentMut.isPending}
                  onClick={() => paymentMut.mutate()}
                >
                  Mark paid (₹{DEFAULT_APPLICATION_FEE})
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {isRazorpayPayment
                  ? 'Fee recorded via Razorpay. Reference above is the captured payment id.'
                  : 'Fee recorded manually by admissions staff.'}
              </p>
            )}

            {paymentMut.error ? (
              <p className="mt-2 text-xs text-destructive">
                {apiErrorMessage(paymentMut.error, 'Payment update failed')}
              </p>
            ) : null}
          </section>
        ) : null}

        {application.admissionFeeStatus && application.admissionFeeStatus !== 'NOT_APPLICABLE' ? (
          <section>
            <p className="mb-2 flex items-center gap-2 text-sm font-medium">
              <IndianRupee className="h-4 w-4" />
              Admission fee
            </p>
            <div className="mb-3 grid gap-2 text-xs sm:grid-cols-2">
              <PaymentDetail label="Status" value={application.admissionFeeStatus} />
              {application.admissionFeeAmount != null ? (
                <PaymentDetail
                  label="Amount"
                  value={`₹${Number(application.admissionFeeAmount).toLocaleString('en-IN')}`}
                />
              ) : null}
              {application.admissionFeeReference ? (
                <PaymentDetail label="Reference" value={application.admissionFeeReference} mono />
              ) : null}
            </div>
            {canManage && application.admissionFeeStatus === 'PENDING' ? (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Due amount (₹)</Label>
                    <Input
                      className="h-8 w-28"
                      type="number"
                      min={1}
                      value={admissionFeeAmount}
                      onChange={(e) => setAdmissionFeeAmount(e.target.value)}
                      placeholder={String(DEFAULT_ADMISSION_FEE_MIN)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={admissionFeeMut.isPending || !admissionFeeAmount}
                    onClick={() =>
                      admissionFeeMut.mutate({
                        status: 'PENDING',
                        admissionFeeAmount: Number(admissionFeeAmount),
                      })
                    }
                  >
                    Save due amount
                  </Button>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Reference</Label>
                    <Input
                      className="h-8"
                      value={admissionFeeRef}
                      onChange={(e) => setAdmissionFeeRef(e.target.value)}
                      placeholder="Receipt / txn no."
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={
                      admissionFeeMut.isPending || !admissionFeeAmount || !admissionFeeRef.trim()
                    }
                    onClick={() =>
                      admissionFeeMut.mutate({
                        status: 'PAID',
                        admissionFeeReference: admissionFeeRef.trim(),
                        admissionFeeAmount: Number(admissionFeeAmount),
                      })
                    }
                  >
                    Mark admission fee paid
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Admission fee applies only after selection. Set the amount the student must pay,
                  then mark paid when received at the office.
                </p>
              </div>
            ) : null}
            {admissionFeeMut.error ? (
              <p className="mt-2 text-xs text-destructive">
                {apiErrorMessage(admissionFeeMut.error, 'Admission fee update failed')}
              </p>
            ) : null}
          </section>
        ) : null}

        {canManage ? (
          <section>
            <p className="mb-2 text-sm font-medium">Workflow</p>
            <div className="flex flex-wrap gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  void downloadApplicationPdf(application.id, application.applicationNumber)
                }
              >
                Download PDF
              </Button>
              {application.status === 'shortlisted' || application.status === 'allotted' ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={offerMut.isPending}
                  onClick={() => offerMut.mutate()}
                >
                  {offerMut.isPending ? 'Sending…' : 'Send offer email'}
                </Button>
              ) : null}
              {application.status === 'allotted' && onEnroll ? (
                <Button size="sm" disabled={enrolling} onClick={onEnroll}>
                  {enrolling ? 'Enrolling…' : 'Enroll as student'}
                </Button>
              ) : null}
              {(['under_review', 'shortlisted', 'rejected', 'allotted'] as const).map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  disabled={statusMut.isPending}
                  onClick={() => statusMut.mutate(s)}
                >
                  {s.replace('_', ' ')}
                </Button>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <p className="mb-2 flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" />
            Audit log
          </p>
          <ol className="max-h-40 space-y-2 overflow-y-auto text-xs">
            {(audit.data ?? []).length === 0 ? (
              <li className="text-muted-foreground">No audit entries yet.</li>
            ) : (
              audit.data?.map((entry) => (
                <li key={entry.id} className="rounded-lg border border-border px-3 py-2">
                  <p className="font-medium">{entry.action}</p>
                  <p className="text-muted-foreground">
                    {entry.actor?.displayName ?? 'System'} ·{' '}
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                </li>
              ))
            )}
          </ol>
        </section>
      </CardContent>
    </Card>
  );
}

function FormSectionPreview({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== '' && v != null);
  if (!entries.length) {
    return <p className="text-xs text-muted-foreground">No data captured for this section.</p>;
  }
  return (
    <dl className="grid gap-1 text-xs sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <dt className="text-muted-foreground">{formatFieldLabel(key)}</dt>
          <dd className="font-medium break-words">{formatFieldValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function formatFieldLabel(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatFieldValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map((v) => formatFieldValue(v)).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5">
      <span className="text-muted-foreground">{label}:</span> {value}
    </span>
  );
}

function PaymentDetail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-muted-foreground">{label}</p>
      <p className={cn('font-medium break-all', mono && 'font-mono text-[11px]')}>{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-warning/10 text-warning',
    submitted: 'bg-muted text-muted-foreground',
    under_review: 'bg-warning/10 text-warning',
    shortlisted: 'bg-primary/10 text-primary',
    rejected: 'bg-danger/10 text-danger',
    allotted: 'bg-success/10 text-success',
  };
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        styles[status] ?? 'bg-muted text-muted-foreground',
      )}
    >
      {status.replace('_', ' ')}
    </span>
  );
}
