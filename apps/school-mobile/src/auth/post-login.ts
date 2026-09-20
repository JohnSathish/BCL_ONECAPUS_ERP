import type { StoredUser } from '@/auth/session';
import { HOME_PATH } from '@/services/notification-path';

export const PASSWORD_PATH = '/password';

export type PostAuthRoute = typeof HOME_PATH | '/welcome' | typeof PASSWORD_PATH;

export function destinationAfterAuth(
  user?: StoredUser | null,
  firstLogin?: boolean,
): PostAuthRoute {
  if (user?.mustResetPassword) return PASSWORD_PATH;
  if (firstLogin || user?.firstLogin) return '/welcome';
  return HOME_PATH;
}
