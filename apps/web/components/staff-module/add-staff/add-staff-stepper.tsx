'use client';

import { Check } from 'lucide-react';

import { WIZARD_STEPS } from '@/components/staff-module/add-staff/constants';
import { cn } from '@/utils/cn';

type Props = {
  stepIndex: number;
  maxReached: number;
  onStepClick: (index: number) => void;
};

export function AddStaffStepper({ stepIndex, maxReached, onStepClick }: Props) {
  const progress = ((stepIndex + 1) / WIZARD_STEPS.length) * 100;

  return (
    <div className="sticky top-0 z-30 space-y-1.5">
      <div className="glass-card overflow-hidden rounded-xl border border-border/50 shadow-sm">
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-gradient-to-r from-primary via-violet-500 to-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <nav className="overflow-x-auto px-1 py-1 scrollbar-none" aria-label="Add staff steps">
          <div className="flex min-w-max gap-0.5">
            {WIZARD_STEPS.map((step, i) => {
              const Icon = step.icon;
              const active = i === stepIndex;
              const done = i < stepIndex;
              const clickable = i <= maxReached;
              const pending = !done && !active;

              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!clickable}
                  title={step.label}
                  onClick={() => clickable && onStepClick(i)}
                  className={cn(
                    'group flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-all',
                    active &&
                      'bg-gradient-to-r from-primary/90 to-violet-600/90 text-primary-foreground shadow-[var(--shadow-glow)]',
                    done &&
                      !active &&
                      'bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300',
                    pending && 'text-muted-foreground',
                    clickable && !active && 'hover:bg-muted/50',
                    !clickable && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] transition-all',
                      active && 'bg-primary-foreground/20',
                      done && !active && 'bg-emerald-500/20',
                      pending && 'bg-muted',
                    )}
                  >
                    {done ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  </span>
                  <span className="hidden text-[11px] font-medium md:inline">
                    {step.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
