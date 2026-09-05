'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Eye,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { SchoolApplicantNav } from '@/components/school-admissions-portal/school-applicant-nav';
import {
  SchoolNeedHelpCard,
  useSchoolPortalBranding,
} from '@/components/school-admissions-portal/school-admissions-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { schoolApplicationProgress } from '@/lib/school-application-progress';
import { schoolDocumentDisplayStatus } from '@/lib/school-document-display-status';
import {
  isSchoolPaymentTxnSameAsApplicationNumber,
  isValidSchoolPaymentTransactionRef,
  normalizeSchoolPaymentTransactionRef,
} from '@/lib/school-payment-transaction-ref';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  SCHOOL_UPLOAD_ACCEPT_ATTR,
  SCHOOL_UPLOAD_FORMAT_HELP,
  SCHOOL_UPLOAD_TOO_LARGE,
  SCHOOL_UPLOAD_MAX_BYTES,
  validateSchoolUploadImageFile,
} from '@/lib/school-upload-image';
import {
  downloadSchoolOwnDocument,
  fetchSchoolApplicantMe,
  removeSchoolDocument,
  saveSchoolPaymentTransactionReference,
  uploadSchoolDocument,
} from '@/services/school-admissions';

const MAX_BYTES = SCHOOL_UPLOAD_MAX_BYTES;
const ACCEPT = SCHOOL_UPLOAD_ACCEPT_ATTR;

