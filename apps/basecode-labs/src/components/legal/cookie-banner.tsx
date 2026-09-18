'use client';

import { useEffect, useState } from 'react';

const KEY = 'bcl_cc';

export type Consent = { functional: boolean; analytics: boolean };

function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  const raw = document.cookie.split('; ').find((c) => c.startsWith(`${KEY}=`));
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw.split('=').slice(1).join('='))) as Consent;
  } catch {
    return null;
  }
}

export function writeConsent(value: Consent) {
  document.cookie = `${KEY}=${encodeURIComponent(JSON.stringify(value))}; path=/; max-age=${60 * 60 * 24 * 400}; samesite=lax`;
  window.dispatchEvent(new Event('bcl-consent'));
}

function loadAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id || document.getElementById('bcl-ga')) return;
  const s = document.createElement('script');
  s.id = 'bcl-ga';
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  const i = document.createElement('script');
  i.innerHTML = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');`;
  document.head.appendChild(i);
}

export function CookieBanner() {
  const [open, setOpen] = useState(false);
  const analyticsAvailable = Boolean(process.env.NEXT_PUBLIC_GA_ID);

  useEffect(() => {
    const existing = readConsent();
    if (!existing) setOpen(true);
    else if (existing.analytics) loadAnalytics();
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.12)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          We use essential login cookies. Functional cookies count unique visitors. Analytics
          cookies load only if Google Analytics is configured and you accept them.{' '}
          <a className="font-semibold text-blue-700" href="/legal/cookie-policy">
            Cookie Policy
          </a>
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="bcl-btn bcl-btn-secondary"
            onClick={() => {
              writeConsent({ functional: false, analytics: false });
              setOpen(false);
            }}
          >
            Essential only
          </button>
          <a className="bcl-btn bcl-btn-secondary" href="/legal/cookie-policy">
            Cookie settings
          </a>
          <button
            className="bcl-btn bcl-btn-primary"
            onClick={() => {
              writeConsent({ functional: true, analytics: analyticsAvailable });
              if (analyticsAvailable) loadAnalytics();
              setOpen(false);
            }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

export function CookieSettings() {
  const [value, setValue] = useState<Consent>({ functional: false, analytics: false });
  const [saved, setSaved] = useState(false);
  const analyticsAvailable = Boolean(process.env.NEXT_PUBLIC_GA_ID);

  useEffect(() => {
    setValue(readConsent() ?? { functional: false, analytics: false });
  }, []);

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-slate-900">Cookie Settings</h2>
      <ul className="mt-4 space-y-3 text-sm">
        <li className="flex items-center justify-between gap-3">
          <span>
            <strong>Essential</strong>
            <span className="mt-0.5 block text-slate-500">Login sessions. Always active.</span>
          </span>
          <span className="text-xs font-semibold text-emerald-700">Always on</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span>
            <strong>Functional</strong>
            <span className="mt-0.5 block text-slate-500">
              Unique visitor identifier on this website.
            </span>
          </span>
          <input
            type="checkbox"
            checked={value.functional}
            onChange={(e) => setValue((v) => ({ ...v, functional: e.target.checked }))}
          />
        </li>
        <li className="flex items-center justify-between gap-3">
          <span>
            <strong>Analytics</strong>
            <span className="mt-0.5 block text-slate-500">
              {analyticsAvailable
                ? 'Google Analytics, if you opt in.'
                : 'Not configured on this deployment.'}
            </span>
          </span>
          <input
            type="checkbox"
            disabled={!analyticsAvailable}
            checked={analyticsAvailable && value.analytics}
            onChange={(e) => setValue((v) => ({ ...v, analytics: e.target.checked }))}
          />
        </li>
        <li className="flex items-center justify-between gap-3 text-slate-400">
          <span>
            <strong>Marketing</strong>
            <span className="mt-0.5 block text-slate-500">Not used on this website.</span>
          </span>
          <span className="text-xs">Off</span>
        </li>
      </ul>
      <button
        className="bcl-btn bcl-btn-primary mt-4"
        onClick={() => {
          writeConsent({
            functional: value.functional,
            analytics: analyticsAvailable && value.analytics,
          });
          if (analyticsAvailable && value.analytics) loadAnalytics();
          setSaved(true);
        }}
      >
        Save cookie settings
      </button>
      {saved ? <p className="mt-2 text-sm text-emerald-700">Cookie preferences saved.</p> : null}
    </div>
  );
}
