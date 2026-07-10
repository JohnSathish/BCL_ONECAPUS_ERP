import type { Router } from 'expo-router';
import { logout } from '@/auth/logout';
import { clearSchoolConfig } from '@/auth/school-config';

/** Sign out (server + local) and return to institution picker (universal app). */
export async function switchInstitution(router: Router) {
  await logout();
  await clearSchoolConfig();
  router.replace('/(auth)/select-school');
}
