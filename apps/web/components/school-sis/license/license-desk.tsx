'use client';

import { useMemo, useState, type InputHTMLAttributes } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Copy,
  Download,
  GraduationCap,
  Headphones,
  History,
  KeyRound,
  Layers,
  Link2,
  Mail,
  Package,
  Power,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuthQueryEnabled } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { useBranding } from '@/hooks/use-branding';
import { apiErrorMessage } from '@/utils/api-error';
import { cn } from '@/utils/cn';
import {
  activateSchoolLicense,
  deactivateSchoolLicense,
  fetchSchoolLicenseEvents,
  fetchSchoolLicenseStatus,
  renewSchoolLicense,
  validateSchoolLicense,
  type SchoolLicenseSnapshot,
} from '@/services/school-license';
import { canManageSchoolSis } from '@/lib/school-sis/permissions';

const MODULE_CATALOG: Array<{ id: string; label: string }> = [
  { id: 'academic', label: 'Academic' },
  { id: 'students', label: 'Students' },
  { id: 'staff', label: 'Staff' },
  { id: 'attendance', label: 'Attendance' },
  { id: 'fees', label: 'Fees' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'examination', label: 'Examination' },
  { id: 'library', label: 'Library' },
  { id: 'transport', label: 'Transport' },
  { id: 'hr_payroll', label: 'HR & Payroll' },
  { id: 'sms', label: 'SMS' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'reports', label: 'Reports' },
  { id: 'automation', label: 'Automation' },
  { id: 'mobile', label: 'Mobile App (Android)' },
  { id: 'ios', label: 'Website App (iOS)' },
  { id: 'website', label: 'Website CMS' },
];

const TONE: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  expiring_soon: 'bg-amber-50 text-amber-900 ring-amber-200',
  expiring_very_soon: 'bg-orange-50 text-orange-900 ring-orange-200',
  expired: 'bg-rose-50 text-rose-800 ring-rose-200',
  suspended: 'bg-slate-800 text-white ring-slate-700',
  revoked: 'bg-rose-700 text-white ring-rose-800',
  validation: 'bg-slate-100 text-slate-700 ring-slate-200',
  unlicensed: 'bg-slate-100 text-slate-700 ring-slate-200',
};

const DOT: Record<string, string> = {
  active: '🟢',
  expiring_soon: '🟡',
  expiring_very_soon: '🟠',
  expired: '🔴',
  validation: '⚠️',
  unlicensed: '⚠️',
  suspended: '⚫',
  revoked: '⚫',
};

