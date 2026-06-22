'use client';

import { Check, Circle } from 'lucide-react';
import type { CareersApplicationStatus } from '@/services/careers-portal';
import { cn } from '@/utils/cn';

export function CareersStatusTracker({
  timeline,
}: {
  timeline?: CareersApplicationStatus['timeline'];
}) {
  if (!timeline) return null;

  if (timeline.rejected) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        Your application was not successful at this time. Thank you for your interest in Don Bosco
        College, Tura.
      </div>
    );
  }

  return (
    <ol className="space-y-0">
      {timeline.steps.map((step, index) => (
        <li key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
          {index < timeline.steps.length - 1 ? (
            <span
              className={cn(
                'absolute left-[11px] top-6 h-[calc(100%-12px)] w-0.5',
                step.state === 'completed' ? 'bg-emerald-500' : 'bg-slate-200',
              )}
            />
          ) : null}
          <span
            className={cn(
              'relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2',
              step.state === 'completed' && 'border-emerald-500 bg-emerald-500 text-white',
              step.state === 'current' && 'border-[#1e3a5f] bg-[#1e3a5f] text-white',
              step.state === 'upcoming' && 'border-slate-200 bg-white text-slate-400',
            )}
          >
            {step.state === 'completed' ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Circle className="h-2 w-2 fill-current" />
            )}
          </span>
          <div>
            <p
              className={cn(
                'text-sm font-semibold',
                step.state === 'current' ? 'text-[#1e3a5f]' : 'text-slate-700',
              )}
            >
              {step.label}
            </p>
            {step.state === 'current' ? (
              <p className="text-xs text-slate-500">Current stage</p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
