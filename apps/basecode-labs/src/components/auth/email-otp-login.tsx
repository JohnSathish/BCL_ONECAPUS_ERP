'use client';

import { FormEvent, useState } from 'react';

export function EmailOtpLogin({
  purpose,
  title,
  subtitle,
}: {
  purpose: 'ADMIN_LOGIN' | 'CLIENT_LOGIN';
  title: string;
  subtitle: string;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [message, setMessage] = useState('');
  const [devCode, setDevCode] = useState('');
  const [pending, setPending] = useState(false);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setMessage('');
    const res = await fetch('/api/auth/request-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, purpose }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setMessage(data.error ?? 'Unable to send code');
      return;
    }
    setDevCode(data.devCode ?? '');
    setStep('code');
    setMessage('A login code was sent to your email. Codes expire in 10 minutes.');
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, purpose }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setMessage(data.error ?? 'Login failed');
      return;
    }
    window.location.href = data.redirect ?? (purpose === 'CLIENT_LOGIN' ? '/portal' : '/admin');
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-2xl backdrop-blur">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-slate-300">{subtitle}</p>
      {step === 'email' ? (
        <form onSubmit={requestCode} className="mt-6 space-y-4">
          <label className="block text-sm">
            Email
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 h-12 w-full rounded-xl border border-white/20 bg-white/10 px-3 text-white outline-none focus:ring-2 focus:ring-cyan-400/40"
            />
          </label>
          <button
            disabled={pending}
            className="w-full rounded-full bg-cyan-400 py-2.5 font-semibold text-slate-900"
          >
            {pending ? 'Sending…' : 'Send login code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="mt-6 space-y-4">
          <p className="text-xs text-slate-400">{email}</p>
          <label className="block text-sm">
            6-digit code
            <input
              required
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="mt-1 h-12 w-full rounded-xl border border-white/20 bg-white/10 px-3 tracking-[0.4em] outline-none focus:ring-2 focus:ring-cyan-400/40"
            />
          </label>
          {process.env.NODE_ENV !== 'production' && devCode ? (
            <p className="text-xs text-amber-300">Development OTP: {devCode}</p>
          ) : null}
          <button
            disabled={pending}
            className="w-full rounded-full bg-cyan-400 py-2.5 font-semibold text-slate-900"
          >
            {pending ? 'Verifying…' : 'Sign in'}
          </button>
        </form>
      )}
      {message ? <p className="mt-4 text-sm text-slate-300">{message}</p> : null}
    </div>
  );
}