function fmt(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function fmtTime(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isLicensed(snap?: SchoolLicenseSnapshot | null) {
  return Boolean(snap?.licenseKey) && snap?.tone !== 'unlicensed';
}

function moduleEnabled(snap: SchoolLicenseSnapshot | undefined, id: string) {
  if (!isLicensed(snap)) return false;
  const list = snap?.enabledModules ?? [];
  if (!list.length) return true;
  return list.includes(id);
}

export function SchoolLicenseStatusCard({
  compact,
  variant = 'card',
}: {
  compact?: boolean;
  variant?: 'card' | 'banner';
}) {
  const enabled = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['school-license'],
    queryFn: fetchSchoolLicenseStatus,
    enabled,
    staleTime: 60_000,
  });
  const snap = q.data;
  if (!snap) return null;

  if (variant === 'banner') {
    const needsKey = snap.tone === 'unlicensed' || snap.tone === 'validation' || !snap.licenseKey;
    const alert =
      snap.tone === 'expired' ||
      snap.tone === 'revoked' ||
      snap.tone === 'unlicensed' ||
      snap.tone === 'validation';
    return (
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]',
          alert
            ? 'border-rose-200 bg-gradient-to-r from-rose-50 via-white to-orange-50'
            : snap.tone === 'expiring_soon' || snap.tone === 'expiring_very_soon'
              ? 'border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50'
              : 'border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-sky-50',
        )}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            ERP License
          </p>
          <p
            className={cn(
              'mt-0.5 text-sm font-semibold',
              alert ? 'text-rose-800' : 'text-[#1a365d]',
            )}
          >
            {DOT[snap.tone] ?? '⚠️'} {snap.label}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {needsKey
              ? 'No ERP license is activated. Enter a license key from BaseCode Labs to activate this installation.'
              : `${snap.daysRemaining == null ? '—' : Math.max(snap.daysRemaining, 0)} days remaining · Expires ${fmt(snap.expiresAt)}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl bg-white/80 px-3 py-2 text-center ring-1 ring-slate-200/80">
            <p className="text-lg font-semibold tabular-nums text-[#1a365d]">
              {snap.daysRemaining == null ? '—' : Math.max(snap.daysRemaining, 0)}
            </p>
            <p className="text-[10px] uppercase tracking-wide text-slate-400">days remaining</p>
          </div>
          <a
            href="/admin/school-sis/system/license"
            className="inline-flex items-center rounded-xl bg-[#1a365d] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[#163056]"
          >
            {needsKey ? 'Enter License Key' : 'Manage license'}
          </a>
          <a
            href="/admin/school-sis/system/license"
            className="text-sm font-semibold text-sky-700 hover:underline"
          >
            View license details →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            ERP License
          </p>
          <p className="mt-1 text-lg font-semibold text-[#1a365d]">
            {DOT[snap.tone] ?? '⚠️'} {snap.label}
          </p>
        </div>
        <span
          className={cn('rounded-full px-2.5 py-1 text-xs font-semibold ring-1', TONE[snap.tone])}
        >
          {snap.licenseType ?? 'None'}
        </span>
      </div>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-[#1a365d]">
        {snap.daysRemaining == null ? '—' : Math.max(snap.daysRemaining, 0)}{' '}
        <span className="text-sm font-medium text-slate-500">days remaining</span>
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-[#1a365d]"
          style={{ width: `${snap.progress ?? 0}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-slate-600">{snap.institutionName}</p>
      <p className="text-xs text-slate-500">Expires: {fmt(snap.expiresAt)}</p>
      {snap.warning && !compact ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {snap.warning}
        </p>
      ) : null}
      <a
        href="/admin/school-sis/system/license"
        className="mt-4 inline-flex text-sm font-semibold text-[#1a365d] underline"
      >
        View license details
      </a>
    </div>
  );
}

