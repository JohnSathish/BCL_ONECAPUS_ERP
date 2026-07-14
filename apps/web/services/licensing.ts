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

/** Optional (toggleable) enterprise modules — keys may be camelCase or kebab-case from API. */
export const OPTIONAL_LICENSE_MODULE_KEYS = [
  'shortTermCourses',
  'lms',
  'questionBank',
  'syllabusRepository',
  'library',
  'cams',
  'infrastructure',
  'frontOffice',
  'governance',
  'officialDocuments',
  'naacIqac',
  'transport',
  'inventory',
  'shifts',
  'workflow',
  'helpdesk',
  'parent-portal',
  'parentPortal',
  'visitor-management',
  'visitorManagement',
  'placement',
  'internship',
  'alumni',
  'hostel',
  'research',
  'integrations',
  'assetLifecycle',
  'dms',
] as const;

export type ModuleEntitlement = {
  moduleKey: string;
  label?: string;
  description?: string;
  enabled: boolean;
  /** Core modules are always enabled and not toggleable in admin UI. */
  core?: boolean;
  limits?: Record<string, unknown>;
};

export function normalizeModuleKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/_/g, '-')
    .toLowerCase();
}

export function isOptionalLicenseModule(moduleKey: string): boolean {
  const normalized = normalizeModuleKey(moduleKey);
  return OPTIONAL_LICENSE_MODULE_KEYS.some((k) => normalizeModuleKey(k) === normalized);
}

export async function fetchModuleEntitlements(): Promise<ModuleEntitlement[]> {
  const { data } = await api.get('/v1/license/modules');
  const raw: unknown[] = Array.isArray(data)
    ? data
    : data && Array.isArray((data as { modules?: unknown }).modules)
      ? (data as { modules: unknown[] }).modules
      : [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    const moduleKey = String(row.moduleKey ?? row.key ?? '');
    return {
      moduleKey,
      label: row.label as string | undefined,
      description: row.description as string | undefined,
      enabled: Boolean(row.enabled),
      core: row.core === true || row.category === 'core',
      limits: (row.limits as Record<string, unknown>) ?? {},
    } satisfies ModuleEntitlement;
  });
}

export async function fetchEnabledModules(): Promise<string[]> {
  const { data } = await api.get('/v1/license/modules/enabled');
  if (Array.isArray(data)) return data as string[];
  if (data && Array.isArray((data as { enabled?: unknown }).enabled)) {
    return (data as { enabled: string[] }).enabled;
  }
  if (data && Array.isArray((data as { modules?: unknown }).modules)) {
    return (data as { modules: string[] }).modules;
  }
  return [];
}

export async function setModuleEntitlement(moduleKey: string, enabled: boolean) {
  const { data } = await api.patch(`/v1/license/modules/${encodeURIComponent(moduleKey)}`, {
    enabled,
  });
  return data as ModuleEntitlement | { success: boolean; moduleKey: string; enabled: boolean };
}
