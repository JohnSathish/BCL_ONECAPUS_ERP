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
import { bootstrapSession, logout as logoutApi } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';

const IDLE_WARNING_MS = 13 * 60 * 1000;
const IDLE_LOGOUT_MS = 15 * 60 * 1000;
const TICK_MS = 15_000;

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
    async (broadcast = true, skipUnsavedCheck = false) => {
      if (forcedLogoutRef.current) return;
      if (!skipUnsavedCheck && !confirmGlobalUnsavedDiscard()) return;
      forcedLogoutRef.current = true;
      initialBootstrapDoneRef.current = false;
      tokenRefreshManager.clearSchedule();
      setWarningOpen(false);
      try {
        await logoutApi();
      } catch {
        /* cookie may already be cleared */
      }
      clear();
      if (broadcast) broadcastSessionMessage({ type: 'LOGOUT' });
      router.replace('/login');
    },
    [clear, router],
  );

  useEffect(() => {
    if (!hasHydrated) return;

    if (pathname === '/login') {
      initialBootstrapDoneRef.current = false;
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
        initialBootstrapDoneRef.current = false;
        clear();
        tokenRefreshManager.clearSchedule();
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
  }, [clear, router, setSession]);

  useEffect(() => {
    if (!session) {
      setWarningOpen(false);
      warningShownRef.current = false;
      return;
    }

    const interval = setInterval(() => {
      const idleMs = Date.now() - getLastActivityAt();

      if (idleMs >= IDLE_LOGOUT_MS) {
        if (warningOpen || isUserActivelyTyping()) return;
        void performLogout();
        return;
      }

      if (idleMs >= IDLE_WARNING_MS && !warningShownRef.current) {
        warningShownRef.current = true;
        setWarningOpen(true);
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [session, warningOpen, performLogout]);

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
      await tokenRefreshManager.refreshSession();
      warningShownRef.current = false;
      setWarningOpen(false);
      pingActivity();
      broadcastSessionMessage({ type: 'IDLE_EXTENDED' });
    } catch {
      await performLogout();
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
        onLogout={() => void performLogout(true, true)}
        busy={continueBusy}
      />
    </>
  );
}
