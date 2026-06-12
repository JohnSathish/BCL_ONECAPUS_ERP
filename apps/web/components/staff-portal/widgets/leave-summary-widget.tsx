'use client';

import Link from 'next/link';

import { GlassCard } from '@/components/erp/glass-card';
import { buttonVariants } from '@/components/ui/button';
import type { StaffDashboardKpis } from '@/types/staff-portal';
import { cn } from '@/utils/cn';

export function LeaveSummaryWidget({
  leave,
  loading,
}: {
  leave?: StaffDashboardKpis['leave'];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5">
        <div className="h-5 w-28 rounded bg-muted" />
        <div className="mt-4 h-20 rounded-xl bg-muted" />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Leave</h3>
        <Link href="/staff/leave" className="text-xs text-primary hover:underline">
          Manage
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-background/50 p-2">
          <p className="text-lg font-bold">{leave?.casual ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">CL</p>
        </div>
        <div className="rounded-lg bg-background/50 p-2">
          <p className="text-lg font-bold">{leave?.sick ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">SL</p>
        </div>
        <div className="rounded-lg bg-background/50 p-2">
          <p className="text-lg font-bold">{leave?.earned ?? 0}</p>
          <p className="text-[10px] text-muted-foreground">EL</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Pending requests: {leave?.pendingRequests ?? 0}
      </p>
      <Link
        href="/staff/leave"
        className={cn(buttonVariants({ size: 'sm' }), 'mt-3 w-full rounded-xl text-xs')}
      >
        Apply Leave
      </Link>
    </GlassCard>
  );
}
