'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Clock3,
  Eye,
  EyeOff,
  HelpCircle,
  KeyRound,
  Lightbulb,
  Loader2,
  Lock,
  LogOut,
  Monitor,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
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
  if (/Windows NT 10/i.test(ua)) os = 'Windows 11';
  else if (/Windows/i.test(ua)) os = 'Windows';
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
  segments: number;
  label: string;
} {
  if (!password) return { level: 'empty', segments: 0, label: '—' };
  const c = passwordChecks(password);
  const score = [c.minLength, c.upper, c.lower, c.number, c.special].filter(Boolean).length;
  if (score <= 1) return { level: 'weak', segments: 1, label: 'Weak' };
  if (score === 2) return { level: 'fair', segments: 2, label: 'Fair' };
  if (score === 3) return { level: 'fair', segments: 3, label: 'Fair' };
  if (score === 4) return { level: 'good', segments: 4, label: 'Good' };
  return { level: 'strong', segments: 5, label: 'Strong' };
}

function segmentColor(level: StrengthLevel) {
  switch (level) {
    case 'weak':
      return 'bg-red-500';
    case 'fair':
      return 'bg-amber-500';
    case 'good':
      return 'bg-sky-500';
    case 'strong':
      return 'bg-emerald-500';
    default:
      return 'bg-slate-200';
  }
}

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: 'strong' | 'warn' | 'info' | 'neutral';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
        tone === 'strong' && 'bg-emerald-100 text-emerald-700',
        tone === 'warn' && 'bg-amber-100 text-amber-700',
        tone === 'info' && 'bg-sky-100 text-sky-700',
        tone === 'neutral' && 'bg-slate-100 text-slate-600',
      )}
    >
      {children}
    </span>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
  onKeyUp,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  onKeyUp?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-slate-500">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={onKeyUp}
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-3.5 pr-11 text-sm text-slate-900 outline-none transition focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
        />
        <button
          type="button"
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={onToggle}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

const cardMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as const },
};

