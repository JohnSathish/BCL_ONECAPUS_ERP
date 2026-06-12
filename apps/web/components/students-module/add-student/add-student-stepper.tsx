'use client';

import { Check } from 'lucide-react';

import { WIZARD_STEPS } from '@/components/students-module/add-student/constants';
import { cn } from '@/utils/cn';

type Props = {
  stepIndex: number;
  maxReached: number;
  onStepClick: (index: number) => void;
};

export function AddStudentStepper({ stepIndex, maxReached, onStepClick }: Props) {
  const progress = ((stepIndex + 1) / WIZARD_STEPS.length) * 100;

  return (
    <div className="sticky top-0 z-30 space-y-2">
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_rgba(15,23,42,0.05)] dark:bg-card/95">
        <div className="h-1 bg-muted/80">
          <div
            className="h-full bg-gradient-to-r from-primary via-violet-500 to-accent transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <nav className="overflow-x-auto px-2 py-2 scrollbar-none" aria-label="Admission steps">
          <div className="flex min-w-max gap-1">
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
                  aria-current={active ? 'step' : undefined}
                  onClick={() => clickable && onStepClick(i)}
                  className={cn(
                    'group flex min-w-[4.5rem] flex-col items-center gap-1 rounded-xl px-2.5 py-2 text-center transition-all sm:min-w-[5.5rem]',
                    active &&
                      'bg-gradient-to-b from-primary to-violet-600 text-primary-foreground shadow-md shadow-primary/25',
                    done &&
                      !active &&
                      'bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/15 dark:text-emerald-300',
                    pending && 'text-muted-foreground',
                    clickable && !active && 'hover:bg-muted/60',
                    !clickable && 'cursor-not-allowed opacity-45',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] transition-all',
                      active && 'bg-primary-foreground/20 ring-2 ring-primary-foreground/30',
                      done && !active && 'bg-emerald-500/20',
                      pending && 'bg-muted',
                    )}
                  >
                    {done ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-semibold leading-tight sm:text-[11px]',
                      active && 'text-primary-foreground',
                    )}
                  >
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
