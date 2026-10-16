'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { SessionExpiryDialog } from '@/components/auth/session-expiry-dialog';
import {
  attachGlobalActivityListeners,
  getLastActivityAt,
  isUserEngaged,
  pingActivity,
  subscribeActivity,
} from '@/lib/auth/session-activity';
import { hasGlobalUnsavedChanges } from '@/lib/auth/unsaved-changes-registry';
import { broadcastSessionMessage, subscribeSessionBroadcast } from '@/lib/auth/session-broadcast';
import { confirmGlobalUnsavedDiscard } from '@/lib/auth/unsaved-changes-registry';
import { isAuthColdPath } from '@/lib/auth/auth-cold-path';
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
  const [warningMessage, setWarningMessage] = useState<string | undefined>();
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
      const schoolPortal = pathname.startsWith('/school-admissions-portal');
      const libraryDesk = pathname.startsWith('/library-desk');
      router.replace(
        schoolPortal
          ? '/school-admissions-portal/login'
          : libraryDesk
            ? '/library-desk/login'
            : '/login',
      );
      void logoutApi().catch(() => undefined);
    },
    [clear, pathname, router, setBootstrapping],
  );

  useEffect(() => {
    if (isAuthColdPath(pathname)) {
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
      pathname === '/library-desk/login' ||
      pathname.startsWith('/admissions-portal') ||
      pathname.startsWith('/school-admissions-portal')
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
    if (isAuthColdPath(pathname)) {
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
    if (isAuthColdPath(pathname)) {
      tokenRefreshManager.clearSchedule();
      return;
    }
    if (session) {
      tokenRefreshManager.scheduleProactiveRefresh(session);
    } else {
      tokenRefreshManager.clearSchedule();
    }
  }, [pathname, session]);

  useEffect(() => {
    return subscribeSessionBroadcast((message) => {
      if (message.type === 'LOGOUT') {
        forcedLogoutRef.current = true;
        initialBootstrapDoneRef.current = true;
        clear();
        setBootstrapping(false);
        tokenRefreshManager.clearSchedule();
        setWarningOpen(false);
        const path = typeof window !== 'undefined' ? window.location.pathname : pathname;
        const schoolPortal = path.startsWith('/school-admissions-portal');
        const libraryDesk = path.startsWith('/library-desk');
        router.replace(
          schoolPortal
            ? '/school-admissions-portal/login'
            : libraryDesk
              ? '/library-desk/login'
              : '/login',
        );
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
  }, [clear, pathname, router, setBootstrapping, setSession]);

  useEffect(() => {
    if (!session || isAuthColdPath(pathname)) {
      setWarningOpen(false);
      warningShownRef.current = false;
      return;
    }

    const interval = setInterval(() => {
      const current = useAuthStore.getState().session;
      const expiresAtMs = current?.expiresAt ? new Date(current.expiresAt).getTime() : 0;
      if (expiresAtMs && expiresAtMs - Date.now() < 3 * 60 * 1000) {
        void tokenRefreshManager.refreshSession().catch(() => undefined);
      }

      const idleMs = Date.now() - getLastActivityAt();
      const keepWorking = isUserEngaged() || hasGlobalUnsavedChanges();

      if (idleMs >= IDLE_LOGOUT_MS) {
        if (keepWorking) {
          warningShownRef.current = true;
          setWarningMessage(undefined);
          setWarningOpen(true);
          return;
        }
        performLogout(true, true);
        return;
      }

      if (idleMs >= IDLE_WARNING_MS && !warningShownRef.current) {
        warningShownRef.current = true;
        setWarningMessage(undefined);
        setWarningOpen(true);
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [session, performLogout, pathname]);

  useEffect(() => {
    return subscribeActivity(() => {
      if (Date.now() - getLastActivityAt() < IDLE_WARNING_MS) {
        warningShownRef.current = false;
        setWarningOpen(false);
      }
    });
  }, []);

  useEffect(() => {
    const onRefreshFailed = (event: Event) => {
      const fatal = Boolean((event as CustomEvent<{ fatal?: boolean }>).detail?.fatal);
      warningShownRef.current = true;
      setWarningMessage(
        fatal
          ? 'The sign-in could not be renewed. Choose Continue to try again. This page, including unsaved marks or a timetable slot, stays open.'
          : 'The connection dropped while renewing your sign-in. Choose Continue to try again. Your open work is still on this page.',
      );
      setWarningOpen(true);
    };
    window.addEventListener('onecampus:session-refresh-failed', onRefreshFailed);
    return () => window.removeEventListener('onecampus:session-refresh-failed', onRefreshFailed);
  }, []);

  const onContinueSession = async () => {
    setContinueBusy(true);
    try {
      await tokenRefreshManager.refreshSession({
        maxWaitMs: CONTINUE_REFRESH_MAX_WAIT_MS,
        force: true,
      });
      warningShownRef.current = false;
      setWarningMessage(undefined);
      setWarningOpen(false);
      pingActivity();
      broadcastSessionMessage({ type: 'IDLE_EXTENDED' });
    } catch {
      setWarningMessage(
        'Still unable to renew the sign-in. Check the connection and choose Continue again. Logging out is the only action that leaves this page.',
      );
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
        onLogout={() => performLogout(true, false)}
        busy={continueBusy}
        message={warningMessage}
      />
    </>
  );
}
