'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export function CareersAnimatedStat({
  label,
  value,
  displayText,
  suffix = '',
  icon: Icon,
  accent = 'sky',
  isLoading,
  compact,
}: {
  label: string;
  value?: number;
  displayText?: string;
  suffix?: string;
  icon?: LucideIcon;
  accent?: 'sky' | 'red' | 'emerald' | 'violet' | 'amber';
  isLoading?: boolean;
  compact?: boolean;
}) {
  const [display, setDisplay] = useState(0);
  const numericValue = value ?? 0;

  useEffect(() => {
    if (displayText || numericValue <= 0) {
      setDisplay(0);
      return;
    }
    const duration = 1400;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(numericValue * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [numericValue, displayText]);

  const accentStyles = {
    sky: 'from-sky-500/20 to-sky-600/5 text-sky-300 border-sky-400/20',
    red: 'from-red-500/20 to-red-600/5 text-red-300 border-red-400/20',
    emerald: 'from-emerald-500/20 to-emerald-600/5 text-emerald-300 border-emerald-400/20',
    violet: 'from-violet-500/20 to-violet-600/5 text-violet-300 border-violet-400/20',
    amber: 'from-amber-500/20 to-amber-600/5 text-amber-300 border-amber-400/20',
  }[accent];

  if (isLoading) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md',
          compact ? 'p-3' : 'p-5',
        )}
      >
        <div className="h-8 w-16 animate-pulse rounded-lg bg-white/10" />
        <div className="mt-2 h-3 w-20 animate-pulse rounded bg-white/10" />
      </div>
    );
  }

  const shown = displayText ?? `${display.toLocaleString('en-IN')}${suffix}`;

  return (
    <div
      className={cn(
        'group min-w-0 overflow-hidden rounded-2xl border bg-gradient-to-br backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20',
        accentStyles,
        compact ? 'p-3' : 'p-5',
      )}
    >
      <div className={cn('flex items-start gap-2', compact ? 'flex-col' : 'justify-between')}>
        <p
          className={cn(
            'min-w-0 truncate font-bold tabular-nums text-white',
            compact
              ? displayText
                ? 'text-base sm:text-lg'
                : 'text-xl sm:text-2xl'
              : displayText
                ? 'text-xl sm:text-2xl'
                : 'text-3xl sm:text-4xl',
          )}
        >
          {shown}
        </p>
        {Icon && !compact ? (
          <div className="shrink-0 rounded-xl bg-white/10 p-2 opacity-80 transition group-hover:opacity-100">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      <p
        className={cn(
          'font-medium leading-snug text-slate-300',
          compact ? 'mt-1 text-[11px] sm:text-xs' : 'mt-2 text-sm',
        )}
      >
        {label}
      </p>
    </div>
  );
}
