'use client';

import { Check } from 'lucide-react';
import { cn } from '@/utils/cn';

export type SchoolWorkflowStep = {
  label: string;
  done?: boolean;
  current?: boolean;
};

export function SchoolWorkflowStepper({ steps }: { steps: SchoolWorkflowStep[] }) {
  return (
    <ol className="tps-doc-stepper">
      {steps.map((step, index) => {
        const n = index + 1;
        const state = step.done ? 'done' : step.current ? 'current' : 'pending';
        return (
          <li key={step.label} className={cn('tps-doc-step', `is-${state}`)}>
            <span className="tps-doc-step-num" aria-hidden>
              {step.done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : n}
            </span>
            <span className="tps-doc-step-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
