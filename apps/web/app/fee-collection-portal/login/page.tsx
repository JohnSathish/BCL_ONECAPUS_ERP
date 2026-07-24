'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { useAuth } from '@/hooks/use-auth';

export default function FeeCollectionPortalLoginPage() {
  const router = useRouter();
  const { session, isReady } = useAuth();

  useEffect(() => {
    if (!isReady || !session) return;
    router.replace('/fee-collection-portal');
  }, [isReady, session, router]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-400">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <p className="text-xs uppercase tracking-[0.25em] text-sky-300/80">
          pay.donboscocollege.ac.in
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Fee Collection Center</h1>
        <p className="mt-2 text-sm text-slate-400">
          Authorized fee collection operators only. For student / café fee payment without ERP
          login, use the public portal at pay.donboscocollege.ac.in.
        </p>
      </div>
      <LoginForm compact hardRedirect postLoginPath="/fee-collection-portal" />
      <p className="mt-6 text-center text-sm text-slate-400">
        New Net Café / CSC?{' '}
        <Link className="text-sky-300 underline" href="/fee-collection-portal/register">
          Register for authorization
        </Link>
      </p>
    </div>
  );
}
