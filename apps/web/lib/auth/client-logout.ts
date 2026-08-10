'use client';

import { logout as logoutApi } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import { useWorkspaceStore } from '@/store/workspace-store';
import { broadcastSessionMessage } from './session-broadcast';
import { tokenRefreshManager } from './token-refresh-manager';

type RouterLike = {
  replace: (href: string) => void;
};

type LogoutClientOptions = {
  /** Defaults to true. Set false when handling a LOGOUT broadcast. */
  broadcast?: boolean;
  /** Defaults to `/login`. */
  redirectTo?: string;
  /** Clear workspace shift/campus selection (admin chrome). Defaults to true. */
  clearWorkspace?: boolean;
};

/**
 * Instant local sign-out: clear store, navigate, then revoke the refresh
 * cookie in the background. Callers must not await the API revoke.
 */
export function logoutClientSide(router: RouterLike, options: LogoutClientOptions = {}) {
  const { broadcast = true, redirectTo = '/login', clearWorkspace = true } = options;

  tokenRefreshManager.clearSchedule();
  useAuthStore.getState().clear();
  useAuthStore.getState().setBootstrapping(false);

  if (clearWorkspace) {
    try {
      useWorkspaceStore.getState().clearWorkspace();
    } catch {
      /* workspace store may be unused on some portals */
    }
  }

  if (broadcast) {
    broadcastSessionMessage({ type: 'LOGOUT' });
  }

  router.replace(redirectTo);
  void logoutApi().catch(() => undefined);
}
