/**
 * Combined upload + school-verification display labels for K.G. admissions.
 * Internal codes stay PENDING | VERIFIED | REJECTED; UI/PDF never show bare "PENDING"
 * when a file is already uploaded.
 */

export type SchoolDocUploadStatus = 'NOT_UPLOADED' | 'UPLOADED';
export type SchoolDocVerificationCode = 'PENDING' | 'VERIFIED' | 'REJECTED';

export type SchoolDocumentDisplayStatus = {
  uploadStatus: SchoolDocUploadStatus;
  verificationStatus: SchoolDocVerificationCode | null;
  /** User-facing combined label for lists / PDF / Excel */
  displayLabel: string;
  /** School-only verification line (payment section) */
  schoolVerificationLabel: string;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger';
};

function normalizeVerification(
  value: string | null | undefined,
): SchoolDocVerificationCode {
  const v = (value ?? '').trim().toUpperCase();
  if (v === 'VERIFIED') return 'VERIFIED';
  if (v === 'REJECTED') return 'REJECTED';
  return 'PENDING';
}

export function schoolDocumentDisplayStatus(input: {
  uploaded: boolean;
  verificationStatus?: string | null;
}): SchoolDocumentDisplayStatus {
  if (!input.uploaded) {
    return {
      uploadStatus: 'NOT_UPLOADED',
      verificationStatus: null,
      displayLabel: 'NOT UPLOADED',
      schoolVerificationLabel: 'NOT UPLOADED',
      tone: 'neutral',
    };
  }

  const verificationStatus = normalizeVerification(input.verificationStatus);
  if (verificationStatus === 'VERIFIED') {
    return {
      uploadStatus: 'UPLOADED',
      verificationStatus,
      displayLabel: 'VERIFIED',
      schoolVerificationLabel: 'VERIFIED',
      tone: 'success',
    };
  }
  if (verificationStatus === 'REJECTED') {
    return {
      uploadStatus: 'UPLOADED',
      verificationStatus,
      displayLabel: 'REJECTED – RESUBMISSION REQUIRED',
      schoolVerificationLabel: 'REJECTED',
      tone: 'danger',
    };
  }
  return {
    uploadStatus: 'UPLOADED',
    verificationStatus: 'PENDING',
    displayLabel: 'UPLOADED – VERIFICATION PENDING',
    schoolVerificationLabel: 'PENDING VERIFICATION',
    tone: 'warning',
  };
}

export function formatSchoolDocumentLine(input: {
  label: string;
  required: boolean;
  uploaded: boolean;
  verificationStatus?: string | null;
}): string {
  const status = schoolDocumentDisplayStatus(input);
  const req = input.required ? 'Required' : 'Optional';
  return `${input.label} (${req}) — ${status.displayLabel}`;
}
