'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { logoutClientSide } from '@/lib/auth/client-logout';
import {
  BACK_LOGOUT_EVENT,
  BACK_LOGOUT_SHOW,
  isPublicAuthPath,
  markBackLogoutConfirmed,
  noteBackLogoutSession,
} from '@/lib/auth/back-logout-history';
import { logout } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';

const LOGOUT_VERIFY_MS = 8_000;

/**
 * Authenticated Bosco Connect: browser Back asks before logout.
 * "No" leaves the session untouched. "Yes" uses the existing logout API.
 */
export function BackLogoutGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useAuthStore((s) => s.session);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const logoutLock = useRef(false);
  const stayRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (session?.accessToken) noteBackLogoutSession(true);
  }, [session]);

  useEffect(() => {
    const show = () => {
      if (!useAuthStore.getState().session?.accessToken) return;
      try {
        if (sessionStorage.getItem(BACK_LOGOUT_SHOW) === '1') setOpen(true);
      } catch {
        /* private mode */
      }
    };
    show();
    window.addEventListener(BACK_LOGOUT_EVENT, show);
    return () => window.removeEventListener(BACK_LOGOUT_EVENT, show);
  }, [session]);

  useEffect(() => {
    if (!hasHydrated || isBootstrapping || session?.accessToken) return;
    setOpen(false);
    if (isPublicAuthPath(pathname)) return;
    try {
      sessionStorage.removeItem(BACK_LOGOUT_SHOW);
    } catch {
      /* private mode */
    }
  }, [hasHydrated, isBootstrapping, pathname, session]);

  function stay() {
    if (logoutLock.current) return;
    try {
      sessionStorage.removeItem(BACK_LOGOUT_SHOW);
    } catch {
      /* private mode */
    }
    setOpen(false);
  }

  async function confirmLogout() {
    if (logoutLock.current) return;
    logoutLock.current = true;
    setBusy(true);
    try {
      await Promise.race([
        logout(),
        new Promise((resolve) => setTimeout(resolve, LOGOUT_VERIFY_MS)),
      ]);
    } catch {
      /* logoutClientSide retries the refresh-token revoke */
    }
    markBackLogoutConfirmed();
    logoutClientSide(router, { redirectTo: '/login' });
  }

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setOpen(true);
        else stay();
      }}
    >
      <DialogContent
        hideClose
        data-back-logout="true"
        overlayClassName="z-[210]"
        className="z-[210] w-[calc(100%-2rem)] sm:max-w-md"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          stayRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Logout Confirmation</DialogTitle>
          <DialogDescription>Do you want to logout from Bosco Connect?</DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="destructive"
            onClick={() => void confirmLogout()}
            disabled={busy}
          >
            Yes, Logout
          </Button>
          <Button type="button" variant="outline" ref={stayRef} onClick={stay} disabled={busy}>
            No, Stay Logged In
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
