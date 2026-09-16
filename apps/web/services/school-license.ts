import { api } from '@/lib/http/client';

export type SchoolLicenseSnapshot = {
  tone: string;
  label: string;
  licenseKey?: string | null;
  licenseType?: string | null;
  institutionName?: string | null;
  institutionId?: string;
  institutionCode?: string | null;
  activatedAt?: string | null;
  validFrom?: string | null;
  expiresAt?: string | null;
  daysRemaining?: number | null;
  termDays?: number;
  progress?: number;
  maxStudents?: number | null;
  maxStaff?: number | null;
  studentsUsed?: number;
  staffUsed?: number;
  enabledModules?: string[];
  installationLimit?: number | null;
  installations?: number;
  installationId?: string | null;
  licenseVersion?: string | null;
  lastValidatedAt?: string | null;
  nextValidationAt?: string | null;
  licenseServerStatus?: string;
  warning?: string | null;
  status?: string;
  expiredPolicy?: string;
};

export async function fetchSchoolLicenseStatus() {
  const { data } = await api.get('/v1/school-sis/license/status');
  return data as SchoolLicenseSnapshot;
}

export async function activateSchoolLicense(payload: {
  licenseKey: string;
  institutionName: string;
  institutionCode: string;
  adminEmail: string;
}) {
  const { data } = await api.post('/v1/school-sis/license/activate', payload);
  return data as SchoolLicenseSnapshot;
}

export async function validateSchoolLicense() {
  const { data } = await api.post('/v1/school-sis/license/validate');
  return data as SchoolLicenseSnapshot;
}

export async function renewSchoolLicense(licenseKey: string) {
  const { data } = await api.post('/v1/school-sis/license/renew', { licenseKey });
  return data as SchoolLicenseSnapshot;
}

export async function deactivateSchoolLicense() {
  const { data } = await api.post('/v1/school-sis/license/deactivate');
  return data as { ok: boolean };
}

export async function fetchSchoolLicenseEvents() {
  const { data } = await api.get('/v1/school-sis/license/events');
  return data as Array<{
    id: string;
    event: string;
    createdAt: string;
    ip?: string | null;
    metaJson?: unknown;
  }>;
}

export async function fetchBclSchoolLicenses() {
  const { data } = await api.get('/v1/bcl-licenses');
  return data as Array<Record<string, unknown>>;
}

export async function issueBclSchoolLicense(payload: Record<string, unknown>) {
  const { data } = await api.post('/v1/bcl-licenses/issue', payload);
  return data as Record<string, unknown> & { signedToken?: string; licenseKey?: string };
}

export async function bclSchoolLicenseAction(
  id: string,
  action: string,
  body: Record<string, unknown> = {},
) {
  const { data } = await api.post(`/v1/bcl-licenses/${id}/${action}`, body);
  return data as Record<string, unknown>;
}
