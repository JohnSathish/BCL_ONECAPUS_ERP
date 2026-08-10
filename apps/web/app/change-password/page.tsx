'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Circle, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { changePassword } from '@/services/student-portal';
import { logout } from '@/services/auth';
import { useAuthStore } from '@/store/auth-store';
import { tokenRefreshManager } from '@/lib/auth/token-refresh-manager';
import { evaluatePasswordPolicy } from '@/utils/password-policy';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

const STRENGTH_META = {
  weak: { bar: 'bg-red-500', label: 'text-red-600', width: '25%' },
  fair: { bar: 'bg-amber-500', label: 'text-amber-600', width: '50%' },
  good: { bar: 'bg-sky-500', label: 'text-sky-600', width: '75%' },
  strong: { bar: 'bg-emerald-500', label: 'text-emerald-600', width: '100%' },
} as const;

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 70% at 15% -10%, rgba(37,99,235,0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 95% 10%, rgba(185,28,28,0.22), transparent 50%), linear-gradient(165deg, #020f2e 0%, #0b1f4a 48%, #122a5c 100%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)',
        }}
      />
      <div className="relative z-10 w-full max-w-lg">{children}</div>
    </main>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  hint?: ReactNode;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-slate-700">
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 border-slate-200 bg-white pr-11 shadow-sm focus-visible:ring-[#1e3a8a]/40"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-700"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint}
    </div>
  );
}

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  const session = useAuthStore((s) => s.session);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const policy = useMemo(() => evaluatePasswordPolicy(newPassword), [newPassword]);
  const match =
    confirmPassword.length > 0 && newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit =
    Boolean(session?.accessToken) &&
    currentPassword.length > 0 &&
    policy.isValid &&
    match &&
    newPassword !== currentPassword &&
    !busy;

  const displayName = session?.user?.displayName?.trim() || session?.user?.email || 'Student';
  const strength = STRENGTH_META[policy.strength];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!policy.isValid) {
      setError(policy.firstError ?? 'Password does not meet policy requirements.');
      return;
    }
    if (!match) {
      setError('New password and confirmation do not match.');
      return;
    }
    setBusy(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      tokenRefreshManager.clearSchedule();
      clear();
      void logout().catch(() => undefined);
      router.replace('/login?reset=1');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update password. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  if (!hasHydrated || isBootstrapping) {
    return (
      <PageShell>
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/95 px-6 py-8 text-sm text-slate-600 shadow-xl backdrop-blur">
          <Loader2 className="h-4 w-4 animate-spin text-[#1e3a8a]" />
          Preparing secure password change…
        </div>
      </PageShell>
    );
  }

  if (!session?.accessToken) {
    return (
      <PageShell>
        <div className="rounded-2xl border border-white/10 bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1e3a8a]/10 text-[#1e3a8a]">
            <Lock className="h-5 w-5" />
          </div>
          <p className="text-sm text-slate-600">Sign in first to change your password.</p>
          <Button asChild className="mt-5 h-11 w-full bg-[#1e3a8a] hover:bg-[#1e40af]">
            <Link href="/login">Go to login</Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_24px_80px_-20px_rgba(2,15,46,0.65)]">
        <div className="relative overflow-hidden bg-[#020f2e] px-6 pb-8 pt-6 text-white sm:px-8">
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              background:
                'radial-gradient(ellipse 80% 90% at 0% 0%, rgba(37,99,235,0.45), transparent 55%), radial-gradient(ellipse 60% 70% at 100% 100%, rgba(185,28,28,0.28), transparent 50%)',
            }}
          />
          <div className="relative">
            <div className="mb-5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-sky-200/80">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure account setup
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                <KeyRound className="h-5 w-5 text-sky-100" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Create a new password
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">
                  Welcome, <span className="font-medium text-white">{displayName}</span>. Change the
                  default password before entering the campus portal.
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 px-6 py-7 sm:px-8">
          <PasswordField
            id="current"
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
            autoComplete="current-password"
            hint={
              <p className="text-xs text-slate-500">
                Use your roll number if this is your first login.
              </p>
            }
          />

          <PasswordField
            id="new"
            label="New password"
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />

          {newPassword ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-500">Password strength</span>
                <span className={cn('font-semibold capitalize', strength.label)}>
                  {policy.strength}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={cn('h-full rounded-full transition-all duration-300', strength.bar)}
                  style={{ width: strength.width }}
                />
              </div>
              <ul className="grid gap-1.5">
                {policy.checks.map((check) => (
                  <li
                    key={check.id}
                    className={cn(
                      'flex items-center gap-2 text-xs transition-colors',
                      check.passed ? 'text-emerald-700' : 'text-slate-500',
                    )}
                  >
                    {check.passed ? (
                      <Check className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 opacity-50" />
                    )}
                    {check.label}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <PasswordField
            id="confirm"
            label="Confirm new password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
            hint={
              confirmPassword ? (
                match ? (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                    <Check className="h-3.5 w-3.5" />
                    Passwords match
                  </p>
                ) : (
                  <p className="text-xs text-red-600">Passwords do not match.</p>
                )
              ) : null
            }
          />

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            disabled={!canSubmit}
            className="relative h-12 w-full overflow-hidden border-0 text-[15px] font-semibold text-white shadow-lg shadow-[#1e3a8a]/25 disabled:opacity-50"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-[#1e3a8a] via-[#1d4ed8] to-[#b91c1c]" />
            <span className="relative z-10 flex items-center justify-center gap-2">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Save password and continue
                </>
              )}
            </span>
          </Button>

          <p className="text-center text-[11px] leading-relaxed text-slate-400">
            After saving, you&apos;ll return to login with your new password.
          </p>
        </form>
      </div>
    </PageShell>
  );
}