function Field({
  icon: Icon,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { icon: typeof KeyRound }) {
  return (
    <label className="relative block">
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        {...props}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-800 outline-none ring-sky-100 placeholder:text-slate-400 focus:border-sky-300 focus:ring-4"
      />
    </label>
  );
}

export function SchoolLicenseDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.session?.user);
  const { branding, displayName } = useBranding();
  const manage = canManageSchoolSis(user?.permissions);
  const status = useQuery({
    queryKey: ['school-license'],
    queryFn: fetchSchoolLicenseStatus,
    enabled,
  });
  const events = useQuery({
    queryKey: ['school-license-events'],
    queryFn: fetchSchoolLicenseEvents,
    enabled: enabled && manage,
  });
  const [form, setForm] = useState({
    licenseKey: '',
    institutionName: branding?.displayName || displayName || 'Campus ERP',
    institutionCode: user?.tenantSlug || 'st-lukes-tura',
    adminEmail: user?.email || '',
  });
  const [renewKey, setRenewKey] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      setNotice(ok);
      await qc.invalidateQueries({ queryKey: ['school-license'] });
      await qc.invalidateQueries({ queryKey: ['school-license-events'] });
    } catch (e) {
      setNotice(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const snap = status.data;
  const licensed = isLicensed(snap);
  const days = snap?.daysRemaining == null ? null : Math.max(snap.daysRemaining, 0);
  const activeTone = snap?.tone === 'active';

  const infoLeft = useMemo(
    () => [
      ['License Status', snap?.label ?? '—'],
      ['License Type', snap?.licenseType ?? '—'],
      ['Institution ID', snap?.institutionId ?? '—'],
      ['Valid From', fmt(snap?.validFrom)],
      ['Days Remaining', days == null ? '—' : String(days)],
      ['Maximum Staff', snap?.maxStaff == null ? '—' : `${snap.staffUsed ?? 0} / ${snap.maxStaff}`],
      ['License Version', snap?.licenseVersion ?? '—'],
    ],
    [snap, days],
  );
  const infoRight = useMemo(
    () => [
      ['License Key', snap?.licenseKey ?? '—'],
      ['Institution / School', snap?.institutionName ?? '—'],
      ['Activation Date', fmt(snap?.activatedAt)],
      ['Expiry Date', fmt(snap?.expiresAt)],
      [
        'Maximum Students',
        snap?.maxStudents == null ? '—' : `${snap.studentsUsed ?? 0} / ${snap.maxStudents}`,
      ],
      ['Installations', `${snap?.installations ?? 0} / ${snap?.installationLimit ?? '—'}`],
      ['Last Validation', fmtTime(snap?.lastValidatedAt)],
      ['Next Validation', fmtTime(snap?.nextValidationAt)],
      ['License Server', snap?.licenseServerStatus ?? '—'],
    ],
    [snap],
  );

  function copyKey() {
    if (!snap?.licenseKey) return;
    void navigator.clipboard.writeText(snap.licenseKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function downloadInfo() {
    const blob = new Blob([JSON.stringify(snap ?? {}, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `st-lukes-license-${snap?.licenseKey ?? 'status'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1a365d]">
            License Management
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage your software license, activation, renewal and installation details.
          </p>
        </div>
        <p className="text-xs text-slate-400">
          Settings <span className="mx-1 text-slate-300">›</span> License Management
        </p>
      </div>

      {notice ? (
        <p
          className={cn(
            'rounded-xl border p-3 text-sm',
            /activated|validated|deactivated|renewed/i.test(notice)
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
              : 'border-rose-200 bg-rose-50 text-rose-900',
          )}
        >
          {notice}
        </p>
      ) : null}
      {snap?.warning ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {snap.warning}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                <Package className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-[#1a365d]">Campus ERP</h2>
                <p className="text-sm text-slate-500">
                  {(snap?.licenseType || 'Annual').replace(/_/g, ' ')} License
                </p>
              </div>
            </div>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1',
                TONE[snap?.tone ?? 'unlicensed'],
              )}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  activeTone ? 'bg-emerald-500' : 'bg-slate-400',
                )}
              />
              {snap?.label ?? 'Inactive'}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-4xl font-semibold tabular-nums text-[#1a365d]">
                {days == null ? '—' : days}
              </p>
              <p className="text-sm text-slate-500">days remaining</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-right">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">Valid until</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-[#1a365d]">
                <CalendarDays className="h-3.5 w-3.5 text-sky-600" />
                {fmt(snap?.expiresAt)}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-sky-500"
              style={{ width: `${licensed ? (snap?.progress ?? 0) : 0}%` }}
            />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <CalendarDays className="h-4 w-4 text-sky-500" />
              <div>
                <p className="text-[11px] text-slate-400">Activated on</p>
                <p className="font-medium text-[#1a365d]">
                  {fmt(snap?.activatedAt || snap?.validFrom)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <CalendarDays className="h-4 w-4 text-sky-500" />
              <div>
                <p className="text-[11px] text-slate-400">Expires on</p>
                <p className="font-medium text-[#1a365d]">{fmt(snap?.expiresAt)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <ShieldCheck className="h-4 w-4 text-sky-500" />
              <div>
                <p className="text-[11px] text-slate-400">License type</p>
                <p className="font-medium text-[#1a365d]">
                  {(snap?.licenseType || '—').replace(/_/g, ' ')}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: 'Max. Students',
                value: snap?.maxStudents ?? '—',
                icon: GraduationCap,
                tone: 'bg-sky-50 text-sky-600',
              },
              {
                label: 'Max. Staff',
                value: snap?.maxStaff ?? '—',
                icon: Users,
                tone: 'bg-emerald-50 text-emerald-600',
              },
              {
                label: 'Installations',
                value: snap?.installationLimit ?? '—',
                icon: Link2,
                tone: 'bg-violet-50 text-violet-600',
              },
              {
                label: 'License Version',
                value: snap?.licenseVersion ?? '—',
                icon: Layers,
                tone: 'bg-fuchsia-50 text-fuchsia-600',
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-slate-100 bg-slate-50/70 px-3 py-3"
              >
                <span
                  className={cn('flex h-8 w-8 items-center justify-center rounded-xl', item.tone)}
                >
                  <item.icon className="h-4 w-4" />
                </span>
                <p className="mt-2 text-lg font-semibold tabular-nums text-[#1a365d]">
                  {item.value}
                </p>
                <p className="text-[11px] text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {manage ? (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="flex items-start gap-2">
              <KeyRound className="mt-0.5 h-5 w-5 text-sky-600" />
              <div>
                <h3 className="font-semibold text-[#1a365d]">Activate ERP License</h3>
                <p className="text-xs text-slate-500">
                  Enter the license key provided by BaseCode Labs to activate this installation.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-2.5">
              <Field
                icon={KeyRound}
                placeholder="License key (e.g. BCL-ONC-XXXX-XXXX-XXXX)"
                value={form.licenseKey}
                onChange={(e) => setForm({ ...form, licenseKey: e.target.value })}
              />
              <p className="text-[11px] leading-relaxed text-slate-500">
                Paste a BaseCode Central OneCampus key (BCL-ONC-…) or a school key starting with
                BCL-SLS-. Institution code must be st-lukes-tura. Production ERP calls
                BASECODE_CENTRAL_URL.
              </p>
              <Field
                icon={Building2}
                placeholder="Campus ERP"
                value={form.institutionName}
                onChange={(e) => setForm({ ...form, institutionName: e.target.value })}
              />
              <Field
                icon={Building2}
                placeholder="st-lukes-tura"
                value={form.institutionCode}
                onChange={(e) => setForm({ ...form, institutionCode: e.target.value })}
              />
              <Field
                icon={Mail}
                placeholder="admin@stlukestura.in"
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              />
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                onClick={() => run(() => activateSchoolLicense(form), 'License activated.')}
              >
                <CheckCircle2 className="h-4 w-4" /> Activate License
              </button>
              <button
                type="button"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                onClick={() => run(() => validateSchoolLicense(), 'License validated.')}
              >
                <ShieldCheck className="h-4 w-4" /> Validate License
              </button>
              <button
                type="button"
                disabled={busy}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-rose-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-rose-600 disabled:opacity-60"
                onClick={() => run(() => deactivateSchoolLicense(), 'Installation deactivated.')}
              >
                <Power className="h-4 w-4" /> Deactivate Installation
              </button>
            </div>
          </section>
        ) : (
          <p className="rounded-2xl border bg-slate-50 p-5 text-sm text-slate-600">
            Only authorised administrators can activate or renew the ERP license.
          </p>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.95fr]">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-semibold text-[#1a365d]">License Information</h3>
              <p className="text-xs text-slate-500">
                Detailed information about your current license.
              </p>
            </div>
          </div>
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <dl className="space-y-2.5 text-sm">
              {infoLeft.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between gap-3 border-b border-slate-50 pb-2"
                >
                  <dt className="text-slate-500">{k}</dt>
                  <dd
                    className={cn(
                      'font-medium text-[#1a365d]',
                      k === 'License Status' && activeTone && 'text-emerald-600',
                    )}
                  >
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            <dl className="space-y-2.5 text-sm">
              {infoRight.map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-center justify-between gap-3 border-b border-slate-50 pb-2"
                >
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="flex items-center gap-1.5 font-medium text-[#1a365d]">
                    <span className="max-w-[220px] truncate">{v}</span>
                    {k === 'License Key' && snap?.licenseKey ? (
                      <button type="button" onClick={copyKey} className="text-sky-600" title="Copy">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                    {k === 'License Server' ? (
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          String(v).toLowerCase() === 'ok' ? 'bg-emerald-500' : 'bg-amber-500',
                        )}
                      />
                    ) : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          {copied ? <p className="mt-2 text-xs text-emerald-600">License key copied.</p> : null}
        </section>

        <div className="space-y-4">
          {manage ? (
            <section
              id="renew"
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
            >
              <div className="flex items-start gap-2">
                <RefreshCw className="mt-0.5 h-5 w-5 text-sky-600" />
                <div>
                  <h3 className="font-semibold text-[#1a365d]">Renew License</h3>
                  <p className="text-xs text-slate-500">
                    Current expiry: {fmt(snap?.expiresAt)}. Enter a new license key to renew.
                  </p>
                </div>
              </div>
              <input
                className="mt-3 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
                placeholder="New license key"
                value={renewKey}
                onChange={(e) => setRenewKey(e.target.value)}
              />
              <button
                type="button"
                disabled={busy}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                onClick={() => run(() => renewSchoolLicense(renewKey), 'License renewed.')}
              >
                <RefreshCw className="h-4 w-4" /> Activate Renewal
              </button>
            </section>
          ) : null}

          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <div className="mb-3 flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-sky-600" />
              <div>
                <h3 className="font-semibold text-[#1a365d]">License Actions</h3>
                <p className="text-xs text-slate-500">Additional license management options.</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              <button
                type="button"
                onClick={downloadInfo}
                className="flex w-full items-center gap-3 py-3 text-left text-sm text-[#1a365d] hover:text-sky-700"
              >
                <Download className="h-4 w-4 text-sky-600" />
                <span>
                  <span className="block font-medium">Download License Info</span>
                  <span className="text-xs font-normal text-slate-500">
                    Download current license details as a file
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowLogs((v) => !v)}
                className="flex w-full items-center gap-3 py-3 text-left text-sm text-[#1a365d] hover:text-sky-700"
              >
                <History className="h-4 w-4 text-emerald-600" />
                <span>
                  <span className="block font-medium">View Activation Logs</span>
                  <span className="text-xs font-normal text-slate-500">
                    See validation and activation history
                  </span>
                </span>
              </button>
              <a
                href="mailto:contact@basecodelabs.com?subject=St.%20Luke%27s%20license%20support"
                className="flex items-center gap-3 py-3 text-sm text-[#1a365d] hover:text-sky-700"
              >
                <Headphones className="h-4 w-4 text-violet-600" />
                <span>
                  <span className="block font-medium">Contact Support</span>
                  <span className="text-xs font-normal text-slate-500">
                    Get help from BaseCode Labs
                  </span>
                </span>
              </a>
            </div>
          </section>
        </div>
      </div>

      {showLogs && manage ? (
        <section
          id="license-activity"
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
        >
          <h3 className="font-semibold text-[#1a365d]">Activation Logs</h3>
          <ul className="mt-3 divide-y text-sm">
            {(events.data ?? []).map((e) => (
              <li key={e.id} className="flex justify-between gap-3 py-2">
                <span>{e.event}</span>
                <span className="text-xs text-slate-500">{fmtTime(e.createdAt)}</span>
              </li>
            ))}
            {!events.data?.length ? (
              <li className="py-2 text-slate-500">No activity yet.</li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-sky-600" />
            <div>
              <h3 className="font-semibold text-[#1a365d]">Enabled Modules</h3>
              <p className="text-xs text-slate-500">Modules available on your license.</p>
            </div>
          </div>
          <a
            href="#modules"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-[#1a365d]"
          >
            <Settings2 className="h-3.5 w-3.5" /> Manage Modules
          </a>
        </div>
        <div id="modules" className="flex flex-wrap gap-2">
          {MODULE_CATALOG.map((m) => {
            const on = moduleEnabled(snap, m.id);
            return (
              <span
                key={m.id}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ring-1',
                  on
                    ? 'bg-emerald-50 text-emerald-800 ring-emerald-100'
                    : 'bg-slate-50 text-slate-400 ring-slate-100',
                )}
              >
                <CheckCircle2
                  className={cn('h-3.5 w-3.5', on ? 'text-emerald-500' : 'text-slate-300')}
                />
                {m.label}
              </span>
            );
          })}
        </div>
      </section>

      {snap?.tone === 'expired' ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5">
          <h3 className="font-semibold text-rose-900">Your ERP license has expired</h3>
          <p className="mt-1 text-sm text-rose-800">License expired on: {fmt(snap.expiresAt)}</p>
          <p className="mt-2 text-sm text-rose-800">
            School data has not been deleted. Renew to restore operational modules.
          </p>
          <div className="mt-3 flex gap-2">
            <a className="rounded-lg bg-rose-800 px-3 py-2 text-sm text-white" href="#renew">
              Renew License
            </a>
            <a
              className="rounded-lg border border-rose-300 px-3 py-2 text-sm"
              href="mailto:contact@basecodelabs.com"
            >
              Contact Support
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function SchoolLicenseHeaderChip() {
  const enabled = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['school-license'],
    queryFn: fetchSchoolLicenseStatus,
    enabled,
    staleTime: 60_000,
  });
  const snap = q.data;
  if (!snap) return null;
  const text =
    snap.tone === 'expired'
      ? 'License: Expired'
      : snap.daysRemaining != null && snap.daysRemaining <= 7
        ? `License: ${Math.max(snap.daysRemaining, 0)} days left`
        : `License: ${snap.label} • ${snap.daysRemaining ?? '—'} days`;
  return (
    <a
      href="/admin/school-sis/system/license"
      className={cn(
        'hidden rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 lg:inline-flex',
        TONE[snap.tone] ?? TONE.unlicensed,
      )}
    >
      {text}
    </a>
  );
}