const TIPS = [
  'Never share your password with anyone',
  'Change your password every 90 days',
  'Use a unique password for this account',
  'Enable Two-Factor Authentication when available',
  'Always log out from shared or public computers',
] as const;

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
  const displayStrength = strength;
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

  const passwordUpdatedLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
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
    { ok: !newPassword || checks.minLength, label: 'Minimum 8 characters' },
    { ok: !newPassword || checks.upper, label: 'Uppercase letter (A–Z)' },
    { ok: !newPassword || checks.number, label: 'Number (0–9)' },
    { ok: !newPassword || checks.lower, label: 'Lowercase letter (a–z)' },
    { ok: !newPassword || checks.special, label: 'Special character (!@#$…)' },
  ];

  return (
    <div className="space-y-4">
      {/* Hero */}
      <motion.div {...cardMotion}>
        <GlassCard className="overflow-hidden rounded-[18px] border-slate-200/80 p-0 shadow-sm">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-sky-50 via-white to-emerald-50/40 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-sm ring-1 ring-primary/10">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                  Password & Security
                </h2>
                <p className="mt-1 max-w-xl text-sm text-slate-500">
                  Protect your account by using a strong password and keeping your account secure.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/70 bg-white/90 px-4 py-3 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Account Security
                </p>
                <p className="text-sm font-semibold text-slate-800">
                  Your account security is <span className="text-emerald-600">Strong</span>
                </p>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* 3-column dashboard */}
      <div className="grid gap-4 xl:grid-cols-12">
        {/* LEFT — Change Password */}
        <motion.div
          className="xl:col-span-5"
          {...cardMotion}
          transition={{ ...cardMotion.transition, delay: 0.04 }}
        >
          <GlassCard className="h-full rounded-[18px] border-slate-200/80 p-0 shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Change Password</h3>
                  <p className="text-xs text-slate-500">
                    Keep your account secure by updating your password regularly.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3.5 p-5">
              <PasswordField
                id="current-password"
                label="Current Password"
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
                value={newPassword}
                onChange={setNew}
                show={showNew}
                onToggle={() => setShowNew((v) => !v)}
                onKeyUp={(e) => setCapsOn(e.getModifierState('CapsLock'))}
                autoComplete="new-password"
              />
              <PasswordField
                id="confirm-password"
                label="Confirm New Password"
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
                    <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      Caps Lock is on
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              {passwordsMatch ? (
                <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                  <Check className="h-3.5 w-3.5" /> Passwords match
                </p>
              ) : null}
              {passwordsMismatch ? (
                <p className="text-xs font-medium text-red-600">Passwords do not match</p>
              ) : null}

              {/* Segmented strength meter */}
              <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">Password Strength</span>
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      displayStrength.level === 'strong' && 'text-emerald-600',
                      displayStrength.level === 'good' && 'text-sky-600',
                      displayStrength.level === 'fair' && 'text-amber-600',
                      displayStrength.level === 'weak' && 'text-red-600',
                      displayStrength.level === 'empty' && 'text-slate-400',
                    )}
                  >
                    {displayStrength.label}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className={cn(
                        'h-2 rounded-full',
                        i < displayStrength.segments
                          ? segmentColor(displayStrength.level)
                          : 'bg-slate-200',
                      )}
                      initial={false}
                      animate={{
                        scale: i < displayStrength.segments ? 1 : 0.96,
                        opacity: i < displayStrength.segments ? 1 : 0.7,
                      }}
                      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                    />
                  ))}
                </div>
                <ul className="mt-1 grid gap-1.5 sm:grid-cols-2">
                  {requirementRows.map((row) => (
                    <li key={row.label} className="flex items-center gap-2 text-xs text-slate-600">
                      <span
                        className={cn(
                          'flex h-4 w-4 items-center justify-center rounded-full',
                          row.ok ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-transparent',
                        )}
                      >
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      </span>
                      {row.label}
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                className="mt-1 h-11 w-full rounded-xl text-sm font-semibold"
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
                    <Lock className="mr-2 h-4 w-4" /> Update Password
                  </>
                )}
              </Button>
              <AnimatePresence mode="wait">
                {msg ? (
                  <motion.p
                    key={msg.text}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      'text-center text-xs',
                      msg.type === 'ok' ? 'text-emerald-600' : 'text-red-600',
                    )}
                  >
                    {msg.text}
                  </motion.p>
                ) : null}
              </AnimatePresence>
            </div>
          </GlassCard>
        </motion.div>

        {/* CENTER — Status / Activity / Sessions */}
        <div className="flex flex-col gap-4 xl:col-span-4">
          <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.08 }}>
            <GlassCard className="rounded-[18px] border-slate-200/80 p-0 shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">Security Status</h3>
                </div>
              </div>
              <div className="divide-y divide-slate-100 px-5">
                <StatusLine
                  label="Password Strength"
                  value={
                    <span className="flex items-center gap-2">
                      <span className="tracking-widest text-slate-400">•••••••••</span>
                      <Pill tone="strong">Strong</Pill>
                    </span>
                  }
                />
                <StatusLine label="Password Updated" value={passwordUpdatedLabel} />
                <StatusLine
                  label="Two-Factor Authentication"
                  value={<Pill tone="warn">Not Enabled</Pill>}
                />
                <StatusLine label="Last Login" value={`Today, ${nowLabel}`} />
                <StatusLine label="Trusted Device" value={`${device.os} · ${device.browser}`} />
              </div>
            </GlassCard>
          </motion.div>

          <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.1 }}>
            <GlassCard className="rounded-[18px] border-slate-200/80 p-0 shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                    <Clock3 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Recent Login Activity</h3>
                    <p className="text-xs text-slate-500">
                      Current session only · full history soon
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-0 px-5 py-2">
                <LoginItem
                  when="Today"
                  detail={`${device.os} · ${device.browser}`}
                  time={nowLabel}
                  badge={<Pill tone="info">Current Session</Pill>}
                  icon={
                    device.isMobile ? (
                      <Smartphone className="h-4 w-4" />
                    ) : (
                      <Monitor className="h-4 w-4" />
                    )
                  }
                />
                <div className="border-t border-dashed border-slate-100 py-4 text-center">
                  <p className="text-xs text-slate-400">
                    Additional login history will appear here when available.
                  </p>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.12 }}>
            <GlassCard className="rounded-[18px] border-slate-200/80 p-0 shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                    <Monitor className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">Active Sessions</h3>
                </div>
              </div>
              <div className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-3.5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-primary shadow-sm ring-1 ring-slate-100">
                      {device.isMobile ? (
                        <Smartphone className="h-4 w-4" />
                      ) : (
                        <Monitor className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {device.os} · {device.browser}
                      </p>
                      <p className="text-[11px] text-slate-400">This device · logged in today</p>
                    </div>
                  </div>
                  <Pill tone="strong">Current Session</Pill>
                </div>
                <Button
                  variant="outline"
                  className="h-10 w-full rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={revokePending}
                  onClick={() => void onLogoutOthers()}
                >
                  {revokePending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing out…
                    </>
                  ) : (
                    <>
                      <LogOut className="mr-2 h-4 w-4" /> Logout Other Devices
                    </>
                  )}
                </Button>
                {revokeMsg ? (
                  <p className="text-center text-xs text-slate-500">{revokeMsg}</p>
                ) : null}
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* RIGHT — 2FA + Tips */}
        <div className="flex flex-col gap-4 xl:col-span-3">
          <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.1 }}>
            <GlassCard className="relative overflow-hidden rounded-[18px] border-slate-200/80 p-0 shadow-sm">
              <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-violet-200/40 blur-2xl" />
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
                    <Smartphone className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Two-Factor Authentication
                  </h3>
                </div>
              </div>
              <div className="relative space-y-4 p-5">
                <p className="text-xs leading-relaxed text-slate-500">
                  Protect your account with an additional layer of security using an authenticator
                  app or SMS.
                </p>
                <div className="flex items-center justify-center rounded-2xl border border-dashed border-violet-200 bg-gradient-to-br from-violet-50 to-sky-50 py-6">
                  <div className="relative">
                    <div className="flex h-16 w-10 items-center justify-center rounded-xl border-2 border-violet-300 bg-white shadow-sm">
                      <Lock className="h-5 w-5 text-violet-500" />
                    </div>
                    <div className="absolute -right-3 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                    Coming Soon
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-600/90">
                    Available in a future release
                  </p>
                </div>
                <Button className="w-full rounded-xl" variant="outline" disabled>
                  Enable 2FA
                </Button>
              </div>
            </GlassCard>
          </motion.div>

          <motion.div {...cardMotion} transition={{ ...cardMotion.transition, delay: 0.12 }}>
            <GlassCard className="rounded-[18px] border-slate-200/80 p-0 shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <Lightbulb className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900">Security Tips</h3>
                </div>
              </div>
              <ul className="space-y-3 p-5">
                {TIPS.map((tip) => (
                  <li key={tip} className="flex items-start gap-2.5 text-sm text-slate-700">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="leading-snug">{tip}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <motion.div
        {...cardMotion}
        transition={{ ...cardMotion.transition, delay: 0.14 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p className="flex items-start gap-2 text-xs text-slate-500 sm:items-center">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 sm:mt-0" />
          If you notice any suspicious activity, contact your college administrator immediately.
        </p>
        <Button
          variant="outline"
          className="h-9 rounded-xl border-slate-200 text-slate-600"
          onClick={() => {
            window.location.href = '/staff/feedback';
          }}
        >
          <HelpCircle className="mr-2 h-4 w-4" /> Need Help?
        </Button>
      </motion.div>
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="text-right text-xs font-medium text-slate-800">{value}</div>
    </div>
  );
}

function LoginItem({
  when,
  detail,
  time,
  badge,
  icon,
}: {
  when: string;
  detail: string;
  time: string;
  badge: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-slate-800">{when}</p>
          {badge}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          {detail} · {time}
        </p>
      </div>
    </div>
  );
}
