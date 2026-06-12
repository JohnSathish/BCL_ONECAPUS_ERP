'use client';

import { X } from 'lucide-react';
import { cn } from '@/utils/cn';

export function AccommodationAlertBanner({
  message,
  variant = 'success',
  onDismiss,
}: {
  message: string;
  variant?: 'success' | 'error';
  onDismiss?: () => void;
}) {
  if (!message) return null;
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-sm',
        variant === 'success'
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
      )}
    >
      <span>{message}</span>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 hover:bg-black/5"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
