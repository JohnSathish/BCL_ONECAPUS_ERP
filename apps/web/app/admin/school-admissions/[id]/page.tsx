'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { apiErrorMessage } from '@/utils/api-error';
import { deriveSchoolOfficeBadges } from '@/lib/school-office/application-status';
import { resolveSchoolCasteCategory } from '@/lib/school-admission-category';
import {
  decideSchoolAdmission,
  downloadSchoolOfficeApplicationPdf,
  downloadSchoolOfficeDocument,
  fetchSchoolOfficeApplication,
  rejectSchoolDocument,
  rejectSchoolPayment,
  resendSchoolApplicationPdfEmail,
  verifySchoolDocument,
  verifySchoolPayment,
} from '@/services/school-admissions';
import { ApplicantProfileHeader } from '@/components/school-office/applicant-profile/profile-chrome';
import {
  ApplicantApplicationTab,
  ApplicantOverviewTab,
} from '@/components/school-office/applicant-profile/overview-application-tabs';
import {
  ApplicantDocumentsTab,
  ApplicantPaymentTab,
  ApplicantReviewTab,
  buildOfficeDocumentRows,
} from '@/components/school-office/applicant-profile/documents-payment-review-tabs';

const VALID_TABS = ['overview', 'application', 'documents', 'payment', 'review'] as const;
type ProfileTab = (typeof VALID_TABS)[number];

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function openOrDownloadDocument(
  applicationId: string,
  slotCode: string,
  mode: 'view' | 'download',
  filenameHint?: string,
) {
  const blob = await downloadSchoolOfficeDocument(applicationId, slotCode);
  const url = URL.createObjectURL(blob);
  if (mode === 'view') {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    const link = document.createElement('a');
    link.href = url;
    link.download = filenameHint || `${slotCode}.bin`;
    link.click();
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export default function SchoolAdmissionsOfficeDetailPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-[var(--school-erp-muted)]">Loading applicant…</p>}
    >
      <ApplicantProfilePage />
    </Suspense>
  );
}

