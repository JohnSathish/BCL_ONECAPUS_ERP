import type { ApplicantMe, PortalInfo } from '@/services/admissions-portal';

export type PortalCycleSettings = {
  applicationFee: number;
  admissionFeeMin: number;
  requirePaymentBeforeSubmit: boolean;
  applicationNumberPrefix: string;
  helpDesk: { phone: string; email?: string };
};

export const DEFAULT_APPLICATION_FEE = 600;
export const DEFAULT_ADMISSION_FEE_MIN = 10500;
const DEFAULT_HELP_PHONE = '+91 9402152496 / +91 9566363655';

export function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function parsePortalCycleSettings(
  raw?: Record<string, unknown> | null,
): PortalCycleSettings {
  const s = (raw ?? {}) as {
    applicationFee?: number;
    admissionFeeMin?: number;
    requirePaymentBeforeSubmit?: boolean;
    applicationNumberPrefix?: string;
    helpDesk?: { phone?: string; email?: string };
  };

  return {
    applicationFee: Number(s.applicationFee) || DEFAULT_APPLICATION_FEE,
    admissionFeeMin: Number(s.admissionFeeMin) || DEFAULT_ADMISSION_FEE_MIN,
    requirePaymentBeforeSubmit: s.requirePaymentBeforeSubmit !== false,
    applicationNumberPrefix: s.applicationNumberPrefix?.trim() || 'DBCT26',
    helpDesk: {
      phone: s.helpDesk?.phone?.trim() || DEFAULT_HELP_PHONE,
      email: s.helpDesk?.email?.trim() || undefined,
    },
  };
}

export function resolvePortalCycleSettings(sources: {
  portalInfo?: PortalInfo | null;
  applicant?: ApplicantMe | null;
}): PortalCycleSettings {
  const applicantSettings = sources.applicant?.application?.cycle?.settings;
  const portalSettings =
    sources.portalInfo?.settings ?? sources.portalInfo?.cycle?.settings ?? null;

  return parsePortalCycleSettings(
    (applicantSettings as Record<string, unknown> | undefined) ?? portalSettings,
  );
}

export function applicationFeeHint(settings: PortalCycleSettings) {
  return `Application fee (registration): ${formatInr(settings.applicationFee)} — required before you can submit your form.`;
}

export function admissionFeeAfterSelectionNote(settings: PortalCycleSettings) {
  return `If you are selected for admission, you will be asked to pay the admission fee (amount set by the college; minimum guideline ${formatInr(settings.admissionFeeMin)}).`;
}
