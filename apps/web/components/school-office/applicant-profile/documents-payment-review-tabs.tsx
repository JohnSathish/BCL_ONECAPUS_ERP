'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SchoolOfficeStatusBadge } from '@/components/school-office/status-badge';
import { ProfileFieldGrid, ProfileSectionCard, displayField } from './profile-chrome';
import {
  grantAdmissionBlockers,
  PAYMENT_REJECT_REASONS,
} from '@/lib/school-office/application-status';
import { schoolDocumentDisplayStatus } from '@/lib/school-document-display-status';
import { SCHOOL_DOCUMENT_SLOTS } from '@/lib/school-admissions-schema';
import { schoolConditionalSlotLabel } from '@/lib/school-document-requirements';

type DocRow = {
  slotCode: string;
  label: string;
  required: boolean;
  optional: boolean;
  uploaded: boolean;
  verificationStatus: string;
  createdAt?: string | null;
  sizeBytes?: number | null;
  remarks?: string | null;
};

function formatBytes(size?: number | null) {
  if (!size || size <= 0) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function rowDisplay(row: Pick<DocRow, 'uploaded' | 'verificationStatus'>) {
  return schoolDocumentDisplayStatus({
    uploaded: row.uploaded,
    verificationStatus: row.verificationStatus,
  });
}

export function buildOfficeDocumentRows(input: {
  documents: Array<{
    slotCode: string;
    verificationStatus: string;
    createdAt?: string | null;
    sizeBytes?: number | null;
    remarks?: string | null;
  }>;
  certificateChecklist: Array<{
    slotCode: string;
    label: string;
    required: boolean;
    uploaded: boolean;
    verificationStatus: string;
    createdAt?: string | null;
    sizeBytes?: number | null;
    remarks?: string | null;
  }>;
  documentRequirements?: unknown;
}): DocRow[] {
  const byCode = new Map(input.documents.map((d) => [d.slotCode, d]));
  const checklistByCode = new Map(input.certificateChecklist.map((c) => [c.slotCode, c]));
  const rows: DocRow[] = [];

  for (const slot of SCHOOL_DOCUMENT_SLOTS) {
    if (slot.code === 'PAYMENT_RECEIPT') continue;
    const uploaded = byCode.get(slot.code);
    const conditional = checklistByCode.get(slot.code);
    const isConditional =
      slot.code === 'CASTE_CERT' ||
      slot.code === 'MOTHER_ST_CERT' ||
      slot.code === 'FATHER_SC_OBC_CERT';

    if (isConditional && !conditional && !uploaded) continue;

    const required = conditional ? conditional.required : isConditional ? false : slot.required;

    if (!required && !uploaded && !conditional) continue;

    const baseLabel =
      conditional?.label ||
      schoolConditionalSlotLabel(slot.code, input.documentRequirements) ||
      slot.label;

    rows.push({
      slotCode: slot.code,
      label: baseLabel,
      required,
      optional: !required,
      uploaded: Boolean(uploaded),
      verificationStatus: uploaded?.verificationStatus ?? 'MISSING',
      createdAt: uploaded?.createdAt ?? conditional?.createdAt ?? null,
      sizeBytes: uploaded?.sizeBytes ?? conditional?.sizeBytes ?? null,
      remarks: uploaded?.remarks ?? conditional?.remarks ?? null,
    });

    for (const doc of input.documents) {
      const m = /^(.+)__p(\d+)$/i.exec(doc.slotCode);
      if (!m || m[1]!.toUpperCase() !== slot.code) continue;
      rows.push({
        slotCode: doc.slotCode,
        label: `${baseLabel} (page ${m[2]})`,
        required: false,
        optional: true,
        uploaded: true,
        verificationStatus: doc.verificationStatus ?? 'PENDING',
        createdAt: doc.createdAt ?? null,
        sizeBytes: doc.sizeBytes ?? null,
        remarks: doc.remarks ?? null,
      });
    }
  }

  return rows;
}

export function ApplicantDocumentsTab({
  rows,
  onView,
  onDownload,
  onVerify,
  onReject,
  busy,
}: {
  rows: DocRow[];
  onView: (slotCode: string) => void;
  onDownload: (slotCode: string) => void;
  onVerify: (slotCode: string) => Promise<void>;
  onReject: (slotCode: string, reason: string) => Promise<void>;
  busy?: boolean;
}) {
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const groups: Array<{ title: string; filter: (row: DocRow) => boolean }> = [
    { title: 'Required Documents', filter: (r) => r.required },
    { title: 'Optional Documents', filter: (r) => r.optional && r.uploaded },
    {
      title: 'Missing Documents',
      filter: (r) => r.required && !r.uploaded,
    },
    {
      title: 'Pending Verification',
      filter: (r) =>
        r.uploaded && ['PENDING', 'UPLOADED'].includes(r.verificationStatus.toUpperCase()),
    },
    {
      title: 'Verified Documents',
      filter: (r) => r.uploaded && r.verificationStatus.toUpperCase() === 'VERIFIED',
    },
    {
      title: 'Rejected Documents',
      filter: (r) => r.uploaded && r.verificationStatus.toUpperCase() === 'REJECTED',
    },
  ];

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const items = rows.filter(group.filter);
        if (!items.length) return null;
        return (
          <ProfileSectionCard key={group.title} title={group.title}>
            <ul className="space-y-2">
              {items.map((row) => (
                <li
                  key={`${group.title}-${row.slotCode}`}
                  className="rounded-lg border bg-slate-50/70 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{row.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.required ? 'Required' : 'Optional'}
                        {' · '}
                        {row.uploaded ? 'Uploaded' : 'Not uploaded'}
                        {' · '}
                        {row.createdAt ? new Date(row.createdAt).toLocaleString('en-IN') : '—'}
                        {' · '}
                        {formatBytes(row.sizeBytes)}
                      </p>
                      {row.remarks ? (
                        <p className="mt-1 text-xs text-rose-700">{row.remarks}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <SchoolOfficeStatusBadge
                        label={rowDisplay(row).displayLabel}
                        tone={rowDisplay(row).tone}
                      />
                      <div className="flex flex-wrap justify-end gap-1.5 print:hidden">
                        {row.uploaded ? (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onView(row.slotCode)}
                            >
                              View
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => onDownload(row.slotCode)}
                            >
                              Download
                            </Button>
                            {row.verificationStatus.toUpperCase() !== 'VERIFIED' ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={busy}
                                onClick={() => void onVerify(row.slotCode)}
                              >
                                Verify
                              </Button>
                            ) : null}
                            {row.verificationStatus.toUpperCase() !== 'REJECTED' ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={busy}
                                onClick={() => {
                                  setRejecting(row.slotCode);
                                  setReason('');
                                }}
                              >
                                Reject
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {rejecting === row.slotCode ? (
                    <div className="mt-3 space-y-2 border-t pt-3 print:hidden">
                      <Label>Rejection reason</Label>
                      <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why is this document rejected?"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={busy || reason.trim().length < 3}
                          onClick={() =>
                            void onReject(row.slotCode, reason).then(() => setRejecting(null))
                          }
                        >
                          Confirm reject
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setRejecting(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </ProfileSectionCard>
        );
      })}
      {!rows.length ? <p className="text-sm text-slate-600">No documents to show yet.</p> : null}
    </div>
  );
}

export function ApplicantPaymentTab({
  fee,
  paymentStatus,
  paymentReference,
  receiptStatus,
  receiptRemarks,
  paymentDate,
  onViewReceipt,
  onVerify,
  onReject,
  busy,
}: {
  fee: number;
  paymentStatus: string;
  paymentReference?: string | null;
  receiptStatus?: string | null;
  receiptRemarks?: string | null;
  paymentDate?: string | null;
  onViewReceipt: () => void;
  onVerify: () => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  busy?: boolean;
}) {
  const [reason, setReason] = useState<string>(PAYMENT_REJECT_REASONS[0]);
  const [other, setOther] = useState('');
  const paymentDisplay =
    !receiptStatus || ['MISSING', 'NOT_UPLOADED'].includes(receiptStatus.toUpperCase())
      ? schoolDocumentDisplayStatus({ uploaded: false })
      : schoolDocumentDisplayStatus({
          uploaded: true,
          verificationStatus: receiptStatus,
        });

  return (
    <div className="space-y-4">
      <ProfileSectionCard title="Admission Fee Payment">
        <ProfileFieldGrid
          fields={[
            { label: 'Admission Fee', value: `₹${fee}` },
            {
              label: 'Payment Reference / Transaction ID',
              value: displayField(paymentReference),
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
              value: paymentDate ? new Date(paymentDate).toLocaleString('en-IN') : '—',
            },
            {
              label: 'Application Payment Record',
              value: paymentStatus || '—',
            },
            { label: 'Verification Remarks', value: displayField(receiptRemarks) },
          ]}
        />
        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={onViewReceipt}>
            View Receipt
          </Button>
          <Button type="button" disabled={busy} onClick={() => void onVerify()}>
            Verify Payment
          </Button>
        </div>
      </ProfileSectionCard>

      <ProfileSectionCard title="Reject Payment">
        <div className="space-y-3 print:hidden">
          <div>
            <Label>Rejection reason</Label>
            <select
              className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {PAYMENT_REJECT_REASONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          {reason === 'Other' ? (
            <div>
              <Label>Details</Label>
              <Input className="mt-1" value={other} onChange={(e) => setOther(e.target.value)} />
            </div>
          ) : null}
          <Button
            type="button"
            variant="destructive"
            disabled={busy || (reason === 'Other' && other.trim().length < 3)}
            onClick={() => void onReject(reason === 'Other' ? other.trim() : reason)}
          >
            Reject Payment
          </Button>
          <p className="text-xs text-muted-foreground">
            Primary payment work happens in Fee &amp; Payments → Pending Verification.
          </p>
        </div>
      </ProfileSectionCard>
    </div>
  );
}

export function ApplicantReviewTab({
  status,
  paymentStatus,
  ageEligible,
  ageMessage,
  documents,
  certificateChecklist,
  indexNumber,
  remarks,
  onIndexChange,
  onRemarksChange,
  onGrant,
  onRefuse,
  busy,
}: {
  status: string;
  paymentStatus: string;
  ageEligible: boolean;
  ageMessage?: string;
  documents: Array<{ slotCode: string; verificationStatus: string }>;
  certificateChecklist: Array<{
    slotCode: string;
    label: string;
    required: boolean;
    uploaded: boolean;
    verificationStatus: string;
  }>;
  indexNumber: string;
  remarks: string;
  onIndexChange: (value: string) => void;
  onRemarksChange: (value: string) => void;
  onGrant: () => Promise<void>;
  onRefuse: () => Promise<void>;
  busy?: boolean;
}) {
  const blockers = grantAdmissionBlockers({
    status,
    paymentStatus,
    ageEligible,
    documents,
    certificateChecklist,
    indexNumber,
  });

  return (
    <div className="space-y-4">
      <ProfileSectionCard title="Application Summary">
        <ProfileFieldGrid
          fields={[
            { label: 'Application Status', value: status },
            { label: 'Payment', value: paymentStatus },
            {
              label: 'Eligibility',
              value: ageEligible ? 'Eligible' : ageMessage || 'Not eligible',
            },
            {
              label: 'Documents',
              value: blockers.includes('All required documents must be verified')
                ? 'Not fully verified'
                : 'Ready',
            },
          ]}
        />
      </ProfileSectionCard>

      {blockers.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Before granting admission</p>
          <ul className="mt-1 list-disc pl-5">
            {blockers.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          Ready for admission decision. Enter the index number and grant admission.
        </div>
      )}

      <ProfileSectionCard title="Admission Decision">
        <div className="max-w-md space-y-3 print:hidden">
          <div>
            <Label>Index Number (required to grant)</Label>
            <Input
              className="mt-1"
              value={indexNumber}
              onChange={(e) => onIndexChange(e.target.value)}
              placeholder="e.g. TPS 2027-001"
            />
          </div>
          <div>
            <Label>Remarks</Label>
            <Input
              className="mt-1"
              value={remarks}
              onChange={(e) => onRemarksChange(e.target.value)}
              placeholder="Required when refusing admission"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || blockers.length > 0}
              onClick={() => void onGrant()}
            >
              Grant Admission
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || remarks.trim().length < 3}
              onClick={() => void onRefuse()}
            >
              Not Granted
            </Button>
          </div>
        </div>
      </ProfileSectionCard>
    </div>
  );
}
