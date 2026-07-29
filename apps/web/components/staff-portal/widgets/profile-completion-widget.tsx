'use client';

import Link from 'next/link';
import { UserRound } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/utils/cn';

export function ProfileCompletionWidget({
  percent,
  loading,
}: {
  percent?: number;
  loading?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, percent ?? 0));
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-400';

  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5">
        <div className="h-5 w-36 rounded bg-muted" />
        <div className="mt-4 h-2 rounded-full bg-muted" />
        <div className="mt-4 h-9 rounded-xl bg-muted" />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">Profile Completion</h3>
          <p className="mt-1 text-xs text-muted-foreground">Complete your profile</p>
        </div>
        <UserRound className="h-5 w-5 text-primary" />
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="font-bold tabular-nums text-foreground">{pct}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted/60">
        <div
          className={cn('h-full rounded-full transition-all', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <Link
        href="/staff/profile"
        className={cn(buttonVariants({ size: 'sm' }), 'mt-4 w-full rounded-xl text-xs')}
      >
        Update Now
      </Link>
    </GlassCard>
  );
}
