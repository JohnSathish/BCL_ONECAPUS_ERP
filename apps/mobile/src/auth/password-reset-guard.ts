import type { Href } from 'expo-router';
import { getUserSnapshot, type StoredUserSnapshot } from '@/auth/session';

export const CHANGE_PASSWORD_HREF = '/(auth)/change-password' as Href;

/** True when the portal user must set a new password before using the app. */
export function userMustResetPassword(
  user?: Pick<StoredUserSnapshot, 'mustResetPassword'> | null,
): boolean {
  return Boolean(user?.mustResetPassword);
}

export async function getMustResetPassword(): Promise<boolean> {
  const snapshot = await getUserSnapshot();
  return userMustResetPassword(snapshot);
}
