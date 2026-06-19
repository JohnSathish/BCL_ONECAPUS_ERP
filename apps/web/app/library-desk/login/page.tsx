'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { useAuth } from '@/hooks/use-auth';
import { resolveHomePath } from '@/lib/permissions/portal-access';

export default function LibraryDeskLoginPage() {
  const router = useRouter();
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (!isReady || !session) return;
    router.replace(resolveHomePath(session.user.roles ?? [], session.user.permissions ?? []));
  }, [isReady, session, router]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <LoginForm hardRedirect />
    </div>
  );
}