function ApplicantProfilePage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const enabled = useAuthQueryEnabled();
  const queryClient = useQueryClient();
  const tabParam = searchParams.get('tab') ?? 'overview';
  const activeTab: ProfileTab = VALID_TABS.includes(tabParam as ProfileTab)
    ? (tabParam as ProfileTab)
    : 'overview';

  const detail = useQuery({
    queryKey: ['school-office-application', params.id],
    queryFn: () => fetchSchoolOfficeApplication(params.id),
    enabled: enabled && Boolean(params.id),
  });

  const app = detail.data?.application;
  const form = asRecord(app?.formData);
  const child = asRecord(form.child);
  const office = asRecord(form.office);
  const category = resolveSchoolCasteCategory(child);
  const checklist = detail.data?.certificateChecklist ?? [];
  const documents = (app?.documents ?? []) as Array<{
    id?: string;
    slotCode: string;
    verificationStatus: string;
    fileUrl?: string | null;
    createdAt?: string;
    sizeBytes?: number | null;
    remarks?: string | null;
    mimeType?: string | null;
  }>;
  const receipt = documents.find((d) => d.slotCode === 'PAYMENT_RECEIPT');

  const [indexNumber, setIndexNumber] = useState('TPS ');
  const [remarks, setRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    const existing = text(office.indexNumber);
    if (existing) setIndexNumber(existing);
    const existingRemarks = text(office.remarks);
    if (existingRemarks) setRemarks(existingRemarks);
  }, [office.indexNumber, office.remarks]);

  useEffect(() => {
    let revoked: string | null = null;
    const hasPhoto = documents.some((d) => d.slotCode === 'PHOTO');
    if (!hasPhoto || !params.id) {
      setPhotoUrl(null);
      return;
    }
    void downloadSchoolOfficeDocument(params.id, 'PHOTO')
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        revoked = url;
        setPhotoUrl(url);
      })
      .catch(() => setPhotoUrl(null));
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [params.id, documents.map((d) => d.slotCode).join(',')]);

  const badges = useMemo(
    () =>
      deriveSchoolOfficeBadges({
        status: app?.status,
        paymentStatus: app?.paymentStatus,
        formData: form,
        documents,
        certificateChecklist: checklist,
      }),
    [app?.status, app?.paymentStatus, form, documents, checklist],
  );

  const docRows = useMemo(
    () =>
      buildOfficeDocumentRows({
        documents,
        certificateChecklist: checklist,
        documentRequirements: detail.data?.settings?.documentRequirements,
      }),
    [documents, checklist, detail.data?.settings?.documentRequirements],
  );

  const setTab = (tab: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set('tab', tab);
    router.replace(`/admin/school-admissions/${params.id}?${next.toString()}`);
  };

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ['school-office-application', params.id] });

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async () => {
    setError(null);
    try {
      const blob = await downloadSchoolOfficeApplicationPdf(params.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${app?.applicationNumber || 'application'}_KG_2027_Application.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (detail.isLoading) {
    return <p className="text-sm text-[var(--school-erp-muted)]">Loading applicant…</p>;
  }
  if (detail.isError || !app) {
    return (
      <p className="text-sm text-destructive">
        {detail.isError ? apiErrorMessage(detail.error) : 'Application not found'}
      </p>
    );
  }

  const candidateName = text(child.fullName) || text(app.firstName) || 'Applicant';
  const fee = detail.data?.settings?.applicationFee ?? 100;
  const submission = detail.data?.submission as
    | {
        pdfFileUrl?: string;
        email?: { status?: string; sentAt?: string | null; error?: string | null };
      }
    | null
    | undefined;

  return (
    <div className="space-y-5">
      <ApplicantProfileHeader
        applicationNumber={app.applicationNumber || params.id}
        candidateName={candidateName}
        badges={badges}
        indexNumber={text(office.indexNumber) || null}
        onDownloadPdf={() => void downloadPdf()}
        onResendEmail={() => void run(() => resendSchoolApplicationPdfEmail(params.id))}
        busy={busy}
      />

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 print:hidden">
          {error}
        </p>
      ) : null}

      <Tabs value={activeTab} onValueChange={setTab} className="space-y-4">
        <TabsList className="print:hidden">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="review">Review &amp; Decision</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ApplicantOverviewTab
            applicationId={app.applicationNumber || params.id}
            formData={form}
            categoryLabel={detail.data?.categoryLabel ?? category?.label}
            community={detail.data?.community}
            age={detail.data?.age}
            status={badges.find((b) => b.key === 'application')?.label || app.status}
            paymentLabel={badges.find((b) => b.key === 'payment')?.label || app.paymentStatus}
            documentLabel={badges.find((b) => b.key === 'documents')?.label || '—'}
            submittedAt={app.submittedAt}
            submission={submission}
            photoUrl={photoUrl}
            onOpenTab={setTab}
          />
        </TabsContent>

        <TabsContent value="application">
          <ApplicantApplicationTab
            formData={form}
            categoryLabel={detail.data?.categoryLabel ?? category?.label}
          />
        </TabsContent>

        <TabsContent value="documents">
          <ApplicantDocumentsTab
            rows={docRows}
            busy={busy}
            onView={(slot) =>
              void openOrDownloadDocument(params.id, slot, 'view').catch((err) =>
                setError(apiErrorMessage(err)),
              )
            }
            onDownload={(slot) =>
              void openOrDownloadDocument(
                params.id,
                slot,
                'download',
                `${app.applicationNumber || 'app'}_${slot}`,
              ).catch((err) => setError(apiErrorMessage(err)))
            }
            onVerify={(slot) => run(() => verifySchoolDocument(params.id, slot))}
            onReject={(slot, reason) => run(() => rejectSchoolDocument(params.id, slot, reason))}
          />
        </TabsContent>

        <TabsContent value="payment">
          <ApplicantPaymentTab
            fee={fee}
            paymentStatus={app.paymentStatus}
            paymentReference={app.paymentReference}
            receiptStatus={receipt?.verificationStatus ?? 'MISSING'}
            receiptRemarks={receipt?.remarks}
            paymentDate={receipt?.createdAt}
            busy={busy}
            onViewReceipt={() =>
              void openOrDownloadDocument(params.id, 'PAYMENT_RECEIPT', 'view').catch((err) =>
                setError(apiErrorMessage(err)),
              )
            }
            onVerify={() => run(() => verifySchoolPayment(params.id, { remarks }))}
            onReject={(reason) => run(() => rejectSchoolPayment(params.id, reason))}
          />
        </TabsContent>

        <TabsContent value="review">
          <ApplicantReviewTab
            status={app.status}
            paymentStatus={app.paymentStatus}
            ageEligible={Boolean(detail.data?.age?.eligible)}
            ageMessage={detail.data?.age?.message}
            documents={documents}
            certificateChecklist={checklist}
            indexNumber={indexNumber}
            remarks={remarks}
            onIndexChange={setIndexNumber}
            onRemarksChange={setRemarks}
            busy={busy}
            onGrant={() =>
              run(() =>
                decideSchoolAdmission(params.id, {
                  decision: 'GRANTED',
                  indexNumber,
                  remarks,
                }),
              )
            }
            onRefuse={() =>
              run(() =>
                decideSchoolAdmission(params.id, {
                  decision: 'NOT_GRANTED',
                  remarks,
                }),
              )
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
