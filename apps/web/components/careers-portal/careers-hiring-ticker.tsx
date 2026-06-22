'use client';

import Link from 'next/link';
import { ArrowRight, Megaphone } from 'lucide-react';
import { DEFAULT_HIRING_ALERT } from '@/lib/careers-portal/constants';
import type { CareersPortalInfo } from '@/services/careers-portal';

function formatClosingDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function CareersHiringTicker({ info }: { info?: CareersPortalInfo }) {
  const alert = info?.hiringAlert;
  const roles = alert?.roles?.length ? alert.roles : [...DEFAULT_HIRING_ALERT.roles];
  const headline = alert?.headline ?? DEFAULT_HIRING_ALERT.headline;
  const closing =
    formatClosingDate(alert?.closingDate) ??
    formatClosingDate(DEFAULT_HIRING_ALERT.closingDate) ??
    'Check vacancy details';

  const tickerText = roles.join('  ·  ');

  return (
    <div className="careers-hiring-ticker relative overflow-hidden rounded-2xl border border-[#c8102e]/40 bg-gradient-to-r from-[#c8102e]/20 via-[#1e3a5f]/40 to-[#c8102e]/20">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#c8102e] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
            <Megaphone className="h-3.5 w-3.5" />
            {headline}
          </span>
          <div className="careers-ticker-mask min-w-0 flex-1 overflow-hidden">
            <p className="careers-ticker-track whitespace-nowrap text-sm font-medium text-white/95">
              {tickerText}
              <span className="mx-8 opacity-40">|</span>
              {tickerText}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4 text-sm">
          <span className="text-sky-200">
            Last Date: <strong className="text-white">{closing}</strong>
          </span>
          <Link
            href="/careers-portal/jobs"
            className="inline-flex items-center gap-1 font-semibold text-white transition hover:text-sky-200"
          >
            Apply Now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
