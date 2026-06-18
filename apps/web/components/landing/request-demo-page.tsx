'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Mail, Phone } from 'lucide-react';

import { BrandingLogoImage } from '@/components/branding/branding-logo-image';
import { BCL_CONTACT } from '@/components/landing/landing.constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { submitDemoRequest } from '@/services/demo-request';
import { apiErrorMessage } from '@/utils/api-error';
import { DEFAULT_LOGIN_LOGO } from '@/lib/branding-asset';

export function RequestDemoPage() {
  const [fullName, setFullName] = useState('');
  const [institution, setInstitution] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await submitDemoRequest({
        fullName: fullName.trim(),
        institution: institution.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim() || undefined,
        message: message.trim() || undefined,
      });
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not submit your request. Please try again or call us.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="landing-page min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
              <BrandingLogoImage src={DEFAULT_LOGIN_LOGO} className="h-6 w-6" priority />
            </div>
            <div>
              <p className="text-sm font-bold">BCL OneCampus ERP</p>
              <p className="text-[10px] text-white/50">BaseCode Labs</p>
            </div>
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_340px] lg:gap-12">
          <div>
            <p className="text-sm font-medium text-cyan-300/90">Request a free demo</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Tell us about your college
            </h1>
            <p className="mt-3 max-w-xl text-base text-white/65">
              Fill in the form and our team will contact you to schedule a personalised OneCampus
              ERP walkthrough for admissions, academics, HR, finance, and more.
            </p>

            {done ? (
              <div className="mt-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
                  <div>
                    <h2 className="text-lg font-semibold text-emerald-100">Request received</h2>
                    <p className="mt-2 text-sm text-emerald-100/80">
                      Thank you! We will contact you shortly at <strong>{email}</strong> or{' '}
                      <strong>{phone}</strong>.
                    </p>
                    <Button
                      asChild
                      variant="outline"
                      className="mt-4 border-white/20 bg-transparent"
                    >
                      <Link href="/">Return to homepage</Link>
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-8 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-sm font-medium text-white/80">Your name *</span>
                    <Input
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Dr. Jane Doe"
                      className="border-white/15 bg-white/5 text-white placeholder:text-white/35"
                    />
                  </label>
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-sm font-medium text-white/80">
                      College / institution *
                    </span>
                    <Input
                      required
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="Don Bosco College, Tura"
                      className="border-white/15 bg-white/5 text-white placeholder:text-white/35"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-white/80">Email *</span>
                    <Input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="principal@college.edu"
                      className="border-white/15 bg-white/5 text-white placeholder:text-white/35"
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span className="text-sm font-medium text-white/80">Mobile *</span>
                    <Input
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="border-white/15 bg-white/5 text-white placeholder:text-white/35"
                    />
                  </label>
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-sm font-medium text-white/80">City (optional)</span>
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Tura, Meghalaya"
                      className="border-white/15 bg-white/5 text-white placeholder:text-white/35"
                    />
                  </label>
                  <label className="block space-y-1.5 sm:col-span-2">
                    <span className="text-sm font-medium text-white/80">
                      What would you like to see? (optional)
                    </span>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                      placeholder="Admissions portal, FYUGP academics, payroll, library, etc."
                      className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    />
                  </label>
                </div>

                {error ? (
                  <p className="text-sm text-red-400" role="alert">
                    {error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-full bg-gradient-to-r from-lime-400 via-emerald-400 to-cyan-400 py-6 text-base font-bold text-slate-900 hover:opacity-95 sm:w-auto sm:px-10"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Submit demo request'
                  )}
                </Button>
              </form>
            )}
          </div>

          <aside className="h-fit rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
            <h2 className="text-lg font-semibold">Contact BaseCode Labs</h2>
            <p className="mt-2 text-sm text-white/60">
              Prefer to reach out directly? Call or email us — we typically respond within one
              business day.
            </p>

            <div className="mt-6 space-y-4">
              <a
                href={`tel:+91${BCL_CONTACT.phone}`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/50 p-4 transition-colors hover:bg-slate-900/80"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
                  <Phone className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs text-white/50">Mobile</p>
                  <p className="font-semibold">{BCL_CONTACT.phoneDisplay}</p>
                </div>
              </a>

              {BCL_CONTACT.emails.map((addr) => (
                <a
                  key={addr}
                  href={`mailto:${addr}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/50 p-4 transition-colors hover:bg-slate-900/80"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-300">
                    <Mail className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-white/50">Email</p>
                    <p className="truncate font-semibold">{addr}</p>
                  </div>
                </a>
              ))}
            </div>

            <p className="mt-6 text-xs text-white/40">
              Already have an account?{' '}
              <Link href="/login" className="text-cyan-300/90 underline-offset-2 hover:underline">
                Sign in
              </Link>
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
