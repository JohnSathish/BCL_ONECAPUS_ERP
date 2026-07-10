import * as SecureStore from 'expo-secure-store';
import type { SchoolConfig } from '@/types/school';

const SCHOOL_CONFIG_KEY = 'oc_school_config';

let cached: SchoolConfig | null = null;

function normalizeApiUrl(raw: string) {
  let url = raw.trim().replace(/\/+$/, '');
  if (!url.endsWith('/api')) {
    url = `${url}/api`;
  }
  return url;
}

export function normalizeSchoolConfig(input: SchoolConfig): SchoolConfig {
  return {
    ...input,
    id: input.id.trim(),
    name: input.name.trim(),
    tenantSlug: input.tenantSlug.trim().toLowerCase(),
    apiUrl: normalizeApiUrl(input.apiUrl),
  };
}

export async function getSchoolConfig(): Promise<SchoolConfig | null> {
  if (cached) return cached;
  const raw = await SecureStore.getItemAsync(SCHOOL_CONFIG_KEY);
  if (!raw) return null;
  try {
    cached = normalizeSchoolConfig(JSON.parse(raw) as SchoolConfig);
    return cached;
  } catch {
    return null;
  }
}

export async function saveSchoolConfig(config: SchoolConfig) {
  const normalized = normalizeSchoolConfig(config);
  cached = normalized;
  await SecureStore.setItemAsync(SCHOOL_CONFIG_KEY, JSON.stringify(normalized));
  return normalized;
}

export async function clearSchoolConfig() {
  cached = null;
  await SecureStore.deleteItemAsync(SCHOOL_CONFIG_KEY);
}

export async function hydrateSchoolConfig() {
  return getSchoolConfig();
}

/** Migrate legacy single-tenant EAS builds that still set EXPO_PUBLIC_* at compile time. */
export async function ensureSchoolConfigFromEnv(): Promise<SchoolConfig | null> {
  const existing = await getSchoolConfig();
  if (existing) return existing;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  const tenantSlug = process.env.EXPO_PUBLIC_TENANT_SLUG?.trim();
  if (!apiUrl || !tenantSlug) return null;

  return saveSchoolConfig({
    id: tenantSlug,
    name: process.env.EXPO_PUBLIC_APP_NAME?.trim() || 'My Institution',
    apiUrl,
    tenantSlug,
    privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
    supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
  });
}

export async function getApiBase(): Promise<string> {
  const config = await getSchoolConfig();
  if (config?.apiUrl) return config.apiUrl;
  return process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://localhost:3001/api';
}

export function getApiBaseSync(): string {
  if (cached?.apiUrl) return cached.apiUrl;
  return process.env.EXPO_PUBLIC_API_URL?.trim() || 'http://localhost:3001/api';
}

export async function getTenantSlug(): Promise<string> {
  const config = await getSchoolConfig();
  if (config?.tenantSlug) return config.tenantSlug;
  return process.env.EXPO_PUBLIC_TENANT_SLUG?.trim() || 'demo';
}

export async function hasSchoolConfig(): Promise<boolean> {
  return Boolean(await getSchoolConfig());
}
