'use client';

import Link from 'next/link';
import { BarChart3, Headphones, Mail, Send, Shield, UserPlus, Zap } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { COMPANY } from '@/lib/company';

const FEATURES = [
  {
    icon: Shield,
    title: 'Secure Access',
    text: 'Verified login with one-time code',
  },
  {
    icon: BarChart3,
    title: 'Manage Everything',
    text: 'Clients, products, licenses and more',
  },
  {
    icon: Zap,
    title: 'Save Time',
    text: 'Simple and efficient workflows',
  },
  {
    icon: UserPlus,
    title: 'Built for Growth',
    text: 'Powering institutions and businesses',
  },
];

export function AdminCentralLogin() {
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
      body: JSON.stringify({ email, purpose: 'ADMIN_LOGIN' }),
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
      body: JSON.stringify({ email, code, purpose: 'ADMIN_LOGIN' }),
    });
    const data = await res.json();
    setPending(false);
    if (!res.ok) {
      setMessage(data.error ?? 'Login failed');
      return;
    }
    window.location.href = data.redirect ?? '/admin';
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04101f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(37,99,235,0.45),_transparent_55%),radial-gradient(ellipse_at_bottom_left,_rgba(14,165,233,0.18),_transparent_50%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:56px_56px]" />
      <div className="pointer-events-none absolute -left-24 top-0 h-[420px] w-[420px] rounded-full border border-blue-400/20" />
      <div className="pointer-events-none absolute -right-20 bottom-10 h-72 w-[140%] bg-[radial-gradient(ellipse_at_center,_transparent_40%,_rgba(59,130,246,0.12)_70%)]" />

      <header className="relative z-10 flex flex-wrap items-start justify-between gap-4 px-6 py-6 lg:px-10">
        <div>
          <p className="text-2xl font-bold tracking-tight">
            BaseCode <span className="text-sky-400">Labs</span>
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
            Technology for a brighter tomorrow
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Trusted by {COMPANY.stats[1].value} institutions</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
            Schools | Colleges | Dioceses | Businesses
          </p>
        </div>
      </header>

      <main className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-6 pb-16 pt-4 lg:grid-cols-[1fr_minmax(320px,440px)_1fr] lg:px-10">
        <section className="max-w-md">
          <h1 className="text-4xl font-semibold leading-tight lg:text-5xl">
            Manage. Grow.
            <span className="mt-1 block text-sky-400">Make an Impact.</span>
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-300">
            BaseCode Central gives you complete control over clients, products, licenses, leads and
            more — all in one secure place.
          </p>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/15 text-sky-300">
                  <item.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="text-xs text-slate-400">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="relative mx-auto w-full max-w-[440px]">
          <div className="absolute -top-12 left-1/2 z-20 -translate-x-1/2">
            <BrandLogo
              size={96}
              className="shadow-[0_0_40px_rgba(56,189,248,0.45)] ring-4 ring-sky-300/30"
            />
          </div>
          <div className="rounded-[28px] border border-white/10 bg-[#071428]/80 px-7 pb-8 pt-16 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-400">
              Welcome to
            </p>
            <h2 className="mt-1 text-center text-3xl font-semibold">
              BaseCode <span className="text-sky-400">Central</span>
            </h2>
            <p className="mt-1 text-center text-sm text-slate-400">Secure. Simple. Powerful.</p>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-3 py-3 text-sm text-slate-200">
              <Shield className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />
              <p>
                Every admin login is verified with a one-time code sent to your email. Passwords are
                not used.
              </p>
            </div>

            {step === 'email' ? (
              <form onSubmit={requestCode} className="mt-6 space-y-4">
                <label className="block text-sm font-medium text-slate-300">
                  Email address
                  <span className="relative mt-1.5 block">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      required
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email address"
                      className="h-12 w-full rounded-full border border-white/15 bg-[#0b1b33] pl-10 pr-4 text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-sky-400/40"
                    />
                  </span>
                </label>
                <button
                  disabled={pending}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-sm font-semibold shadow-[0_10px_30px_rgba(14,165,233,0.35)] disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {pending ? 'Sending…' : 'Send login code'}
                </button>
              </form>
            ) : (
              <form onSubmit={verify} className="mt-6 space-y-4">
                <p className="text-center text-xs text-slate-400">{email}</p>
                <label className="block text-sm font-medium text-slate-300">
                  6-digit code
                  <input
                    required
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="mt-1.5 h-12 w-full rounded-full border border-white/15 bg-[#0b1b33] px-4 text-center tracking-[0.5em] text-white outline-none focus:ring-2 focus:ring-sky-400/40"
                  />
                </label>
                {process.env.NODE_ENV !== 'production' && devCode ? (
                  <p className="text-center text-xs text-amber-300">Development OTP: {devCode}</p>
                ) : null}
                <button
                  disabled={pending}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 text-sm font-semibold disabled:opacity-60"
                >
                  {pending ? 'Verifying…' : 'Sign in'}
                </button>
                <button
                  type="button"
                  className="w-full text-xs text-slate-400 hover:text-white"
                  onClick={() => {
                    setStep('email');
                    setCode('');
                    setMessage('');
                  }}
                >
                  Use a different email
                </button>
              </form>
            )}

            {message ? <p className="mt-4 text-center text-sm text-slate-300">{message}</p> : null}

            <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-slate-500">
              <span className="h-px flex-1 bg-white/10" />
              or
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <a
              href={`mailto:${COMPANY.email}`}
              className="mt-4 flex items-center justify-center gap-2 text-sm text-sky-300 hover:text-sky-200"
            >
              <Headphones className="h-4 w-4" />
              Contact support if you need help
            </a>
          </div>
        </section>

        <aside className="hidden max-w-xs justify-self-end lg:block">
          <blockquote className="text-2xl font-medium leading-snug text-slate-100">
            “Technology that empowers institutions and communities.”
          </blockquote>
          <div className="mt-4 h-1 w-16 rounded-full bg-sky-400" />
        </aside>
      </main>

      <footer className="relative z-10 flex flex-wrap items-center justify-between gap-3 px-6 pb-6 text-xs text-slate-500 lg:px-10">
        <p>
          © {new Date().getFullYear()} {COMPANY.legalName} All rights reserved.
        </p>
        <p className="uppercase tracking-[0.22em]">{COMPANY.tagline}</p>
        <Link href="/" className="hover:text-white">
          Public website
        </Link>
      </footer>
    </div>
  );
}
