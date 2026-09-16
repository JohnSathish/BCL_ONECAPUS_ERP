import * as SecureStore from 'expo-secure-store';
import { apiFetch } from '@/api/client';
import { getSchoolConfig } from '@/auth/school-config';
import { isSchoolSisConfig } from '@/auth/school-product';
import { getStoredAppType } from '@/auth/session';
import { SCHOOL_BRAND } from '@/constants/school-branding';

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
    productName?: string | null;
    productTagline?: string | null;
    poweredByText?: string | null;
    showPoweredBy?: boolean;
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
  const school = await getSchoolConfig();
  if (isSchoolSisConfig(school)) {
    const data = await apiFetch<{
      appName?: string;
      displayName?: string;
      motto?: string;
      logoUrl?: string | null;
      primaryColor?: string | null;
      minVersion?: string;
      latestVersion?: string;
      forceUpdate?: boolean;
      maintenanceMode?: boolean;
      maintenanceMessage?: string | null;
      androidStoreUrl?: string | null;
    }>('/v1/school-mobile/bootstrap', { skipAuth: true });
    const mapped: BootstrapConfig = {
      appName: data.appName || SCHOOL_BRAND.shortName,
      minVersion: data.minVersion || '1.0.0',
      latestVersion: data.latestVersion || '1.0.0',
      maintenanceMode: Boolean(data.maintenanceMode),
      maintenanceMessage: data.maintenanceMessage ?? null,
      forceUpdate: Boolean(data.forceUpdate),
      forceUpdateMessage: null,
      playStoreUrl: data.androidStoreUrl ?? null,
      branding: {
        logoUrl: data.logoUrl ?? null,
        splashImageUrl: null,
        primaryColor: data.primaryColor ?? SCHOOL_BRAND.navyMid,
        displayName: data.displayName || SCHOOL_BRAND.legalName,
        productName: SCHOOL_BRAND.shortName,
        productTagline: data.motto || SCHOOL_BRAND.motto,
        poweredByText: SCHOOL_BRAND.legalName,
        showPoweredBy: false,
      },
      portalHighlights: {
        stats: { students: 0, faculty: 0, departments: 0, academicYear: null },
        updates: [],
      },
    };
    try {
      await SecureStore.setItemAsync(
        CACHE_KEY,
        JSON.stringify({ savedAt: Date.now(), data: mapped }),
      );
    } catch {
      /* ignore */
    }
    return mapped;
  }

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
