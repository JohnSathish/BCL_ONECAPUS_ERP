'use client';

import { cn } from '@/utils/cn';

export function WidgetSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-2xl border border-border/50 bg-muted/30', className)}
    />
  );
}
