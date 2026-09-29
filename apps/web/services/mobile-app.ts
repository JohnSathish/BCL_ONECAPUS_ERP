import { api } from '@/services/api';

export type MobileAppSettings = {
  id: string;
  tenantId: string;
  studentAppName: string;
  staffAppName: string;
  studentMinVersion: string;
  studentLatestVersion: string;
  staffMinVersion: string;
  staffLatestVersion: string;
  studentMaintenanceMode: boolean;
  staffMaintenanceMode: boolean;
  maintenanceMessage: string | null;
  studentForceUpdate: boolean;
  staffForceUpdate: boolean;
  forceUpdateMessage: string | null;
  studentDashboardConfig: Record<string, boolean>;
  staffDashboardConfig: Record<string, boolean>;
  brandingOverrides: Record<string, string>;
  loginNotices?: {
    showBanner?: boolean;
    bannerTitle?: string | null;
    bannerSubtitle?: string | null;
    customUpdates?: string[];
    includeAutoUpdates?: boolean;
    includeAdmissions?: boolean;
    includeAcademicSession?: boolean;
    includeNepHint?: boolean;
  };
  playStoreUrl?: string | null;
  apkDownloadUrl?: string | null;
  releaseNotes?: string | null;
  featureFlags?: Record<string, boolean>;
  configVersion?: number;
};

export async function fetchMobileAppSettings() {
  const { data } = await api.get<MobileAppSettings>('/v1/mobile-app/settings');
  return data;
}

export async function updateMobileAppSettings(payload: Partial<MobileAppSettings>) {
  const { data } = await api.patch<MobileAppSettings>('/v1/mobile-app/settings', payload);
  return data;
}

export type AppUpdatePlatform = 'ANDROID' | 'IOS';

export type AppUpdateDeviceVersion = {
  version: string | null;
  devices: number;
  pushEnabled: number;
};

export type AppUpdatePolicy = {
  platform: AppUpdatePlatform;
  exists: boolean;
  latestVersion: string;
  minimumVersion: string;
  forceUpdate: boolean;
  storeUrl: string | null;
  releaseTitle: string | null;
  releaseNotes: string[];
  releaseDate: string | null;
  isActive: boolean;
  lastNotifiedAt: string | null;
  lastNotifiedVersion: string | null;
  lastNotifiedCount: number | null;
  updatedAt: string | null;
  devices: AppUpdateDeviceVersion[];
};

export type AppUpdateOverview = {
  pushConfigured: boolean;
  defaults: Record<AppUpdatePlatform, string>;
  policies: AppUpdatePolicy[];
};

export type SaveAppUpdatePolicyPayload = {
  latestVersion: string;
  minimumVersion: string;
  forceUpdate: boolean;
  storeUrl: string | null;
  releaseTitle: string | null;
  releaseNotes: string[];
  releaseDate: string | null;
  isActive: boolean;
};

export async function fetchAppUpdateOverview() {
  const { data } = await api.get<AppUpdateOverview>('/v1/app/updates');
  return data;
}

export async function saveAppUpdatePolicy(
  platform: AppUpdatePlatform,
  payload: SaveAppUpdatePolicyPayload,
) {
  const { data } = await api.put<AppUpdatePolicy>(
    `/v1/app/updates/${platform.toLowerCase()}`,
    payload,
  );
  return data;
}

export async function sendAppUpdateNotification(
  platform: AppUpdatePlatform,
  payload: { title?: string; body?: string; onlyOutdated?: boolean },
) {
  const { data } = await api.post<{
    queued: number;
    platform: AppUpdatePlatform;
    version: string;
    title: string;
    body: string;
  }>(`/v1/app/updates/${platform.toLowerCase()}/notify`, payload);
  return data;
}

export async function fetchMobileAnalytics(days = 30) {
  const { data } = await api.get('/v1/mobile-app/analytics/dashboard', { params: { days } });
  return data;
}
