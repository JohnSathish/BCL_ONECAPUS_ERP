import { api } from '@/services/api';

export type DemoRequestPayload = {
  fullName: string;
  institution: string;
  email: string;
  phone: string;
  city?: string;
  message?: string;
};

export async function submitDemoRequest(payload: DemoRequestPayload) {
  const { data } = await api.post<{ accepted: boolean; notified: boolean }>(
    '/v1/marketing/demo-request',
    payload,
  );
  return data;
}
