import {
  canAccessAdminPortal,
  canAccessApplicantPortal,
  canAccessPath,
  resolveHomePath,
} from '@/lib/permissions/portal-access';
import { resolveSchoolSisHomePath } from '@/lib/school-sis/portal-access';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { useAuthStore } from '@/store/auth-store';
import type { AuthSession } from '@/types/auth';
import type { LoginContext } from '@/types/login-context';

type RouterLike = { replace: (path: string) => void };

export function finishWebLogin(input: {
  session: AuthSession;
  rememberMe: boolean;
  router: RouterLike;
  context: LoginContext | null;
  schoolSis: boolean;
  postLoginPath?: string;
  queryNextPath?: string;
}) {
  const { session } = input;
  useAuthStore.getState().setSession(session);
  useAuthStore.getState().setPrefs({ rememberMe: input.rememberMe });
  useAuthStore.getState().setBootstrapping(false);
  tokenRefreshManager.scheduleProactiveRefresh(session);
  if (session.user.mustResetPassword) {
    input.router.replace('/change-password');
    return;
  }
  const roles = session.user.roles ?? [];
  const permissions = session.user.permissions ?? [];
  const schoolSession =
    input.context?.institutionType === 'SCHOOL' ||
    input.schoolSis ||
    input.context?.schoolProduct === 'SECONDARY_SIS';
  const secondarySis = input.schoolSis || input.context?.schoolProduct === 'SECONDARY_SIS';
  const schoolHome = secondarySis
    ? resolveSchoolSisHomePath(roles, permissions)
    : schoolSession
      ? canAccessAdminPortal(roles, permissions)
        ? '/admin'
        : canAccessApplicantPortal(roles, permissions)
          ? '/school-admissions-portal/dashboard'
          : '/admin'
      : null;
  const requestedPath = input.postLoginPath ?? input.queryNextPath;
  const destination =
    (requestedPath && canAccessPath(roles, requestedPath, permissions) ? requestedPath : null) ??
    schoolHome ??
    resolveHomePath(roles, permissions);
  if (
    destination === '/school-sis-portal/me' ||
    destination.startsWith('/school-sis-portal/') ||
    destination === '/change-password'
  ) {
    input.router.replace(destination);
    return;
  }
  window.location.assign(destination);
}
