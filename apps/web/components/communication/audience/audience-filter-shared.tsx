'use client';

import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-1 flex items-baseline justify-between gap-2">
      <label className="text-sm font-medium text-foreground">{children}</label>
      {hint ? <span className="text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function CheckList({
  options,
  values,
  onChange,
  maxHeight = 'max-h-36',
}: {
  options: { id: string; label: string }[];
  values: string[];
  onChange: (ids: string[]) => void;
  maxHeight?: string;
}) {
  const selected = new Set(values);
  return (
    <div
      className={cn('space-y-1 overflow-y-auto rounded-xl border border-border/70 p-2', maxHeight)}
    >
      {options.length === 0 ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">No options</p>
      ) : (
        options.map((o) => {
          const on = selected.has(o.id);
          return (
            <label
              key={o.id}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50',
                on && 'bg-primary/10',
              )}
            >
              <input
                type="checkbox"
                className="rounded border-border"
                checked={on}
                onChange={() => {
                  if (on) onChange(values.filter((id) => id !== o.id));
                  else onChange([...values, o.id]);
                }}
              />
              <span className="truncate">{o.label}</span>
            </label>
          );
        })
      )}
    </div>
  );
}

export const FEE_STATUS_OPTIONS = [
  { value: '', label: 'Any fee status' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PARTIAL', label: 'Partial' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'DEFAULTERS', label: 'Defaulters' },
] as const;

export const ATTENDANCE_PRESETS = [
  { label: '< 75%', below: 75, above: undefined },
  { label: '< 60%', below: 60, above: undefined },
  { label: '< 50%', below: 50, above: undefined },
  { label: '> 90%', below: undefined, above: 90 },
] as const;

export const STAFF_STATUS_OPTIONS = [
  { id: 'ACTIVE', label: 'Active' },
  { id: 'ON_LEAVE', label: 'On Leave' },
  { id: 'CONTRACT', label: 'Contract' },
  { id: 'VISITING', label: 'Visiting Faculty' },
  { id: 'RETIRED', label: 'Retired' },
] as const;
