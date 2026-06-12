import { api } from '@/services/api';

export type LicenseSeverity = 'green' | 'yellow' | 'orange' | 'red' | 'gray';
export type LicenseStatus = 'ACTIVE' | 'NEAR_EXPIRY' | 'GRACE_PERIOD' | 'EXPIRED' | 'SUSPENDED';

export type LicenseSummary = {
  licenseNumber: string;
  institutionName: string;
  licenseType: string;
  subscriptionPlan: string;
  startDate: string;
  expiryDate: string | null;
  renewalDate: string | null;
  gracePeriodDays: number;
  status: LicenseStatus;
  nearExpiryTier: number | null;
  daysRemaining: number | null;
  blockingDate: string | null;
  progressPercent: number;
  severity: LicenseSeverity;
  isWriteBlocked: boolean;
  alertMessage: string | null;
  showMarquee: boolean;
  renewalContact: {
    company: string;
    mobile: string;
    email: string;
  };
};

export type LicenseUsage = {
  currentStudents: number;
  currentStaff: number;
  fileStorageMb: number;
  databaseSizeMb: number;
  apiUsageCount: number;
};

export type LicenseDetails =
  | (LicenseSummary & {
      hasLicense?: true;
      usage: LicenseUsage;
      limits: {
        maxStudents: number | null;
        maxStaff: number | null;
        storageLimitMb: number | null;
      };
      renewalHistory: Array<{
        id: string;
        renewedAt: string;
        previousExpiryDate: string | null;
        newExpiryDate: string;
        notes: string | null;
      }>;
    })
  | {
      hasLicense: false;
      usage: LicenseUsage;
      limits: {
        maxStudents: number | null;
        maxStaff: number | null;
        storageLimitMb: number | null;
      };
      renewalHistory: [];
      renewalContact: LicenseSummary['renewalContact'];
    };

export async function activateLicenseKey(activationKey: string) {
  const { data } = await api.post('/v1/license/activate-key', { activationKey });
  return data as { success: boolean; message: string; license: LicenseSummary };
}

export async function fetchLicenseSummary(): Promise<LicenseSummary> {
  const { data } = await api.get('/v1/license/summary');
  return data;
}

export async function fetchLicenseDetails(): Promise<LicenseDetails> {
  const { data } = await api.get('/v1/license/details');
  return data;
}

export async function fetchRenewalContact() {
  const { data } = await api.get('/v1/license/renewal-contact');
  return data as LicenseSummary['renewalContact'];
}
