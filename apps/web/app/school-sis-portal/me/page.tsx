'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { Button } from '@/components/ui/button';
import { SCHOOL_SIS_LOGO_SRC } from '@/lib/school-erp/product';
import { logout } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';

export default function SchoolSisSignedInPage() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const clear = useAuthStore((s) => s.clear);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const name = session?.user?.displayName?.trim() || session?.user?.email || 'Student';
  const roles = session?.user?.roles ?? [];
  const schoolSelf = roles.includes('school-student') || roles.includes('school-parent');

  useEffect(() => {
    if (!hasHydrated) return;
    if (!session?.accessToken) {
      router.replace('/login');
      return;
    }
    if (session.user.mustResetPassword) {
      router.replace('/change-password');
    }
  }, [hasHydrated, router, session?.accessToken, session?.user?.mustResetPassword]);

  async function onLogout() {
    tokenRefreshManager.clearSchedule();
    clear();
    await logout().catch(() => undefined);
    window.location.assign('/login');
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
          {schoolSelf ? null : (
            <Button className="bg-slate-900 hover:bg-slate-800" asChild>
              <a href="/admin">Open school office</a>
            </Button>
          )}
          <Button variant="outline" type="button" onClick={() => void onLogout()}>
            Sign out
          </Button>
        </div>
      </div>
    </main>
  );
}
