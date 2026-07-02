import { setAppType } from '@/api/client';
import { clearSession } from '@/auth/session';

export async function logout() {
  await clearSession();
  setAppType('student');
}
