import { api } from '@/services/api';
import { API_BASE_URL } from '@/lib/http/env';
import type {
  AccessPointRow,
  CamsDashboard,
  KioskBootstrap,
  KioskLiveStats,
  KioskScanResult,
} from '@/types/campus-access';

const base = `${API_BASE_URL}/v1`;

async function kioskFetch<T>(
  path: string,
  code: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const qs = `token=${encodeURIComponent(token)}`;
  const res = await fetch(`${base}/public/kiosk/${encodeURIComponent(code)}/${path}?${qs}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  return res.json() as Promise<T>;
}

export function fetchKioskBootstrap(code: string, token: string) {
  return kioskFetch<KioskBootstrap>('bootstrap', code, token);
}

export function fetchKioskLive(code: string, token: string) {
  return kioskFetch<KioskLiveStats>('live', code, token);
}

export function scanKiosk(code: string, token: string, scanCode: string) {
  return kioskFetch<KioskScanResult>('scan', code, token, {
    method: 'POST',
    body: JSON.stringify({ scanCode }),
  });
}

export async function fetchAccessPoints(): Promise<AccessPointRow[]> {
  const { data } = await api.get<AccessPointRow[]>('/v1/admin/campus-access/access-points');
  return data;
}

export async function createAccessPoint(payload: {
  code: string;
  name: string;
  accessType: string;
  location?: string;
}) {
  const { data } = await api.post('/v1/admin/campus-access/access-points', payload);
  return data;
}

export async function createKioskDevice(accessPointId: string, name: string) {
  const { data } = await api.post<{
    kioskUrl: string;
    token: string;
    device: { id: string; name: string; tokenPrefix: string };
  }>(`/v1/admin/campus-access/access-points/${accessPointId}/devices`, { name });
  return data;
}

export async function fetchCamsDashboard(): Promise<CamsDashboard> {
  const { data } = await api.get<CamsDashboard>('/v1/admin/campus-access/dashboard');
  return data;
}
