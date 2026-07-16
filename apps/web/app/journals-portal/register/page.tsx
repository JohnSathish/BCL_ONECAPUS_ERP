'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Globe2,
  IdCard,
  Lock,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import { JournalPublicShell } from '@/components/journals-portal/journal-public-shell';
import {
  AUTH_COUNTRIES,
  AUTH_INSTITUTIONS,
  AuthField,
  JournalAuthLayout,
  passwordStrength,
} from '@/components/journals-portal/journal-auth-layout';
import { fetchJournalPortalInfo, journalPortalRegister } from '@/services/journals-portal';
import { apiErrorMessage } from '@/utils/api-error';

const NAVY = '#0B2545';

export default function JournalRegisterPage() {
  const router = useRouter();
  const infoQ = useQuery({
    queryKey: ['journal-portal-info'],
    queryFn: fetchJournalPortalInfo,
    staleTime: 60_000,
  });
  const short = infoQ.data?.journal?.shortName || infoQ.data?.journal?.name || 'TRANSIENT';

  const [form, setForm] = useState({
    displayName: '',
    email: '',
    confirmEmail: '',
    phone: '',
    affiliation: '',
    department: '',
    designation: '',
    country: 'India',
    orcid: '',
    password: '',
    confirmPassword: '',
    agree: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => passwordStrength(form.password), [form.password]);
  const filledBars = Math.min(4, Math.max(0, strength.score));

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.agree) {
      setError('Please agree to the Author Guidelines to continue.');
      return;
    }
    if (form.email.trim().toLowerCase() !== form.confirmEmail.trim().toLowerCase()) {
      setError('Email addresses do not match. Please re-check for typos.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.orcid && !/^(\d{4}-){3}\d{3}[\dX]$/i.test(form.orcid.trim())) {
      setError('ORCID should look like 0000-0002-XXXX-XXXX.');
      return;
    }

    setLoading(true);
    try {
      await journalPortalRegister({
        displayName: form.displayName,
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: form.phone || undefined,
        affiliation: form.affiliation || undefined,
        department: form.department || undefined,
        designation: form.designation || undefined,
        country: form.country || undefined,
        orcid: form.orcid || undefined,
      });
      router.push(
        `/journals-portal/login?registered=1&email=${encodeURIComponent(form.email.trim().toLowerCase())}`,
      );
    } catch (err) {
      setError(apiErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <JournalPublicShell>
      <JournalAuthLayout mode="register">
        <div>
          <p className="jp-auth-section-title">Join the community</p>
          <h2
            className="jp-serif mt-2 text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ color: NAVY }}
          >
            Create your {short} author account
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#0B2545]/75">
            Register once to submit manuscripts, track peer review, and manage production proofs.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-7">
          <section className="space-y-3.5">
            <p className="jp-auth-section-title">Personal information</p>
            <AuthField id="reg-name" label="Full name" icon={<User className="h-4 w-4" />}>
              <input
                id="reg-name"
                required
                autoComplete="name"
                placeholder="John Smith"
                value={form.displayName}
                onChange={(e) => set('displayName', e.target.value)}
              />
            </AuthField>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <AuthField id="reg-email" label="Email address" icon={<Mail className="h-4 w-4" />}>
                <input
                  id="reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@institution.edu"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                />
              </AuthField>
              <AuthField
                id="reg-email-confirm"
                label="Confirm email"
                icon={<Mail className="h-4 w-4" />}
              >
                <input
                  id="reg-email-confirm"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Re-enter email"
                  value={form.confirmEmail}
                  onChange={(e) => set('confirmEmail', e.target.value)}
                />
              </AuthField>
            </div>
            <AuthField id="reg-phone" label="Phone (optional)" icon={<Phone className="h-4 w-4" />}>
              <input
                id="reg-phone"
                type="tel"
                autoComplete="tel"
                placeholder="+91 …"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </AuthField>
          </section>

          <section className="space-y-3.5">
            <p className="jp-auth-section-title">Academic information</p>
            <AuthField
              id="reg-affiliation"
              label="Institution"
              icon={<Building2 className="h-4 w-4" />}
            >
              <input
                id="reg-affiliation"
                list="jp-institutions"
                placeholder="Don Bosco College, Tura"
                value={form.affiliation}
                onChange={(e) => set('affiliation', e.target.value)}
              />
              <datalist id="jp-institutions">
                {AUTH_INSTITUTIONS.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </AuthField>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <AuthField id="reg-dept" label="Department">
                <input
                  id="reg-dept"
                  placeholder="Physics"
                  value={form.department}
                  onChange={(e) => set('department', e.target.value)}
                />
              </AuthField>
              <AuthField id="reg-desig" label="Designation">
                <input
                  id="reg-desig"
                  placeholder="Assistant Professor"
                  value={form.designation}
                  onChange={(e) => set('designation', e.target.value)}
                />
              </AuthField>
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <AuthField id="reg-country" label="Country" icon={<Globe2 className="h-4 w-4" />}>
                <select
                  id="reg-country"
                  value={form.country}
                  onChange={(e) => set('country', e.target.value)}
                >
                  {AUTH_COUNTRIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </AuthField>
              <AuthField
                id="reg-orcid"
                label="ORCID iD (optional)"
                icon={<IdCard className="h-4 w-4" />}
                hint="Format: 0000-0002-XXXX-XXXX"
              >
                <input
                  id="reg-orcid"
                  placeholder="0000-0002-1825-0097"
                  value={form.orcid}
                  onChange={(e) => set('orcid', e.target.value)}
                />
              </AuthField>
            </div>
          </section>

          <section className="space-y-3.5">
            <p className="jp-auth-section-title">Account security</p>
            <AuthField
              id="reg-password"
              label="Password"
              icon={<Lock className="h-4 w-4" />}
              className="has-toggle"
            >
              <input
                id="reg-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-[#0B2545]/45 hover:text-[#0B2545]"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </AuthField>
            {form.password ? (
              <div>
                <div className="jp-auth-strength">
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      style={{
                        background: i < filledBars ? strength.color : 'rgba(11, 37, 69, 0.1)',
                      }}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] font-medium" style={{ color: strength.color }}>
                  {strength.label} password
                </p>
              </div>
            ) : null}
            <AuthField
              id="reg-confirm"
              label="Confirm password"
              icon={<Lock className="h-4 w-4" />}
              className="has-toggle"
            >
              <input
                id="reg-confirm"
                type={showConfirm ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={form.confirmPassword}
                onChange={(e) => set('confirmPassword', e.target.value)}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 text-[#0B2545]/45 hover:text-[#0B2545]"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </AuthField>
          </section>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#0B2545]/1 bg-white/60 px-4 py-3 text-sm text-[#0B2545]/75">
            <input
              type="checkbox"
              checked={form.agree}
              onChange={(e) => set('agree', e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#0B2545]/25 accent-[#D4A017]"
            />
            <span>
              I agree to the{' '}
              <Link
                href="/journals-portal/author-guidelines"
                className="font-semibold text-[#0B2545] underline-offset-2 hover:underline"
                target="_blank"
              >
                Author Guidelines
              </Link>{' '}
              and publication ethics of this journal.
            </span>
          </label>

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={loading} className="jp-auth-submit">
            {loading ? 'Creating account…' : 'Create author account'}
            {!loading ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-[#0B2545]/65">
          Already registered?{' '}
          <Link
            href="/journals-portal/login"
            className="font-semibold text-[#0B2545] underline-offset-2 hover:underline"
          >
            Sign in →
          </Link>
        </p>
      </JournalAuthLayout>
    </JournalPublicShell>
  );
}
