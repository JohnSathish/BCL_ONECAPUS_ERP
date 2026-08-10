'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SessionExpiryDialog } from '@/components/auth/session-expiry-dialog';
import {
  attachGlobalActivityListeners,
  getLastActivityAt,
  isUserActivelyTyping,
  pingActivity,
  subscribeActivity,
} from '@/lib/auth/session-activity';
import { broadcastSessionMessage, subscribeSessionBroadcast } from '@/lib/auth/session-broadcast';
import { confirmGlobalUnsavedDiscard } from '@/lib/auth/unsaved-changes-registry';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { logout as logoutApi, bootstrapSession } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import { useWorkspaceStore } from '@/store/workspace-store';

const IDLE_WARNING_MS = 13 * 60 * 1000;
const IDLE_LOGOUT_MS = 15 * 60 * 1000;
const TICK_MS = 15_000;
/** Continue Session should fail fast — do not wait for API cold-start. */
const CONTINUE_REFRESH_MAX_WAIT_MS = 8_000;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const setSession = useAuthStore((s) => s.setSession);
  const clear = useAuthStore((s) => s.clear);
  const setBootstrapping = useAuthStore((s) => s.setBootstrapping);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  const [warningOpen, setWarningOpen] = useState(false);
  const [continueBusy, setContinueBusy] = useState(false);
  const warningShownRef = useRef(false);
  const forcedLogoutRef = useRef(false);
  const initialBootstrapDoneRef = useRef(false);

  const performLogout = useCallback(
    (broadcast = true, skipUnsavedCheck = false) => {
      if (forcedLogoutRef.current) return;
      if (!skipUnsavedCheck && !confirmGlobalUnsavedDiscard()) return;

      forcedLogoutRef.current = true;
      // Keep bootstrap "done" so clearing the session does not kick off a 30s refresh retry.
      initialBootstrapDoneRef.current = true;
      tokenRefreshManager.clearSchedule();
      setWarningOpen(false);
      setContinueBusy(false);
      clear();
      setBootstrapping(false);
      try {
        useWorkspaceStore.getState().clearWorkspace();
      } catch {
        /* ignore */
      }
      if (broadcast) broadcastSessionMessage({ type: 'LOGOUT' });
      router.replace('/login');
      void logoutApi().catch(() => undefined);
    },
    [clear, router, setBootstrapping],
  );

  useEffect(() => {
    if (pathname === '/login' || pathname === '/forgot-password') {
      forcedLogoutRef.current = false;
      initialBootstrapDoneRef.current = false;
    }
  }, [pathname]);

  useEffect(() => {
    if (session?.accessToken) {
      forcedLogoutRef.current = false;
    }
  }, [session?.accessToken]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!session?.user?.mustResetPassword) return;
    if (
      pathname === '/change-password' ||
      pathname === '/login' ||
      pathname === '/forgot-password' ||
      pathname.startsWith('/admissions-portal')
    ) {
      return;
    }
    router.replace('/change-password');
  }, [hasHydrated, pathname, router, session?.user?.mustResetPassword]);

  useEffect(() => {
    if (!hasHydrated) return;

    // Login/forgot stay cold — no session restore.
    // /change-password MUST bootstrap so forced-reset after login (full page
    // navigation) and refresh still recover the httpOnly refresh cookie.
    if (pathname === '/login' || pathname === '/forgot-password') {
      setBootstrapping(false);
      return;
    }

    if (forcedLogoutRef.current) {
      setBootstrapping(false);
      return;
    }

    if (initialBootstrapDoneRef.current) return;

    const existing = useAuthStore.getState().session;
    if (existing?.accessToken) {
      const expiresAtMs = existing.expiresAt ? new Date(existing.expiresAt).getTime() : 0;
      if (!expiresAtMs || expiresAtMs > Date.now()) {
        initialBootstrapDoneRef.current = true;
        setBootstrapping(false);
        tokenRefreshManager.scheduleProactiveRefresh(existing);
        return;
      }
    }

    let cancelled = false;
    (async () => {
      setBootstrapping(true);
      const restored = await bootstrapSession({ maxWaitMs: 30_000 });
      if (cancelled) return;
      initialBootstrapDoneRef.current = true;
      if (restored) {
        setSession(restored);
        tokenRefreshManager.scheduleProactiveRefresh(restored);
      }
      setBootstrapping(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, pathname, setBootstrapping, setSession]);

  useEffect(() => {
    return attachGlobalActivityListeners();
  }, []);

  useEffect(() => {
    pingActivity();
  }, [pathname]);

  useEffect(() => {
    if (session) {
      tokenRefreshManager.scheduleProactiveRefresh(session);
    } else {
      tokenRefreshManager.clearSchedule();
    }
  }, [session]);

  useEffect(() => {
    return subscribeSessionBroadcast((message) => {
      if (message.type === 'LOGOUT') {
        forcedLogoutRef.current = true;
        initialBootstrapDoneRef.current = true;
        clear();
        setBootstrapping(false);
        tokenRefreshManager.clearSchedule();
        setWarningOpen(false);
        router.replace('/login');
      } else if (message.type === 'SESSION_UPDATED') {
        setSession(message.session);
        tokenRefreshManager.scheduleProactiveRefresh(message.session);
        warningShownRef.current = false;
        setWarningOpen(false);
      } else if (message.type === 'IDLE_EXTENDED') {
        warningShownRef.current = false;
        setWarningOpen(false);
        pingActivity();
      }
    });
  }, [clear, router, setBootstrapping, setSession]);

  useEffect(() => {
    if (!session) {
      setWarningOpen(false);
      warningShownRef.current = false;
      return;
    }

    const interval = setInterval(() => {
      const idleMs = Date.now() - getLastActivityAt();

      // Hard idle logout always wins — do not keep offering Continue after expiry.
      if (idleMs >= IDLE_LOGOUT_MS) {
        if (isUserActivelyTyping()) return;
        performLogout(true, true);
        return;
      }

      if (idleMs >= IDLE_WARNING_MS && !warningShownRef.current) {
        warningShownRef.current = true;
        setWarningOpen(true);
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [session, performLogout]);

  useEffect(() => {
    return subscribeActivity(() => {
      if (Date.now() - getLastActivityAt() < IDLE_WARNING_MS) {
        warningShownRef.current = false;
        setWarningOpen(false);
      }
    });
  }, []);

  const onContinueSession = async () => {
    setContinueBusy(true);
    try {
      await tokenRefreshManager.refreshSession({ maxWaitMs: CONTINUE_REFRESH_MAX_WAIT_MS });
      warningShownRef.current = false;
      setWarningOpen(false);
      pingActivity();
      broadcastSessionMessage({ type: 'IDLE_EXTENDED' });
    } catch {
      performLogout(true, true);
    } finally {
      setContinueBusy(false);
    }
  };

  return (
    <>
      {children}
      <SessionExpiryDialog
        open={warningOpen && Boolean(session)}
        onContinue={() => void onContinueSession()}
        onLogout={() => performLogout(true, true)}
        busy={continueBusy}
      />
    </>
  );
}
