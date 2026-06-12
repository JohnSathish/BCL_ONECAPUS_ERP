'use client';

import Link from 'next/link';
import { IndianRupee } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import { Button } from '@/components/ui/button';
import type { StudentDashboardView } from '@/types/student-portal';

export function FeeWidget({
  fees,
  loading,
}: {
  fees?: StudentDashboardView['fees'];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5">
        <div className="h-5 w-24 rounded bg-muted" />
        <div className="mt-4 h-16 rounded-xl bg-muted" />
      </GlassCard>
    );
  }

  const paid = fees?.paid ?? 0;
  const due = fees?.due ?? 0;

  return (
    <GlassCard className="p-5">
      <div className="flex items-center gap-2">
        <IndianRupee className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold tracking-tight">Fee Dashboard</h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {fees?.semesterLabel ?? 'Current semester'}
      </p>
      <div className="mt-4 space-y-2 rounded-xl border border-border/50 bg-background/40 p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Paid</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            ₹{paid.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Due</span>
          <span
            className={
              due > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'font-semibold'
            }
          >
            ₹{due.toLocaleString()}
          </span>
        </div>
      </div>
      {due > 0 ? (
        <Button asChild className="mt-4 w-full rounded-xl" size="sm">
          <Link href="/student/fees">Pay Now</Link>
        </Button>
      ) : (
        <p className="mt-4 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
          All fees cleared
        </p>
      )}
    </GlassCard>
  );
}
