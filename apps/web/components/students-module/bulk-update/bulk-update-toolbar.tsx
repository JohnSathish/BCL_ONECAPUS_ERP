'use client';

import { cn } from '@/utils/cn';
import { BULK_UPDATE_STEPS } from '@/components/students-module/bulk-update/use-bulk-update-wizard';

type Props = {
  stepIndex: number;
  selectedCount: number;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  showBack?: boolean;
};

export function BulkUpdateToolbar({
  stepIndex,
  selectedCount,
  onBack,
  onNext,
  nextLabel = 'Next',
  nextDisabled,
  showBack = true,
}: Props) {
  return (
    <div className="sticky top-0 z-30 glass-card rounded-xl border border-border/50 px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {BULK_UPDATE_STEPS.map((label, i) => (
            <span
              key={label}
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                i === stepIndex
                  ? 'bg-primary text-primary-foreground'
                  : i < stepIndex
                    ? 'bg-primary/15 text-primary'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {selectedCount > 0 ? (
            <span className="text-[11px] font-medium text-primary">{selectedCount} selected</span>
          ) : null}
          {showBack && stepIndex > 0 ? (
            <button
              type="button"
              className="rounded-lg border border-border px-2.5 py-1 text-[11px] hover:bg-muted"
              onClick={onBack}
            >
              Back
            </button>
          ) : null}
          {onNext ? (
            <button
              type="button"
              disabled={nextDisabled}
              className="rounded-lg bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground disabled:opacity-50"
              onClick={onNext}
            >
              {nextLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
