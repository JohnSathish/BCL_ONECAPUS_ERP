'use client';

import Link from 'next/link';
import { LoginForm } from '@/components/auth/login-form';

export default function OpacLoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 text-center">
        <h1 className="text-xl font-bold text-slate-950">Library account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Students and staff use the same college login. There is no separate library password.
        </p>
      </div>
      <LoginForm compact postLoginPath="/opac/account" />
      <p className="mt-3 text-center text-sm">
        <Link href="/forgot-password" className="text-sky-800">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}
