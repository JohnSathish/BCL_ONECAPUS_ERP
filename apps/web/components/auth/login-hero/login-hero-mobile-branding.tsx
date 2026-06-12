'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import {
  MOBILE_STATS_STRIP,
  PRIMARY_FEATURE_BADGES,
  SECONDARY_FEATURE_BADGES,
  TRUST_INDICATORS,
} from './login-hero.constants';
import { cn } from '@/utils/cn';

export function LoginHeroMobileBranding() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="login-hero-mobile-branding w-full min-w-0 space-y-2.5">
      <ul className="login-hero-feature-grid grid grid-cols-2 gap-1.5">
        {PRIMARY_FEATURE_BADGES.map(({ icon: Icon, label }) => (
          <li key={label}>
            <span className="login-hero-chip login-hero-feature-chip flex h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-[11px] font-medium text-white/90">
              <Icon className="h-3 w-3 shrink-0 text-cyan-200/90" aria-hidden />
              <span className="truncate">{label}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="login-hero-mobile-extended space-y-2.5">
        <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          {TRUST_INDICATORS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-1 text-[10px] font-medium text-white/65"
            >
              <Icon className="h-3 w-3 shrink-0 text-emerald-300/80" aria-hidden />
              {label}
            </li>
          ))}
        </ul>

        <div className="login-hero-stats-strip flex items-center justify-center divide-x divide-white/10 rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5 backdrop-blur-sm">
          {MOBILE_STATS_STRIP.map(({ value, label }) => (
            <div key={label} className="min-w-0 flex-1 px-2 text-center">
              <p className="text-[11px] font-bold tabular-nums text-white/90">{value}</p>
              <p className="truncate text-[9px] text-white/50">{label}</p>
            </div>
          ))}
        </div>

        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="login-hero-features-toggle mx-auto flex h-8 min-h-[32px] items-center gap-1 rounded-full border border-white/12 bg-white/[0.05] px-3 text-[11px] font-medium text-white/75 backdrop-blur-sm transition hover:bg-white/[0.08]"
            aria-expanded={expanded}
          >
            View Features
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
              aria-hidden
            />
          </button>

          {expanded ? (
            <ul className="mt-2 grid grid-cols-2 gap-1.5">
              {SECONDARY_FEATURE_BADGES.map(({ icon: Icon, label }) => (
                <li key={label}>
                  <span className="login-hero-chip flex h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-[10px] text-white/75">
                    <Icon className="h-3 w-3 shrink-0 text-cyan-200/70" aria-hidden />
                    <span className="truncate">{label}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
