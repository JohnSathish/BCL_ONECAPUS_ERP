import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { COLLEGE_NAME } from '@/constants/release';
import type { SchoolConfig } from '@/types/school';

const SCHOOL_CONFIG_KEY = 'oc_school_config';
export const ST_LUKES_LIVE_API = 'https://erp.stlukestura.in/api';

let cached: SchoolConfig | null = null;

function wantsLocalSchoolApi() {
  return process.env.EXPO_PUBLIC_USE_LOCAL_API === '1';
}

function isPrivateDevApiHost(url: string) {
  try {
    const hostname = new URL(url.includes('://') ? url : `http://${url}`).hostname.toLowerCase();
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '10.0.2.2' ||
      hostname === '10.0.3.2'
    );
  } catch {
    return /localhost|127\.0\.0\.1|10\.0\.2\.2|10\.0\.3\.2/i.test(url);
  }
}

function rewriteApiUrlForRuntime(url: string) {
  try {
    const parsed = new URL(url);
    const androidEmulator = Platform.OS === 'android' && Device.isDevice === false;
    if (androidEmulator && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      parsed.hostname = '10.0.2.2';
      return parsed.toString().replace(/\/+$/, '');
    }
    return url.replace(/\/+$/, '');
  } catch {
    return url.replace(/\/+$/, '');
  }
}

/** Emulator builds should hit live St. Luke's ERP unless local nest is opted in. */
export function resolveSchoolApiUrl(url: string, tenantSlug?: string | null) {
  const rewritten = rewriteApiUrlForRuntime(url);
  if (wantsLocalSchoolApi()) return rewritten;
  if (tenantSlug === 'st-lukes-tura' && isPrivateDevApiHost(rewritten)) {
    return ST_LUKES_LIVE_API;
  }
  return rewritten;
}

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
    code: input.code?.trim() || undefined,
    apiUrl: normalizeApiUrl(input.apiUrl),
  };
}

function withLiveSchoolApi(config: SchoolConfig): SchoolConfig {
  const apiUrl = resolveSchoolApiUrl(config.apiUrl, config.tenantSlug);
  if (apiUrl === config.apiUrl) return config;
  return { ...config, apiUrl };
}

export async function getSchoolConfig(): Promise<SchoolConfig | null> {
  if (cached) {
    cached = withLiveSchoolApi(cached);
    return cached;
  }
  const raw = await SecureStore.getItemAsync(SCHOOL_CONFIG_KEY);
  if (!raw) return null;
  try {
    const loaded = normalizeSchoolConfig(JSON.parse(raw) as SchoolConfig);
    const next = withLiveSchoolApi(loaded);
    cached = next;
    if (next.apiUrl !== loaded.apiUrl) {
      await SecureStore.setItemAsync(SCHOOL_CONFIG_KEY, JSON.stringify(next));
    }
    return next;
  } catch {
    return null;
  }
}

export async function saveSchoolConfig(config: SchoolConfig) {
  const normalized = withLiveSchoolApi(normalizeSchoolConfig(config));
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
    name: process.env.EXPO_PUBLIC_APP_NAME?.trim() || COLLEGE_NAME,
    apiUrl: resolveSchoolApiUrl(apiUrl, tenantSlug),
    tenantSlug,
    privacyPolicyUrl: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
    supportEmail: process.env.EXPO_PUBLIC_SUPPORT_EMAIL,
  });
}

export async function getApiBase(): Promise<string> {
  const config = await getSchoolConfig();
  const tenant = config?.tenantSlug || process.env.EXPO_PUBLIC_TENANT_SLUG?.trim();
  const raw = config?.apiUrl || process.env.EXPO_PUBLIC_API_URL?.trim() || ST_LUKES_LIVE_API;
  return resolveSchoolApiUrl(raw, tenant);
}

export function getApiBaseSync(): string {
  const tenant = cached?.tenantSlug || process.env.EXPO_PUBLIC_TENANT_SLUG?.trim();
  const raw = cached?.apiUrl || process.env.EXPO_PUBLIC_API_URL?.trim() || ST_LUKES_LIVE_API;
  return resolveSchoolApiUrl(raw, tenant);
}

export async function getTenantSlug(): Promise<string> {
  const config = await getSchoolConfig();
  if (config?.tenantSlug) return config.tenantSlug;
  return process.env.EXPO_PUBLIC_TENANT_SLUG?.trim() || 'demo';
}

export async function hasSchoolConfig(): Promise<boolean> {
  return Boolean(await getSchoolConfig());
}
