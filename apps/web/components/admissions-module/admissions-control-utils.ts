import type { AdmissionApplication } from '@/types/admissions';
import { applicantDisplayName, applicantPhotoUrl } from '@/components/admissions-portal/utils';

export function formatSubjectCode(code?: string | null) {
  if (!code) return '—';
  return code.replace(/_/g, ' ').toUpperCase();
}

export function applicationShiftLabel(app: AdmissionApplication) {
  const allocation = app.seatAllocations?.[0];
  if (allocation?.shift?.name) return allocation.shift.name;
  if (app.preferredShift?.name) return app.preferredShift.name;
  const prefs = (app.formData?.coursePreferences ?? {}) as { shiftId?: string };
  if (prefs.shiftId) return 'Shift selected';
  return 'Pending selection';
}

export function applicationMajorLabel(app: AdmissionApplication) {
  if (app.majorSubjectCode) return formatSubjectCode(app.majorSubjectCode);
  const prefs = (app.formData?.coursePreferences ?? {}) as { majorCode?: string };
  if (prefs.majorCode) return formatSubjectCode(prefs.majorCode);
  return app.academicStream?.name ?? '—';
}

export function applicationPercentage(app: AdmissionApplication) {
  const academic = (app.formData?.academic ?? {}) as {
    class12Percentage?: number | string;
  };
  const fromForm = academic.class12Percentage;
  if (fromForm != null && fromForm !== '') {
    const n = Number(fromForm);
    if (Number.isFinite(n)) return n.toFixed(2);
  }
  const score = Number(app.meritScore);
  return Number.isFinite(score) ? score.toFixed(2) : '—';
}

export function applicationFormProgressLabel(app: AdmissionApplication) {
  if (app.status !== 'draft') return null;
  if ((app.progressPercent ?? 0) <= 0) return null;
  return 'Form in progress';
}

export function applicationFeeLabel(app: AdmissionApplication) {
  if (app.paymentStatus === 'PAID' || app.paymentStatus === 'WAIVED') {
    return 'Application fee paid';
  }
  if (app.status === 'draft' && (app.progressPercent ?? 0) < 85) return null;
  return 'Application fee pending';
}

export function isSelectedForAdmission(app: AdmissionApplication) {
  return app.status === 'allotted';
}

export function admissionFeeLabel(app: AdmissionApplication) {
  if (!isSelectedForAdmission(app)) return null;
  const status = app.admissionFeeStatus ?? 'NOT_APPLICABLE';
  if (status === 'PAID' || status === 'WAIVED') return 'Admission fee paid';
  if (status === 'PENDING') {
    const amount = app.admissionFeeAmount != null ? Number(app.admissionFeeAmount) : null;
    return amount != null
      ? `Admission fee due ₹${amount.toLocaleString('en-IN')}`
      : 'Admission fee due';
  }
  return null;
}

export function applicationRowTone(app: AdmissionApplication) {
  const feePaid = app.paymentStatus === 'PAID' || app.paymentStatus === 'WAIVED';
  const submitted = app.status !== 'draft';
  if (feePaid && submitted) return 'success';
  if (app.status === 'rejected') return 'muted';
  return 'default';
}

export function applicationDisplayMeta(app: AdmissionApplication) {
  return {
    name: applicantDisplayName(app),
    photo: applicantPhotoUrl(app.documents),
    major: applicationMajorLabel(app),
    shift: applicationShiftLabel(app),
    percentage: applicationPercentage(app),
    submittedAt: app.submittedAt,
  };
}
