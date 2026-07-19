'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import {
  canAccessAdminPortal,
  canAccessFeeCollectionPortal,
} from '@/lib/permissions/portal-access';

const PUBLIC_PREFIXES = [
  '/fee-collection-portal/login',
  '/fee-collection-portal/register',
  '/fee-collection-portal/verify',
];

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#0f2744_0%,_#07111f_55%,_#04080f_100%)] text-slate-100">
      {children}
    </div>
  );
}

export default function FeeCollectionPortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, isReady } = useAuth();
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname?.startsWith(`${p}/`));

  useEffect(() => {
    if (!isReady || isPublic) return;
    if (!session) {
      router.replace('/fee-collection-portal/login');
      return;
    }
    const roles = session.user?.roles ?? [];
    const perms = session.user?.permissions ?? [];
    if (!canAccessFeeCollectionPortal(roles, perms) && !canAccessAdminPortal(roles, perms)) {
      router.replace('/login');
    }
  }, [isReady, session, router, isPublic]);

  if (isPublic) {
    return <Shell>{children}</Shell>;
  }

  if (!isReady || !session) {
    return (
      <Shell>
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
          Loading…
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <header className="border-b border-white/10 bg-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-sky-300/80">
              Authorized Fee Collection
            </p>
            <h1 className="text-lg font-semibold text-white">Center Portal</h1>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm">
            <Link className="text-slate-300 hover:text-white" href="/fee-collection-portal">
              Dashboard
            </Link>
            <Link className="text-slate-300 hover:text-white" href="/fee-collection-portal/pay">
              Collect
            </Link>
            <Link
              className="text-slate-300 hover:text-white"
              href="/fee-collection-portal/transactions"
            >
              History
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </Shell>
  );
}
