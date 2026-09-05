'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Download, CheckCircle2 } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SchoolApplicantNav } from '@/components/school-admissions-portal/school-applicant-nav';
import {
  SchoolNeedHelpCard,
  useSchoolPortalBranding,
} from '@/components/school-admissions-portal/school-admissions-shell';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { resolveSchoolCasteCategory } from '@/lib/school-admission-category';
import { displaySchoolPinCode } from '@/lib/school-address-pin';
import { schoolDocumentDisplayStatus } from '@/lib/school-document-display-status';
import { schoolApplicationProgress } from '@/lib/school-application-progress';
import {
  resolveApplicableSchoolCertificates,
  DEFAULT_SCHOOL_DOCUMENT_REQUIREMENTS,
} from '@/lib/school-document-requirements';
import { SCHOOL_DOCUMENT_SLOTS } from '@/lib/school-admissions-schema';
import { apiErrorMessage } from '@/utils/api-error';
import {
  downloadSchoolApplicationPdf,
  fetchSchoolApplicantMe,
  submitSchoolApplication,
} from '@/services/school-admissions';

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function SummarySection({
  title,
  editHref,
  children,
}: {
  title: string;
  editHref: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-[#1a5336]">{title}</h3>
        <Link className="text-sm font-medium text-[#1a5336] underline" href={editHref}>
          Edit
        </Link>
      </div>
      {children}
    </section>
  );
}

function FieldGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-slate-500">{item.label}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium text-slate-900">
            {item.value || '—'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function SchoolReviewPage() {
  const enabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const branding = useSchoolPortalBranding();
  const me = useQuery({
    queryKey: ['school-applicant-me'],
    queryFn: fetchSchoolApplicantMe,
    enabled,
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const progress = schoolApplicationProgress(me.data);
  const submitted = progress.submitted;
  const formData = asRecord(me.data?.application.formData);
  const child = asRecord(formData.child);
  const permanentAddress = asRecord(formData.permanentAddress);
  const presentAddress = asRecord(formData.presentAddress);
  const father = asRecord(formData.father);
  const mother = asRecord(formData.mother);
  const sibling = asRecord(formData.sibling);
  const category = resolveSchoolCasteCategory(child);
  const submission = me.data?.submission;
  const app = me.data?.application;
  const childName =
    (typeof child.fullName === 'string' && child.fullName.trim()) || app?.firstName || '—';
  const submittedAt = app?.submittedAt ? new Date(app.submittedAt).toLocaleString('en-IN') : '—';

  const docReqs = me.data?.settings?.documentRequirements ?? DEFAULT_SCHOOL_DOCUMENT_REQUIREMENTS;
  const applicableCerts = resolveApplicableSchoolCertificates(formData, {
    documentRequirements: docReqs,
  });
  const docsByCode = new Map((me.data?.application.documents ?? []).map((d) => [d.slotCode, d]));
  const baseSlots = SCHOOL_DOCUMENT_SLOTS.filter((s) => s.code !== 'PAYMENT_RECEIPT');
  const documentRows = [
    ...baseSlots
      .filter((s) => !['CASTE_CERT', 'MOTHER_ST_CERT', 'FATHER_SC_OBC_CERT'].includes(s.code))
      .map((s) => {
        const doc = docsByCode.get(s.code);
        return {
          code: s.code,
          label: s.label,
          required: s.required,
          uploaded: Boolean(doc),
          verificationStatus: doc?.verificationStatus ?? null,
        };
      }),
    ...applicableCerts.map((c) => {
      const doc = docsByCode.get(c.slotCode);
      return {
        code: c.slotCode,
        label: c.label,
        required: c.required,
        uploaded: Boolean(doc),
        verificationStatus: doc?.verificationStatus ?? null,
      };
    }),
  ];
  const paymentDoc = docsByCode.get('PAYMENT_RECEIPT');
  const paymentDisplay = schoolDocumentDisplayStatus({
    uploaded: Boolean(paymentDoc),
    verificationStatus: paymentDoc?.verificationStatus,
  });

  const onSubmit = async () => {
    setError(null);
    if (!confirmChecked) {
      setError(
        'Please confirm that you have carefully reviewed your application before submitting.',
      );
      return;
    }
    if (!progress.formDone) {
      setError('Complete the application form before submitting.');
      setConfirmOpen(false);
      return;
    }
    if (!progress.docsDone) {
      setError('Upload all required certificates before submitting.');
      setConfirmOpen(false);
      return;
    }
    if (!progress.paymentDone) {
      setError(
        'Enter the bank transaction / UTR number and upload the admission fee payment receipt before submitting.',
      );
      setConfirmOpen(false);
      return;
    }
    setSubmitting(true);
    try {
      await submitSchoolApplication();
      setConfirmOpen(false);
      setJustSubmitted(true);
      await queryClient.invalidateQueries({ queryKey: ['school-applicant-me'] });
    } catch (err) {
      setConfirmOpen(false);
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const openFinalConfirm = () => {
    setError(null);
    if (!confirmChecked) {
      setError(
        'Please confirm that you have carefully reviewed your application before submitting.',
      );
      return;
    }
    if (!progress.formDone) {
      setError('Complete the application form before submitting.');
      return;
    }
    if (!progress.docsDone) {
      setError('Upload all required certificates before submitting.');
      return;
    }
    if (!progress.paymentDone) {
      setError(
        'Enter the bank transaction / UTR number and upload the admission fee payment receipt before submitting.',
      );
      return;
    }
    setConfirmOpen(true);
  };

  const onDownloadPdf = async () => {
    setError(null);
    setDownloading(true);
    try {
      const blob = await downloadSchoolApplicationPdf();
      triggerBlobDownload(
        blob,
        `${app?.applicationNumber || 'application'}_KG_2027_Application.pdf`,
      );
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  };

  if (submitted || justSubmitted) {
    return (
      <SchoolApplicantNav
        sidebar={<SchoolNeedHelpCard phone={branding.helpPhone} email={branding.helpEmail} />}
      >
        <div className="rounded-2xl border border-emerald-200 bg-[#eaf5ee] p-6 text-center sm:p-8">
          <CheckCircle2 className="mx-auto h-12 w-12 text-[#1a5336]" />
          <h2 className="tps-serif mt-3 text-2xl text-[#1a5336]">
            Application Submitted Successfully
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Your K.G. Admission application for Academic Session 2027 has been received by Tura
            Public School, Tura. The application is now locked — you cannot edit details or
            documents online. Contact the school office if a correction is needed.
          </p>
          <dl className="mx-auto mt-5 max-w-md space-y-2 rounded-xl bg-white p-4 text-left text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Application Number</dt>
              <dd className="font-mono font-semibold text-[#1a5336]">
                {app?.applicationNumber ?? '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Applicant Name</dt>
              <dd className="font-semibold">{childName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Submission Date</dt>
              <dd>{submittedAt}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Application Status</dt>
              <dd className="capitalize">{(app?.status ?? 'submitted').replaceAll('_', ' ')}</dd>
            </div>
            {submission?.email?.status ? (
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Email copy</dt>
                <dd>
                  {submission.email.status === 'SENT'
                    ? 'Sent to your registered email'
                    : submission.email.status === 'FAILED'
                      ? 'Could not send email — download PDF below'
                      : 'Pending'}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              className="bg-[#1a5336] text-white hover:bg-[#15462d]"
              disabled={downloading}
              onClick={() => void onDownloadPdf()}
            >
              <Download className="mr-2 h-4 w-4" />
              {downloading ? 'Preparing PDF…' : 'Download Application PDF'}
            </Button>
            <Button asChild variant="outline">
              <Link href="/school-admissions-portal/dashboard">Go to Dashboard</Link>
            </Button>
          </div>
          {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
        </div>
      </SchoolApplicantNav>
    );
  }

  return (
    <SchoolApplicantNav
      sidebar={<SchoolNeedHelpCard phone={branding.helpPhone} email={branding.helpEmail} />}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="tps-serif text-2xl text-[#1a5336]">Review & submit</h2>
          <p className="text-sm text-muted-foreground">
            Confirm every section below. You can go back to edit before final submission. A PDF copy
            will be generated and emailed to you.
          </p>
        </div>
        {app?.applicationNumber ? (
          <span className="rounded-full bg-[#eaf5ee] px-3 py-1 font-mono text-sm text-[#1a5336]">
            Application No. {app.applicationNumber}
          </span>
        ) : null}
      </div>

      <div className="mt-5 space-y-4">
        <SummarySection title="Child details" editHref="/school-admissions-portal/application">
          <FieldGrid
            items={[
              { label: 'Full name', value: text(child.fullName) || childName },
              { label: 'Date of birth', value: text(child.dateOfBirth) },
              { label: 'Gender', value: text(child.gender) },
              { label: 'Blood group', value: text(child.bloodGroup) },
              { label: 'Nationality', value: text(child.nationality) },
              { label: 'Last school', value: text(child.lastSchool) },
              {
                label: 'Caste / Category',
                value: [category?.label, text(child.community) ? text(child.community) : null]
                  .filter(Boolean)
                  .join(' · '),
              },
            ]}
          />
        </SummarySection>

        <SummarySection title="Address" editHref="/school-admissions-portal/application">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Permanent
              </p>
              <FieldGrid
                items={[
                  { label: 'Village', value: text(permanentAddress.village) },
                  { label: 'P.O.', value: text(permanentAddress.po) },
                  { label: 'District', value: text(permanentAddress.district) },
                  { label: 'State / UT', value: text(permanentAddress.state) },
                  { label: 'PIN', value: displaySchoolPinCode(permanentAddress) },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Present
              </p>
              <FieldGrid
                items={[
                  {
                    label: 'Landmark / Village',
                    value: text(presentAddress.landmark),
                  },
                  { label: 'P.O.', value: text(presentAddress.po) },
                  { label: 'District', value: text(presentAddress.district) },
                  { label: 'State / UT', value: text(presentAddress.state) },
                  { label: 'PIN', value: displaySchoolPinCode(presentAddress) },
                ]}
              />
            </div>
          </div>
        </SummarySection>

        <SummarySection title="Parent details" editHref="/school-admissions-portal/application">
          <div className="space-y-4">
            <FieldGrid
              items={[
                { label: 'Father’s name', value: text(father.fullName) },
                { label: 'Father’s occupation', value: text(father.occupation) },
                { label: 'Father’s mobile', value: text(father.mobile) },
                { label: 'Mother’s name', value: text(mother.fullName) },
                { label: 'Mother’s occupation', value: text(mother.occupation) },
                { label: 'Mother’s mobile', value: text(mother.mobile) },
                {
                  label: 'Sibling in TPS',
                  value: text(sibling.name)
                    ? `${text(sibling.name)}${text(sibling.class) ? ` · Class ${text(sibling.class)}` : ''}`
                    : 'None recorded',
                },
              ]}
            />
          </div>
        </SummarySection>

        <SummarySection title="Documents" editHref="/school-admissions-portal/documents">
          <ul className="space-y-2 text-sm">
            {documentRows.map((row) => {
              const display = schoolDocumentDisplayStatus({
                uploaded: row.uploaded,
                verificationStatus: row.verificationStatus,
              });
              return (
                <li key={row.code} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {row.label}
                    {row.required ? (
                      <span className="ml-1 text-xs text-rose-600">Required</span>
                    ) : (
                      <span className="ml-1 text-xs text-slate-400">Optional</span>
                    )}
                  </span>
                  <span
                    className={
                      display.tone === 'success'
                        ? 'font-medium text-emerald-700'
                        : display.tone === 'danger'
                          ? 'font-medium text-rose-700'
                          : display.tone === 'warning'
                            ? 'font-medium text-amber-800'
                            : 'text-slate-600'
                    }
                  >
                    {display.displayLabel}
                  </span>
                </li>
              );
            })}
            <li className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
              <span>
                Progress: {progress.certificatesUploaded} of {progress.certificatesRequired}{' '}
                required
              </span>
              <span className={progress.docsDone ? 'text-emerald-700' : 'text-amber-700'}>
                {progress.docsDone ? 'Complete' : 'Incomplete'}
              </span>
            </li>
          </ul>
        </SummarySection>

        <SummarySection title="Fee & payment receipt" editHref="/school-admissions-portal/payment">
          <FieldGrid
            items={[
              {
                label: 'Application Number',
                value: app?.applicationNumber || '—',
              },
              {
                label: 'Fee amount',
                value:
                  typeof me.data?.settings?.applicationFee === 'number'
                    ? `₹${me.data.settings.applicationFee}`
                    : 'As per school notice',
              },
              {
                label: 'Payment Reference / Transaction ID',
                value: app?.paymentReference?.trim() || 'Not entered',
              },
              {
                label: 'Receipt Status',
                value: paymentDisplay.displayLabel,
              },
              {
                label: 'Verification Status',
                value: paymentDisplay.schoolVerificationLabel,
              },
              {
                label: 'Receipt Upload Date',
                value:
                  paymentDoc?.updatedAt || paymentDoc?.createdAt
                    ? new Date(paymentDoc.updatedAt || paymentDoc.createdAt).toLocaleString('en-IN')
                    : '—',
              },
            ]}
          />
        </SummarySection>
      </div>

      <ul className="mt-5 space-y-1 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
        <li>Application form: {progress.formDone ? 'Complete' : 'Incomplete'}</li>
        <li>
          Documents: {progress.certificatesUploaded} of {progress.certificatesRequired} required
          uploaded
        </li>
        <li>Payment reference: {app?.paymentReference?.trim() || 'Not entered'}</li>
        <li>Fee receipt: {paymentDisplay.displayLabel}</li>
      </ul>

      <div
        role="alert"
        className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-amber-950 shadow-sm"
      >
        <div className="flex gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
            <AlertTriangle className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1.5">
            <p className="text-sm font-semibold text-amber-950 sm:text-base">
              Important: Please verify your application carefully before submitting.
            </p>
            <p className="text-sm leading-relaxed text-amber-950/90">
              Once the application is submitted, you will not be able to edit or update your
              application details or uploaded documents. Please carefully check all information,
              documents, and payment details before submitting.
            </p>
          </div>
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-800">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 shrink-0 accent-[#1a5336]"
          checked={confirmChecked}
          onChange={(e) => {
            setConfirmChecked(e.target.checked);
            if (e.target.checked) setError(null);
          }}
        />
        <span className="leading-relaxed">
          I have carefully reviewed all the information and documents provided above and confirm
          that they are correct. I understand that I cannot edit or update my application after
          submission.
        </span>
      </label>

      {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link href="/school-admissions-portal/application">Back to form</Link>
        </Button>
        <Button
          className="min-h-11 bg-[#1a5336] text-white hover:bg-[#15462d] disabled:opacity-60"
          disabled={submitting || !confirmChecked}
          onClick={openFinalConfirm}
        >
          Submit Application
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(open) => !submitting && setConfirmOpen(open)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Are you sure you want to submit your application?</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-slate-600">
              After submission, you will not be able to edit or update your application details or
              uploaded documents.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setConfirmOpen(false)}
            >
              Go Back &amp; Review
            </Button>
            <Button
              type="button"
              className="bg-[#1a5336] text-white hover:bg-[#15462d]"
              disabled={submitting}
              onClick={() => void onSubmit()}
            >
              {submitting ? 'Submitting…' : 'Yes, Submit Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SchoolApplicantNav>
  );
}
