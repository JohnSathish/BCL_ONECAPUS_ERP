export const LICENSE_TYPES = [
  'TRIAL_15',
  'TRIAL_30',
  'TRIAL_60',
  'ANNUAL_1Y',
  'MULTI_2Y',
  'MULTI_3Y',
  'MULTI_5Y',
  'LIFETIME',
] as const;

export type LicenseType = (typeof LICENSE_TYPES)[number];

export const LICENSE_TYPE_LABELS: Record<LicenseType, string> = {
  TRIAL_15: 'Trial (15 Days)',
  TRIAL_30: 'Trial (30 Days)',
  TRIAL_60: 'Trial (60 Days)',
  ANNUAL_1Y: 'Annual License',
  MULTI_2Y: 'Multi-Year (2 Years)',
  MULTI_3Y: 'Multi-Year (3 Years)',
  MULTI_5Y: 'Multi-Year (5 Years)',
  LIFETIME: 'Lifetime License',
};

export const LICENSE_TYPE_DAYS: Partial<Record<LicenseType, number>> = {
  TRIAL_15: 15,
  TRIAL_30: 30,
  TRIAL_60: 60,
  ANNUAL_1Y: 365,
  MULTI_2Y: 730,
  MULTI_3Y: 1095,
  MULTI_5Y: 1825,
};

export type LicenseStatus =
  | 'ACTIVE'
  | 'NEAR_EXPIRY'
  | 'GRACE_PERIOD'
  | 'EXPIRED'
  | 'SUSPENDED';

export type LicenseSeverity = 'green' | 'yellow' | 'orange' | 'red' | 'gray';

export type LicenseWriteAction =
  | 'admission.create'
  | 'student.create'
  | 'staff.create'
  | 'attendance.write'
  | 'examination.write'
  | 'fee.write';

export const RENEWAL_CONTACT = {
  company: 'BaseCode Labs Pvt. Ltd.',
  mobile: '9566363655',
  email: 'contact@basecodelabs.com',
};

export type LicenseComputed = {
  status: LicenseStatus;
  nearExpiryTier: number | null;
  daysRemaining: number | null;
  blockingDate: Date | null;
  progressPercent: number;
  severity: LicenseSeverity;
  isWriteBlocked: boolean;
};

export type TenantLicenseRow = {
  id: string;
  tenantId: string;
  licenseNumber: string;
  licenseType: string;
  subscriptionPlan: string;
  startDate: Date;
  expiryDate: Date | null;
  renewalDate: Date | null;
  gracePeriodDays: number;
  maxStudents: number | null;
  maxStaff: number | null;
  storageLimitMb: number | null;
  internalNotes: string | null;
  suspendedAt: Date | null;
  suspendedById: string | null;
  suspensionReason: string | null;
};
