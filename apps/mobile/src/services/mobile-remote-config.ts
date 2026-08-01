import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '@/api/client';
import { getStoredAppType } from '@/auth/session';

const CACHE_KEY = 'onecampus.mobile.bootstrap.v1';

export type BootstrapConfig = {
  appName: string;
  minVersion: string;
  latestVersion: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  forceUpdate: boolean;
  forceUpdateMessage: string | null;
  softUpdateMessage?: string | null;
  playStoreUrl?: string | null;
  apkDownloadUrl?: string | null;
  releaseNotes?: string | null;
  configVersion?: number;
  featureFlags?: Record<string, boolean>;
  menuVisibility?: Record<string, boolean>;
  branding: {
    logoUrl: string | null;
    splashImageUrl: string | null;
    primaryColor: string | null;
    displayName: string | null;
  };
  loginNotices?: {
    showBanner?: boolean;
    bannerTitle?: string | null;
    bannerSubtitle?: string | null;
  };
  portalHighlights?: {
    stats: {
      students: number;
      faculty: number;
      departments: number;
      academicYear: string | null;
    };
    updates: string[];
  };
};

export async function fetchBootstrapConfig(): Promise<BootstrapConfig> {
  const storedType = await getStoredAppType();
  const appType = storedType === 'staff' ? 'staff' : 'student';
  const data = await apiFetch<BootstrapConfig>(`/v1/mobile-app/bootstrap?appType=${appType}`, {
    skipAuth: true,
  });
  try {
    await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* ignore */
  }
  return data;
}

export async function readCachedBootstrap(): Promise<BootstrapConfig | null> {
  try {
    const raw = await SecureStore.getItemAsync(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { data?: BootstrapConfig };
    return parsed.data ?? null;
  } catch {
    return null;
  }
}
