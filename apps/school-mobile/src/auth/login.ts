export { login, changePassword, type LoginSession } from '@/auth/account';
import { apiFetch } from '@/api/client';
import { saveActiveChild } from '@/auth/session';

export async function fetchHome(childId?: string | null) {
  const q = childId ? `?childId=${encodeURIComponent(childId)}` : '';
  return apiFetch<Record<string, unknown>>(`/v1/school-mobile/home${q}`);
}

export async function switchChild(id: string) {
  await saveActiveChild(id);
}
