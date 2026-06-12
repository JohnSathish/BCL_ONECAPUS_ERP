import { publicClient } from '@/lib/http/public-client';

export type ApiHealthReady = {
  status: 'ready' | 'degraded';
  api: string;
  database: { status: string; message?: string };
  redis: { status: string; message?: string };
  queue: { status: string };
  uptime: { seconds: number };
  ts: string;
};

export async function fetchApiHealthLive(): Promise<{ status: string; ts: string }> {
  const { data } = await publicClient.get('/health/live');
  return data;
}

export async function fetchApiHealthReady(): Promise<ApiHealthReady> {
  const { data } = await publicClient.get('/health/ready');
  return data;
}
