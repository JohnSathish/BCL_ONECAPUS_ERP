'use client';

import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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

export function SchoolLicenseStatusCard({ compact }: { compact?: boolean }) {
  const enabled = useAuthQueryEnabled();
  const q = useQuery({
    queryKey: ['school-license'],
    queryFn: fetchSchoolLicenseStatus,
    enabled,
    staleTime: 60_000,
  });
  const snap = q.data;
  if (!snap) return null;
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

export function SchoolLicenseDesk() {
  const enabled = useAuthQueryEnabled();
  const qc = useQueryClientSafe();
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
    institutionName: branding?.displayName || displayName || "St. Luke's Secondary School",
    institutionCode: user?.tenantSlug || 'st-lukes-tura',
    adminEmail: user?.email || '',
  });
  const [renewKey, setRenewKey] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setNotice(ok);
      await qc.invalidateQueries({ queryKey: ['school-license'] });
      await qc.invalidateQueries({ queryKey: ['school-license-events'] });
    } catch (e) {
      setNotice(apiErrorMessage(e));
    }
  };

  const snap = status.data;
  const rows = useMemo(
    () => [
      ['License Status', snap?.label ?? '—'],
      ['License Key', snap?.licenseKey ?? '—'],
      ['License Type', snap?.licenseType ?? '—'],
      ['Institution / School', snap?.institutionName ?? '—'],
      ['Institution ID', snap?.institutionId ?? '—'],
      ['Activation Date', fmt(snap?.activatedAt)],
      ['Valid from', fmt(snap?.validFrom)],
      ['Expiry Date', fmt(snap?.expiresAt)],
      ['Days Remaining', snap?.daysRemaining == null ? '—' : String(snap.daysRemaining)],
      [
        'Maximum Students',
        snap?.maxStudents == null ? '—' : `${snap.studentsUsed ?? 0} / ${snap.maxStudents}`,
      ],
      ['Maximum Staff', snap?.maxStaff == null ? '—' : `${snap.staffUsed ?? 0} / ${snap.maxStaff}`],
      ['Installations', `${snap?.installations ?? 0} / ${snap?.installationLimit ?? '—'}`],
      ['License Version', snap?.licenseVersion ?? '—'],
      ['Last Validation', fmtTime(snap?.lastValidatedAt)],
      ['Next Validation', fmtTime(snap?.nextValidationAt)],
      ['License Server', snap?.licenseServerStatus ?? '—'],
    ],
    [snap],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-[#1a365d]">License Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Signed annual ERP license for this school installation. Keys are verified on the server;
          expiry is never trusted from the browser clock.
        </p>
      </div>

      {notice ? (
        <p
          className={cn(
            'rounded-xl border p-3 text-sm',
            /activated|validated|deactivated|renewed/i.test(notice)
              ? 'border-slate-200 bg-white text-slate-800'
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

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                ERP License
              </p>
              <h2 className="mt-1 text-xl font-semibold text-[#1a365d]">
                {snap?.institutionName ?? "St. Luke's Secondary School"}
              </h2>
              <p className="text-sm text-slate-500">{snap?.licenseType ?? '—'} license</p>
            </div>
            <span
              className={cn(
                'rounded-full px-3 py-1 text-xs font-semibold ring-1',
                TONE[snap?.tone ?? 'unlicensed'],
              )}
            >
              {DOT[snap?.tone ?? 'unlicensed']} {snap?.label ?? 'Validation Required'}
            </span>
          </div>
          <p className="mt-6 text-4xl font-semibold tabular-nums text-[#1a365d]">
            {snap?.daysRemaining == null ? '—' : Math.max(snap.daysRemaining, 0)}
            <span className="ml-2 text-sm font-medium text-slate-500">days remaining</span>
          </p>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#1a365d]"
              style={{ width: `${snap?.progress ?? 0}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <p>
              <span className="text-slate-500">Activated</span>
              <br />
              {fmt(snap?.activatedAt || snap?.validFrom)}
            </p>
            <p>
              <span className="text-slate-500">Expires</span>
              <br />
              {fmt(snap?.expiresAt)}
            </p>
          </div>
        </div>

        {manage ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-[#1a365d]">Activate ERP License</h3>
            <div className="mt-3 space-y-2">
              <input
                className="h-10 w-full rounded-lg border px-3 text-sm"
                placeholder="School license key (BCL-SLS-2026-…)"
                value={form.licenseKey}
                onChange={(e) => setForm({ ...form, licenseKey: e.target.value })}
              />
              <p className="text-xs text-slate-500">
                Do not paste a Don Bosco college key (BCL-65BD-… or BCL-2026-…). Issue a school key
                at <span className="font-medium">/platform/school-licenses</span> while signed in as
                platform-admin. Keys start with BCL-SLS-.
              </p>
              <input
                className="h-10 w-full rounded-lg border px-3 text-sm"
                placeholder="Institution / school name"
                value={form.institutionName}
                onChange={(e) => setForm({ ...form, institutionName: e.target.value })}
              />
              <input
                className="h-10 w-full rounded-lg border px-3 text-sm"
                placeholder="Institution code"
                value={form.institutionCode}
                onChange={(e) => setForm({ ...form, institutionCode: e.target.value })}
              />
              <input
                className="h-10 w-full rounded-lg border px-3 text-sm"
                placeholder="Admin email"
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-lg bg-[#1a365d] px-3 py-2 text-sm font-semibold text-white"
                onClick={() => run(() => activateSchoolLicense(form), 'License activated.')}
              >
                Activate License
              </button>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => run(() => validateSchoolLicense(), 'License validated.')}
              >
                Validate License
              </button>
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm text-rose-700"
                onClick={() => run(() => deactivateSchoolLicense(), 'Installation deactivated.')}
              >
                Deactivate Installation
              </button>
            </div>
            <div className="mt-5 border-t pt-4">
              <h3 className="font-semibold text-[#1a365d]">Renew License</h3>
              <p className="mt-1 text-xs text-slate-500">
                Current expiry {fmt(snap?.expiresAt)}. Paste the new signed key from BaseCode Labs.
              </p>
              <input
                className="mt-2 h-10 w-full rounded-lg border px-3 text-sm"
                placeholder="New license key"
                value={renewKey}
                onChange={(e) => setRenewKey(e.target.value)}
              />
              <button
                type="button"
                className="mt-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => run(() => renewSchoolLicense(renewKey), 'License renewed.')}
              >
                Activate Renewal
              </button>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border bg-slate-50 p-5 text-sm text-slate-600">
            Only authorised administrators can activate or renew the ERP license.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-[#1a365d]">License Information</h3>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-slate-50 px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-slate-400">{k}</dt>
              <dd className="text-sm font-medium text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-[#1a365d]">Enabled Modules</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          {(snap?.enabledModules ?? []).length ? (
            snap?.enabledModules?.map((m) => (
              <span
                key={m}
                className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-100"
              >
                {m}
              </span>
            ))
          ) : (
            <p className="text-sm text-slate-500">No entitlements loaded.</p>
          )}
        </div>
      </div>

      {manage ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-[#1a365d]">License Activity</h3>
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
        </div>
      ) : null}

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

function useQueryClientSafe() {
  return useQueryClient();
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
