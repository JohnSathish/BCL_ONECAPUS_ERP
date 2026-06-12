'use client';

import { HeartPulse } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { ProgressRing } from '@/components/portal/progress-ring';
import type { StudentDashboardView } from '@/types/student-portal';
import { cn } from '@/utils/cn';

const SIGNAL_TONE: Record<string, string> = {
  good: 'bg-emerald-500',
  warn: 'bg-amber-500',
  bad: 'bg-rose-500',
  neutral: 'bg-muted-foreground/40',
};

export function HealthScoreWidget({
  health,
  loading,
}: {
  health?: StudentDashboardView['health'];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5">
        <div className="mx-auto h-24 w-24 rounded-full bg-muted" />
      </GlassCard>
    );
  }

  const tone = health?.tone ?? 'warn';
  const signals = health?.signals ?? [];

  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2">
        <HeartPulse className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold tracking-tight">Profile Health</h3>
      </div>
      <div className="mt-4 flex flex-col items-center">
        <ProgressRing
          value={health?.score ?? 0}
          tone={tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : 'warn'}
          label="Health"
          size={100}
        />
        <p
          className={cn(
            'mt-2 text-xs font-medium',
            tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
            tone === 'warn' && 'text-amber-600 dark:text-amber-400',
            tone === 'bad' && 'text-rose-600 dark:text-rose-400',
          )}
        >
          {health?.label ?? 'Calculating…'}
        </p>
      </div>
      <ul className="mt-4 space-y-1.5">
        {signals.length ? (
          signals.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{s.label}</span>
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full',
                  SIGNAL_TONE[s.tone] ?? SIGNAL_TONE.neutral,
                )}
                title={s.tone}
              />
            </li>
          ))
        ) : (
          <li className="text-xs text-muted-foreground">
            Health signals load from your profile data.
          </li>
        )}
      </ul>
    </GlassCard>
  );
}
