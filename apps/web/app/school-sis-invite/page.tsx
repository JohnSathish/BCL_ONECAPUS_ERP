'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { publicClient } from '@/lib/http/public-client';
import { getLoginRequestHeaders } from '@/lib/login-host';
import { apiErrorMessage } from '@/utils/api-error';

function SchoolSisAcceptInviteForm() {
  const params = useSearchParams();
  const token = useMemo(() => params.get('token') ?? '', [params]);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f7fb] p-4">
      <form
        className="w-full max-w-md space-y-3 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
          }
          if (password !== confirm) {
            setError('Passwords do not match');
            return;
          }
          setBusy(true);
          try {
            await publicClient.post(
              '/v1/school-sis/public/iam/accept-invite',
              { token, password },
              { headers: getLoginRequestHeaders() },
            );
            setMessage('Account activated. You can sign in now.');
          } catch (err) {
            setError(apiErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <h1 className="text-lg font-semibold text-slate-900">Accept school invitation</h1>
        <p className="text-sm text-slate-500">
          Set a password to activate your St. Luke’s ERP account.
        </p>
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        <button
          type="submit"
          disabled={busy || !token}
          className="h-10 w-full rounded-md bg-blue-800 text-sm font-medium text-white disabled:opacity-50"
        >
          Activate account
        </button>
        <a className="block text-center text-sm text-blue-800" href="/login">
          Back to login
        </a>
      </form>
    </div>
  );
}

export default function SchoolSisAcceptInvitePage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-500">Loading invitation…</div>}>
      <SchoolSisAcceptInviteForm />
    </Suspense>
  );
}
