'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export default function OpacLoginPage() {
  const [member, setMember] = useState<'student' | 'staff'>('student');
  return (
    <div className="mx-auto max-w-md">
      <div className="mb-4 text-center">
        <h1 className="text-xl font-bold text-slate-950">Library account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Students and staff use the same college password. There is no separate library password.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(['student', 'staff'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            className={`h-10 rounded-lg text-sm font-semibold ${
              member === kind ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}
            onClick={() => setMember(kind)}
          >
            {kind === 'student' ? 'Student Login' : 'Staff Login'}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <LoginForm
          compact
          plain
          postLoginPath="/opac/account"
          identifierLabel={member === 'student' ? 'Student ID / Roll number' : 'Staff ID or email'}
        />
      </div>
      <p className="mt-3 text-center text-sm">
        <Link href="/forgot-password" className="text-sky-800">
          Forgot password?
        </Link>
      </p>
    </div>
  );
}
