'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Monitor,
  Phone,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { api } from '@/services/api';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';

type StrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

function parseDevice() {
  if (typeof navigator === 'undefined') {
    return { browser: 'Browser', os: 'Device', isMobile: false };
  }
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  let browser = 'Browser';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) browser = 'Safari';

  let os = 'Unknown';
  if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { browser, os, isMobile };
}

function passwordChecks(password: string) {
  return {
    minLength: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function strengthFromChecks(password: string): {
  level: StrengthLevel;
  score: number;
  label: string;
} {
  if (!password) return { level: 'empty', score: 0, label: 'Enter a password' };
  const c = passwordChecks(password);
  const score = [c.minLength, c.upper, c.lower, c.number, c.special].filter(Boolean).length;
  if (score <= 2) return { level: 'weak', score: score * 20, label: 'Weak' };
  if (score === 3) return { level: 'fair', score: 60, label: 'Fair' };
  if (score === 4) return { level: 'good', score: 80, label: 'Good' };
  return { level: 'strong', score: 100, label: 'Strong' };
}

function strengthColor(level: StrengthLevel) {
  switch (level) {
    case 'weak':
      return 'bg-destructive';
    case 'fair':
      return 'bg-amber-500';
    case 'good':
      return 'bg-sky-500';
    case 'strong':
      return 'bg-emerald-500';
    default:
      return 'bg-muted-foreground/30';
  }
}

function statusTone(kind: 'strong' | 'warn' | 'danger' | 'neutral') {
  switch (kind) {
    case 'strong':
      return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'warn':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'danger':
      return 'border-destructive/30 bg-destructive/10 text-destructive';
    default:
      return 'border-border/50 bg-muted/40 text-muted-foreground';
  }
}

function PasswordField({
  id,
  label,
  icon,
  value,
  onChange,
  show,
  onToggle,
  onKeyUp,
  autoComplete,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={onKeyUp}
          className="w-full rounded-[14px] border border-border/60 bg-background/80 py-2.5 pl-10 pr-11 text-sm outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={onToggle}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

const cardMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
};

export function StaffSecurityTab() {
  const device = useMemo(() => parseDevice(), []);
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [pending, setPending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [revokePending, setRevokePending] = useState(false);
  const [revokeMsg, setRevokeMsg] = useState<string | null>(null);

  const checks = passwordChecks(newPassword);
  const strength = strengthFromChecks(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const allChecksPass = Object.values(checks).every(Boolean);
  const canSubmit = currentPassword.length > 0 && allChecksPass && passwordsMatch && !pending;

  const nowLabel = useMemo(
    () =>
      new Date().toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      }),
    [],
  );

  useEffect(() => {
    if (!success) return;
    const t = window.setTimeout(() => setSuccess(false), 2800);
    return () => window.clearTimeout(t);
  }, [success]);

  async function onUpdatePassword() {
    if (!canSubmit) return;
    setPending(true);
    setMsg(null);
    setSuccess(false);
    try {
      await api.post('/v1/auth/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrent('');
      setNew('');
      setConfirm('');
      setSuccess(true);
      setMsg({ type: 'ok', text: 'Password updated successfully.' });
    } catch (e) {
      setMsg({ type: 'err', text: apiErrorMessage(e, 'Unable to change password') });
    } finally {
      setPending(false);
    }
  }

  async function onLogoutOthers() {
    const ok = window.confirm(
      'This signs out all sessions, including this device. You will need to log in again. Continue?',
    );
    if (!ok) return;
    setRevokePending(true);
    setRevokeMsg(null);
    try {
      await api.post('/v1/auth/sessions/revoke-all');
      setRevokeMsg('All sessions signed out. Redirecting to login…');
      window.location.href = '/login';
    } catch (e) {
      setRevokeMsg(apiErrorMessage(e, 'Unable to revoke sessions'));
      setRevokePending(false);
    }
  }

  const requirementRows: { ok: boolean; label: string }[] = [
    { ok: checks.minLength, label: 'Minimum 8 characters' },
    { ok: checks.upper, label: 'Uppercase letter' },
    { ok: checks.lower, label: 'Lowercase letter' },
    { ok: checks.number, label: 'Number' },
    { ok: checks.special, label: 'Special character' },
  ];

  return (
    <div className="space-y-5">
      <motion.div {...cardMotion}>
        <div className="relative overflow-hidden rounded-[18px] border border-border/40 bg-gradient-to-br from-primary/10 via-background to-sky-500/5 p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Password & Security</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Protect your account by using a strong password and keeping your account secure.
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Password Management */}
          <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.05 }}>
            <GlassCard className="overflow-hidden rounded-[18px] p-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <div className="border-b border-border/40 bg-gradient-to-r from-primary/5 to-transparent px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Change Password</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Keep your account secure by updating your password regularly.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <PasswordField
                  id="current-password"
                  label="Current Password"
                  icon={<KeyRound className="h-4 w-4" />}
                  value={currentPassword}
                  onChange={setCurrent}
                  show={showCurrent}
                  onToggle={() => setShowCurrent((v) => !v)}
                  onKeyUp={(e) => setCapsOn(e.getModifierState('CapsLock'))}
                  autoComplete="current-password"
                />
                <PasswordField
                  id="new-password"
                  label="New Password"
                  icon={<Lock className="h-4 w-4" />}
                  value={newPassword}
                  onChange={setNew}
                  show={showNew}
                  onToggle={() => setShowNew((v) => !v)}
                  onKeyUp={(e) => setCapsOn(e.getModifierState('CapsLock'))}
                  autoComplete="new-password"
                />
                <PasswordField
                  id="confirm-password"
                  label="Confirm Password"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  value={confirmPassword}
                  onChange={setConfirm}
                  show={showConfirm}
                  onToggle={() => setShowConfirm((v) => !v)}
                  onKeyUp={(e) => setCapsOn(e.getModifierState('CapsLock'))}
                  autoComplete="new-password"
                />

                <AnimatePresence>
                  {capsOn ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                        Caps Lock is on
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {passwordsMatch ? (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5" /> Passwords match
                  </p>
                ) : null}
                {passwordsMismatch ? (
                  <p className="text-xs font-medium text-destructive">Passwords do not match</p>
                ) : null}

                <div className="space-y-2 rounded-[14px] border border-border/40 bg-muted/20 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Password Strength
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'rounded-full',
                        strength.level === 'strong' && statusTone('strong'),
                        strength.level === 'good' && 'border-sky-500/30 bg-sky-500/10 text-sky-700',
                        strength.level === 'fair' && statusTone('warn'),
                        strength.level === 'weak' && statusTone('danger'),
                      )}
                    >
                      {strength.label}
                    </Badge>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={cn('h-full rounded-full', strengthColor(strength.level))}
                      initial={false}
                      animate={{ width: `${strength.score}%` }}
                      transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                    />
                  </div>
                  <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {requirementRows.map((row) => (
                      <li
                        key={row.label}
                        className={cn(
                          'flex items-center gap-2 text-xs transition-colors',
                          row.ok
                            ? 'font-medium text-emerald-600 dark:text-emerald-400'
                            : 'text-muted-foreground',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 items-center justify-center rounded-full border',
                            row.ok
                              ? 'border-emerald-500/40 bg-emerald-500/15'
                              : 'border-border/60 bg-background',
                          )}
                        >
                          {row.ok ? <Check className="h-2.5 w-2.5" /> : null}
                        </span>
                        {row.label}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <Button
                    className="min-w-[180px] rounded-xl"
                    disabled={!canSubmit}
                    onClick={() => void onUpdatePassword()}
                  >
                    {pending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating…
                      </>
                    ) : success ? (
                      <>
                        <Check className="mr-2 h-4 w-4" /> Updated
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" /> Update Password
                      </>
                    )}
                  </Button>
                  <AnimatePresence mode="wait">
                    {msg ? (
                      <motion.p
                        key={msg.text}
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          'text-xs',
                          msg.type === 'ok'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-destructive',
                        )}
                      >
                        {msg.text}
                      </motion.p>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Security Status + 2FA */}
          <div className="grid gap-4 sm:grid-cols-2">
            <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.1 }}>
              <GlassCard className="h-full rounded-[18px] p-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <div className="border-b border-border/40 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-600">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">Security Status</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Account security overview
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  <StatusRow label="Account Security" badge="Strong" tone="strong" />
                  <StatusRow
                    label="Password Updated"
                    badge="Keep current"
                    tone="warn"
                    hint="Change every 90 days"
                  />
                  <StatusRow label="Two-Factor Authentication" badge="Not Enabled" tone="warn" />
                  <StatusRow label="Last Login" badge="Today" tone="strong" hint={nowLabel} />
                  <StatusRow
                    label="Trusted Device"
                    badge={`${device.os} · ${device.browser}`}
                    tone="neutral"
                  />
                </div>
              </GlassCard>
            </motion.div>

            <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.12 }}>
              <GlassCard className="relative h-full overflow-hidden rounded-[18px] p-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                <div className="pointer-events-none absolute -right-6 bottom-0 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
                <div className="border-b border-border/40 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/12 text-sky-600">
                      <Fingerprint className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">Two-Factor Authentication</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Protect your account with an additional layer of security.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="relative space-y-4 p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={cn('rounded-full', statusTone('warn'))}>
                      Coming Soon
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Available in a future release
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <EmptyIconTile icon={<Phone className="h-4 w-4" />} label="SMS" />
                    <EmptyIconTile icon={<Smartphone className="h-4 w-4" />} label="App" />
                    <EmptyIconTile icon={<Shield className="h-4 w-4" />} label="Shield" />
                  </div>
                  <Button className="w-full rounded-xl" variant="outline" disabled>
                    Enable 2FA
                  </Button>
                </div>
              </GlassCard>
            </motion.div>
          </div>

          {/* Login Activity */}
          <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.15 }}>
            <GlassCard className="rounded-[18px] p-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <div className="border-b border-border/40 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/12 text-violet-600">
                    <Monitor className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Recent Login Activity</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Showing your current session. Full history coming soon.
                    </p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-border/40">
                <LoginRow
                  when="Today"
                  title={device.browser}
                  subtitle={device.os}
                  time={nowLabel}
                  badge="Current Session"
                  tone="strong"
                  icon={
                    device.isMobile ? (
                      <Smartphone className="h-4 w-4" />
                    ) : (
                      <Monitor className="h-4 w-4" />
                    )
                  }
                />
                <div className="px-5 py-6 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Additional login history will appear here when available.
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Active Sessions */}
          <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.18 }}>
            <GlassCard className="rounded-[18px] p-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <div className="border-b border-border/40 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/12 text-orange-600">
                    <LogOut className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">Active Sessions</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Manage devices signed into your account.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex flex-col gap-3 rounded-[14px] border border-border/50 bg-gradient-to-br from-muted/30 to-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/40">
                      {device.isMobile ? (
                        <Smartphone className="h-4 w-4 text-primary" />
                      ) : (
                        <Monitor className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">Current Device</p>
                      <p className="text-xs text-muted-foreground">
                        {device.os} · {device.browser}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Logged in today · This session
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn('w-fit rounded-full', statusTone('strong'))}
                  >
                    Active
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    disabled={revokePending}
                    onClick={() => void onLogoutOthers()}
                  >
                    {revokePending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing out…
                      </>
                    ) : (
                      <>
                        <LogOut className="mr-2 h-4 w-4" /> Sign Out All Devices
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    Ends every session (including this one). Per-device revoke arrives later.
                  </p>
                  {revokeMsg ? (
                    <span className="text-xs text-muted-foreground">{revokeMsg}</span>
                  ) : null}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* Security Tips */}
        <motion.div
          className="lg:col-span-1"
          {...cardMotion}
          transition={{ ...cardMotion.transition, delay: 0.1 }}
        >
          <GlassCard className="sticky top-4 rounded-[18px] p-0 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="border-b border-border/40 bg-gradient-to-br from-primary/8 to-transparent px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Security Tips</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Best practices for your account
                  </p>
                </div>
              </div>
            </div>
            <ul className="space-y-3 p-5">
              {[
                'Never share your password.',
                'Change password every 90 days.',
                'Use a unique password.',
                'Enable 2FA when available.',
                'Log out from shared computers.',
              ].map((tip) => (
                <li key={tip} className="flex items-start gap-2.5 text-sm text-foreground/90">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
                    <Check className="h-3 w-3" />
                  </span>
                  {tip}
                </li>
              ))}
            </ul>
            <div className="border-t border-border/40 px-5 py-4">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Tip: A strong password uses letters, numbers, and symbols — and is not reused on
                other sites.
              </p>
              <div className="mt-3">
                <Progress value={strength.score || 12} className="h-1.5" />
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}

function StatusRow({
  label,
  badge,
  tone,
  hint,
}: {
  label: string;
  badge: string;
  tone: 'strong' | 'warn' | 'danger' | 'neutral';
  hint?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/30 pb-3 last:border-0 last:pb-0">
      <div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground/80">{hint}</p> : null}
      </div>
      <Badge
        variant="outline"
        className={cn('max-w-[55%] truncate rounded-full', statusTone(tone))}
      >
        {badge}
      </Badge>
    </div>
  );
}

function EmptyIconTile({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-[14px] border border-dashed border-border/60 bg-muted/20 px-2 py-3 text-muted-foreground">
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  );
}

function LoginRow({
  when,
  title,
  subtitle,
  time,
  badge,
  tone,
  icon,
}: {
  when: string;
  title: string;
  subtitle: string;
  time: string;
  badge: string;
  tone: 'strong' | 'warn' | 'danger' | 'neutral';
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{title}</p>
          <Badge variant="outline" className={cn('rounded-full', statusTone(tone))}>
            {badge}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {when} · {subtitle} · {time}
        </p>
      </div>
    </div>
  );
}
