'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
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

const STRENGTH_COLOR = {
  weak: 'bg-red-500',
  fair: 'bg-amber-500',
  good: 'bg-blue-500',
  strong: 'bg-emerald-500',
} as const;

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const clear = useAuthStore((s) => s.clear);
  const session = useAuthStore((s) => s.session);

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
      try {
        await logout();
      } catch {
        /* cookie may already be cleared */
      }
      clear();
      router.replace('/login?reset=1');
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update password. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  if (!session?.accessToken) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">Sign in first to change your password.</p>
          <Button asChild className="mt-4">
            <Link href="/login">Go to login</Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Create a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              For security, you must change the default password before accessing the ERP.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current">Current password</Label>
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new">New password</Label>
            <Input
              id="new"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {newPassword ? (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Password strength</span>
                  <span className="font-medium capitalize">{policy.strength}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full transition-all', STRENGTH_COLOR[policy.strength])}
                    style={{ width: `${policy.strengthScore}%` }}
                  />
                </div>
                <ul className="space-y-1">
                  {policy.checks.map((check) => (
                    <li
                      key={check.id}
                      className={cn(
                        'text-xs',
                        check.passed ? 'text-emerald-600' : 'text-muted-foreground',
                      )}
                    >
                      {check.passed ? '✓' : '○'} {check.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm new password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {confirmPassword && !match ? (
              <p className="text-xs text-danger">Passwords do not match.</p>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={!canSubmit}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating…
              </>
            ) : (
              'Save password and continue'
            )}
          </Button>
        </form>
      </div>
    </main>
  );
}
