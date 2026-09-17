'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { SCHOOL_SIS_LOGO_SRC } from '@/lib/school-erp/product';
import { canAccessAdminPortal } from '@/lib/permissions/portal-access';
import { logout } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';

export default function SchoolSisSignedInPage() {
  const router = useRouter();
  const { session, isReady } = useAuth();
  const clear = useAuthStore((s) => s.clear);
  const name = session?.user?.displayName?.trim() || session?.user?.email || 'Student';
  const roles = session?.user?.roles ?? [];
  const permissions = session?.user?.permissions ?? [];
  const canOpenOffice = canAccessAdminPortal(roles, permissions);

  useEffect(() => {
    if (!isReady) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    if (session.user.mustResetPassword) {
      router.replace('/change-password');
    }
  }, [isReady, router, session?.accessToken, session?.user?.mustResetPassword]);

  async function onLogout() {
    tokenRefreshManager.clearSchedule();
    clear();
    await logout().catch(() => undefined);
    window.location.assign('/login');
  }

  if (!isReady || !session?.accessToken) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f4f7fb] px-4 py-10">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-8 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin text-slate-800" />
          Signing you in…
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#f4f7fb] px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <BrandingLogoImage
          src={SCHOOL_SIS_LOGO_SRC}
          alt="St. Luke's Secondary School"
          className="h-14 w-14 object-contain"
        />
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          St. Luke&apos;s Secondary School, Tura
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">You are signed in</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Welcome, <span className="font-medium text-slate-900">{name}</span>. Your school password
          is updated. Classes, attendance, homework and results are in the St. Luke&apos;s mobile
          app — this web login is for staff office work.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {canOpenOffice ? (
            <Button className="bg-slate-900 hover:bg-slate-800" asChild>
              <a href="/admin">Open school office</a>
            </Button>
          ) : null}
          <Button variant="outline" type="button" onClick={() => void onLogout()}>
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}
