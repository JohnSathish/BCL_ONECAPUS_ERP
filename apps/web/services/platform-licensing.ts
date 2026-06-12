import { api } from '@/services/api';
import type { LicenseStatus, LicenseSummary } from '@/services/licensing';

export type PlatformLicenseListItem = {
  tenantId: string;
  institutionName: string;
  tenantStatus: string;
  license: {
    id: string;
    licenseNumber: string;
    licenseType: string;
    subscriptionPlan: string;
    expiryDate: string | null;
    status: LicenseStatus;
    daysRemaining: number | null;
    severity: LicenseSummary['severity'];
  } | null;
};

export type PlatformAnalytics = {
  totalLicensedInstitutions: number;
  activeLicenses: number;
  nearExpiryLicenses: number;
  expiredLicenses: number;
  suspendedLicenses: number;
  annualRevenue: number;
  renewalForecast: number;
};

export type PlatformLicenseDetail = {
  tenant: { id: string; name: string; status: string };
  license:
    | (Record<string, unknown> & {
        licenseNumber: string;
        licenseType: string;
        subscriptionPlan: string;
        status: LicenseStatus;
        daysRemaining: number | null;
        expiryDate: string | null;
        internalNotes: string | null;
        renewals: Array<{
          id: string;
          renewedAt: string;
          previousExpiryDate: string | null;
          newExpiryDate: string;
          amount: string | number | null;
          invoiceNumber: string | null;
          paymentMode: string | null;
          notes: string | null;
        }>;
      })
    | null;
  usage: {
    currentStudents: number;
    currentStaff: number;
    fileStorageMb: number;
  };
};

export async function fetchPlatformAnalytics(): Promise<PlatformAnalytics> {
  const { data } = await api.get('/v1/platform/licenses/analytics');
  return data;
}

export async function fetchPlatformLicenses(params?: {
  status?: LicenseStatus;
  search?: string;
}): Promise<{ items: PlatformLicenseListItem[]; total: number }> {
  const { data } = await api.get('/v1/platform/licenses', { params });
  return data;
}

export async function fetchPlatformLicense(tenantId: string): Promise<PlatformLicenseDetail> {
  const { data } = await api.get(`/v1/platform/licenses/${tenantId}`);
  return data;
}

export async function renewPlatformLicense(
  tenantId: string,
  payload: {
    newExpiryDate: string;
    amount?: number;
    invoiceNumber?: string;
    paymentMode?: string;
    notes?: string;
  },
) {
  const { data } = await api.post(`/v1/platform/licenses/${tenantId}/renew`, payload);
  return data;
}

export async function extendPlatformLicense(
  tenantId: string,
  payload: { newExpiryDate: string; notes?: string },
) {
  const { data } = await api.post(`/v1/platform/licenses/${tenantId}/extend`, payload);
  return data;
}

export async function suspendPlatformLicense(tenantId: string, reason: string) {
  const { data } = await api.post(`/v1/platform/licenses/${tenantId}/suspend`, { reason });
  return data;
}

export async function activatePlatformLicense(tenantId: string) {
  const { data } = await api.post(`/v1/platform/licenses/${tenantId}/activate`);
  return data;
}

export async function createPlatformLicense(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/platform/licenses', payload);
  return data;
}

export type LicenseActivationKeyRow = {
  id: string;
  activationKey: string;
  label: string | null;
  licenseType: string;
  subscriptionPlan: string;
  termDays: number;
  status: string;
  keyExpiresAt: string | null;
  redeemedAt: string | null;
  redeemedByTenantId: string | null;
  createdAt: string;
};

export async function fetchPlatformLicenseKeys(
  status?: string,
): Promise<LicenseActivationKeyRow[]> {
  const { data } = await api.get('/v1/platform/license-keys', {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function createPlatformLicenseKeys(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/platform/license-keys', payload);
  return data as { items: LicenseActivationKeyRow[]; total: number };
}

export async function revokePlatformLicenseKey(id: string) {
  const { data } = await api.post(`/v1/platform/license-keys/${id}/revoke`);
  return data;
}

export async function fetchPlatformLicenseAudit(tenantId: string) {
  const { data } = await api.get(`/v1/platform/licenses/${tenantId}/audit`);
  return data as Array<{
    id: string;
    action: string;
    createdAt: string;
    previousValue: unknown;
    newValue: unknown;
  }>;
}
