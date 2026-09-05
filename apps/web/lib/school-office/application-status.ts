/**
 * Derive office-facing status badges and grant readiness for K.G. admissions.
 */

export type SchoolOfficeBadgeTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export type SchoolOfficeStatusBadge = {
  key: 'application' | 'payment' | 'documents' | 'admission';
  label: string;
  tone: SchoolOfficeBadgeTone;
};

export type SchoolCertificateChecklistItem = {
  slotCode: string;
  label: string;
  required: boolean;
  uploaded: boolean;
  verificationStatus: string;
};

export type SchoolDocumentSlotLike = {
  slotCode: string;
  verificationStatus: string;
  createdAt?: string | null;
  sizeBytes?: number | null;
  remarks?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function humanApplicationStatus(status: string | null | undefined): string {
  switch ((status ?? '').toLowerCase()) {
    case 'draft':
      return 'Draft';
    case 'submitted':
      return 'Submitted';
    case 'under_review':
      return 'Under Review';
    case 'allotted':
      return 'Admission Granted';
    case 'rejected':
      return 'Not Granted';
    default:
      return status ? status : 'Unknown';
  }
}

export function derivePaymentBadge(input: {
  paymentStatus?: string | null;
  receiptStatus?: string | null;
  hasReceipt?: boolean;
}): SchoolOfficeStatusBadge {
  const payment = (input.paymentStatus ?? '').toUpperCase();
  const receipt = (input.receiptStatus ?? '').toUpperCase();
  const uploaded =
    Boolean(input.hasReceipt) ||
    receipt === 'PENDING' ||
    receipt === 'VERIFIED' ||
    receipt === 'REJECTED';

  if (payment === 'PAID' || receipt === 'VERIFIED') {
    return { key: 'payment', label: 'VERIFIED', tone: 'success' };
  }
  if (receipt === 'REJECTED') {
    return {
      key: 'payment',
      label: 'REJECTED – RESUBMISSION REQUIRED',
      tone: 'danger',
    };
  }
  if (uploaded) {
    return {
      key: 'payment',
      label: 'UPLOADED – VERIFICATION PENDING',
      tone: 'warning',
    };
  }
  return { key: 'payment', label: 'NOT UPLOADED', tone: 'neutral' };
}

export function deriveDocumentRollup(
  checklist: SchoolCertificateChecklistItem[],
  documents: SchoolDocumentSlotLike[],
  requiredBaseCodes: string[],
): {
  label: string;
  tone: SchoolOfficeBadgeTone;
  filterKey: 'incomplete' | 'pending' | 'verified' | 'rejected' | 'none';
  pendingCount: number;
  missingCount: number;
  rejectedCount: number;
  allRequiredVerified: boolean;
} {
  const byCode = new Map(documents.map((d) => [d.slotCode, d]));
  const requiredSlots = new Map<string, { label: string }>();

  for (const code of requiredBaseCodes) {
    if (code === 'PAYMENT_RECEIPT') continue;
    requiredSlots.set(code, { label: code });
  }
  for (const item of checklist) {
    if (!item.required) continue;
    requiredSlots.set(item.slotCode, { label: item.label });
  }

  if (requiredSlots.size === 0) {
    return {
      label: 'No Documents Required',
      tone: 'neutral',
      filterKey: 'none',
      pendingCount: 0,
      missingCount: 0,
      rejectedCount: 0,
      allRequiredVerified: true,
    };
  }

  let missingCount = 0;
  let pendingCount = 0;
  let rejectedCount = 0;
  let verifiedCount = 0;

  for (const [code] of requiredSlots) {
    const uploaded = byCode.get(code);
    const status = (uploaded?.verificationStatus ?? 'MISSING').toUpperCase();
    if (!uploaded || status === 'MISSING') {
      missingCount += 1;
      continue;
    }
    if (status === 'VERIFIED') verifiedCount += 1;
    else if (status === 'REJECTED') rejectedCount += 1;
    else pendingCount += 1;
  }

  const allRequiredVerified = verifiedCount === requiredSlots.size && missingCount === 0;

  if (rejectedCount > 0) {
    return {
      label: 'Documents Rejected',
      tone: 'danger',
      filterKey: 'rejected',
      pendingCount,
      missingCount,
      rejectedCount,
      allRequiredVerified: false,
    };
  }
  if (allRequiredVerified) {
    return {
      label: 'Documents Verified',
      tone: 'success',
      filterKey: 'verified',
      pendingCount,
      missingCount,
      rejectedCount,
      allRequiredVerified: true,
    };
  }
  if (missingCount > 0 && pendingCount === 0 && verifiedCount === 0) {
    return {
      label: 'Documents Not Uploaded',
      tone: 'warning',
      filterKey: 'incomplete',
      pendingCount,
      missingCount,
      rejectedCount,
      allRequiredVerified: false,
    };
  }
  if (pendingCount > 0 && missingCount === 0) {
    return {
      label: 'Uploaded – Verification Pending',
      tone: 'warning',
      filterKey: 'pending',
      pendingCount,
      missingCount,
      rejectedCount,
      allRequiredVerified: false,
    };
  }
  if (pendingCount > 0 || missingCount > 0) {
    return {
      label: 'Documents Incomplete',
      tone: 'warning',
      filterKey: 'pending',
      pendingCount,
      missingCount,
      rejectedCount,
      allRequiredVerified: false,
    };
  }
  return {
    label: 'Uploaded – Verification Pending',
    tone: 'warning',
    filterKey: 'pending',
    pendingCount,
    missingCount,
    rejectedCount,
    allRequiredVerified: false,
  };
}

export function deriveAdmissionBadge(input: {
  status?: string | null;
  officeDecision?: string | null;
  indexNumber?: string | null;
}): SchoolOfficeStatusBadge {
  const status = (input.status ?? '').toLowerCase();
  const decision = (input.officeDecision ?? '').toUpperCase();
  if (status === 'allotted' || decision === 'GRANTED') {
    return {
      key: 'admission',
      label: input.indexNumber ? `Granted · ${input.indexNumber}` : 'Admission Granted',
      tone: 'success',
    };
  }
  if (status === 'rejected' || decision === 'NOT_GRANTED') {
    return { key: 'admission', label: 'Not Granted', tone: 'danger' };
  }
  return { key: 'admission', label: 'Decision Pending', tone: 'info' };
}

export function deriveApplicationBadge(status?: string | null): SchoolOfficeStatusBadge {
  const s = (status ?? '').toLowerCase();
  if (s === 'allotted') return { key: 'application', label: 'Submitted', tone: 'success' };
  if (s === 'rejected') return { key: 'application', label: 'Submitted', tone: 'neutral' };
  if (s === 'submitted' || s === 'under_review') {
    return { key: 'application', label: humanApplicationStatus(s), tone: 'info' };
  }
  if (s === 'draft') return { key: 'application', label: 'Draft', tone: 'neutral' };
  return { key: 'application', label: humanApplicationStatus(s), tone: 'neutral' };
}

export function deriveSchoolOfficeBadges(input: {
  status?: string | null;
  paymentStatus?: string | null;
  formData?: Record<string, unknown> | null;
  documents?: SchoolDocumentSlotLike[];
  certificateChecklist?: SchoolCertificateChecklistItem[];
  requiredBaseCodes?: string[];
}): SchoolOfficeStatusBadge[] {
  const form = asRecord(input.formData);
  const office = asRecord(form.office);
  const docs = input.documents ?? [];
  const receipt = docs.find((d) => d.slotCode === 'PAYMENT_RECEIPT');
  const docRollup = deriveDocumentRollup(
    input.certificateChecklist ?? [],
    docs,
    input.requiredBaseCodes ?? [
      'PHOTO',
      'BIRTH_CERT',
      'LAST_SCHOOL_REPORT',
      'LAST_SCHOOL_CERT',
      'FATHER_INCOME',
      'MOTHER_INCOME',
    ],
  );

  return [
    deriveApplicationBadge(input.status),
    derivePaymentBadge({
      paymentStatus: input.paymentStatus,
      receiptStatus: receipt?.verificationStatus,
      hasReceipt: Boolean(receipt),
    }),
    {
      key: 'documents',
      label: docRollup.label,
      tone: docRollup.tone,
    },
    deriveAdmissionBadge({
      status: input.status,
      officeDecision: text(office.decision) || null,
      indexNumber: text(office.indexNumber) || null,
    }),
  ];
}

export function grantAdmissionBlockers(input: {
  status?: string | null;
  paymentStatus?: string | null;
  ageEligible?: boolean;
  formData?: Record<string, unknown> | null;
  documents?: SchoolDocumentSlotLike[];
  certificateChecklist?: SchoolCertificateChecklistItem[];
  indexNumber?: string;
}): string[] {
  const blockers: string[] = [];
  const status = (input.status ?? '').toLowerCase();
  if (!['submitted', 'under_review'].includes(status)) {
    blockers.push('Application must be submitted');
  }
  if (!input.ageEligible) {
    blockers.push('Applicant is not age-eligible');
  }
  const docs = input.documents ?? [];
  const receipt = docs.find((d) => d.slotCode === 'PAYMENT_RECEIPT');
  if (
    (input.paymentStatus ?? '').toUpperCase() !== 'PAID' ||
    (receipt?.verificationStatus ?? '').toUpperCase() !== 'VERIFIED'
  ) {
    blockers.push('Payment must be verified');
  }
  const rollup = deriveDocumentRollup(input.certificateChecklist ?? [], docs, [
    'PHOTO',
    'BIRTH_CERT',
    'LAST_SCHOOL_REPORT',
    'LAST_SCHOOL_CERT',
    'FATHER_INCOME',
    'MOTHER_INCOME',
  ]);
  if (!rollup.allRequiredVerified) {
    blockers.push('All required documents must be verified');
  }
  if (!text(input.indexNumber)) {
    blockers.push('Index number is required');
  }
  return blockers;
}

export const PAYMENT_REJECT_REASONS = [
  'Incorrect amount',
  'Unclear receipt',
  'Wrong bank account',
  'Payment reference mismatch',
  'Duplicate payment',
  'Other',
] as const;
