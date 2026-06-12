'use client';

import Link from 'next/link';
import { Fingerprint, Radio } from 'lucide-react';

import { GlassCard } from '@/components/erp/glass-card';
import type { StaffDashboardKpis } from '@/types/staff-portal';

export function AttendanceSummaryWidget({
  attendance,
  biometricId,
  rfidNo,
  loading,
}: {
  attendance?: StaffDashboardKpis['attendance'];
  biometricId?: string | null;
  rfidNo?: string | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <GlassCard className="animate-pulse p-5">
        <div className="h-5 w-36 rounded bg-muted" />
        <div className="mt-4 h-24 rounded-xl bg-muted" />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Attendance</h3>
        <Link href="/staff/attendance" className="text-xs text-primary hover:underline">
          View details
        </Link>
      </div>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Check-in</dt>
          <dd className="font-medium">{attendance?.todayCheckIn ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Check-out</dt>
          <dd className="font-medium">{attendance?.todayCheckOut ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Device</dt>
          <dd className="truncate font-medium">{attendance?.device ?? '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Status</dt>
          <dd className="font-medium text-emerald-600 dark:text-emerald-400">
            {attendance?.status ?? '—'}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
        {biometricId ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5">
            <Fingerprint className="h-3 w-3" />
            Bio: {biometricId}
          </span>
        ) : null}
        {rfidNo ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5">
            <Radio className="h-3 w-3" />
            RFID: {rfidNo}
          </span>
        ) : null}
      </div>
    </GlassCard>
  );
}