function formatBytes(size?: number | null) {
  if (!size || size <= 0) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileNameFromUrl(url: string) {
  try {
    const path = url.split('?')[0] ?? url;
    return decodeURIComponent(path.split('/').pop() || 'payment-receipt');
  } catch {
    return 'payment-receipt';
  }
}

function formatUploadedOn(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StepRail({
  steps,
}: {
  steps: Array<{ n: number; title: string; detail: string; done?: boolean; active?: boolean }>;
}) {
  return (
    <ol className="mt-5 space-y-0 rounded-xl border border-[#1a5336]/15 bg-[#f7faf8] px-4 py-3">
      {steps.map((step, idx) => (
        <li key={step.n} className="relative">
          <div className="flex gap-3 py-2.5">
            <span
              className={cn(
                'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                step.done
                  ? 'bg-[#1a5336] text-white'
                  : step.active
                    ? 'bg-[#eaf5ee] text-[#1a5336] ring-2 ring-[#1a5336]/30'
                    : 'bg-white text-slate-500 ring-1 ring-slate-200',
              )}
            >
              {step.done ? '✓' : step.n}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Step {step.n}
              </p>
              <p
                className={cn(
                  'text-sm font-semibold',
                  step.active || step.done ? 'text-[#1a5336]' : 'text-slate-700',
                )}
              >
                {step.title}
              </p>
              <p className="text-xs text-slate-600">{step.detail}</p>
            </div>
          </div>
          {idx < steps.length - 1 ? (
            <div className="ml-3.5 h-3 w-px bg-[#1a5336]/20" aria-hidden />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export default function SchoolPaymentPage() {
  const router = useRouter();
  const enabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const me = useQuery({
    queryKey: ['school-applicant-me'],
    queryFn: fetchSchoolApplicantMe,
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [savingTxn, setSavingTxn] = useState(false);
  const [txnDraft, setTxnDraft] = useState('');

  const bank = me.data?.settings?.bank;
  const fee = me.data?.settings?.applicationFee ?? 0;
  const applicationNumber = me.data?.application.applicationNumber ?? '';
  const savedTxn = me.data?.application.paymentReference?.trim() ?? '';
  const proof = me.data?.application.documents?.find((d) => d.slotCode === 'PAYMENT_RECEIPT');
  const progress = schoolApplicationProgress(me.data);
  const branding = useSchoolPortalBranding();
  const readOnly = Boolean(me.data?.readOnly);
  const hasReceipt = Boolean(proof);
  const hasTxn = Boolean(savedTxn);
  const paymentDisplay = schoolDocumentDisplayStatus({
    uploaded: hasReceipt,
    verificationStatus: proof?.verificationStatus,
  });
  const isVerified =
    paymentDisplay.verificationStatus === 'VERIFIED' ||
    me.data?.application.paymentStatus === 'PAID';
  const isRejected = paymentDisplay.verificationStatus === 'REJECTED';
  const canUpload = (!readOnly || isRejected) && hasTxn;
  const canEditTxn = !readOnly || isRejected;

  useEffect(() => {
    if (savedTxn) setTxnDraft(savedTxn);
  }, [savedTxn]);

  const receiptStatusLabel = (() => {
    if (!hasReceipt) return 'Not uploaded';
    if (isVerified) return 'Verified';
    if (isRejected) return 'Rejected – resubmission required';
    return 'Uploaded – Verification Pending';
  })();

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['school-applicant-me'] });

  const saveTransactionReference = async () => {
    if (!canEditTxn) return false;
    setError(null);
    const normalized = normalizeSchoolPaymentTransactionRef(txnDraft);
    if (!isValidSchoolPaymentTransactionRef(normalized)) {
      setError('Enter a valid bank transaction / UTR / reference number (4–100 characters).');
      return false;
    }
    if (isSchoolPaymentTxnSameAsApplicationNumber(normalized, applicationNumber)) {
      setError(
        'Do not enter your application number here. Enter the transaction / UTR / reference number from your bank receipt.',
      );
      return false;
    }
    setSavingTxn(true);
    try {
      await saveSchoolPaymentTransactionReference(normalized);
      setTxnDraft(normalized);
      await refresh();
      return true;
    } catch (err) {
      setError(apiErrorMessage(err));
      return false;
    } finally {
      setSavingTxn(false);
    }
  };

  const validateAndUpload = async (file?: File | null) => {
    if (!file || !canUpload) return;
    setError(null);

    const normalized = normalizeSchoolPaymentTransactionRef(txnDraft);
    if (!savedTxn || normalizeSchoolPaymentTransactionRef(savedTxn) !== normalized) {
      const ok = await saveTransactionReference();
      if (!ok) return;
    }

    if (file.size > MAX_BYTES) {
      setError(SCHOOL_UPLOAD_TOO_LARGE);
      return;
    }
    const typeError = validateSchoolUploadImageFile(file);
    if (typeError) {
      setError(typeError);
      return;
    }
    setUploading(true);
    try {
      await uploadSchoolDocument('PAYMENT_RECEIPT', file);
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onView = async () => {
    setError(null);
    setViewing(true);
    try {
      const blob = await downloadSchoolOwnDocument('PAYMENT_RECEIPT');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setViewing(false);
    }
  };

  const onRemove = async () => {
    if (!canUpload) return;
    setError(null);
    setRemoving(true);
    try {
      await removeSchoolDocument('PAYMENT_RECEIPT');
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  const continueToReview = () => {
    if (!progress.paymentDone) {
      setError(
        !hasTxn
          ? 'Enter your bank transaction / UTR / reference number, then upload the receipt.'
          : 'Please upload your payment receipt to continue.',
      );
      return;
    }
    router.push('/school-admissions-portal/review');
  };

  const openPicker = () => {
    if (!canUpload || uploading || savingTxn) return;
    inputRef.current?.click();
  };

  const activeStep = !hasTxn ? 2 : !hasReceipt || isRejected ? 3 : 4;

  return (
    <SchoolApplicantNav
      sidebar={<SchoolNeedHelpCard phone={branding.helpPhone} email={branding.helpEmail} />}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="tps-serif text-2xl text-[#1a5336]">Admission fee (manual transfer)</h2>
        {applicationNumber ? (
          <span className="rounded-full bg-[#eaf5ee] px-3 py-1 font-mono text-sm text-[#1a5336]">
            Application No. {applicationNumber}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        First transfer the fee, then enter your bank transaction / UTR number, then upload the
        receipt.
      </p>

      <StepRail
        steps={[
          {
            n: 1,
            title: `Transfer ${fee > 0 ? `₹${fee}` : 'the fee'} to the school bank account.`,
            detail: `Mention ${applicationNumber || 'your application number'} while transferring.`,
            done: true,
            active: false,
          },
          {
            n: 2,
            title: 'Enter your bank Transaction / UTR / Reference Number.',
            detail: 'Use the number shown on your bank transfer receipt.',
            done: hasTxn,
            active: activeStep === 2,
          },
          {
            n: 3,
            title: 'Upload the payment receipt.',
            detail: SCHOOL_UPLOAD_FORMAT_HELP,
            done: hasReceipt && !isRejected,
            active: activeStep === 3,
          },
          {
            n: 4,
            title: 'Continue to Review & Submit.',
            detail: 'Submit only after the receipt is uploaded.',
            done: progress.paymentDone && Boolean(me.data?.application.status !== 'draft'),
            active: activeStep === 4,
          },
        ]}
      />

      <div
        className={cn(
          'mt-4 rounded-xl border px-4 py-3',
          isVerified && 'border-emerald-200 bg-emerald-50',
          isRejected && 'border-rose-200 bg-rose-50',
          hasReceipt && !isVerified && !isRejected && 'border-amber-200 bg-amber-50',
          !hasReceipt && 'border-slate-200 bg-slate-50',
        )}
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Payment Status
        </p>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium text-slate-600">Payment Reference:</dt>
            <dd className="font-mono text-slate-900">{hasTxn ? savedTxn : 'Not entered'}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-medium text-slate-600">Receipt:</dt>
            <dd
              className={cn(
                'font-semibold',
                isVerified && 'text-emerald-800',
                isRejected && 'text-rose-800',
                hasReceipt && !isVerified && !isRejected && 'text-amber-900',
                !hasReceipt && 'text-slate-800',
              )}
            >
              {receiptStatusLabel}
            </dd>
          </div>
        </dl>
        {isRejected && proof?.remarks ? (
          <p className="mt-2 text-xs text-rose-800">{proof.remarks}</p>
        ) : null}
        {hasReceipt && !isVerified && !isRejected ? (
          <p className="mt-2 text-xs text-slate-600">
            Your receipt is with the school office. You may continue to Review & Submit.
          </p>
        ) : null}
      </div>

      <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm">
        <p className="font-semibold text-[#1a5336]">STEP 1 · Bank account details</p>
        <p className="mt-2">
          Amount: <strong>{fee > 0 ? `₹${fee}` : 'As informed by the school office'}</strong>
        </p>
        <p>Account name: {bank?.accountName ?? 'Tura Public School'}</p>
        <p>Account number: {bank?.accountNumber}</p>
        <p>IFSC: {bank?.ifsc}</p>
        <p>
          Bank: {bank?.bankName}
          {bank?.branch ? ` · ${bank.branch}` : ''}
        </p>
        {bank?.upiId ? <p>UPI: {bank.upiId}</p> : null}
        <div className="mt-3 rounded-lg border border-[#1a5336]/15 bg-white/70 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payment reference to mention while transferring
          </p>
          <p className="mt-0.5 font-mono text-base font-semibold text-[#1a5336]">
            {applicationNumber || '—'}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            This is your application number. It is not the bank transaction / UTR number.
          </p>
        </div>
        {bank?.instructions ? <p className="mt-2 text-slate-700">{bank.instructions}</p> : null}
      </div>

      <div className="mt-6 rounded-xl border border-[#1a5336]/15 bg-white p-4">
        <h3 className="text-sm font-semibold text-[#1a5336]">
          STEP 2 · Payment Reference / Transaction ID *
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the transaction/reference number shown on your bank transfer receipt.
        </p>
        <div className="mt-3 max-w-xl space-y-2">
          <Label htmlFor="school-payment-txn-ref">Bank Transaction / UTR / Reference No.</Label>
          <Input
            id="school-payment-txn-ref"
            value={txnDraft}
            maxLength={100}
            disabled={!canEditTxn || savingTxn}
            placeholder="Enter transaction ID / UTR / reference number"
            className="font-mono"
            onChange={(e) => setTxnDraft(e.target.value)}
            onBlur={() => {
              if (
                canEditTxn &&
                normalizeSchoolPaymentTransactionRef(txnDraft) &&
                normalizeSchoolPaymentTransactionRef(txnDraft) !== savedTxn
              ) {
                void saveTransactionReference();
              }
            }}
          />
          {canEditTxn ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-10 border-[#1a5336]/30 text-[#1a5336]"
                disabled={savingTxn}
                onClick={() => void saveTransactionReference()}
              >
                {savingTxn ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  'Save transaction ID'
                )}
              </Button>
              {hasTxn ? (
                <span className="text-xs text-emerald-700">Saved</span>
              ) : (
                <span className="text-xs text-amber-800">Required before receipt upload</span>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-[#1a5336]">STEP 3 · Payment Receipt Upload *</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Please upload a clear copy of the payment receipt showing the payment amount and
          transaction details.
        </p>
        {!hasTxn ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Enter and save your bank transaction / UTR / reference number above before uploading the
            receipt.
          </p>
        ) : null}

        <input
          ref={inputRef}
          id="school-payment-receipt-upload"
          type="file"
          className="sr-only"
          accept={ACCEPT}
          aria-label="Upload admission fee payment receipt"
          disabled={!canUpload || uploading || savingTxn}
          onChange={(e) => {
            const file = e.target.files?.[0];
            void validateAndUpload(file);
          }}
        />

        {uploading ? (
          <div className="mt-3 flex flex-col items-center justify-center rounded-2xl border border-[#1a5336]/25 bg-[#eaf5ee]/50 px-4 py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#1a5336]" />
            <p className="mt-3 text-sm font-semibold text-[#1a5336]">Uploading receipt…</p>
            <p className="mt-1 text-xs text-slate-500">Please wait while we save your file.</p>
          </div>
        ) : hasReceipt && !isRejected ? (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:p-5">
            <div className="flex flex-wrap items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                {isVerified ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <FileText className="h-6 w-6" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-emerald-900">
                  {isVerified ? '✓ Payment Receipt Verified' : '✓ Receipt uploaded successfully'}
                </p>
                <p className="mt-0.5 text-sm text-emerald-800/80">
                  Status: {isVerified ? 'Verified by school' : 'Pending verification'}
                </p>
                <p className="mt-2 truncate font-mono text-xs text-slate-700 sm:text-sm">
                  {fileNameFromUrl(proof!.fileUrl)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {[
                    formatBytes(proof?.sizeBytes),
                    formatUploadedOn(proof?.updatedAt || proof?.createdAt),
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Stored securely'}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 border-emerald-300 bg-white"
                disabled={viewing}
                onClick={() => void onView()}
              >
                <Eye className="mr-1.5 h-4 w-4" />
                {viewing ? 'Opening…' : 'View Receipt'}
              </Button>
              {canUpload && !isVerified ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 border-[#1a5336]/30 bg-white text-[#1a5336]"
                    onClick={openPicker}
                  >
                    <RefreshCw className="mr-1.5 h-4 w-4" />
                    Replace
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 border-rose-200 bg-white text-rose-700"
                    disabled={removing}
                    onClick={() => void onRemove()}
                  >
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    {removing ? 'Removing…' : 'Remove'}
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        ) : isRejected && hasReceipt ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:p-5">
            <div className="flex gap-3">
              <XCircle className="h-6 w-6 shrink-0 text-rose-600" />
              <div className="min-w-0">
                <p className="font-semibold text-rose-900">✕ Receipt Rejected</p>
                <p className="mt-1 text-sm text-rose-800">
                  {proof?.remarks ||
                    'The school could not accept this receipt. Please upload a new one.'}
                </p>
                <p className="mt-2 truncate font-mono text-xs text-slate-600">
                  {fileNameFromUrl(proof!.fileUrl)}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 bg-white"
                disabled={viewing}
                onClick={() => void onView()}
              >
                <Eye className="mr-1.5 h-4 w-4" />
                View Receipt
              </Button>
              {canUpload ? (
                <Button
                  type="button"
                  className="min-h-11 bg-[#1a5336] text-white hover:bg-[#15462d]"
                  onClick={openPicker}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  Upload New Receipt
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={!canUpload}
            onClick={openPicker}
            onDragEnter={(e) => {
              e.preventDefault();
              if (canUpload) setDragging(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (canUpload) setDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void validateAndUpload(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              'mt-3 flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-8 text-center transition sm:py-10',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1a5336]/35 focus-visible:ring-offset-2',
              dragging
                ? 'border-[#1a5336] bg-[#eaf5ee]'
                : 'border-[#1a5336]/35 bg-[#f7faf8] hover:border-[#1a5336] hover:bg-[#eaf5ee]/70',
              !canUpload && 'cursor-not-allowed opacity-60',
            )}
            aria-label="Upload admission fee payment receipt"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#1a5336] shadow-sm ring-1 ring-[#1a5336]/15">
              <FileText className="h-7 w-7" />
            </span>
            <p className="mt-4 text-base font-semibold text-[#1a5336] sm:text-lg">
              Upload Payment Receipt
            </p>
            <p className="mt-1 max-w-md text-sm text-slate-600">
              Please upload the receipt / proof of your {fee > 0 ? `₹${fee}` : 'admission fee'}{' '}
              payment.
            </p>
            <span className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#1a5336] px-5 py-3 text-sm font-semibold text-white shadow-sm">
              <FolderOpen className="h-4 w-4" />
              Choose Receipt File
            </span>
            <p className="mt-3 text-xs text-slate-500">or drag &amp; drop your file here</p>
            <p className="mt-1 text-xs text-slate-400">{SCHOOL_UPLOAD_FORMAT_HELP}</p>
          </button>
        )}
      </div>

      {error ? (
        <p
          className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {!readOnly ? (
        <div className="mt-6 space-y-2">
          <p className="text-sm font-semibold text-[#1a5336]">STEP 4 · Continue</p>
          {!progress.paymentDone ? (
            <p className="text-sm text-amber-800">
              {!hasTxn
                ? 'Enter your bank transaction / UTR / reference number, then upload the receipt.'
                : 'Please upload your payment receipt to continue.'}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button
              className="min-h-11 bg-[#1a5336] text-white hover:bg-[#15462d] disabled:opacity-50"
              disabled={!progress.paymentDone || uploading || savingTxn}
              onClick={continueToReview}
            >
              Continue to Review & Submit →
            </Button>
          </div>
        </div>
      ) : null}
    </SchoolApplicantNav>
  );
}
