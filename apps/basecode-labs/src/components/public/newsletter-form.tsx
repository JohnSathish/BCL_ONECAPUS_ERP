'use client';

import { FormEvent, useState } from 'react';
import { ArrowRight, Mail } from 'lucide-react';

export function NewsletterForm() {
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle');
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setStatus('idle');
    const email = String(new FormData(e.currentTarget).get('email') ?? '');
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setPending(false);
    setStatus(res.ok ? 'ok' : 'err');
    if (res.ok) e.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className="mt-4">
      <label className="sr-only" htmlFor="footer-email">
        Email address
      </label>
      <div className="relative">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          id="footer-email"
          required
          type="email"
          name="email"
          placeholder="Enter your email address"
          className="h-12 w-full rounded-full border border-white/15 bg-[#071428] pl-10 pr-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/20"
        />
      </div>
      <button
        disabled={pending}
        className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 text-sm font-semibold text-white disabled:opacity-60"
      >
        {pending ? 'Subscribing…' : 'Subscribe'}
        <ArrowRight className="h-4 w-4" />
      </button>
      {status === 'ok' ? (
        <p className="mt-2 text-xs text-emerald-300">Thank you. We will keep you posted.</p>
      ) : null}
      {status === 'err' ? (
        <p className="mt-2 text-xs text-red-300">Please enter a valid email and try again.</p>
      ) : null}
      <p className="mt-3 text-[11px] text-slate-500">No spam. Unsubscribe anytime.</p>
    </form>
  );
}
