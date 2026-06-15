'use client';

import { Check } from 'lucide-react';
import { APPLICANT_FORM_STEPS } from './constants';
import { cn } from '@/utils/cn';

type Props = {
  currentStep: number;
  progressPercent: number;
  onStepClick?: (step: number) => void;
  readOnly?: boolean;
  maxStep?: number;
  variant?: 'default' | 'sidebar';
};

export function AdmissionsStepper({
  currentStep,
  progressPercent,
  onStepClick,
  readOnly,
  maxStep = 7,
  variant = 'default',
}: Props) {
  const isSidebar = variant === 'sidebar';

  return (
    <div className="space-y-4">
      {!isSidebar ? (
        <div>
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span>Application progress</span>
            <span className="font-semibold text-sky-300">{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      ) : null}

      <ol className="space-y-1">
        {APPLICANT_FORM_STEPS.map((step) => {
          const done = progressPercent >= Math.round((step.id / 7) * 100);
          const active = currentStep === step.id;
          const clickable = !readOnly && step.id <= maxStep;

          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={!clickable || !onStepClick}
                onClick={() => onStepClick?.(step.id)}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left text-xs transition-colors',
                  isSidebar && active && 'border border-white bg-white/95 text-[#1a2b4b] shadow-sm',
                  isSidebar && !active && 'text-slate-400 hover:bg-white/5',
                  !isSidebar && active && 'bg-sky-600/90 text-white shadow-lg shadow-sky-900/30',
                  !isSidebar && !active && done && 'bg-emerald-500/10 text-emerald-100',
                  !isSidebar && !active && !done && 'text-slate-400 hover:bg-white/5',
                  !clickable && 'cursor-default opacity-70',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    isSidebar && active && 'bg-[#2563eb] text-white',
                    isSidebar && !active && done && 'bg-emerald-500 text-white',
                    isSidebar && !active && !done && 'border border-white/30 text-slate-500',
                    !isSidebar && active && 'bg-white text-sky-700',
                    !isSidebar && !active && done && 'bg-emerald-500 text-white',
                    !isSidebar && !active && !done && 'border border-white/20 bg-white/5',
                  )}
                >
                  {done && !active ? <Check className="h-3 w-3" /> : step.id}
                </span>
                <span className="leading-tight">
                  <span className="block font-semibold">{step.title}</span>
                  {isSidebar && step.hint ? (
                    <span className="mt-0.5 block text-[10px] opacity-80">{step.hint}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
