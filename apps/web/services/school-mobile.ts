import { api } from './api';

export type SchoolMobileSettings = {
  androidLatestVersion: string;
  iosLatestVersion: string;
  minVersion: string;
  forceUpdate: boolean;
  androidStoreUrl: string | null;
  iosStoreUrl: string | null;
  releaseNotes: string | null;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
};

export type SchoolMobilePrayer = {
  id: string;
  weekday: number;
  weekdayLabel?: string;
  title: string;
  body: string;
  enabled: boolean;
};

export type SchoolMobileBroadcast = {
  id: string;
  title: string;
  body: string;
  audience: string;
  status: string;
  successCount: number;
  failureCount: number;
  createdAt: string;
};

export async function fetchSchoolMobileSettings() {
  const { data } = await api.get<SchoolMobileSettings>('/v1/school-mobile/admin/settings');
  return data;
}

export async function patchSchoolMobileSettings(body: Partial<SchoolMobileSettings>) {
  const { data } = await api.patch<SchoolMobileSettings>('/v1/school-mobile/admin/settings', body);
  return data;
}

export async function fetchSchoolMobilePrayers() {
  const { data } = await api.get<SchoolMobilePrayer[]>('/v1/school-mobile/admin/prayers');
  return data;
}

export async function saveSchoolMobilePrayer(body: {
  weekday: number;
  title: string;
  body: string;
  enabled?: boolean;
}) {
  const { data } = await api.patch<SchoolMobilePrayer>('/v1/school-mobile/admin/prayers', body);
  return data;
}

export async function fetchSchoolMobileBroadcasts() {
  const { data } = await api.get<SchoolMobileBroadcast[]>('/v1/school-mobile/admin/broadcasts');
  return data;
}

export async function sendSchoolMobileBroadcast(body: {
  title: string;
  body: string;
  audience: string;
  type?: string;
  deepLink?: string;
  imageUrl?: string;
}) {
  const { data } = await api.post<SchoolMobileBroadcast>(
    '/v1/school-mobile/admin/broadcasts',
    body,
  );
  return data;
}
