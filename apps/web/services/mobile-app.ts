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

export async function fetchMobileAnalytics(days = 30) {
  const { data } = await api.get('/v1/mobile-app/analytics/dashboard', { params: { days } });
  return data;
}
